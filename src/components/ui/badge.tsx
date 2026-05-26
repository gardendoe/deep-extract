import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/lib';

type BadgeProps = React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>;

const badgeVariants = cva(
  'text-muted-foreground inline-flex items-center justify-center rounded-full border text-xs font-semibold',
  {
    variants: {
      variant: {
        default: 'bg-accent border-transparent',
        outlined: 'bg-muted border-border',
      },
      size: {
        default: 'gap-1.5 px-2 py-1',
        small: 'gap-1 px-2 py-0.5',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export default function Badge({ className, variant = 'default', size = 'default', ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant, size, className }))} {...props} />;
}
