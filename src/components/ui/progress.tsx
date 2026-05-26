import { Progress as ProgressPrimitive } from 'radix-ui';
import { cn } from '@/lib';

type ProgressProps = React.ComponentProps<typeof ProgressPrimitive.Root>;

export default function Progress({ className, value = 0, ...props }: ProgressProps) {
  return (
    <ProgressPrimitive.Root
      value={value}
      max={100}
      className={cn('bg-accent relative flex h-2 w-full items-center overflow-x-hidden rounded-full', className)}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="bg-primary size-full flex-1 rounded-full transition-all"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  );
}
