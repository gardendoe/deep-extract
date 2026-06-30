import type { WorkerInMsg, WorkerOutMsg, WorkerResultMsg, UnpackedFile } from '@/types';
import { WORKER_SUPPORTED, OPFS_SUPPORTED, LOCK_SUPPORTED, OPFS_SESSION_PREFIX } from '@/constants';
import WorkerProxy from './worker-proxy';

/**
 * Packer
 *
 * - 압축 대상 파일은 '파일'로 통칭한다.
 * - 압축 결과물은 OPFS 세션 폴더(workerSessionName)에 저장된다.
 * - 실제 압축 작업은 Worker(packer.worker.ts)에서 수행하며, 메인 스레드는 메시지로 제어한다.
 *
 * Packer.create() // 워커 생성 + OPFS 세션 폴더 생성 + Web Lock 취득
 *  → enqueueFileAsync() × N // 파일을 순차적으대로 워커로 전송 (백프레셔 적용)
 *   → finalizeAsync() 또는 abortAsync()
 */

/**
 * 추출된 파일들을 ZIP64 스트리밍 방식으로 압축한다.
 * 실제 압축 작업은 {@link Worker}에서 수행하며, 결과물을 OPFS에 기록한다.
 */
export default class Packer {
  // 동시에 워커로 보낼 수 있는 파일 개수 한도 (백프레셔 기준값)
  private static readonly WORKER_QUEUE_SIZE = 2;

  // 파일 처리 결과 집계
  private skippedCount = 0;
  private errorCount = 0;

  // 압축 작업의 핵심 리소스: finalize/abort 시 항상 함께 정리해야 한다.
  private worker: WorkerProxy<WorkerInMsg, WorkerOutMsg> | null = null; // 엄격한 타입 체크를 위한 Worker 래퍼 클래스
  private workerSessionName: string | null = null; // OPFS 세션 폴더명

  // enqueueFileAsync()의 백프레셔 제어용
  // 보낸 파일 수(workerPending)가 한도(WORKER_QUEUE_SIZE)를 넘으면,
  // 빈 자리가 날 때까지 대기자를 큐(workerAckWaiters)에 쌓아둔다.
  private workerPending = 0;
  private readonly workerAckWaiters: Array<() => void> = [];

  // 압축 작업 중단/종료 상태 플래그
  private aborted = false;
  private workerDone = false;

  // 워커가 전체 압축 작업에 대한 최종 응답을 보냈음을 외부에 알리는 Promise 쌍
  private workerResultPromise: Promise<WorkerResultMsg> | null = null;
  private workerResultResolve: ((message: WorkerResultMsg) => void) | null = null;
  private readonly workerDoneWaiters: Array<() => void> = []; // 최종 응답을 기다릴 때 쓰는 큐

  // create()에서 잡아둔 Web Lock을 해제하기 위한 핸들
  private sessionLockResolve: (() => void) | null = null;

  private constructor() {}

  /**
   * {@link Worker}를 띄우고, OPFS 세션 폴더 생성 + Web Lock을 취득한다.
   * @returns 생성된 {@link Packer} 인스턴스, Worker 또는 OPFS를 지원하지 않는 브라우저의 경우 `null`
   * @example const packer = Packer.create();
   *          if (!packer) throw new Error('Not supported');
   */
  static create(): Packer | null {
    if (!WORKER_SUPPORTED || !OPFS_SUPPORTED) return null;

    const packer = new Packer();
    const sessionName = Packer.generateOpfsSessionName(); // OPFS 세션 폴더명 생성
    packer.workerSessionName = sessionName;

    const worker = new WorkerProxy<WorkerInMsg, WorkerOutMsg>(new Worker(new URL('./packer.worker.ts', import.meta.url), { type: 'module' }));
    packer.worker = worker;

    const { promise: workerResultPromise, resolve: workerResultResolve } = Promise.withResolvers<WorkerResultMsg>();
    packer.workerResultPromise = workerResultPromise;
    packer.workerResultResolve = workerResultResolve;

    worker.onmessage = ({ data }) => {
      // 파일 1개에 대한 응답
      if (data.type === 'ACK' || data.type === 'FILE_ERROR') {
        packer.workerPending--; // 응답이 하나 왔으므로 workerPending을 줄인다.

        if (data.type === 'FILE_ERROR') packer.errorCount++;

        // enqueueFileAsync()에서 빈 자리를 기다리던 대기자 하나를 깨운다.
        packer.workerAckWaiters.shift()?.();
      } else {
        // 전체 압축 작업에 대한 최종 응답
        packer.workerDone = true;
        packer.workerPending = 0; // 더 이상 파일 단위 응답이 오지 않으므로 workerPending을 0으로 리셋한다.

        // workerResultPromise를 resolve하고 모든 대기자를 깨운다.
        packer.workerResultResolve?.(data);
        while (packer.workerDoneWaiters.length > 0) packer.workerDoneWaiters.shift()?.();
        while (packer.workerAckWaiters.length > 0) packer.workerAckWaiters.shift()?.();
      }
    };

    worker.onerror = ({ message }) => {
      // 워커 자체가 죽은 경우 (처리되지 않은 예외 등)
      // 대기 중인 Promise, 큐들이 영원히 멈춰있지 않도록 정리한다.
      packer.workerDone = true;
      packer.workerPending = 0;
      packer.workerResultResolve?.({ type: 'ERROR', message });

      while (packer.workerDoneWaiters.length > 0) packer.workerDoneWaiters.shift()?.();
      while (packer.workerAckWaiters.length > 0) packer.workerAckWaiters.shift()?.();
    };

    // 워커에게 이번 압축 결과를 어느 OPFS 폴더에 쓸지 알려준다.
    worker.postMessage({ type: 'INIT', sessionName });

    if (LOCK_SUPPORTED) {
      // sessionLockPromise가 resolve될 때까지 Web Lock을 점유한다. (releaseLock()이 호출되면 resolve되도록 연결해두는 것)
      // Unpacker.clearAsync()는 이 Lock으로 아직 사용 중인 세션 폴더인지를 판단한다.
      const { promise: sessionLockPromise, resolve: sessionLockResolve } = Promise.withResolvers<void>();
      packer.sessionLockResolve = sessionLockResolve;

      void navigator.locks.request(sessionName, { mode: 'exclusive' }, () => sessionLockPromise);
    }

    return packer;
  }

  /**
   * 파일 하나를 워커로 보내 ZIP 스트림에 추가한다.
   * 한도(`WORKER_QUEUE_SIZE`)만큼 이미 보낸 상태면 빈 자리가 날 때까지 대기한다.
   * @returns 정상적으로 큐에 들어갔으면 `true`, 스킵됐으면 `false`
   */
  async enqueueFileAsync(file: UnpackedFile): Promise<boolean> {
    // 백프레셔 (빈 자리가 날 때까지 대기)
    if (this.workerPending >= Packer.WORKER_QUEUE_SIZE) {
      // workerAckWaiters에 쌓여 있다가 ACK 응답 시 깨어난다.
      const { promise: ackPromise, resolve: ackResolve } = Promise.withResolvers<void>();
      this.workerAckWaiters.push(ackResolve);
      await ackPromise;
    }

    // 대기하는 동안 abortAsync() 호출 또는 워커 종료로 상태가 바뀌었을 수 있으므로 재확인한다.
    if (!this.worker || this.aborted || this.workerDone) {
      file.stream.cancel().catch(() => {}); // 사용하지 않는 스트림은 명시적으로 취소한다.
      return false;
    }

    this.workerPending++;

    // stream을 복사하지 않고 워커로 소유권을 이전한다. (이후 메인 스레드에서 사용 불가)
    this.worker.postMessage(
      {
        type: 'ADD_FILE',
        name: file.name,
        size: file.size,
        stream: file.stream,
      },
      [file.stream],
    );

    return true;
  }

  /**
   * ZIP 스트림을 마무리하고, 완성된 파일의 다운로드 URL과 정리 함수를 반환한다.
   * @returns `{ url: 다운로드 URL, dispose: URL 해제 + OPFS 세션 폴더 삭제 + Web Lock 해제 함수 }`
   */
  async finalizeAsync(): Promise<{
    url: string;
    dispose: () => Promise<void>;
    skippedCount: number;
    errorCount: number;
  }> {
    if (!this.workerResultPromise) throw new Error('내부 오류: 워커 결과 Promise가 없습니다.');

    // workerSessionName을 null로 비워서 OPFS 세션 폴더 소유권을 가져온다.
    // 이후 abortAsync()가 호출돼도 중복으로 폴더를 건드리지 않는다.
    const sessionName = this.workerSessionName;
    this.workerSessionName = null;

    if (!this.worker) throw new Error('내부 오류: 워커가 이미 종료됐습니다.');
    this.worker.postMessage({ type: 'FINALIZE' });

    // 워커가 ZIP을 마무리하고 최종 응답을 보낼 때까지 대기한다.
    const result = await this.workerResultPromise;
    this.worker.terminate();
    this.worker = null;

    // 실패 시 불완전한 결과물을 정리하고 Web Lock을 해제한다.
    if (result.type === 'ERROR') {
      if (sessionName) await Packer.deleteOpfsSessionAsync(sessionName);
      this.releaseLock();
      throw new Error(result.message);
    }

    if (!sessionName) throw new Error('내부 오류: 워커 세션명이 없습니다.');

    // OPFS에 완성된 압축 결과물을 열어서 다운로드 URL로 변환한다.
    const url = await Packer.createDownloadUrlAsync(sessionName);

    return {
      url,
      skippedCount: this.skippedCount,
      errorCount: this.errorCount,
      dispose: async () => {
        URL.revokeObjectURL(url);
        await Packer.deleteOpfsSessionAsync(sessionName);
        this.releaseLock();
      },
    };
  }

  /** 압축 작업을 중단하고 OPFS 세션 폴더를 정리한다. 중복 호출은 무시한다. */
  async abortAsync(): Promise<void> {
    if (this.aborted) return;
    this.aborted = true;

    if (this.worker) {
      this.worker.postMessage({ type: 'CANCEL' });

      // 워커가 최종 응답을 보낼 때까지 대기한다.
      let workerResponded = this.workerDone;
      if (!workerResponded) {
        await Promise.race([
          new Promise<void>((resolve) =>
            this.workerDoneWaiters.push(() => {
              workerResponded = true;
              resolve();
            }),
          ),
          new Promise<void>((resolve) => setTimeout(resolve, 5000)), // 5초 안에 응답이 없으면 타임아웃으로 처리한다.
        ]);
      }

      // 타임아웃으로 끝난 경우, workerResultPromise를 기다리는 쪽이 멈추지 않도록 강제로 ERROR를 채운다.
      if (!workerResponded) {
        this.workerResultResolve?.({ type: 'ERROR', message: 'aborted' });
      }
      this.worker.terminate();
      this.worker = null;

      // enqueueFileAsync()에서 빈 자리를 기다리던 대기자들을 깨워서 false를 반환하고 빠져나가도록 한다.
      while (this.workerAckWaiters.length > 0) {
        this.workerAckWaiters.shift()?.();
      }

      // finalizeAsync()가 소유권을 가져가지 않은 경우에만 직접 OPFS 세션 폴더를 삭제한다.
      if (this.workerSessionName) {
        await Packer.deleteOpfsSessionAsync(this.workerSessionName);
        this.workerSessionName = null;
      }
    }

    this.releaseLock();
  }

  /**
   * 고유한 OPFS 세션 폴더명을 생성한다.
   * @returns `OPFS_SESSION_PREFIX` + UUID 조합의 폴더명
   */
  private static generateOpfsSessionName(): string {
    return `${OPFS_SESSION_PREFIX}-${crypto.randomUUID()}`;
  }

  /**
   * OPFS 세션 폴더를 삭제한다.
   * @param sessionName 삭제할 OPFS 세션 폴더명
   */
  private static async deleteOpfsSessionAsync(sessionName: string): Promise<void> {
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(sessionName, { recursive: true });
    } catch {
      // 삭제 실패(이미 삭제됐거나 처음부터 없는 경우 등)는 치명적이지 않으므로 무시한다.
    }
  }

  /**
   * OPFS 세션 폴더에 저장된 압축 결과물을 다운로드 URL로 변환한다.
   * @param sessionName 대상 OPFS 세션 폴더명
   * @returns 다운로드 URL
   */
  private static async createDownloadUrlAsync(sessionName: string): Promise<string> {
    const root = await navigator.storage.getDirectory();
    const dirHandle = await root.getDirectoryHandle(sessionName);
    const fileHandle = await dirHandle.getFileHandle('output.zip');
    const zip = await fileHandle.getFile();
    const url = URL.createObjectURL(zip);

    return url;
  }

  /** {@link Packer.create}에서 잡아둔 Web Lock을 해제한다. */
  private releaseLock(): void {
    this.sessionLockResolve?.();
    this.sessionLockResolve = null; // null로 비워서 중복 해제 방지
  }
}
