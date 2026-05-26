import { motion } from 'motion/react';
import { FileArchive } from 'lucide-react';
import { motionVariants } from '@/lib';

export default function DragOverlay() {
  return (
    <motion.div
      variants={motionVariants}
      initial={['hidden', 'down']}
      animate={['visible', 'center']}
      exit={['hidden', 'down']}
      aria-hidden="true"
      className="bg-background/85 from-primary/10 absolute inset-0 z-50 flex size-full items-center justify-center bg-radial to-transparent to-70% backdrop-blur-sm"
    >
      <div className="border-primary flex size-full flex-col items-center justify-center gap-y-6 rounded-2xl border-2 border-dashed">
        <FileArchive className="text-primary size-20" />
        <p className="text-foreground text-3xl font-semibold">파일을 여기에 놓으세요</p>
      </div>
    </motion.div>
  );
}
