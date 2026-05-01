import { Badge } from '@/components/ui/badge';
import { type ChainStatus } from './HashChainIndicator';
import { cn } from '@/utils/helpers';

interface ChainContinuityBarProps {
  hash: string;
  prevHash: string;
  status: ChainStatus;
}

export function ChainContinuityBar({ hash, prevHash, status }: ChainContinuityBarProps) {
  const ok = status === 'intact' || status === 'first';

  return (
    <div className="space-y-3">
      <div className="flex items-stretch gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground mb-1">prev_hash</div>
          <div className={cn(
            'px-2.5 py-2 rounded border text-[10px] break-all leading-relaxed',
            status === 'broken'
              ? 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950/20 dark:border-red-900 dark:text-red-400'
              : 'bg-muted/80 border-border text-muted-foreground',
          )}>
            {prevHash || <span className="text-muted-foreground/60 italic">none</span>}
          </div>
        </div>

        <div className="flex items-center justify-center mt-5 flex-shrink-0">
          <span className={cn('text-xs', status === 'broken' ? 'text-red-400' : 'text-muted-foreground/60')}>→</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="text-[10px] text-muted-foreground mb-1">hash</div>
          <div className="px-2.5 py-2 rounded border border-border bg-muted/80 text-[10px] text-muted-foreground break-all leading-relaxed">
            {hash}
          </div>
        </div>
      </div>

      <Badge
        variant="outline"
        className={cn(
          'text-[10px] gap-1.5 font-normal rounded',
          ok
            ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400'
            : 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400',
        )}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
        {status === 'intact'  && 'Chain link verified — hashes match'}
        {status === 'first'   && 'Genesis block — no previous hash expected'}
        {status === 'broken'  && 'Chain break — prev_hash does not match preceding receipt hash'}
        {status === 'unknown' && 'Chain continuity unknown'}
      </Badge>
    </div>
  );
}
