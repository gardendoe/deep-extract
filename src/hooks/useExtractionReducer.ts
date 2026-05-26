import type { ExtractionState, ExtractionAction, LogEntry } from '@/types';
import { MAX_FILE_DEPTH } from '@/lib';

export const DEFAULT_OPTIONS: ExtractionState['options'] = {
  mode: 'flatten',
  encoding: 'utf-8',
  maxDepth: MAX_FILE_DEPTH,
};

export const initialState: ExtractionState = {
  status: 'idle',
  progress: 0,
  logs: [],
  extractedFiles: [],
  downloadUrl: null,
  options: DEFAULT_OPTIONS,
  totalArchives: 0,
};

function makeLog(level: LogEntry['level'], message: string): LogEntry {
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, level, message };
}

export function extractionReducer(state: ExtractionState, action: ExtractionAction): ExtractionState {
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
      return { ...state, progress: action.payload };

    case 'LOG_ADDED':
      return {
        ...state,
        logs: [...state.logs, makeLog(action.payload.level, action.payload.message)],
      };

    case 'FILE_EXTRACTED':
      return { ...state, extractedFiles: [...state.extractedFiles, action.payload] };

    case 'DOWNLOAD_URL_SET':
      return { ...state, downloadUrl: action.payload };

    case 'EXTRACTION_COMPLETED':
      return { ...state, status: 'done', progress: 100 };

    case 'EXTRACTION_FAILED':
      return {
        ...state,
        status: 'error',
        errorMessage: action.payload,
        logs: [...state.logs, makeLog('error', `추출 실패: ${action.payload}`)],
      };

    case 'RESET':
      return { ...initialState, options: state.options }; // 설정값은 초기화하지 않음

    case 'OPTIONS_CHANGED':
      return { ...state, options: { ...state.options, ...action.payload } };
  }
}
