import type { UnpackOptions } from '@/types';
import { useReducer, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
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

    const handlePageHide = () => {
      // pagehide는 BFCache 진입 시에도 발생하므로 abort만 하고 상태는 건드리지 않는다
      abortControllerRef.current?.abort();
      disposeRef.current?.().catch(() => {});
    };

    window.addEventListener('pagehide', handlePageHide);
    return () => window.removeEventListener('pagehide', handlePageHide);
  }, []);

  /** 압축 파일 목록을 받아 해제 → 재압축 → 다운로드 URL 생성까지 실행한다. */
  const unpackAsync = useCallback(async (files: File[]) => {
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const { signal } = controller;

    // signal이 abort 상태이면 UI에 알리고 true를 반환한다.
    const handleAbortedIf = async (): Promise<boolean> => {
      if (!signal.aborted) return false;

      // reset 호출에 의한 중단은 사용자에게 따로 토스트를 노출하지 않는다.
      if (signal.reason !== 'reset') {
        dispatch({ type: 'EXTRACTION_CANCELLED' });
        toast.info('추출이 취소되었습니다.');
      }

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
      toast.error('지원되지 않는 브라우저입니다.');
      abortControllerRef.current = null;
      return;
    }

    let queuedCount = 0;

    const abortPacker = () => {
      packer.abortAsync().catch(() => {});
    };

    // signal abort 시 Packer 워커도 함께 중단한다.
    signal.addEventListener('abort', abortPacker, { once: true });

    // addEventListener 등록 직후 이미 abort된 경우를 방어한다.
    if (signal.aborted) {
      signal.removeEventListener('abort', abortPacker);
      abortControllerRef.current = null;
      abortPacker();

      if (signal.reason !== 'reset') {
        dispatch({ type: 'EXTRACTION_CANCELLED' });
        toast.info('추출이 취소되었습니다.');
      }

      return;
    }

    try {
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

      // 큐에 파일이 없으면 Packer를 닫지 않고 중단한다.
      if (queuedCount === 0) {
        await packer.abortAsync();

        if (await handleAbortedIf()) return;

        const totalFailed = skippedCount + errorCount;
        const message =
          totalFailed > 0
            ? '추출 가능한 파일이 없습니다. 압축 파일을 열거나 해제하지 못했습니다.'
            : '추출된 파일이 없습니다. 압축 파일이 비어 있거나 지원되지 않는 형식입니다.';

        dispatch({ type: 'EXTRACTION_FAILED', payload: message });
        toast.error(message);

        return;
      }

      const { url, dispose, skippedCount: packSkipped, errorCount: packErrors } = await packer.finalizeAsync();
      disposeRef.current = dispose; // 다음 실행 or reset 시 정리하도록 보관

      if (await handleAbortedIf()) return;
      if (packErrors > 0) {
        dispatch({ type: 'ITEM_FAILED', payload: { name: '(재압축 단계)', reason: '재압축 오류' } });
      }

      dispatch({ type: 'DOWNLOAD_URL_SET', payload: url });
      dispatch({ type: 'EXTRACTION_COMPLETED' });

      // Unpacker 단계 실패 + Packer 단계 실패를 합산해서 최종 결과를 표시한다.
      const totalSkipped = skippedCount + packSkipped;
      const totalErrors = errorCount + packErrors;
      const totalFailed = totalSkipped + totalErrors;
      const successCount = queuedCount - packSkipped - packErrors;

      if (totalFailed > 0) {
        const detail = [totalSkipped > 0 ? `제한 초과: ${totalSkipped}개` : '', totalErrors > 0 ? `오류: ${totalErrors}개` : '']
          .filter(Boolean)
          .join(', ');

        toast.warning(`${successCount}개 파일 추출 완료 (실패: ${totalFailed}개 — ${detail})`);
      } else {
        toast.success(`${successCount}개 파일 추출 완료`);
      }
    } catch (error) {
      if (await handleAbortedIf()) return;

      // abort가 아닌 예외의 경우, Packer 정리 후 오류 상태로 전환한다.
      await packer.abortAsync();

      const message = error instanceof Error ? error.message : String(error);
      dispatch({ type: 'EXTRACTION_FAILED', payload: message });
      toast.error(message);
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
    // 진행 중인 unpackAsync()가 있으면 reset 사유로 중단해서 취소 토스트를 띄우지 않도록 한다.
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
