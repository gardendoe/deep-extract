import type { LogEntry } from '@/types';
import { motion } from 'motion/react';
import { Loader } from 'lucide-react';
import { Card, Progress, LogConsole } from '@/components';
import { motionVariants } from '@/lib';

type ExtractionProps = {
  logs: LogEntry[];
  progress: number;
  totalArchives?: number;
};

export default function Extraction({ logs, progress, totalArchives = 0 }: ExtractionProps) {
  const processedArchives =
    totalArchives > 0 ? Math.min(Math.round((progress * totalArchives) / 90), totalArchives) : 0;

  return (
    <motion.div
      variants={motionVariants}
      initial={['hidden', 'down']}
      animate={['visible', 'center']}
      exit={['hidden', 'down']}
      className="layout"
    >
      <Card>
        <Card.Header
          variant="primary"
          title="추출 진행 중"
          icon={<Loader className="animate-pulse" />}
          extra={
            <div className="text-muted-foreground flex items-center gap-1 font-mono tabular-nums">
              <span>{processedArchives}</span>
              <span>/</span>
              <span>{totalArchives}</span>
              <span className="mr-3 ml-1">archives</span>
              <span className="text-foreground font-mono font-semibold tabular-nums">{progress}%</span>
            </div>
          }
        />

        <Progress value={progress} />
        <LogConsole logs={logs} />
      </Card>
    </motion.div>
  );
}
