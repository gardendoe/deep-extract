import type { UnpackedFile, FailedZIP, UnpackOptions } from '@/types';
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
  onFailed: (item: FailedZIP) => void;
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
 * - 압축 해제되어 추출된 결과물들은 '파일'로 통칭한다.
 *
 * Unpacker.unpackAsync()
 *  → new Batch().processAsync() // 업로드된 ZIP 전체를 하나의 배치로 처리
 *   → Phase 1: (각 ZIP마다) new Pipeline(...).validateAsync() // ZIP Central Directory 파싱 및 사전 검증
 *   → Phase 2: (사전 검증을 통과한 ZIP마다) pipeline.processZipAsync() // 실제 압축 해제
 *              → (각 Entry마다) processEntryAsync()
 */

/** 압축 해제 작업의 진입점 */
export default class Unpacker {
  private constructor() {}

  /**
   * 압축 해제를 시작하는 메인 메서드
   * @param zipFiles 업로드된 ZIP 목록
   * @param _options 압축 해제 옵션 (TODO)
   * @param callbacks 진행 상황/완료/오류를 UI에 알려줄 콜백 함수 모음
   * @param signal 외부에서 작업 취소 신호를 보낼 수 있는 {@link AbortSignal} 객체
   */
  static async unpackAsync(zipFiles: File[], _options: UnpackOptions, callbacks: UnpackCallbacks, signal?: AbortSignal): Promise<void> {
    // OPFS 영구 저장 권한 요청 (디스크 용량 부족 시 브라우저가 임의로 삭제하는 것을 방지)
    if (OPFS_SUPPORTED) {
      try {
        void navigator.storage.persist();
      } catch (error) {
        console.warn('[Unpacker] OPFS 영구 저장 권한 요청 실패:', error);
      }
    }

    // 실제 압축 해제 작업은 Batch에게 위임한다.
    await new Batch().processAsync(zipFiles, callbacks, signal ?? new AbortController().signal);
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
  // 여러 Pipeline(모든 ZIP)에 걸쳐 공유되어 수정되는 값
  private readonly usedNames = new Set<string>(); // 이미 사용된 출력 파일명 목록 (파일명 중복 방지)
  private readonly output = { bytes: 0 }; // 총 출력 바이트 누적치 (Zip Bomb 방어용)
  private readonly process = { bytes: 0 }; // 압축 해제 진행 바이트 누적치 (진행률 계산 분자)

  async processAsync(zipFiles: File[], callbacks: UnpackCallbacks, signal: AbortSignal): Promise<void> {
    // Phase 1: 모든 ZIP의 Central Directory를 파싱해서 사전 검증을 수행하고, 예상 출력 바이트를 산출한다.
    const validPipelines: { pipeline: Pipeline; zip: File }[] = []; // 사전 검증을 통과한 Pipeline 목록
    let totalBytes = 0; // 사전 검증을 통과한 모든 ZIP의 예상 출력 바이트 합산 (진행률 계산 분모)

    for (const zip of zipFiles) {
      if (signal.aborted) break;

      // 현재 처리 중인 ZIP 전용 Pipeline을 생성한다.
      const pipeline = new Pipeline(zip, callbacks, signal, this.usedNames, this.output);

      try {
        const zipBytes = await pipeline.validateAsync(totalBytes);
        if (zipBytes !== null) {
          totalBytes += zipBytes;
          validPipelines.push({ pipeline, zip });
        }
      } catch {
        callbacks.onFailed({ name: zip.name, reason: FailureReason.CORRUPTED });
      }
    }

    // Phase 2: 사전 검증을 통과한 ZIP만 순차적으로 압축 해제한다.
    for (const { pipeline, zip } of validPipelines) {
      if (signal.aborted) break;

      try {
        await pipeline.processZipAsync(totalBytes, this.process, callbacks.onProgress);
      } catch (error) {
        // ZIP Central Directory 조작이 감지된 경우
        // 다른 ZIP도 신뢰할 수 없으므로, 에러를 위로 던져서 압축 해제 작업 전체를 중단한다.
        if (error instanceof ZipBombDetectedError) throw error;

        callbacks.onFailed({ name: zip.name, reason: FailureReason.CORRUPTED });
      }
    }
  }
}

/** ZIP 하나를 스트리밍 방식으로 압축 해제한다. (1 {@link Batch} : N {@link Pipeline}) */
class Pipeline {
  // Batch와 공유하는 참조 값
  private readonly zip: File; // 압축 해제 대상 ZIP
  private readonly callbacks: UnpackCallbacks;
  private readonly signal: AbortSignal;
  private readonly usedNames: Set<string>;
  private readonly output: { bytes: number };

  // validateAsync에서 초기화, processZipAsync에서 사용 후 해제
  private reader: ZipReader<Blob> | null = null;
  private entries: Entry[] = []; // ZIP Central Directory에서 파싱한 각 항목의 메타데이터 목록

  constructor(zip: File, callbacks: UnpackCallbacks, signal: AbortSignal, usedNames: Set<string>, output: { bytes: number }) {
    this.zip = zip;
    this.callbacks = callbacks;
    this.usedNames = usedNames;
    this.output = output;
    this.signal = signal;
  }

  /**
   * ZIP Central Directory를 파싱해서 각 항목의 메타데이터를 캐싱하고 사전 검증을 수행한다.
   * @param prevBytes 이미 사전 검증을 통과한 이전 ZIP들의 누적 바이트 (총 출력 상한 초과 여부 체크용)
   * @returns 예상 출력 바이트 (검증 실패 시 `null`)
   */
  async validateAsync(prevBytes: number): Promise<number | null> {
    this.reader = new ZipReader<Blob>(new BlobReader(this.zip));

    // 사전 검증 성공 여부 (아래 finally에서 reader를 닫을지 판단하는 플래그)
    let validated = false;

    try {
      const entries = await this.reader.getEntries();

      // ZIP 사전 검증 1: 항목 개수 상한 초과 시 ZIP 전체를 실패 처리한다.
      const entryCount = entries.filter((entry) => !entry.directory).length;
      if (entryCount > ENTRIES_MAX_COUNT) {
        this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.TOO_MANY_ENTRIES });
        return null;
      }

      let zipBytes = 0; // 예상 출력 바이트

      for (const entry of entries) {
        if (entry.directory) continue;

        // ZIP 사전 검증 2: ZIP Central Directory에 선언된 압축 해제 후 크기가 0인 경우
        // 손상된 ZIP 혹은 비표준 ZIP으로 간주하고 ZIP 전체 실패 처리
        if (entry.compressedSize > 0 && entry.uncompressedSize === 0) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.SIZE_UNKNOWN });
          return null;
        }

        // ZIP 사전 검증 3: 항목별 압축 비율 상한을 초과한 경우 ZIP 전체 실패 처리
        if (entry.compressedSize > 0 && entry.uncompressedSize / entry.compressedSize > ENTRY_MAX_RATIO) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.RATIO_TOO_HIGH });
          return null;
        }

        // ZIP 사전 검증 4: 항목별 출력 상한을 초과한 경우 ZIP 전체 실패 처리
        if (entry.uncompressedSize > ENTRY_MAX_UNCOMPRESSED) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.ENTRY_TOO_LARGE });
          return null;
        }

        zipBytes += entry.uncompressedSize;

        // ZIP 사전 검증 5: 총 예상 누적치(이전 ZIP 포함)가 총 출력 상한을 초과할 경우 ZIP 전체 실패 처리
        if (prevBytes + zipBytes > OUTPUT_MAX_TOTAL) {
          this.callbacks.onFailed({ name: this.zip.name, reason: FailureReason.OUTPUT_TOO_LARGE });
          return null;
        }
      }

      this.entries = entries; // ZIP Central Directory 파싱 결과 캐싱 (processZipAsync에서 재사용)
      validated = true;

      return zipBytes;
    } finally {
      // 사전 검증 실패 시에는 reader가 더 이상 필요 없으므로 닫는다.
      if (!validated) {
        await this.reader.close();
        this.reader = null;
      }
    }
  }

  /**
   * {@link Pipeline.validateAsync()}에서 사전 검증을 통과한 ZIP의 캐싱된 항목들을 실제로 압축 해제한다.
   * @param totalBytes 전체 ZIP의 총 예상 출력 바이트 (진행률 계산 분모)
   * @param process {@link Batch.process}
   * @param onProgress 진행률(0~100) 갱신 콜백
   */
  async processZipAsync(totalBytes: number, process: { bytes: number }, onProgress: (progress: number) => void): Promise<void> {
    const reader = this.reader;
    if (!reader) throw new Error('[Pipeline] ZIP 사전 검증 미수행');

    try {
      for (const entry of this.entries) {
        if (this.signal.aborted) break;
        await this.processEntryAsync(entry, totalBytes, process, onProgress);
      }
    } catch (error) {
      // 사용자가 취소해서 발생한 에러는 정상 흐름으로 간주하고 무시한다.
      // 그 외 에러(ZIP 손상, Zip Bomb 의심 등)는 위로 던져서 Batch가 처리하도록 한다.
      if (!this.signal.aborted) throw error;
    } finally {
      // 압축 해제 완료 후, reader를 닫고 메모리를 해제한다.
      await reader.close();
      this.reader = null;
      this.entries = [];
    }
  }

  /**
   * ZIP 안의 항목(Entry) 하나를 압축 해제해서 스트림 형태로 Packer에게 전달한다.
   * @param entry 처리할 항목
   * @param totalBytes 전체 ZIP의 총 예상 출력 바이트 (진행률 계산 분모)
   * @param process {@link Batch.process}
   * @param onProgress 진행률(0~100) 갱신 콜백
   */
  private async processEntryAsync(
    entry: Entry,
    totalBytes: number,
    process: { bytes: number },
    onProgress: (progress: number) => void,
  ): Promise<void> {
    if (entry.directory) return;

    // Zip Slip 방어: 안전한 파일명만 추출
    const safeName = basename(entry.filename);
    if (!safeName) return;

    // Zip Bomb 방어: 스트리밍되는 실제 바이트를 직접 세면서 상한 재검증
    let entryBytes = 0; // 현재 항목의 실제 누적 바이트
    let zipBombDetected = false;

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
      // 압축 해제되는 데이터가 청크 단위로 흘러갈 때마다 호출되는 함수
      // 해당 함수 내에서 에러가 던져져도 아래의 getDataPromise가 reject되는 형태로만 나타나며,
      // reject는 catch 블록에 의해 조용히 무시된다. (실제 처리는 zipBombDetected 플래그로 판별)
      transform: (chunk, controller) => {
        entryBytes += chunk.byteLength;
        this.output.bytes += chunk.byteLength;

        // 사전 검증을 통과했음에도 스트리밍 도중 항목별 또는 총 출력 상한을 초과할 경우
        // ZIP Central Directory 조작으로 간주하고, 누적 바이트를 롤백한 뒤 스트림을 강제 중단한다.
        if (entryBytes > ENTRY_MAX_UNCOMPRESSED || this.output.bytes > OUTPUT_MAX_TOTAL) {
          this.output.bytes -= entryBytes;
          zipBombDetected = true;
          throw new Error('entry limit exceeded');
        }

        // 모든 검증을 통과한 경우 정상적으로 다음 단계(readable 쪽)로 청크를 전달한다.
        controller.enqueue(chunk);
      },
    });

    // 현재 항목을 처리하기 전 시점의 process.bytes 스냅샷
    const prevProgress = process.bytes;

    // 압축 해제 작업을 수행함과 동시에 writable 스트림으로 데이터를 흘려보낸다.
    // 쓰기 작업(writable)과 읽기 작업(onFile readable)을 동시에 수행하기 위해,
    // await하지 않고 Promise만 변수에 보관하여 백그라운드에서 진행한다.
    const getDataPromise = entry.getData(writable, {
      signal: this.signal,

      // getData()가 writable에 청크를 쓸 때마다 호출되는 함수
      onprogress: (progress) => {
        process.bytes = prevProgress + progress; // progress는 현재 항목 내 누적 바이트이므로 prevProgress에 더해준다.
        if (totalBytes > 0) onProgress(Math.round((process.bytes / totalBytes) * 100));
      },
    });

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
