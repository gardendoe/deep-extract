import type { ExtractedFile } from './archive';

export type LogType = 'line' | 'spacer';
export type LogLevel = 'default' | 'info' | 'success' | 'warning' | 'error';

export type LogEntry = {
  id: string;
  level: LogLevel;
  message: string;
};

/**
 * 추출 방식 옵션 (향후 기능 확장용)
 * - flatten: 모든 파일을 단일 디렉터리로 추출 (현재 동작)
 * - preserve: 원래의 디렉터리 구조를 유지하며 추출 (향후 구현 예정)
 */
export type ExtractionMode = 'flatten' | 'preserve';

/** 추출 설정 (향후 인코딩, 모드 등 옵션 추가 예정) */
export interface ExtractionOptions {
  mode: ExtractionMode;
  encoding: string; // 향후 파일명 인코딩 지정 기능에 사용
  maxDepth: number;
}

export type ExtractionStatus = 'idle' | 'extracting' | 'done' | 'error';

export interface ExtractionState {
  status: ExtractionStatus;
  progress: number; // 0 ~ 100
  logs: LogEntry[];
  extractedFiles: ExtractedFile[];
  downloadUrl: string | null;
  options: ExtractionOptions;
  totalArchives: number;
  durationMs?: number;
  errorMessage?: string;
}

export type ExtractionAction =
  | { type: 'EXTRACTION_STARTED'; payload: { totalArchives: number } }
  | { type: 'PROGRESS_UPDATED'; payload: number }
  | { type: 'LOG_ADDED'; payload: { level: LogLevel; message: string } }
  | { type: 'FILE_EXTRACTED'; payload: ExtractedFile }
  | { type: 'DOWNLOAD_URL_SET'; payload: string }
  | { type: 'EXTRACTION_COMPLETED'; payload?: { durationMs: number } }
  | { type: 'EXTRACTION_FAILED'; payload: string }
  | { type: 'RESET' }
  | { type: 'OPTIONS_CHANGED'; payload: Partial<ExtractionOptions> };
