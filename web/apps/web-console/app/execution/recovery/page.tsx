'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useGovernanceHandoffEvents,
  useGovernancePolicyDecisions,
  useGovernanceRecoveryEvents,
} from '@/hooks/useGovernance';
import type { GovernanceRecoveryEvent } from '@/lib/governance';
import { GovernanceBadge, HandoffBadge, ReplayClassBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { AlertTriangle, ArrowUpRight, History, RotateCcw, Search } from 'lucide-react';

function recoveryTone(event: GovernanceRecoveryEvent): 'success' | 'danger' | 'warning' | 'info' | 'neutral' {
  const eventType = event.event_type.toLowerCase();
  if (event.replay_allowed === false || eventType.includes('skip') || eventType.includes('manual')) return 'warning';
  if (eventType.includes('fail')) return 'danger';
  if (eventType.includes('recover') || eventType.includes('redispatch') || eventType.includes('resume')) return 'success';
  if (eventType.includes('detect') || eventType.includes('interrupt')) return 'warning';
  return 'neutral';
}

function recoveryLabel(event: GovernanceRecoveryEvent): string {
  const eventType = event.event_type.toLowerCase();
  if (event.replay_allowed === false || eventType.includes('skip')) return 'Replay skipped';
  if (eventType.includes('manual')) return 'Manual recovery required';
  if (eventType.includes('fail')) return 'Recovery failed';
  if (eventType.includes('recover') || eventType.includes('resume') || eventType.includes('redispatch')) return 'Recovered';
  if (eventType.includes('interrupt') || eventType.includes('detect')) return 'Interrupted';
  return event.event_type.replace(/[_-]+/g, ' ');
}

export default function RecoveryPage() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [runtimeFilter, setRuntimeFilter] = useState('');
  const [selected, setSelected] = useState<GovernanceRecoveryEvent | null>(null);

  const params = {
    limit: 200,
    event_type: eventFilter,
    runtime_id: runtimeFilter.trim(),
  };
  const { data, isLoading } = useGovernanceRecoveryEvents(params);
  const { data: handoffs } = useGovernanceHandoffEvents({ limit: 200, runtime_id: runtimeFilter.trim() });
  const { data: policies } = useGovernancePolicyDecisions({ limit: 200 });
  const events = data?.items ?? [];
  const handoffItems = handoffs?.items ?? [];
  const policyByTask = useMemo(() => new Map((policies?.items ?? []).map((item) => [item.task_id, item])), [policies]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return events;
    return events.filter((event) =>
      [event.task_id, event.source_runtime_id, event.target_runtime_id, event.checkpoint_digest, event.reason, event.event_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [events, search]);

  const stats = {
    interrupted: events.filter((event) => recoveryLabel(event) === 'Interrupted').length,
    recovered: events.filter((event) => recoveryLabel(event) === 'Recovered').length,
    skipped: events.filter((event) => recoveryLabel(event) === 'Replay skipped').length,
    handoffBlocked: handoffItems.filter((event) => event.decision === 'denied').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Recovery</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tenant-wide recovery events, checkpoint watermarks, replay skips, and runtime handoff decisions.
            </p>
          </div>
          <div className="grid w-full max-w-xl gap-2 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, checkpoint, reason..." className="h-8 pl-8 text-xs" />
            </div>
            <Input value={runtimeFilter} onChange={(event) => setRuntimeFilter(event.target.value)} placeholder="Runtime ID filter" className="h-8 text-xs" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Interrupted', value: stats.interrupted, Icon: AlertTriangle },
            { label: 'Recovered', value: stats.recovered, Icon: RotateCcw },
            { label: 'Replay skipped', value: stats.skipped, Icon: History },
            { label: 'Handoff blocked', value: stats.handoffBlocked, Icon: AlertTriangle },
          ].map(({ label, value, Icon }) => (
            <div key={label} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Icon className="h-3.5 w-3.5" />{label}</div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{value}</div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['all', 'interrupted', 'recovering', 'recovered', 'replay_skipped', 'manual_required', 'failed'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setEventFilter(eventFilter === value ? 'all' : value)}
              className={`rounded border px-2.5 py-1 text-[11px] font-medium ${eventFilter === value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-muted-foreground'}`}
            >
              {value.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <div className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-between px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recovery Events</h2>
              <p className="text-[11px] text-muted-foreground">Backed by `GET /v1/execution/governance/recovery-events`.</p>
            </div>
            {!isLoading && <span className="text-[11px] tabular-nums text-muted-foreground">{filtered.length} of {data?.total ?? 0}</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task</TableHead><TableHead>State</TableHead><TableHead>Checkpoint</TableHead><TableHead>Replay</TableHead><TableHead>Runtime</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No recovery events match these filters.</TableCell></TableRow>
              ) : (
                filtered.map((event) => {
                  const policy = policyByTask.get(event.task_id);
                  return (
                    <TableRow key={event.recovery_event_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(event)}>
                      <TableCell>
                        <Link href={`/execution/tasks/${encodeURIComponent(event.task_id)}`} className="group flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-xs text-foreground">{truncateText(event.task_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </Link>
                      </TableCell>
                      <TableCell><GovernanceBadge label={recoveryLabel(event)} tone={recoveryTone(event)} /></TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {event.checkpoint_digest ? truncateText(event.checkpoint_digest, 18) : 'Not available'}
                        <div className="font-sans text-[10px] text-muted-foreground">{event.last_committed_step !== undefined ? `Committed step ${event.last_committed_step}` : 'Committed watermark not available'}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          <ReplayClassBadge replayClass={policy?.replay_class} />
                          {policy?.irreversible && <GovernanceBadge label="Irreversible" tone="danger" showDot={false} />}
                          {event.replay_allowed === false && <GovernanceBadge label="Blocked" tone="warning" showDot={false} />}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{truncateText(event.target_runtime_id || event.source_runtime_id || 'Not available', 18)}</TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">{event.reason || 'Evidence not available'}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getRelativeTime(event.created_at)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>

        <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-foreground">Runtime Handoff Events</h2>
          <div className="grid gap-2">
            {handoffItems.length === 0 ? (
              <p className="text-xs text-muted-foreground">Evidence not available. No runtime handoff events returned.</p>
            ) : handoffItems.slice(0, 8).map((event) => (
              <Link key={event.handoff_event_id} href={`/execution/tasks/${encodeURIComponent(event.task_id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 px-3 py-2 text-xs hover:bg-gray-50">
                <span className="font-mono text-foreground">{truncateText(event.task_id, 18)}</span>
                <HandoffBadge decision={event.decision} />
                <span className="font-mono text-muted-foreground">{truncateText(event.source_runtime_id || 'unknown', 12)} -&gt; {truncateText(event.target_runtime_id || 'unknown', 12)}</span>
                <span className="text-muted-foreground">{event.reason}</span>
              </Link>
            ))}
          </div>
        </div>

        <SafeEvidenceJsonPanel title="Selected recovery evidence" data={selected} defaultOpen={Boolean(selected)} />
      </div>
    </DashboardLayout>
  );
}
