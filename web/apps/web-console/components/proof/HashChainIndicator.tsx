import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/helpers';

export type ChainStatus = 'intact' | 'broken' | 'first' | 'unknown';

const CONFIGS: Record<ChainStatus, { dot: string; badge: string; label: string }> = {
  intact:  { dot: 'bg-green-500', badge: 'border-green-200 bg-green-50 text-green-700',   label: 'ok' },
  broken:  { dot: 'bg-red-500',   badge: 'border-red-200 bg-red-50 text-red-700',         label: 'break' },
  first:   { dot: 'bg-muted-foreground/60', badge: 'border-border bg-muted/80 text-muted-foreground', label: 'genesis' },
  unknown: { dot: 'bg-muted-foreground/60', badge: 'border-border bg-muted/80 text-muted-foreground', label: '—' },
};

export function HashChainIndicator({ status }: { status: ChainStatus }) {
  const c = CONFIGS[status];
  return (
    <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium gap-1', c.badge)}>
      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', c.dot)} />
      {c.label}
    </Badge>
  );
}
