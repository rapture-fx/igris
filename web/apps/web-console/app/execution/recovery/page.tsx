'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTasks, type Task } from '@/hooks/useTasks';
import { GovernanceBadge, HandoffBadge, ReplayClassBadge } from '@/components/governance/GovernanceBadge';
import { portabilityLabel } from '@/lib/governance';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { AlertTriangle, ArrowUpRight, History, RotateCcw, Search } from 'lucide-react';

function recoveryLabel(task: Task): { label: string; tone: 'success' | 'danger' | 'warning' | 'info' | 'neutral' } {
  if (task.recovery?.skip_reason) return { label: 'Manual recovery required', tone: 'warning' };
  if (task.status === 'recovering') return { label: 'Recovering', tone: 'warning' };
  if (task.status === 'failed') return { label: 'Recovery failed', tone: 'danger' };
  if ((task.recovery?.events ?? []).some((event) => event.event_type?.toLowerCase().includes('skip'))) {
    return { label: 'Replay skipped', tone: 'warning' };
  }
  if ((task.recovery?.events ?? []).length > 0 || task.runtime_handoff?.decision === 'allowed') {
    return { label: 'Recovered', tone: 'success' };
  }
  if (task.checkpoint_summary || task.checkpoint_digest) return { label: 'Checkpointed', tone: 'info' };
  return { label: 'No recovery evidence', tone: 'neutral' };
}

function isRecoveryRelevant(task: Task): boolean {
  return Boolean(
    task.status === 'recovering' ||
      task.status === 'failed' ||
      task.checkpoint_summary ||
      task.checkpoint_digest ||
      task.recovery?.skip_reason ||
      (task.recovery?.events ?? []).length > 0 ||
      task.runtime_handoff,
  );
}

export default function RecoveryPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading } = useTasks({ limit: 200 });
  const tasks = data?.tasks ?? [];

  const recoveryTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks
      .filter(isRecoveryRelevant)
      .filter((task) => {
        if (!query) return true;
        return [
          task.task_id,
          task.runtime_id,
          task.checkpoint_runtime_id,
          task.checkpoint_digest,
          task.recovery?.skip_reason,
          task.runtime_handoff?.reason,
          task.policy?.action_name,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [search, tasks]);

  const stats = useMemo(
    () => ({
      interrupted: tasks.filter((task) => task.status === 'failed' || task.recovery?.skip_reason).length,
      recovering: tasks.filter((task) => task.status === 'recovering').length,
      resumable: tasks.filter((task) => task.durability?.resume_supported).length,
      handoffBlocked: tasks.filter((task) => task.runtime_handoff?.decision === 'denied').length,
    }),
    [tasks],
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Recovery</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Interrupted executions, checkpoints, replay decisions, and runtime handoff evidence.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search task, runtime, checkpoint..."
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ['Interrupted', stats.interrupted, AlertTriangle],
            ['Recovering', stats.recovering, RotateCcw],
            ['Resume supported', stats.resumable, History],
            ['Handoff blocked', stats.handoffBlocked, AlertTriangle],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                {label}
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{String(value)}</div>
            </div>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recovery Evidence</h2>
              <p className="text-[11px] text-muted-foreground">
                All rows come from task checkpoint, recovery event, and runtime handoff fields.
              </p>
            </div>
            {!isLoading && (
              <span className="text-[11px] tabular-nums text-muted-foreground">
                {recoveryTasks.length} of {tasks.length}
              </span>
            )}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Checkpoint</TableHead>
                <TableHead>Replay</TableHead>
                <TableHead>Handoff</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : recoveryTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    Evidence not available. No interrupted, checkpointed, or handoff-linked executions are currently returned by the API.
                  </TableCell>
                </TableRow>
              ) : (
                recoveryTasks.map((task) => {
                  const state = recoveryLabel(task);
                  const portability = portabilityLabel(task.policy?.checkpoint_portability ?? task.runtime_handoff?.checkpoint_portability);
                  return (
                    <TableRow key={task.task_id} className="hover:bg-gray-50">
                      <TableCell>
                        <Link href={`/execution/tasks/${encodeURIComponent(task.task_id)}`} className="group flex items-center gap-1.5">
                          <span className="font-mono text-xs text-foreground">{truncateText(task.task_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                        </Link>
                        {task.runtime_id && <div className="font-mono text-[10px] text-muted-foreground">{truncateText(task.runtime_id, 18)}</div>}
                      </TableCell>
                      <TableCell><GovernanceBadge label={state.label} tone={state.tone} /></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {task.checkpoint_summary?.checkpoint_digest || task.checkpoint_digest
                          ? truncateText(task.checkpoint_summary?.checkpoint_digest ?? task.checkpoint_digest ?? '', 18)
                          : 'Not available'}
                        <div className="font-sans text-[10px] text-muted-foreground">
                          {task.checkpoint_summary?.last_committed_step !== undefined
                            ? `Committed step ${task.checkpoint_summary.last_committed_step}`
                            : 'Committed watermark not available'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <ReplayClassBadge replayClass={task.policy?.replay_class} />
                          <GovernanceBadge
                            label={task.durability?.resume_supported ? 'Resumable' : 'Non-resumable'}
                            tone={task.durability?.resume_supported ? 'success' : 'neutral'}
                            showDot={false}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <HandoffBadge decision={task.runtime_handoff?.decision} />
                          <GovernanceBadge
                            label={portability.label}
                            tone={portability.experimental ? 'warning' : 'neutral'}
                            showDot={false}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {task.recovery?.skip_reason ?? task.runtime_handoff?.reason ?? task.failure_reason ?? 'Evidence not available'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {getRelativeTime(task.completed_at ?? task.dispatched_at ?? task.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  );
}
