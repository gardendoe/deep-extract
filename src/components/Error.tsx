import { motion } from 'motion/react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button, Card } from '@/components';
import { motionVariants } from '@/lib';

type ErrorStateProps = {
  message?: string;
  onReset: () => void;
};

export default function Error({ message, onReset }: ErrorStateProps) {
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
          variant="error"
          title="압축 해제 실패"
          icon={<AlertTriangle />}
          extra={
            <Button variant="outlined" onClick={onReset}>
              <RotateCcw size={14} />
              처음부터
            </Button>
          }
        />
        <div className="bg-error/10 rounded-xl p-4">
          <p className="text-error leading-relaxed">
            {message || '압축 파일이 손상되었거나 지원하지 않는 형식일 수 있어요. 파일을 다시 확인해 주세요.'}
          </p>
        </div>
      </Card>
    </motion.div>
  );
}
