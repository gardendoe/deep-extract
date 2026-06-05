import type { LogEntry, LogLevel, FileMeta, UnpackOptions } from '@/types';

type UnpackState = {
  status: 'idle' | 'extracting' | 'done' | 'error';
  progress: number;
  logs: LogEntry[];
  extractedFiles: FileMeta[];
  downloadUrl: string | null;
  options: UnpackOptions;
  totalArchives: number;
  errorMessage?: string;
};

type UnpackAction =
  | { type: 'EXTRACTION_STARTED'; payload: { totalArchives: number } }
  | { type: 'PROGRESS_UPDATED'; payload: number }
  | { type: 'LOG_ADDED'; payload: { level: LogLevel; message: string } }
  | { type: 'FILE_EXTRACTED'; payload: FileMeta }
  | { type: 'DOWNLOAD_URL_SET'; payload: string }
  | { type: 'EXTRACTION_COMPLETED' }
  | { type: 'EXTRACTION_CANCELLED' }
  | { type: 'EXTRACTION_FAILED'; payload: string }
  | { type: 'RESET' }
  | { type: 'OPTIONS_CHANGED'; payload: Partial<UnpackOptions> };

export const initialState: UnpackState = {
  status: 'idle',
  progress: 0,
  logs: [],
  extractedFiles: [],
  downloadUrl: null,
  totalArchives: 0,
  options: {
    mode: 'flatten',
    encoding: 'utf-8',
  },
};

function makeLog(level: LogEntry['level'], message: string): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, level, message };
}

export function unpackReducer(state: UnpackState, action: UnpackAction): UnpackState {
  switch (action.type) {
    case 'EXTRACTION_STARTED':
      return {
        ...state,
        status: 'extracting',
        progress: 0,
        logs: [],
        extractedFiles: [],
        downloadUrl: null,
        totalArchives: action.payload.totalArchives,
      };

    case 'PROGRESS_UPDATED':
      if (state.status !== 'extracting') return state;
      return { ...state, progress: action.payload };

    case 'LOG_ADDED':
      if (state.status !== 'extracting') return state;
      return {
        ...state,
        logs: [...state.logs, makeLog(action.payload.level, action.payload.message)],
      };

    case 'FILE_EXTRACTED':
      if (state.status !== 'extracting') return state;
      return { ...state, extractedFiles: [...state.extractedFiles, action.payload] };

    case 'DOWNLOAD_URL_SET':
      if (state.status !== 'extracting') return state;
      return { ...state, downloadUrl: action.payload };

    case 'EXTRACTION_COMPLETED':
      if (state.status !== 'extracting') return state;
      return { ...state, status: 'done', progress: 100 };

    case 'EXTRACTION_CANCELLED':
      if (state.status !== 'extracting') return state;
      return { ...state, status: 'idle', progress: 0 };

    case 'EXTRACTION_FAILED':
      if (state.status !== 'extracting') return state;
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload,
        logs: [...state.logs, makeLog('error', `추출 실패: ${action.payload}`)],
      };

    case 'RESET':
      return { ...initialState, options: state.options }; // 설정값은 초기화하지 않는다.

    case 'OPTIONS_CHANGED':
      return { ...state, options: { ...state.options, ...action.payload } };
  }
}
