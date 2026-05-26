import type { ExtractionOptions, ExtractedFile } from '@/types';
import { useReducer, useRef, useCallback } from 'react';
import { toast } from 'sonner';
import { extractionReducer, initialState } from './useExtractionReducer';
import { extractArchivesAsync, packToZip } from '@/lib';

export default function useExtraction() {
  const [state, dispatch] = useReducer(extractionReducer, initialState);
  const downloadUrlRef = useRef<string | null>(null);

  const extractAsync = useCallback(
    async (files: File[]) => {
      dispatch({ type: 'EXTRACTION_STARTED', payload: { totalArchives: files.length } });

      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current);
        downloadUrlRef.current = null;
      }

      const collectedFiles: ExtractedFile[] = [];

      try {
        await extractArchivesAsync(files, state.options, {
          onLog: (level, message) => dispatch({ type: 'LOG_ADDED', payload: { level, message } }),
          onProgress: (progress) => dispatch({ type: 'PROGRESS_UPDATED', payload: progress }),
          onFile: (file) => {
            collectedFiles.push(file);
            dispatch({ type: 'FILE_EXTRACTED', payload: file });
          },
        });

        dispatch({ type: 'LOG_ADDED', payload: { level: 'default', message: '\nZIP 생성 중...' } });

        const zipBlob = await packToZip(collectedFiles);
        const url = URL.createObjectURL(zipBlob);
        downloadUrlRef.current = url;

        dispatch({ type: 'DOWNLOAD_URL_SET', payload: url });
        dispatch({ type: 'EXTRACTION_COMPLETED' });
        dispatch({
          type: 'LOG_ADDED',
          payload: { level: 'success', message: `완료! 총 ${collectedFiles.length}개 파일 추출됨` },
        });

        toast.success(`${collectedFiles.length}개 파일 추출 완료`);
      } catch (error) {
        dispatch({ type: 'EXTRACTION_FAILED', payload: String(error) });
        toast.error('압축 해제 중 오류가 발생했습니다.');
      }
    },
    [state.options],
  );

  const reset = useCallback(() => {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current);
      downloadUrlRef.current = null;
    }

    dispatch({ type: 'RESET' });
  }, []);

  const changeOptions = useCallback((options: Partial<ExtractionOptions>) => {
    dispatch({ type: 'OPTIONS_CHANGED', payload: options });
  }, []);

  return { state, extractAsync, reset, changeOptions };
}
