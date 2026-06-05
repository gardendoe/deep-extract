import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

type ButtonProps = React.ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

const buttonVariants = cva(
  'group/button focus-visible:border-ring focus-visible:ring-ring/50 inline-flex shrink-0 items-center justify-center gap-2 border border-transparent bg-clip-padding font-semibold whitespace-nowrap transition-all select-none focus-visible:ring-3 [&_svg]:shrink-0 [&_svg]:transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/80',
        outlined: 'border-border text-foreground hover:bg-accent hover:text-accent-foreground border bg-transparent',
        dashed:
          'border-border hover:border-primary hover:text-primary hover:bg-primary/5 text-foreground border border-dashed bg-transparent',
        destructive: 'hover:text-error text-muted-foreground hover:bg-error/15 bg-transparent',
      },
      size: {
        default: 'h-8 rounded-lg px-3 text-sm [&_svg:not([class*="size-"])]:size-3.5',
        small: 'h-7 rounded-md px-2 text-xs [&_svg:not([class*="size-"])]:size-3',
        large: 'h-12 gap-3 rounded-xl px-5 text-base [&_svg:not([class*="size-"])]:size-4',
        icon: 'size-6 rounded-md [&_svg:not([class*="size-"])]:size-4',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

export default function Button({ className, variant = 'default', size = 'default', ...props }: ButtonProps) {
  return <button className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
