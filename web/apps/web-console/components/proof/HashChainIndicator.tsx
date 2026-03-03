export type ChainStatus = 'intact' | 'broken' | 'first' | 'unknown';

interface HashChainIndicatorProps {
  status: ChainStatus;
}

const CONFIGS: Record<ChainStatus, { dot: string; text: string; label: string }> = {
  intact:  { dot: 'bg-green-500', text: 'text-green-700', label: 'ok' },
  broken:  { dot: 'bg-red-500',   text: 'text-red-700',   label: 'break' },
  first:   { dot: 'bg-gray-300',  text: 'text-gray-400',  label: 'genesis' },
  unknown: { dot: 'bg-gray-200',  text: 'text-gray-400',  label: '—' },
};

export function HashChainIndicator({ status }: HashChainIndicatorProps) {
  const c = CONFIGS[status];
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  );
}
