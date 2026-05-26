import { type Variants } from 'motion';

export const motionVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },

  up: { y: -10 },
  down: { y: 10 },
  center: { y: 0 },
};
