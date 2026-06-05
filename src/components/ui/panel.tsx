import { cn } from '@/utils';

type PanelProps = React.ComponentProps<'div'> & {
  title: string;
  subtitle?: string;
};

export default function Panel({ className, children, title, subtitle: extra, ...props }: PanelProps) {
  return (
    <div className={cn('border-border overflow-hidden rounded-lg border font-mono text-xs', className)} {...props}>
      <div className="border-border text-muted-foreground bg-muted flex items-center justify-between border-b px-4 py-2">
        <span>{title}</span>
        {extra && <span>{extra}</span>}
      </div>

      <div className="bg-background p-2">{children}</div>
    </div>
  );
}
