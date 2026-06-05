/** UI 표시용 파일 메타 데이터 */
export type FileMeta = {
  name: string;
  size: number;
};

/**
 * 추출 파이프라인 내 파일 항목
 * - size: Central Directory에서 읽은 uncompressedSize
 * - stream: zip.js가 청크를 공급하는 ReadableStream
 */
export type UnpackedFile = {
  name: string;
  size: number;
  stream: ReadableStream<Uint8Array>;
};
