'use client';

/**
 * ExecutionStoryTimeline — the core component of the execution detail page.
 *
 * A vertical, flight-recorder-style timeline of one execution: requested action
 * → policy decision → runtime boundary → dispatch → checkpoints → failure /
 * recovery → receipt → proof. Each node is plain English and tone-coloured. A
 * trailing dashed node marks the expected-but-not-yet-reached next step.
 */

import { cn } from '@/utils/helpers';
import { formatDateTime, getRelativeTime } from '@/utils/helpers';
import type { StoryGroup, StoryNode } from '@/lib/executionStory';
import type { Tone } from '@/lib/governance';

const DOT: Record<Tone, string> = {
  success: 'bg-green-500',
  danger: 'bg-red-500',
  warning: 'bg-yellow-500',
  info: 'bg-blue-400',
  neutral: 'bg-muted-foreground/60',
};

const PHASE_LABEL: Record<StoryGroup, string> = {
  request: 'Request',
  policy: 'Policy',
  boundary: 'Boundary',
  dispatch: 'Dispatch',
  execution: 'Execution',
  recovery: 'Recovery',
  proof: 'Proof',
};

export function ExecutionStoryTimeline({ nodes }: { nodes: StoryNode[] }) {
  if (nodes.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No execution events have been recorded for this task yet.
      </p>
    );
  }

  return (
    <ol className="relative">
      {nodes.map((node, index) => {
        const last = index === nodes.length - 1;
        const showPhase = index === 0 || nodes[index - 1]?.group !== node.group;
        return (
          <li key={node.id} className="flex gap-3">
            {/* marker + connector */}
            <div className="flex w-4 flex-shrink-0 flex-col items-center">
              <span
                className={cn(
                  'mt-[3px] h-2.5 w-2.5 flex-shrink-0 rounded-full border-2 border-white',
                  node.pending ? 'bg-white ring-1 ring-gray-200' : DOT[node.tone],
                  !node.pending && 'ring-1 ring-black/[0.04]',
                )}
              />
              {!last && (
                <span
                  className={cn(
                    'w-px flex-1',
                    node.pending ? 'border-l border-dashed border-gray-200' : 'bg-gray-200',
                  )}
                />
              )}
            </div>

            {/* content */}
            <div className={cn('min-w-0 flex-1', last ? 'pb-0' : 'pb-5')}>
              {showPhase && (
                <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {PHASE_LABEL[node.group]}
                </div>
              )}
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span
                  className={cn(
                    'text-xs font-semibold',
                    node.pending ? 'text-muted-foreground' : 'text-foreground',
                  )}
                >
                  {node.title}
                </span>
                {node.timestamp && (
                  <span className="text-[11px] text-muted-foreground" title={formatDateTime(node.timestamp)}>
                    {getRelativeTime(node.timestamp)}
                  </span>
                )}
                {node.pending && (
                  <span className="rounded border border-gray-200 bg-gray-50 px-1 py-px text-[10px] uppercase tracking-wide text-muted-foreground">
                    expected
                  </span>
                )}
              </div>
              {node.detail && (
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">
                  {node.detail}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
