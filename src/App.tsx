import { useCallback } from 'react';
import { useUnpack } from '@/hooks';
import { Toaster, Header, Main, Compatibility, Dropzone, Extraction, Result, Error, Support, Footer } from '@/components';

export default function App() {
  const { state, unpackAsync, cancel, reset } = useUnpack();
  const handleReset = useCallback(async () => {
    await reset();
  }, [reset]);

  const isIdle = state.status === 'idle';
  const isExtracting = state.status === 'extracting';
  const isDone = state.status === 'done';
  const isError = state.status === 'error';

  return (
    <>
      <Toaster />

      <Header />

      <Main>
        <Compatibility>
          {isIdle ? (
            <Dropzone onExtract={unpackAsync} />
          ) : (
            <Extraction progress={state.progress} totalArchives={state.totalArchives} onCancel={isExtracting ? cancel : undefined} />
          )}

          {isDone && <Result files={state.extractedFiles} failedItems={state.failedItems} downloadUrl={state.downloadUrl} onReset={handleReset} />}
          {isError && <Error message={state.errorMessage} onReset={handleReset} />}

          <Support />
        </Compatibility>
      </Main>

      <Footer />
    </>
  );
}
