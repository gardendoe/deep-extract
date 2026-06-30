/** ZIP 사전 검증을 통과했음에도 스트리밍 중 출력 상한을 초과한 경우 throw한다. (ZIP Central Directory 조작 의심) */
export class ZipBombDetectedError extends Error {
  constructor(zipName: string) {
    super(`의심스러운 ZIP 파일이 감지되어 압축 해제 작업을 중단합니다. (${zipName})`);
    this.name = 'ZipBombDetectedError';
  }
}
