/**
 * 압축 해제 방식 (TODO)
 * - flatten: 압축 파일 내의 모든 일반 파일들을 단일 디렉터리로 추출 (현재 기능)
 * - preserve: 원래의 디렉터리 구조를 유지한 채 압축만 해제 (향후 구현 예정)
 */
export type UnpackMode = 'flatten' | 'preserve';

/** 압축 해제 옵션 (TODO)
 * - mode: flatten/preserve
 * - encoding: 파일명 인코딩 설정 (UTF8...)
 */
export interface UnpackOptions {
  mode: UnpackMode;
  encoding: string;
}

/**
 * 압축 해제되어 `onFile` 콜백으로 전달되는 파일
 * - `size`: ZIP Central Directory 기준 예상 출력 크기 (`uncompressedSize`)
 * - `stream`: 실제 압축 해제 데이터를 청크로 공급하는 {@link ReadableStream}
 */
export type UnpackedFile = {
  name: string; // 중복 처리까지 거친 최종 출력 파일명
  size: number; // ZIP Central Directory에 선언된 압축 해제 후 크기 (실제 스트리밍 바이트와 다를 수 있음)
  stream: ReadableStream<Uint8Array>; // 압축 해제된 데이터가 청크 단위로 흘러나오는 스트림
};

/** 압축 해제 실패한 ZIP */
export type FailedZIP = {
  name: string;
  reason: string;
};

/** UI 표시용 파일 메타 데이터 */
export type FileMeta = {
  name: string;
  size: number;
};
