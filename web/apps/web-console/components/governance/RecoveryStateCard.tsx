'use client';

/**
 * RecoveryStateCard — durable execution recovery for one task: checkpoint
 * digest, committed step watermark, resume eligibility, the recovery event
 * timeline, runtime handoff decision, and checkpoint portability mode.
 *
 * Compatible/any-runtime portability is marked experimental, matching the
 * Multi-Runtime Recovery contract.
 */

import { History } from 'lucide-react';
import type { Task } from '@/hooks/useTasks';
import { KeyValueGrid } from '@/components/execution/shared';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { getRelativeTime } from '@/utils/helpers';
import { portabilityLabel } from '@/lib/governance';
import { GovernanceBadge, HandoffBadge } from './GovernanceBadge';

export function RecoveryStateCard({ task }: { task: Task }) {
  const hasCheckpoint = Boolean(task.checkpoint_summary || task.checkpoint_digest);
  const events = task.recovery?.events ?? [];
  const handoff = task.runtime_handoff;
  const portabilityInfo = portabilityLabel(
    task.policy?.checkpoint_portability ?? task.runtime_handoff?.checkpoint_portability,
  );

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <History className="h-4 w-4 text-muted-foreground" />
        Recovery &amp; checkpoints
      </div>

      {!hasCheckpoint && events.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No checkpoint or recovery event has been recorded for this task.
        </p>
      ) : (
        <>
          <KeyValueGrid
            rows={[
              {
                label: 'Resume supported',
                value: task.durability?.resume_supported
                  ? 'Yes'
                  : task.durability?.streaming
                    ? 'No — streaming, non-resumable'
                    : 'No',
              },
              {
                label: 'Redispatch eligible',
                value: task.recovery?.redispatch_eligible ? 'Yes' : 'No',
              },
              {
                label: 'Committed watermark',
                value:
                  task.checkpoint_summary?.last_committed_step !== undefined
                    ? `Step ${task.checkpoint_summary.last_committed_step}`
                    : task.last_step !== undefined
                      ? `Step ${task.last_step}`
                      : '—',
              },
              {
                label: 'Checkpoint digest',
                value:
                  task.checkpoint_summary?.checkpoint_digest ?? task.checkpoint_digest ?? '—',
                mono: Boolean(
                  task.checkpoint_summary?.checkpoint_digest ?? task.checkpoint_digest,
                ),
                copyable:
                  task.checkpoint_summary?.checkpoint_digest ?? task.checkpoint_digest,
              },
              {
                label: 'Checkpoint runtime',
                value:
                  task.checkpoint_summary?.checkpoint_runtime_id ??
                  task.checkpoint_runtime_id ??
                  '—',
                mono: Boolean(
                  task.checkpoint_summary?.checkpoint_runtime_id ??
                    task.checkpoint_runtime_id,
                ),
              },
              {
                label: 'Portability',
                value: (
                  <span className="flex items-center gap-1.5">
                    {portabilityInfo.label}
                    {portabilityInfo.experimental && (
                      <GovernanceBadge label="Experimental" tone="warning" showDot={false} />
                    )}
                  </span>
                ),
              },
            ]}
          />

          {task.recovery?.skip_reason && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-700">
              Manual recovery required — {task.recovery.skip_reason}
            </p>
          )}

          {handoff?.decision && (
            <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="mb-1 flex items-center gap-2">
                <HandoffBadge decision={handoff.decision} />
                {handoff.source_runtime_id && handoff.target_runtime_id && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {handoff.source_runtime_id} → {handoff.target_runtime_id}
                  </span>
                )}
              </div>
              {handoff.reason && (
                <p className="text-[11px] text-muted-foreground">{handoff.reason}</p>
              )}
            </div>
          )}

          {events.length > 0 && (
            <div className="mt-3 overflow-hidden rounded-md border border-gray-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-[11px]">Event</TableHead>
                    <TableHead className="text-[11px]">Runtime</TableHead>
                    <TableHead className="text-[11px]">Replay</TableHead>
                    <TableHead className="text-[11px]">Reason</TableHead>
                    <TableHead className="text-[11px]">When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.map((event, index) => (
                    <TableRow key={`${event.event_type}-${event.created_at}-${index}`}>
                      <TableCell className="text-xs font-medium text-foreground">
                        {event.event_type ?? 'event'}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {event.target_runtime_id || event.source_runtime_id || '—'}
                      </TableCell>
                      <TableCell className="text-xs">
                        {typeof event.replay_allowed === 'boolean' ? (
                          <GovernanceBadge
                            label={event.replay_allowed ? 'Allowed' : 'Blocked'}
                            tone={event.replay_allowed ? 'success' : 'warning'}
                            showDot={false}
                          />
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.reason ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {event.created_at ? getRelativeTime(event.created_at) : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
