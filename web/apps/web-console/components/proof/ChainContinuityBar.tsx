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
        {/* prev_hash */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-gray-400 mb-1">prev_hash</div>
          <div
            className={cn(
              'px-2.5 py-2 rounded border text-[10px] font-mono break-all leading-relaxed',
              status === 'broken'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-gray-50 border-gray-200 text-gray-600',
            )}
          >
            {prevHash || <span className="text-gray-300 italic not-italic">none</span>}
          </div>
        </div>

        {/* connector */}
        <div className="flex items-center justify-center mt-5 flex-shrink-0">
          <div className={cn('text-xs font-mono', status === 'broken' ? 'text-red-400' : 'text-gray-300')}>
            →
          </div>
        </div>

        {/* hash */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-mono text-gray-400 mb-1">hash</div>
          <div className="px-2.5 py-2 rounded border border-gray-200 bg-gray-50 text-[10px] font-mono text-gray-600 break-all leading-relaxed">
            {hash}
          </div>
        </div>
      </div>

      {/* status line */}
      <div className={cn('text-[10px] font-mono flex items-center gap-1.5', ok ? 'text-green-600' : 'text-red-600')}>
        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', ok ? 'bg-green-500' : 'bg-red-500')} />
        {status === 'intact'  && 'Chain link verified — hashes match'}
        {status === 'first'   && 'Genesis block — no previous hash expected'}
        {status === 'broken'  && 'Chain break — prev_hash does not match preceding receipt hash'}
        {status === 'unknown' && 'Chain continuity unknown'}
      </div>
    </div>
  );
}
