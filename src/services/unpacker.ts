import type { LogLevel, UnpackedFile, UnpackOptions } from '@/types';
import { type Entry, ZipReader, BlobReader } from '@zip.js/zip.js';
import { OPFS_SUPPORTED, LOCK_SUPPORTED, OPFS_SESSION_PREFIX, OUTPUT_MAX_TOTAL, ENTRIES_MAX_COUNT, ENTRY_MAX_DECOMPRESSED } from '@/constants';
import { PolicySkipError, basename, deduplicateName, formatSize } from '@/utils';

/**
 * Unpacker
 *
 * - 업로드된 ZIP들은 'ZIP'으로 통칭한다.
 * - ZIP 안의 구성 요소(처리 전)는 '항목(Entry)'으로 통칭한다.
 * - 압축 해제되어 콜백으로 전달되는 결과물(처리 후)은 '파일'로 통칭한다.
 *
 * Unpacker.unpackAsync()
 *  → new Batch().processAsync() // 업로드된 ZIP 전체를 하나의 배치로 처리
 *   → (각 ZIP마다) new Pipeline(...).processZipAsync() → (각 Entry마다) processEntryAsync()
 */

/** 압축 해제 진행/완료/오류를 UI로 알리기 위한 콜백 묶음 */
export type UnpackCallbacks = {
  onLog: (level: LogLevel, message: string) => void;
  onProgress: (progress: number) => void;
  onFile: (file: UnpackedFile) => Promise<void>; // 항목이 추출될 때마다 호출 (스트림 형태로 전달)
};

/** 압축 해제 작업의 진입점 */
export default class Unpacker {
  private constructor() {}

  /**
   * 압축 해제를 시작하는 메인 메서드
   * @param files 업로드된 ZIP 목록
   * @param _options 압축 해제 옵션 (TODO)
   * @param callbacks 진행 상황/완료/오류를 UI에 알려줄 콜백 함수 모음
   * @param signal 외부에서 작업 취소 신호를 보낼 수 있는 {@link AbortSignal} 객체
   * @returns `{ skippedCount: 건너뛴 항목 총합, errorCount: 에러난 항목 총합 }`
   */
  static async unpackAsync(
    files: File[],
    _options: UnpackOptions,
    callbacks: UnpackCallbacks,
    signal?: AbortSignal,
  ): Promise<{ skippedCount: number; errorCount: number }> {
    // OPFS 영구 저장 권한 요청 (디스크 용량 부족 시 브라우저가 임의로 삭제하는 것을 방지)
    if (OPFS_SUPPORTED) {
      try {
        void navigator.storage.persist();
      } catch (error) {
        console.warn('[Unpacker] OPFS 영구 저장 권한 요청 실패:', error);
      }
    }

    // 실제 압축 해제 작업은 Batch 객체에게 위임한다.
    return new Batch().processAsync(files, callbacks, signal ?? new AbortController().signal);
  }

  /**
   * Packer가 압축 작업 중 OPFS에 남긴 비활성 세션 폴더를 청소한다.
   */
  static async clearAsync(): Promise<void> {
    if (!OPFS_SUPPORTED || !LOCK_SUPPORTED) return;

    try {
      const root = await navigator.storage.getDirectory(); // OPFS 루트 디렉터리

      for await (const name of root.keys()) {
        if (!name.startsWith(OPFS_SESSION_PREFIX)) continue; // 세션 폴더가 아니면 건너뛴다.

        // 세션 폴더명(Packer가 생성한 sessionName)으로 Web Lock 취득을 시도한다.
        // 성공(lock 획득) → 해당 이름의 lock을 쥔 Packer가 없음 → 이미 종료된 세션 → 삭제 대상
        // 실패(lock === null) → 다른 탭의 Packer가 아직 이 lock을 쥐고 있음 → 활성 세션이므로 보존
        await navigator.locks.request(name, { mode: 'exclusive', ifAvailable: true }, async (lock) => {
          if (!lock) return;

          try {
            await root.removeEntry(name, { recursive: true });
          } catch (error) {
            console.warn(`[Unpacker] OPFS 비활성 세션 폴더 삭제 실패 (${name}):`, error);
          }
        });
      }
    } catch (error) {
      console.warn('[Unpacker] OPFS 정리 실패:', error);
    }
  }
}

/** 업로드된 모든 ZIP을 하나의 배치로 묶어 순차적으로 처리한다. */
class Batch {
  private totalSkippedCount = 0; // 건너뛴 항목 총합
  private totalErrorCount = 0; // 에러난 항목 총합

  // 여러 Pipeline(모든 ZIP)에 걸쳐 공유되어 수정되는 값
  private readonly usedNames = new Set<string>(); // 이미 사용된 출력 파일명 모음 (파일명 중복 방지)
  private readonly guard = {
    bytes: 0, // 실제로 출력 처리된 데이터의 누적 바이트 수
    exceeded: false, // 총 출력 상한 초과 여부
  };

  async processAsync(files: File[], callbacks: UnpackCallbacks, signal: AbortSignal): Promise<{ skippedCount: number; errorCount: number }> {
    callbacks.onLog('default', '추출 시작...');

    // ZIP들을 순서대로 하나씩 처리한다.
    for (let i = 0; i < files.length; i++) {
      if (this.guard.exceeded || signal.aborted) break;

      callbacks.onLog('default', `\n[${i + 1}/${files.length}] ${files[i].name}`);

      try {
        // 현재 처리 중인 ZIP 전용 Pipeline을 생성하고, usedNames와 guard의 참조를 전달한다.
        const pipeline = new Pipeline(files[i], callbacks, signal, this.usedNames, this.guard);
        const { skippedCount } = await pipeline.processZipAsync();
        this.totalSkippedCount += skippedCount;
      } catch (error) {
        // ZIP 자체가 손상됐거나 열 수 없는 경우 (Pipeline.processZipAsync에서 던져진 에러)
        callbacks.onLog('error', `\t[열기 실패] ${files[i].name}: ${(error as Error).message}`);
        this.totalErrorCount++;
      }

      // ZIP 단위로 진행률을 갱신한다.
      callbacks.onProgress(Math.round(((i + 1) / files.length) * 100));
    }

    if (this.guard.exceeded) {
      callbacks.onLog('warning', `총 출력 상한(${formatSize(OUTPUT_MAX_TOTAL)})에 도달하여 일부 ZIP이 처리되지 않았습니다.`);
    }

    return {
      skippedCount: this.totalSkippedCount,
      errorCount: this.totalErrorCount,
    };
  }
}

/** ZIP 하나를 스트리밍 방식으로 압축 해제한다. (1 {@link Batch} : N {@link Pipeline}) */
class Pipeline {
  private entryCount = 0; // 현재까지 처리 시도한 항목 개수 (Zip Bomb 방지용 카운터)
  private skippedCount = 0; // 건너뛴 항목 개수 (항목별 출력 상한 또는 총 출력 상한에 걸린 경우)

  // Session과 공유하는 참조 값
  private readonly zip: File; // 압축 해제 대상 ZIP
  private readonly callbacks: UnpackCallbacks;
  private readonly signal: AbortSignal;
  private readonly usedNames: Set<string>;
  private readonly guard: { bytes: number; exceeded: boolean };

  constructor(zip: File, callbacks: UnpackCallbacks, signal: AbortSignal, usedNames: Set<string>, guard: { bytes: number; exceeded: boolean }) {
    this.zip = zip;
    this.callbacks = callbacks;
    this.usedNames = usedNames;
    this.guard = guard;
    this.signal = signal;
  }

  /**
   * ZIP 하나를 처음부터 끝까지 처리한다.
   * @returns 건너뛴 항목 개수
   */
  async processZipAsync(): Promise<{ skippedCount: number }> {
    // File 객체를 zip.js가 읽을 수 있도록 BlobReader로 감싸서 전달해준다.
    const reader = new ZipReader(new BlobReader(this.zip));

    try {
      // ZIP 안의 항목(entry)들을 하나씩 비동기로 읽어서 순차적으로 처리한다.
      for await (const entry of reader.getEntriesGenerator()) {
        if (this.signal.aborted || this.guard.exceeded) break;
        await this.processEntryAsync(entry);
      }
    } catch (error) {
      // 사용자가 취소해서 발생한 에러는 정상 흐름으로 간주하고 무시한다.
      // 그 외 에러(ZIP 손상 등)는 위로 던져서 Batch가 처리하도록 한다.
      if (!this.signal.aborted) throw error;
    } finally {
      await reader.close();
    }

    return { skippedCount: this.skippedCount };
  }

  /**
   * ZIP 안의 항목(entry) 하나를 처리한다.
   * @param entry 처리할 항목
   */
  private async processEntryAsync(entry: Entry): Promise<void> {
    // 폴더 항목이거나 총 출력 상한을 초과한 경우 early return.
    if (entry.directory) return;
    if (this.guard.exceeded) return;

    this.entryCount++;

    // Zip Bomb 방지를 위한 항목 개수 상한 체크
    if (this.entryCount > ENTRIES_MAX_COUNT) {
      // 항목 개수 상한을 넘는 순간 경고 로그를 출력한다.
      if (this.entryCount === ENTRIES_MAX_COUNT + 1) {
        this.callbacks.onLog('warning', `\t[제한] 항목 수가 ${ENTRIES_MAX_COUNT.toLocaleString()}개를 초과해 나머지 항목을 건너뜁니다.`);
      }

      return;
    }

    // 경로 조작 공격(Zip Slip 등)을 방지하고 안전한 파일명만 추출한다.
    const safeName = basename(entry.filename);
    if (!safeName) return;

    // Zip Bomb 방지를 위한 항목별 출력 상한 체크
    // 1차 검증: ZIP Central Directory에 선언된 크기를 기준으로 빠른 차단
    // declaredSize가 0이면 스트리밍 생성된 ZIP일 수 있으므로 일단 통과시키고 2차 검증에서 잡도록 한다.
    const declaredSize = entry.uncompressedSize;
    if (declaredSize > 0 && declaredSize > ENTRY_MAX_DECOMPRESSED) {
      this.skip(
        `\t[건너뜀] ${safeName}: 파일 크기(${formatSize(declaredSize)})가 항목별 출력 상한(${formatSize(ENTRY_MAX_DECOMPRESSED)})을 초과합니다.`,
      );
      return;
    }

    // 전체 누적치 + 현재 항목의 출력 크기 > 총 출력 상한인 경우 Batch 처리를 중단한다.
    if (declaredSize > 0 && this.guard.bytes + declaredSize > OUTPUT_MAX_TOTAL) {
      this.terminate(`[중단] 총 출력 한도(${formatSize(OUTPUT_MAX_TOTAL)}) 초과`);
      return;
    }

    // 2차 검증: 실제로 스트리밍되는 바이트 수를 직접 세면서 재확인
    // declaredSize가 0이라 1차를 통과했거나, Central Directory 값이 거짓일 가능성에 대비한다.
    let entryBytes = 0; // 현재 항목의 실제 누적 바이트

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
      // 압축 해제되는 데이터가 청크 단위로 흘러갈 때마다 호출됨
      transform: (chunk, controller) => {
        entryBytes += chunk.byteLength;
        this.guard.bytes += chunk.byteLength; // 전체 누적치에도 더해준다.

        // entryBytes가 항목별 출력 상한을 초과할 경우 현재 항목을 건너뛴다.
        if (entryBytes > ENTRY_MAX_DECOMPRESSED) {
          this.guard.bytes -= chunk.byteLength; // 현재 청크만 롤백 (이전 청크들은 ZIP에 이미 기록됨)
          this.skip(`\t[건너뜀] ${safeName}: 파일 크기가 항목별 출력 상한(${formatSize(ENTRY_MAX_DECOMPRESSED)})을 초과합니다.`);
          throw new PolicySkipError('entry limit exceeded'); // 스트림 강제 중단
        }

        // 전체 누적치가 총 출력 상한을 초과할 경우 Batch 처리를 중단한다.
        if (this.guard.bytes > OUTPUT_MAX_TOTAL) {
          this.guard.bytes -= chunk.byteLength; // 현재 청크만 롤백 (이전 청크들은 ZIP에 이미 기록됨)
          this.terminate(`[중단] 총 출력 상한(${formatSize(OUTPUT_MAX_TOTAL)}) 초과`);
          throw new PolicySkipError('total limit exceeded'); // 스트림 강제 중단
        }

        // 모든 검증을 통과한 경우 정상적으로 다음 단계(readable 쪽)로 청크를 전달한다.
        controller.enqueue(chunk);
      },
    });

    // zip.js가 압축 해제 작업을 수행함과 동시에 writable 스트림으로 데이터를 흘려보낸다.
    // 쓰기 작업(writable)과 읽기 작업(onFile readable)을 동시에 수행하기 위해,
    // await하지 않고 Promise만 변수에 보관하여 백그라운드에서 진행한다.
    const getDataPromise = entry.getData(writable, { signal: this.signal });

    // 중복 파일명 넘버링 처리
    const finalName = deduplicateName(safeName, this.usedNames);
    this.usedNames.add(finalName);

    if (finalName !== safeName) {
      this.callbacks.onLog('warning', `\t! ${safeName} -> ${finalName} (파일명 중복)`);
    } else {
      this.callbacks.onLog('success', `\t+ ${finalName}`);
    }

    // onFile 콜백에 readable 스트림을 전달해서 데이터를 소비하게 한다.
    // 이 시점에 위 entry.getData()의 쓰기 작업도 이미 동시에 진행 중이므로,
    // writable → (transform에서 상한 검증) → readable → onFile 콜백 순으로 청크가 흐르면서 압축 해제와 데이터 소비가 동시에 일어난다.
    // onFile이 readable 스트림을 끝까지 다 읽어야 await가 완료된다.
    await this.callbacks.onFile({ name: finalName, size: declaredSize, stream: readable });

    // onFile이 readable을 다 읽은 시점이면 getData()도 대부분 끝나 있겠지만,
    // 압축 해제 작업이 실제로 완전히 종료됐는지 명시적으로 한 번 더 확인하기 위해 await한다.
    try {
      await getDataPromise;
    } catch {
      // 상한 초과 또는 사용자 취소로 인한 에러는 이미 위에서 처리됐으므로 무시한다.
      // ZIP 손상 등 진짜 에러는 readable → worker → FILE_ERROR 경로로 처리된다.
    }
  }

  /**
   * 현재 항목을 건너뛰고 다음 항목으로 넘어간다.
   * @param message 로그에 남길 메시지
   */
  private skip(message: string): void {
    this.skippedCount++;
    this.callbacks.onLog('warning', message);
  }

  /**
   * Batch 처리를 중단(압축 해제 작업을 조기 종료)한다.
   * @param message 로그에 남길 메시지
   */
  private terminate(message: string): void {
    this.guard.exceeded = true;
    this.skippedCount++;
    this.callbacks.onLog('error', message);
  }
}
