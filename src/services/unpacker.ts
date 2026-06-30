import type { UnpackedFile, FailedItem, UnpackOptions } from '@/types';
import { type Entry, ZipReader, BlobReader } from '@zip.js/zip.js';
import {
  OPFS_SUPPORTED,
  LOCK_SUPPORTED,
  OPFS_SESSION_PREFIX,
  ENTRIES_MAX_COUNT,
  ENTRY_MAX_RATIO,
  ENTRY_MAX_UNCOMPRESSED,
  OUTPUT_MAX_TOTAL,
} from '@/constants';
import { ZipBombDetectedError, basename, deduplicateName } from '@/utils';

/** 압축 해제 진행/완료/오류를 UI로 알리기 위한 콜백 묶음 */
type UnpackCallbacks = {
  onFile: (file: UnpackedFile) => Promise<void>;
  onProgress: (progress: number) => void;
  onFailed: (item: FailedItem) => void;
};

/** 압축 해제 실패 사유 (사용자 친화적일 것) */
const FailureReason = {
  CORRUPTED: '손상된 파일',
  TOO_MANY_ENTRIES: '파일 개수 초과',
  SIZE_UNKNOWN: '비정상 파일',
  RATIO_TOO_HIGH: '비정상 파일',
  ENTRY_TOO_LARGE: '파일 크기 초과',
  OUTPUT_TOO_LARGE: '총 용량 초과',
} as const;

/**
 * Unpacker
 *
 * - 업로드된 ZIP들은 'ZIP'으로 통칭한다.
 * - ZIP 안의 구성 요소는 '항목(Entry)'으로 통칭한다.
 * - 압축 해제되어 onFile 콜백으로 전달되는 결과물은 '파일'로 통칭한다.
 *
 * Unpacker.unpackAsync()
 *  → new Batch().processAsync() // 업로드된 ZIP 전체를 하나의 배치로 처리
 *   → (각 ZIP마다) new Pipeline(...).processZipAsync() → (각 Entry마다) processEntryAsync()
 */

/** 압축 해제 작업의 진입점 */
export default class Unpacker {
  private constructor() {}

  /**
   * 압축 해제를 시작하는 메인 메서드
   * @param files 업로드된 ZIP 목록
   * @param _options 압축 해제 옵션 (TODO)
   * @param callbacks 진행 상황/완료/오류를 UI에 알려줄 콜백 함수 모음
   * @param signal 외부에서 작업 취소 신호를 보낼 수 있는 {@link AbortSignal} 객체
   * @returns `{ skippedCount: 건너뛴 ZIP 개수, errorCount: 에러난 ZIP 개수 }`
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

  /** Packer가 압축 작업 중 OPFS에 남긴 비활성 세션 폴더를 청소한다. */
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
  private skippedCount = 0; // 건너뛴 ZIP 개수 (정책상 의도적 제외)
  private errorCount = 0; // 에러난 ZIP 개수 (예기치 못한 실패)

  // 여러 Pipeline(모든 ZIP)에 걸쳐 공유되어 수정되는 값
  private readonly usedNames = new Set<string>(); // 이미 사용된 출력 파일명 모음 (파일명 중복 방지)
  private readonly guard = { bytes: 0 }; // 총 출력 누적 바이트

  async processAsync(files: File[], callbacks: UnpackCallbacks, signal: AbortSignal): Promise<{ skippedCount: number; errorCount: number }> {
    // ZIP들을 순서대로 하나씩 처리한다.
    for (let i = 0; i < files.length; i++) {
      if (signal.aborted) break;

      try {
        // 현재 처리 중인 ZIP 전용 Pipeline을 생성하고, usedNames와 guard의 참조를 전달한다.
        const pipeline = new Pipeline(files[i], callbacks, signal, this.usedNames, this.guard);
        const { skippedCount } = await pipeline.processZipAsync();
        this.skippedCount += skippedCount;
      } catch (error) {
        // 압축 해제 작업 자체가 중단되어야 하는 에러는 위로 전파한다.
        if (error instanceof ZipBombDetectedError) throw error;

        // ZIP 자체가 손상됐거나 열 수 없는 경우 (Pipeline.processZipAsync에서 던져진 에러)
        callbacks.onFailed({ name: files[i].name, reason: FailureReason.CORRUPTED });
        this.errorCount++;
      }

      // ZIP 단위로 진행률을 갱신한다.
      callbacks.onProgress(Math.round(((i + 1) / files.length) * 100));
    }

    return {
      skippedCount: this.skippedCount,
      errorCount: this.errorCount,
    };
  }
}

/** ZIP 하나를 스트리밍 방식으로 압축 해제한다. (1 {@link Batch} : N {@link Pipeline}) */
class Pipeline {
  // Batch와 공유하는 참조 값
  private readonly zip: File; // 압축 해제 대상 ZIP
  private readonly callbacks: UnpackCallbacks;
  private readonly signal: AbortSignal;
  private readonly usedNames: Set<string>;
  private readonly guard: { bytes: number };

  constructor(zip: File, callbacks: UnpackCallbacks, signal: AbortSignal, usedNames: Set<string>, guard: { bytes: number }) {
    this.zip = zip;
    this.callbacks = callbacks;
    this.usedNames = usedNames;
    this.guard = guard;
    this.signal = signal;
  }

  /**
   * ZIP 하나를 처음부터 끝까지 처리한다.
   * @returns 건너뛴 ZIP 개수
   */
  async processZipAsync(): Promise<{ skippedCount: number }> {
    const reader = new ZipReader(new BlobReader(this.zip));

    try {
      const entries = await reader.getEntries();

      // ZIP 사전 검증 1: 항목 개수 상한 초과 시 ZIP 전체를 실패 처리한다.
      const entryCount = entries.filter((entry) => !entry.directory).length;
      if (entryCount > ENTRIES_MAX_COUNT) {
        this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.TOO_MANY_ENTRIES });
        return { skippedCount: 1 };
      }

      // 총 예상 출력 바이트
      // guard.bytes를 직접 수정하지 않고, 현재 ZIP을 처리했을 때의 예상 누적치를 시뮬레이션하기 위한 변수. (건들지 말 것)
      let projectedBytes = this.guard.bytes;

      for (const entry of entries) {
        if (entry.directory) continue;

        // ZIP 사전 검증 2: 압축 데이터는 있는데 ZIP Central Directory에 선언된 크기가 0인 경우
        // 손상된 ZIP 혹은 비표준 ZIP으로 간주하고 ZIP 전체를 실패 처리한다.
        if (entry.compressedSize > 0 && entry.uncompressedSize === 0) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.SIZE_UNKNOWN });
          return { skippedCount: 1 };
        }

        // ZIP 사전 검증 3: 항목별 압축 비율 상한을 초과한 경우 ZIP 전체를 실패 처리한다.
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > ENTRY_MAX_RATIO) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.RATIO_TOO_HIGH });
          return { skippedCount: 1 };
        }

        // ZIP 사전 검증 4: 항목별 출력 상한을 초과한 경우 ZIP 전체를 실패 처리한다.
        if (entry.uncompressedSize > ENTRY_MAX_UNCOMPRESSED) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.ENTRY_TOO_LARGE });
          return { skippedCount: 1 };
        }

        projectedBytes += entry.uncompressedSize;

        // ZIP 사전 검증 5: 총 예상 누적치가 총 출력 상한을 초과할 경우 ZIP 전체를 실패 처리한다.
        if (projectedBytes > OUTPUT_MAX_TOTAL) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.OUTPUT_TOO_LARGE });
          return { skippedCount: 1 };
        }
      }

      for (const entry of entries) {
        if (this.signal.aborted) break;
        await this.processEntryAsync(entry);
      }
    } catch (error) {
      // 사용자가 취소해서 발생한 에러는 정상 흐름으로 간주하고 무시한다.
      // 그 외 에러(ZIP 손상 등)는 위로 던져서 Batch가 처리하도록 한다.
      if (!this.signal.aborted) throw error;
    } finally {
      await reader.close();
    }

    return { skippedCount: 0 };
  }

  /**
   * ZIP 안의 항목(Entry) 하나를 처리한다.
   * @param entry 처리할 항목
   */
  private async processEntryAsync(entry: Entry): Promise<void> {
    if (entry.directory) return;

    // Zip Slip 방지: 안전한 파일명만 추출한다.
    const safeName = basename(entry.filename);
    if (!safeName) return;

    // Zip Bomb 방지: 스트리밍되는 실제 바이트를 직접 세면서 상한을 재검증한다.
    // 사전 검증을 통과했음에도 상한 초과에 걸리는 경우 → ZIP Central Directory가 조작되었을 가능성.
    let entryBytes = 0; // 현재 항목의 실제 누적 바이트
    let zipBombDetected = false;

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
      // 압축 해제되는 데이터가 청크 단위로 흘러갈 때마다 호출되는 함수
      // 해당 함수 내에서 에러가 던져져도 아래의 getDataPromise가 reject되는 형태로만 나타나며,
      // reject는 catch 블록에 의해 조용히 무시된다. (실제 처리는 zipBombDetected 플래그로 판별)
      transform: (chunk, controller) => {
        entryBytes += chunk.byteLength;
        this.guard.bytes += chunk.byteLength;

        // 현재 누적치가 항목별 출력 상한을 초과하거나 || 총 누적치가 총 출력 상한을 초과할 경우
        // 현재 항목에서 누적된 바이트를 전부 롤백하고 스트림을 강제 중단한다.
        if (entryBytes > ENTRY_MAX_UNCOMPRESSED || this.guard.bytes > OUTPUT_MAX_TOTAL) {
          this.guard.bytes -= entryBytes;
          zipBombDetected = true;
          throw new Error('entry limit exceeded');
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

    // onFile 콜백에 readable 스트림을 전달해서 데이터를 소비하게 한다.
    // 이 시점에 위 entry.getData()의 쓰기 작업도 이미 동시에 진행 중이므로,
    // writable → (transform에서 상한 검증) → readable → onFile 콜백 순으로 청크가 흐르면서 압축 해제와 데이터 소비가 동시에 일어난다.
    // onFile이 readable 스트림을 끝까지 다 읽어야 await가 완료된다.
    await this.callbacks.onFile({ name: finalName, size: entry.uncompressedSize, stream: readable });

    // onFile이 readable을 다 읽은 시점이면 getData()도 대부분 끝나 있겠지만,
    // 압축 해제 작업이 실제로 완전히 종료됐는지 명시적으로 한 번 더 확인하기 위해 await한다.
    try {
      await getDataPromise;
    } catch {
      // 상한 초과 또는 사용자 취소로 인한 에러는 이미 위에서 처리됐으므로 무시한다.
      // ZIP 손상 등 진짜 에러는 readable → Worker → FILE_ERROR 경로로 처리된다.
    }

    // 스트리밍 중 ZIP Central Directory 조작이 감지된 경우, 압축 해제 작업을 중단하기 위해 에러를 throw한다.
    if (zipBombDetected) throw new ZipBombDetectedError(this.zip.name);
  }
}
