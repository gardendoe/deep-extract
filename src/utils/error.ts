// 유틸 함수
export const isAbortError = (error: unknown): error is Error => {
  return error instanceof Error && error.name === 'AbortError';
};

export const errorMessage = (error: unknown): string => {
  return error instanceof Error ? error.message : String(error);
};

// 커스텀 에러 클래스
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

export class ZipCorruptedError extends Error {
  constructor(cause: unknown) {
    super(errorMessage(cause), { cause });
    this.name = 'ZipCorruptedError';
  }
}
