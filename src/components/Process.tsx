import { Loader, X } from 'lucide-react';
import { Card, Progress, Button } from '@/components';

type ProcessProps = {
  progress: number;
  onCancel: () => void;
};

export default function Process({ progress, onCancel }: ProcessProps) {
  return (
    <Card>
      <Card.Header
        variant="primary"
        title="추출 진행 중"
        icon={<Loader className="animate-pulse" />}
        extra={
          <div className="flex items-center gap-3">
            <span className="text-foreground font-mono font-semibold tabular-nums">{progress}%</span>
            <Button variant="destructive" onClick={onCancel}>
              <X />
              취소
            </Button>
          </div>
        }
      />

      <Progress value={progress} />
    </Card>
  );
}
