import { cn } from '@/lib/utils';

type StatusType = string;

const statusConfig: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  RUNNING: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  IDLE: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' },
  SAFE_IDLE: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  ERROR: { dot: 'bg-red-500', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  VIOLATION: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  VIOLATED: { dot: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  COMPLETED: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' },
  ONLINE: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  OFFLINE: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' },
  RECOVERING: { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  ACTIVE: { dot: 'bg-green-500', text: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
  INACTIVE: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' },
  CRITICAL: { dot: 'bg-red-600', text: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  WARNING: { dot: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  INFO: { dot: 'bg-blue-400', text: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  RESOLVED: { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' },
};

const fallback = { dot: 'bg-muted-foreground/60', text: 'text-muted-foreground', bg: 'bg-muted/80', border: 'border-border' };

interface StatusBadgeProps {
  status: StatusType;
  className?: string;
  showDot?: boolean;
}

export function StatusBadge({ status, className, showDot = true }: StatusBadgeProps) {
  const key = status?.toUpperCase() ?? '';
  const config = statusConfig[key] ?? fallback;
  const displayStatus = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : '';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border',
        config.bg,
        config.text,
        config.border,
        className
      )}
    >
      {showDot && <span className={cn('h-1.5 w-1.5 rounded-full flex-shrink-0', config.dot)} />}
      {displayStatus}
    </span>
  );
}
