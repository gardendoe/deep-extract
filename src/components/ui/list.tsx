import { X } from 'lucide-react';
import { Button } from '@/components';
import { cn, formatSize } from '@/utils';

type ListProps = React.ComponentProps<'ul'>;

type ListItemProps = React.ComponentProps<'li'> & {
  name: string;
  size: number;
  emoji: string;
  onRemove?: () => void;
};

function ListRoot({ className, ...props }: ListProps) {
  return <ul className={cn('flex flex-col gap-y-px font-mono *:shrink-0', className)} {...props} />;
}

function ListItem({ className, name, size, emoji, onRemove, ...props }: ListItemProps) {
  return (
    <li
      className={cn(
        'hover:bg-accent grid items-center gap-3 overflow-hidden rounded-md p-2 transition-colors',
        onRemove ? 'grid-cols-[auto_1fr_auto_auto]' : 'grid-cols-[auto_1fr_auto]',
        className,
      )}
      {...props}
    >
      <span className="text-sm">{emoji}</span>
      <span title={name} className="text-secondary-foreground truncate text-[0.78125rem]">
        {name}
      </span>
      <span className="text-muted-foreground text-[0.78125rem] tabular-nums">{formatSize(size)}</span>

      {onRemove && (
        <Button variant="destructive" size="icon" aria-label={`${name} 제거`} onClick={onRemove}>
          <X />
        </Button>
      )}
    </li>
  );
}

const List = Object.assign(ListRoot, { Item: ListItem });

export default List;
