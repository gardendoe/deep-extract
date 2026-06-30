import type { FailedZIP, FileMeta, UnpackOptions } from '@/types';

type UnpackState = {
  status: 'idle' | 'processing' | 'done' | 'error';
  progress: number;
  failed: FailedZIP[];
  succeeded: FileMeta[];
  downloadUrl: string | null;
  options: UnpackOptions;
  errorMessage: string | null;
};

type UnpackAction =
  | { type: 'STARTED' }
  | { type: 'UPDATE_PROGRESS'; payload: number }
  | { type: 'ZIP_FAILED'; payload: FailedZIP }
  | { type: 'FILE_UNPACKED'; payload: FileMeta }
  | { type: 'DOWNLOAD_READY'; payload: string }
  | { type: 'DONE' }
  | { type: 'CANCELLED' }
  | { type: 'RESET' }
  | { type: 'OPTIONS_CHANGED'; payload: Partial<UnpackOptions> }
  | { type: 'ERROR'; payload: string };

export const initialState: UnpackState = {
  status: 'idle',
  progress: 0,
  failed: [],
  succeeded: [],
  downloadUrl: null,
  options: { mode: 'flatten', encoding: 'utf-8' },
  errorMessage: null,
};

export function unpackReducer(state: UnpackState, action: UnpackAction): UnpackState {
  switch (action.type) {
    case 'STARTED':
      return {
        ...state,
        status: 'processing',
        progress: 0,
        failed: [],
        succeeded: [],
        downloadUrl: null,
      };

    case 'UPDATE_PROGRESS':
      if (state.status !== 'processing') return state;
      return { ...state, progress: action.payload };

    case 'ZIP_FAILED':
      if (state.status !== 'processing') return state;
      return { ...state, failed: [...state.failed, action.payload] };

    case 'FILE_UNPACKED':
      if (state.status !== 'processing') return state;
      return { ...state, succeeded: [...state.succeeded, action.payload] };

    case 'DOWNLOAD_READY':
      if (state.status !== 'processing') return state;
      return { ...state, downloadUrl: action.payload };

    case 'DONE':
      if (state.status !== 'processing') return state;
      return { ...state, status: 'done', progress: 100 };

    case 'CANCELLED':
      if (state.status !== 'processing') return state;
      return { ...state, status: 'idle', progress: 0 };

    case 'RESET':
      return { ...initialState, options: state.options };

    case 'OPTIONS_CHANGED':
      return { ...state, options: { ...state.options, ...action.payload } };

    case 'ERROR':
      if (state.status !== 'processing') return state;
      return { ...state, status: 'error', errorMessage: action.payload };
  }
}
