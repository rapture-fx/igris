import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/helpers';

export function ReceiptStatusBadge({ signed }: { signed: boolean }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1.5 py-0.5 rounded font-medium gap-1',
        signed
          ? 'border-green-200 bg-green-50 text-green-700'
          : 'border-border bg-muted/80 text-muted-foreground',
      )}
    >
      <span className={cn('w-1 h-1 rounded-full flex-shrink-0', signed ? 'bg-green-500' : 'bg-muted-foreground/60')} />
      {signed ? 'signed' : 'unsigned'}
    </Badge>
  );
}
