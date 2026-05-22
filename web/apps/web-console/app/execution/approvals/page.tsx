'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
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
import { api } from '@/lib/apiClient';
import { toast } from '@/components/ui/use-toast';
import { useTasks, type Task } from '@/hooks/useTasks';
import {
  GovernanceBadge,
  PolicyBadge,
  ReplayClassBadge,
  RiskBadge,
} from '@/components/governance/GovernanceBadge';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { AlertTriangle, ArrowUpRight, CheckCircle2, Clock, RefreshCw, Search } from 'lucide-react';

interface PausedRun {
  id: string;
  agent_id: string;
  namespace?: string;
  paused_at: string;
  pause_reason?: string;
  model?: string;
  violation_type?: string;
}

type DecisionFilter = 'all' | 'allowed' | 'denied' | 'approval_required';
type ReplayFilter = 'all' | 'irreversible' | 'human_gated' | 'retryable' | 'non_retryable';

function hasPolicyDecision(task: Task): boolean {
  return Boolean(task.policy?.decision);
}

export default function ApprovalsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [replayFilter, setReplayFilter] = useState<ReplayFilter>('all');
  const [riskFilter, setRiskFilter] = useState('all');

  const { data: taskData, isLoading: tasksLoading } = useTasks({ limit: 200 });
  const tasks = taskData?.tasks ?? [];

  const { data: runs = [], isLoading, refetch, isFetching } = useQuery<PausedRun[]>({
    queryKey: ['paused-runs'],
    queryFn: async () => {
      try {
        return await api.get<PausedRun[]>('/v1/execution/runs?status=PAUSED');
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: (runId: string) => api.post(`/v1/execution/runs/${runId}/approve`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      toast({ title: 'Run approved', description: 'Execution will resume.' });
    },
    onError: () => toast({ title: 'Approve failed', variant: 'destructive' }),
  });

  const rejectMutation = useMutation({
    mutationFn: (runId: string) =>
      api.post(`/v1/execution/runs/${runId}/reject`, { reason: 'human_rejected' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['paused-runs'] });
      toast({ title: 'Run rejected', description: 'Execution has been terminated.' });
    },
    onError: () => toast({ title: 'Reject failed', variant: 'destructive' }),
  });

  const policyTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks
      .filter(hasPolicyDecision)
      .filter((task) => {
        if (decisionFilter !== 'all' && task.policy?.decision !== decisionFilter) return false;
        if (replayFilter === 'irreversible' && !task.policy?.irreversible) return false;
        if (replayFilter === 'human_gated' && !task.policy?.human_gated) return false;
        if (replayFilter === 'retryable' && task.policy?.replay_class !== 'retryable') return false;
        if (replayFilter === 'non_retryable' && task.policy?.replay_class !== 'non_retryable') return false;
        if (riskFilter !== 'all' && String(task.policy?.risk_level ?? '').toLowerCase() !== riskFilter) return false;
        if (!query) return true;
        return [
          task.task_id,
          task.runtime_id,
          task.policy?.decision_id,
          task.policy?.action_name,
          task.policy?.reason,
          task.policy?.action_digest,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      });
  }, [decisionFilter, replayFilter, riskFilter, search, tasks]);

  const counts = useMemo(
    () => ({
      allowed: tasks.filter((task) => task.policy?.decision === 'allowed').length,
      denied: tasks.filter((task) => task.policy?.decision === 'denied').length,
      approval: tasks.filter((task) => task.policy?.decision === 'approval_required').length,
      humanGated: tasks.filter((task) => task.policy?.human_gated).length,
    }),
    [tasks],
  );

  const filterButton = (label: string, active: boolean, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[11px] font-medium ${
        active
          ? 'border-gray-900 bg-gray-900 text-white'
          : 'border-gray-200 bg-white text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Policy &amp; Approvals</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Recent action policy decisions, human gates, and the current approval queue.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh approvals
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            ['Allowed', counts.allowed, 'success' as const],
            ['Denied', counts.denied, 'danger' as const],
            ['Approval required', counts.approval, 'warning' as const],
            ['Human-gated', counts.humanGated, 'warning' as const],
          ].map(([label, value, tone]) => (
            <div key={String(label)} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">{label}</span>
                <GovernanceBadge label={String(label)} tone={tone} showDot={false} />
              </div>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{String(value)}</div>
            </div>
          ))}
        </div>

        <section className="rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="space-y-3 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Policy Decisions</h2>
                <p className="text-[11px] text-muted-foreground">
                  Built from task policy summaries returned by `GET /v1/tasks`.
                </p>
              </div>
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search action, task, runtime..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {filterButton('All decisions', decisionFilter === 'all', () => setDecisionFilter('all'))}
              {filterButton('Allowed', decisionFilter === 'allowed', () => setDecisionFilter('allowed'))}
              {filterButton('Denied', decisionFilter === 'denied', () => setDecisionFilter('denied'))}
              {filterButton('Approval required', decisionFilter === 'approval_required', () => setDecisionFilter('approval_required'))}
              {filterButton('Irreversible', replayFilter === 'irreversible', () => setReplayFilter(replayFilter === 'irreversible' ? 'all' : 'irreversible'))}
              {filterButton('Human-gated', replayFilter === 'human_gated', () => setReplayFilter(replayFilter === 'human_gated' ? 'all' : 'human_gated'))}
              {filterButton('Retryable', replayFilter === 'retryable', () => setReplayFilter(replayFilter === 'retryable' ? 'all' : 'retryable'))}
              {filterButton('Non-replayable', replayFilter === 'non_retryable', () => setReplayFilter(replayFilter === 'non_retryable' ? 'all' : 'non_retryable'))}
              {['low', 'medium', 'high', 'critical'].map((risk) =>
                filterButton(`${risk} risk`, riskFilter === risk, () => setRiskFilter(riskFilter === risk ? 'all' : risk)),
              )}
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Replay</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasksLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : policyTasks.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">
                    Evidence not available. No policy decisions matching these filters are currently returned by the task API.
                  </TableCell>
                </TableRow>
              ) : (
                policyTasks.map((task) => (
                  <TableRow key={task.task_id} className="hover:bg-gray-50">
                    <TableCell>
                      <Link href={`/execution/tasks/${encodeURIComponent(task.task_id)}`} className="group flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground">{task.policy?.action_name ?? 'Action not available'}</span>
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">{truncateText(task.task_id, 18)}</div>
                    </TableCell>
                    <TableCell><PolicyBadge decision={task.policy?.decision} /></TableCell>
                    <TableCell><RiskBadge risk={task.policy?.risk_level} /></TableCell>
                    <TableCell><ReplayClassBadge replayClass={task.policy?.replay_class} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <GovernanceBadge label={task.policy?.irreversible ? 'Irreversible' : 'Reversible'} tone={task.policy?.irreversible ? 'danger' : 'neutral'} showDot={false} />
                        <GovernanceBadge label={task.policy?.human_gated ? 'Human-gated' : 'No human gate'} tone={task.policy?.human_gated ? 'warning' : 'neutral'} showDot={false} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">
                      {task.policy?.reason ?? 'Evidence not available'}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {task.policy?.created_at ? getRelativeTime(task.policy.created_at) : 'Not available'}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
              {!isLoading && runs.length > 0 && (
                <GovernanceBadge label={`${runs.length} waiting`} tone="warning" />
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Uses the existing paused-run approval workflow when available.
            </p>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Paused</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Violation</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <TableRow key={index}>
                    <TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-10 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-green-500" />
                    <p className="text-xs text-foreground">No actions are waiting for approval.</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      Backend tenant-authored policy rules are experimental; this queue only shows real paused runs.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{truncateText(run.id, 18)}</TableCell>
                    <TableCell>
                      <div className="text-xs text-foreground">{truncateText(run.agent_id, 18)}</div>
                      {run.namespace && <div className="text-[10px] text-muted-foreground">{run.namespace}</div>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {getRelativeTime(run.paused_at)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {run.pause_reason ?? run.model ?? 'Evidence not available'}
                    </TableCell>
                    <TableCell>
                      {run.violation_type ? (
                        <GovernanceBadge label={run.violation_type} tone="danger" />
                      ) : (
                        <span className="text-xs text-muted-foreground">Not available</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => approveMutation.mutate(run.id)}>
                          Approve
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => rejectMutation.mutate(run.id)}>
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center gap-1.5 px-4 py-3 text-xs text-muted-foreground">
            <AlertTriangle className="h-3.5 w-3.5" />
            Approval decisions should be reviewed from the corresponding execution story before actioning high-risk work.
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
