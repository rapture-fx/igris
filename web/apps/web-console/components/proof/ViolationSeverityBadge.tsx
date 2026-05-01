import { Badge } from '@/components/ui/badge';
import { cn } from '@/utils/helpers';

const KIND_STYLES: Record<string, string> = {
  CPU_LIMIT:         'border-orange-200 bg-orange-50 text-orange-700',
  MEMORY_LIMIT:      'border-amber-200 bg-amber-50 text-amber-700',
  QUOTA_EXCEEDED:    'border-red-200 bg-red-50 text-red-700',
  TICK_TIMEOUT:      'border-violet-200 bg-violet-50 text-violet-700',
  CAPABILITY_DENIED: 'border-rose-200 bg-rose-50 text-rose-700',
};

function formatKind(k: string) {
  return k.charAt(0).toUpperCase() + k.slice(1).replace(/_/g, ' ').toLowerCase();
}

export function ViolationSeverityBadge({ kind }: { kind: string }) {
  return (
    <Badge
      variant="outline"
      className={cn('text-[10px] px-1.5 py-0.5 rounded font-medium', KIND_STYLES[kind] ?? 'border-border bg-muted/80 text-muted-foreground')}
    >
      {formatKind(kind)}
    </Badge>
  );
}
