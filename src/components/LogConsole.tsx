import type { LogEntry } from '@/types';
import { useRef, useEffect } from 'react';
import { Panel } from '@/components';
import { writeLogs, cn } from '@/lib';

type LogConsoleProps = { logs: LogEntry[] };

const LOG_LEVEL_COLOR: Record<LogEntry['level'], string> = {
  default: 'text-muted-foreground',
  info: 'text-info',
  success: 'text-success',
  warning: 'text-warning',
  error: 'text-error',
};

export default function LogConsole({ logs }: LogConsoleProps) {
  const logContent = writeLogs(logs);
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!consoleRef.current) return;
    consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
  }, [logs.length]);

  return (
    <Panel title="extraction.log">
      <div ref={consoleRef} className="flex max-h-80 flex-col gap-y-px overflow-y-auto p-2 leading-loose">
        {logs.length === 0 ? (
          <p>압축 해제를 시작하면 로그가 표시됩니다...</p>
        ) : (
          logContent.map((log) =>
            log.type === 'spacer' ? (
              <br key={log.id} />
            ) : (
              <span key={log.id} className={cn('wrap-break-word whitespace-pre-wrap', LOG_LEVEL_COLOR[log.level])}>
                {log.message}
              </span>
            ),
          )
        )}
      </div>
    </Panel>
  );
}
