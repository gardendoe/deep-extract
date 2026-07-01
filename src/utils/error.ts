export class InternalError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InternalError';
  }
}

export class PackerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PackerError';
  }
}

export class ZipBombDetectedError extends Error {
  constructor(zipName: string) {
    super(`악성으로 의심되는 파일이 감지되어 압축 해제 작업을 중단합니다. (${zipName})`);
    this.name = 'ZipBombDetectedError';
  }
}
