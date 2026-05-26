import { MotionConfig, AnimatePresence } from 'motion/react';
import { useExtraction } from '@/hooks';
import { Toaster, Header, Main, Dropzone, Extraction, Result, Error, Footer } from '@/components';

export default function App() {
  const { state, extractAsync, reset } = useExtraction();

  const isIdle = state.status === 'idle';
  const isExtracting = state.status === 'extracting';
  const isDone = state.status === 'done';
  const isError = state.status === 'error';

  return (
    <MotionConfig transition={{ type: 'tween', duration: 0.15 }}>
      <Toaster />

      <div className="flex min-h-screen flex-col *:shrink-0">
        <Header />

        <Main>
          {isIdle && <Dropzone onExtract={extractAsync} />}

          <AnimatePresence>
            {(isExtracting || isDone) && (
              <Extraction
                key="extraction"
                logs={state.logs}
                progress={state.progress}
                totalArchives={state.totalArchives}
              />
            )}

            {isDone && (
              <Result key="result" files={state.extractedFiles} downloadUrl={state.downloadUrl} onReset={reset} />
            )}

            {isError && <Error key="error" message={state.errorMessage} onReset={reset} />}
          </AnimatePresence>
        </Main>

        <Footer />
      </div>
    </MotionConfig>
  );
}
