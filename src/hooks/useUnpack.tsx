import type { UnpackOptions } from '@/types';
import { useReducer, useRef, useCallback, useEffect } from 'react';
import { Unpacker, Packer } from '@/services';
import { unpackReducer, initialState } from './unpackReducer';

/**
 * 압축 해제 전체 흐름을 관리하는 커스텀 훅
 *
 * {@link Unpacker}로 재귀 해제한 파일들을 {@link Packer}에 스트리밍으로 넘겨서,
 * ZIP64 단일 파일로 재압축한 뒤 다운로드 URL을 제공한다.
 *
 * - `unpackAsync`: 압축 해제 → 재압축 전 과정 실행
 * - `cancel`: 진행 중인 작업을 중단하고 임시 파일 정리
 * - `reset`: 세션 리소스 초기화
 * - `changeOptions`: 압축 해제 옵션 변경
 */
export default function useUnpack() {
  const [state, dispatch] = useReducer(unpackReducer, initialState);
  const disposeRef = useRef<(() => Promise<void>) | null>(null); // Packer.finalizeAsync()가 반환한 정리 함수
  const abortControllerRef = useRef<AbortController | null>(null); // 진행 중인 unpackAsync()를 중단하는 컨트롤러
  const optionsRef = useRef<UnpackOptions>(state.options); // 클로저 캡처 없이 항상 최신 옵션을 참조하기 위한 ref

  useEffect(() => {
    optionsRef.current = state.options;
  }, [state.options]);

  useEffect(() => {
    // 마운트 시 OPFS 비활성 세션 폴더 정리
    void Unpacker.clearAsync();

    // 페이지 이탈(뒤로 가기 포함) 시 진행 중인 작업을 중단하고 세션 리소스를 정리한다.
    const handlePageHide = () => {
      abortControllerRef.current?.abort();
      disposeRef.current?.().catch(() => {});
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  /** 압축 파일 목록을 받아서 압축 해제 → 재압축 → 다운로드 URL 생성까지 실행한다. */
  const unpackAsync = useCallback(async (files: File[]) => {
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    const { signal } = abortController;

    // 현재 signal이 aborted(취소)된 상태인지 확인한다. (중간에 계속 취소 여부를 재확인하고 빠져나가는 용도)
    const handleAbortedIf = async (): Promise<boolean> => {
      if (!signal.aborted) return false;
      if (signal.reason !== 'reset') dispatch({ type: 'EXTRACTION_CANCELLED' });
      return true;
    };

    dispatch({ type: 'EXTRACTION_STARTED', payload: { totalArchives: files.length } });

    // 이전 unpackAsync() 실행이 남긴 세션 리소스 정리
    if (disposeRef.current) {
      await disposeRef.current();
      disposeRef.current = null;
    }

    const packer = Packer.create();
    if (!packer) {
      dispatch({ type: 'EXTRACTION_FAILED', payload: '지원되지 않는 브라우저입니다.' });
      abortControllerRef.current = null;
      return;
    }

    // signal abort 시 Packer가 진행중인 작업도 중단시킨다.
    const abortPacker = () => packer.abortAsync().catch(() => {});
    signal.addEventListener('abort', abortPacker, { once: true });

    // addEventListener 등록 직후 이미 abort된 경우를 방어한다.
    if (signal.aborted) {
      signal.removeEventListener('abort', abortPacker);
      abortControllerRef.current = null;
      abortPacker();

      if (signal.reason !== 'reset') {
        dispatch({ type: 'EXTRACTION_CANCELLED' });
      }

      return;
    }

    try {
      // Packer에 성공적으로 큐잉된 파일 개수
      let queuedCount = 0;

      // 압축 해제 시작
      const { skippedCount, errorCount } = await Unpacker.unpackAsync(
        files,
        optionsRef.current,
        {
          onFile: async (file) => {
            const queued = await packer.enqueueFileAsync(file);
            if (queued) {
              queuedCount++;
              dispatch({ type: 'FILE_EXTRACTED', payload: { name: file.name, size: file.size } });
            }
          },
          onProgress: (progress) => dispatch({ type: 'PROGRESS_UPDATED', payload: progress }),
          onFailed: (item) => dispatch({ type: 'ITEM_FAILED', payload: item }),
        },
        signal,
      );

      if (await handleAbortedIf()) return;

      // Packer에 큐잉된 파일이 하나도 없으면
      // finalizeAsync()로 ZIP을 완성하는 대신 abortAsync()로 압축 작업을 중단한다.
      if (queuedCount === 0) {
        await packer.abortAsync();

        if (await handleAbortedIf()) return;

        const totalFailed = skippedCount + errorCount;
        const message =
          totalFailed > 0
            ? '추출 가능한 파일이 없습니다. 압축 파일을 열거나 해제하지 못했습니다.'
            : '추출된 파일이 없습니다. 압축 파일이 비어 있거나 지원되지 않는 형식입니다.';

        dispatch({ type: 'EXTRACTION_FAILED', payload: message });
        return;
      }

      const { url, dispose, errorCount: packErrors } = await packer.finalizeAsync();
      disposeRef.current = dispose; // 다음 실행 or reset 시 정리하도록 보관

      if (await handleAbortedIf()) return;
      if (packErrors > 0) dispatch({ type: 'ITEM_FAILED', payload: { name: '(재압축 단계)', reason: '재압축 오류' } });

      dispatch({ type: 'DOWNLOAD_URL_SET', payload: url });
      dispatch({ type: 'EXTRACTION_COMPLETED' });
    } catch (error) {
      // 잡힌 error가 abort로 인한 것이라면 이미 cancel 처리됐으므로 여기서 종료한다.
      if (await handleAbortedIf()) return;

      // abort가 아닌 실제 런타임 오류의 경우, Packer 자원을 정리하고 EXTRACTION_FAILED로 전환한다.
      await packer.abortAsync();
      dispatch({ type: 'EXTRACTION_FAILED', payload: error instanceof Error ? error.message : String(error) });
    } finally {
      signal.removeEventListener('abort', abortPacker);
      abortControllerRef.current = null;
    }
  }, []);

  /** 진행 중인 압축 해제 작업을 중단한다. */
  const cancel = useCallback(() => {
    // abort 이후 정리는 unpackAsync() 내부에서 처리한다.
    abortControllerRef.current?.abort();
  }, []);

  /** 세션 리소스를 모두 초기화한다. */
  const reset = useCallback(async () => {
    abortControllerRef.current?.abort('reset');

    if (disposeRef.current) {
      await disposeRef.current();
      disposeRef.current = null;
    }

    dispatch({ type: 'RESET' });
  }, []);

  /** 압축 해제 옵션을 변경한다. 진행 중인 작업에는 영향을 주지 않는다. */
  const changeOptions = useCallback((options: Partial<UnpackOptions>) => {
    dispatch({ type: 'OPTIONS_CHANGED', payload: options });
  }, []);

  return { state, unpackAsync, cancel, reset, changeOptions };
}
