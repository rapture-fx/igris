const KIND_STYLES: Record<string, string> = {
  CPU_LIMIT:        'text-orange-700 bg-orange-50 border-orange-200',
  MEMORY_LIMIT:     'text-amber-700 bg-amber-50 border-amber-200',
  QUOTA_EXCEEDED:   'text-red-700 bg-red-50 border-red-200',
  TICK_TIMEOUT:     'text-violet-700 bg-violet-50 border-violet-200',
  CAPABILITY_DENIED:'text-rose-700 bg-rose-50 border-rose-200',
};

interface ViolationSeverityBadgeProps {
  kind: string;
}

export function ViolationSeverityBadge({ kind }: ViolationSeverityBadgeProps) {
  const style = KIND_STYLES[kind] ?? 'text-gray-600 bg-gray-50 border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono font-medium border rounded ${style}`}>
      {kind}
    </span>
  );
}
