import { Loader, X } from 'lucide-react';
import { Card, Progress, Button } from '@/components';

type ExtractionProps = {
  progress: number;
  totalArchives?: number;
  onCancel?: () => void;
};

export default function Extraction({ progress, totalArchives = 0, onCancel }: ExtractionProps) {
  const processedArchives =
    totalArchives > 0 ? Math.min(Math.round((progress * totalArchives) / 90), totalArchives) : 0;

  return (
    <Card>
      <Card.Header
        variant="primary"
        title="추출 진행 중"
        icon={<Loader className="animate-pulse" />}
        extra={
          <div className="flex items-center gap-3">
            <div className="text-muted-foreground flex items-center gap-1 font-mono tabular-nums">
              <span>{processedArchives}</span>
              <span>/</span>
              <span>{totalArchives}</span>
              <span className="mr-1 ml-1">archives</span>
              <span className="text-foreground font-mono font-semibold tabular-nums">{progress}%</span>
            </div>
            {onCancel && (
              <Button variant="destructive" onClick={onCancel}>
                <X />
                취소
              </Button>
            )}
          </div>
        }
      />

      <Progress value={progress} />
    </Card>
  );
}
