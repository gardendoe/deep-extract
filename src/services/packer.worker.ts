import type { WorkerInMsg, WorkerOutMsg } from '@/types';
import { ZipWriter } from '@zip.js/zip.js';
import { OUTPUT_ZIP_NAME } from '@/constants';

/** 워커 내부에서 파일 1개를 나타내는 단위 */
type FileItem = {
  name: string;
  size: number;
  stream: ReadableStream<Uint8Array>;
};

/**
 * 채널을 통해 전달되는 값
 * - {@link CANCEL_SENTINEL}: 취소 신호
 * - {@link FileItem}: 추가할 파일
 * - `null`: 정상 종료 신호
 */
type QueueItem = typeof CANCEL_SENTINEL | FileItem | null;

/** `null`과 구별하기 위한 취소 전용 심볼 */
const CANCEL_SENTINEL = Symbol('cancel');

/** {@link self.postMessage}의 타입을 {@link WorkerOutMsg}로 강제하기 위한 래퍼 함수 */
const postMessage = (message: WorkerOutMsg): void => {
  self.postMessage(message);
};

/**
 * push/pull 기반의 단방향 비동기 큐.
 * 소비자({@link pull} 호출자)가 먼저 대기 중이면 즉시 깨우고, 아니면 내부 버퍼에 쌓는다.
 * (1 {@link WorkerSession} : 1 {@link AsyncQueue<QueueItem>})
 */
class AsyncQueue<T> {
  private readonly items: T[] = []; // 소비자가 아직 없을 때 쌓아두는 버퍼
  private readonly waiters: Array<(item: T) => void> = []; // pull() 호출 후 대기 중인 소비자 목록

  /** 큐에 요소를 추가한다. 대기 중인 소비자가 있으면 버퍼를 거치지 않고 직접 전달한다. */
  push(item: T): void {
    const waiter = this.waiters.shift();
    if (waiter) waiter(item);
    else this.items.push(item);
  }

  /** 큐에서 요소를 꺼낸다. 버퍼가 비어 있으면 요소가 들어올 때까지 대기한다. */
  pull(): Promise<T> {
    if (this.items.length > 0) return Promise.resolve(this.items.shift() as T);

    const { promise, resolve } = Promise.withResolvers<T>();
    this.waiters.push(resolve);
    return promise;
  }
}

/** 워커 1회 실행에 해당하는 전체 압축 세션을 캡슐화한 클래스 (1 {@link Worker} : 1 {@link WorkerSession}) */
class WorkerSession {
  // 메인 스레드에서 전달된 QueueItem을 runAsync()의 처리 루프로 넘기는 비동기 채널
  private readonly channel = new AsyncQueue<QueueItem>();

  // CANCEL 메시지 수신 시 abort() 호출로 zipWriter.add()를 중단시킨다
  private readonly abortController = new AbortController();

  // INIT 메시지가 도착하기 전에 runAsync()가 먼저 실행되는 경우를 대비해 sessionName을 Promise로 받는다.
  // INIT 수신 시 resolveSessionName()으로 해제된다.
  private readonly sessionNamePromise: Promise<string>;
  private readonly sessionNameResolve: (name: string) => void;

  constructor() {
    const { promise, resolve } = Promise.withResolvers<string>();
    this.sessionNamePromise = promise;
    this.sessionNameResolve = resolve;
  }

  /** 메인 스레드로부터 수신한 메시지를 처리한다. */
  handleMessage(message: WorkerInMsg): void {
    switch (message.type) {
      case 'INIT':
        this.sessionNameResolve(message.sessionName);
        break;
      case 'ADD_FILE':
        this.channel.push({ name: message.name, size: message.size, stream: message.stream });
        break;
      case 'FINALIZE':
        this.channel.push(null); // 정상 종료 신호
        break;
      case 'CANCEL':
        this.abortController.abort();
        this.channel.push(CANCEL_SENTINEL); // 루프가 pull() 대기 중일 수 있으므로 명시적으로 깨운다.
        break;
    }
  }

  /** OPFS에 압축 결과물을 생성하고, 채널에서 파일을 하나씩 꺼내 ZIP에 추가하는 메인 루프 */
  async runAsync(): Promise<void> {
    const sessionName = await this.sessionNamePromise;

    // OPFS에 세션 전용 폴더와 압축 결과물 파일 핸들을 준비한다.
    const root = await navigator.storage.getDirectory();
    const dirHandle = await root.getDirectoryHandle(sessionName, { create: true });
    const fileHandle = await dirHandle.getFileHandle(OUTPUT_ZIP_NAME, { create: true });
    const writable = await fileHandle.createWritable();

    const zipWriter = new ZipWriter(writable);
    const signal = this.abortController.signal;

    try {
      for (;;) {
        const item = await this.channel.pull(); // 다음 신호가 올 때까지 대기한다.

        // null = FINALIZE: ZIP을 정상 종료한다.
        if (item === null) {
          await zipWriter.close();
          postMessage({ type: 'DONE' });
          return;
        }

        // CANCEL_SENTINEL 또는 이미 abort된 상태: writable을 버리고 세션을 중단한다.
        if (item === CANCEL_SENTINEL || signal.aborted) {
          if (item !== null && item !== CANCEL_SENTINEL) {
            (item as FileItem).stream.cancel().catch(() => {});
          }

          await writable.abort();
          postMessage({ type: 'ERROR', message: 'aborted' });
          return;
        }

        // 파일 단위 추가 시도
        try {
          await zipWriter.add(item.name, item.stream, { signal });
          postMessage({ type: 'ACK' });
        } catch (error) {
          if (signal.aborted || (error instanceof Error && error.name === 'AbortError')) throw error;

          // hasCorruptedEntries가 true이면 ZIP 구조가 손상됐을 수 있으므로 세션 전체를 에러 처리한다.
          if (zipWriter.hasCorruptedEntries) throw error instanceof Error ? error : new Error(String(error));

          // PolicySkipError이고 ZIP이 깨끗한 경우에만 FILE_SKIP으로 처리해 세션을 유지한다.
          if (error instanceof Error && error.name === 'PolicySkipError') {
            postMessage({ type: 'FILE_SKIP' });
          } else {
            postMessage({
              type: 'FILE_ERROR',
              message: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }
    } catch (error) {
      // 치명적 오류 또는 abort: writable을 폐기하고 ERROR를 반환한다. (아래 self.postMessage에서 처리)
      try {
        await writable.abort();
      } catch {
        // writable이 이미 닫혔거나 abort된 경우 무시한다.
      }

      const isAbort = error instanceof Error && error.name === 'AbortError';
      postMessage({
        type: 'ERROR',
        message: isAbort ? 'aborted' : error instanceof Error ? error.message : String(error),
      });
    }
  }
}

const session = new WorkerSession();

// 메인 스레드 메시지를 WorkerSession으로 위임한다.
self.addEventListener('message', ({ data }: MessageEvent<WorkerInMsg>) => {
  session.handleMessage(data);
});

// runAsync()의 미처리 예외를 ERROR 메시지로 변환해 메인 스레드에 알린다.
session.runAsync().catch((error) => {
  postMessage({ type: 'ERROR', message: error instanceof Error ? error.message : String(error) });
});
