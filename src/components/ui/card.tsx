import { type VariantProps, cva } from 'class-variance-authority';
import { cn } from '@/utils';

type CardRootProps = React.ComponentProps<'div'>;

type CardHeaderProps = Omit<React.ComponentProps<'div'>, 'children'> &
  VariantProps<typeof cardHeaderVariants> & {
    title: string;
    icon?: React.ReactNode;
    extra?: React.ReactNode;
  };

const cardHeaderVariants = cva('inline-flex size-8 items-center justify-center rounded-lg border', {
  variants: {
    variant: {
      default: 'bg-transparent text-muted-foreground border-border',
      primary: 'bg-primary/15 text-primary border-primary/30',
      success: 'bg-success/15 text-success border-success/30',
      error: 'bg-error/15 text-error border-error/30',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});

function CardRoot({ className, ...props }: CardRootProps) {
  return (
    <div
      className={cn(
        'bg-card border-border text-card-foreground relative flex flex-col gap-y-4 rounded-2xl border p-6 text-sm',
        className,
      )}
      {...props}
    />
  );
}

function CardHeader({ className, variant, title, icon, extra, ...props }: CardHeaderProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-4', className)} {...props}>
      <div className="flex items-center gap-4">
        <div className={cn(cardHeaderVariants({ variant }), '[&_svg:not([class*="size-"])]:size-4')}>{icon}</div>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>

      {extra}
    </div>
  );
}

const Card = Object.assign(CardRoot, { Header: CardHeader });

export default Card;
