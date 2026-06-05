import { useState, useCallback } from 'react';
import { useUnpack } from '@/hooks';
import { Toaster, Header, Main, Compatibility, Dropzone, Extraction, Result, Error, Support, Footer } from '@/components';

export default function App() {
  const { state, unpackAsync, cancel, reset } = useUnpack();
  const [dropzoneKey, setDropzoneKey] = useState(0);
  const handleReset = useCallback(async () => {
    setDropzoneKey((k) => k + 1);
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
          <Dropzone key={dropzoneKey} onExtract={unpackAsync} />

          {!isIdle && (
            <Extraction
              logs={state.logs}
              progress={state.progress}
              totalArchives={state.totalArchives}
              onCancel={isExtracting ? cancel : undefined}
            />
          )}
          {isDone && <Result files={state.extractedFiles} downloadUrl={state.downloadUrl} onReset={handleReset} />}
          {isError && <Error message={state.errorMessage} onReset={handleReset} />}

          <Support />
        </Compatibility>
      </Main>

      <Footer />
    </>
  );
}
