'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OnboardingModal } from '@/components/onboarding/OnboardingModal';
import { ErrorState } from '@/components/states/ErrorState';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { fetchExecutionReceipts, fetchExecutionRuns, fetchExecutionViolations, type ExecutionReceipt, type ExecutionRun, type ExecutionViolation } from '@/lib/executionRuns';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { type Task, useTasks } from '@/hooks/useTasks';
import {
  AlertTriangle,
  ArrowRight,
  Hash,
  ListChecks,
  PlayCircle,
  RotateCcw,
} from 'lucide-react';

function isActionTask(task: Task): boolean {
  return task.task_type === 'action_workflow' || Boolean(task.action_evidence?.length);
}

function proofLabel(task: Task): string {
  if (task.proof?.verified === true || task.proof?.status === 'verified') return 'Verified';
  if (task.proof?.status === 'mismatch') return 'Mismatch';
  if (task.proof?.status === 'missing') return 'Missing';
  if (task.proof?.status === 'present') return 'Recorded';
  if (task.execution_receipt || task.proof?.status === 'pending') return 'Pending';
  return 'Not recorded';
}

function recoveryLabel(task: Task): string {
  const evidence = task.action_evidence ?? [];
  const runtimes = new Set(evidence.map((row) => row.runtime_id).filter(Boolean));
  if (runtimes.size > 1) return 'Recovered';
  if (task.status === 'recovering') return 'Recovering';
  if (task.checkpoint_summary || task.checkpoint_digest) return 'Checkpointed';
  if (task.recovery?.redispatch_eligible) return 'Ready';
  return 'No recovery';
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: typeof PlayCircle;
  loading: boolean;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        {label}
      </div>
      <div className="bg-white px-4 pt-4 pb-5">
        {loading ? <Skeleton className="h-8 w-16" /> : <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>}
      </div>
    </div>
  );
}

function Surface({
  title,
  link,
  children,
}: {
  title: string;
  link?: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <span className="text-xs font-medium text-foreground">{title}</span>
        {link && (
          <Link href={link.href} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
            {link.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        )}
      </div>
      <div className="bg-white">{children}</div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: tasksData, isLoading: tasksLoading, error: tasksError, refetch: refetchTasks } = useTasks({ limit: 50 });

  const { data: runs = [], isLoading: runsLoading, error: runsError, refetch: refetchRuns } = useQuery<ExecutionRun[]>({
    queryKey: ['dashboard-runs'],
    queryFn: () => fetchExecutionRuns({ limit: 20, sort: 'created_at:desc', range: '24h' }, { strict: true }),
    retry: false,
  });

  const { data: receipts = [], isLoading: receiptsLoading, error: receiptsError, refetch: refetchReceipts } = useQuery<ExecutionReceipt[]>({
    queryKey: ['dashboard-receipts'],
    queryFn: () => fetchExecutionReceipts(40, { strict: true }),
    retry: false,
  });

  const { data: violations = [], isLoading: violationsLoading, error: violationsError, refetch: refetchViolations } = useQuery<ExecutionViolation[]>({
    queryKey: ['dashboard-violations'],
    queryFn: () => fetchExecutionViolations('last_24h', 500, { strict: true }),
    retry: false,
  });

  const tasks = tasksData?.tasks ?? [];

  const digest = useMemo(() => {
    const verifiedReceipts = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status === 'verified';
    }).length;
    const pendingReceipts = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status !== 'verified';
    }).length;
    const activeTasks = tasks.filter((task) => ['pending', 'dispatched', 'checkpointed', 'recovering'].includes(task.status)).length;
    const completedTasks = tasks.filter((task) => task.status === 'completed').length;
    const failedTasks = tasks.filter((task) => ['failed', 'cancelled', 'expired'].includes(task.status)).length;
    const proofMismatchTasks = tasks.filter((task) => task.proof?.status === 'mismatch').length;
    const recoveredTasks = tasks.filter((task) => recoveryLabel(task) === 'Recovered').length;
    return {
      activeTasks,
      completedTasks,
      verifiedReceipts,
      pendingReceipts,
      failedTasks,
      proofMismatchTasks,
      recoveredTasks,
      policyViolations: violations.length,
    };
  }, [receipts, tasks, violations]);

  const latestActionTask = useMemo(() => {
    return [...tasks]
      .filter(isActionTask)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
  }, [tasks]);

  const verificationCoverage = useMemo(() => {
    if (!receipts.length) return 0;
    const verified = receipts.filter((receipt) => {
      const status = String(receipt.status ?? receipt.verification_status ?? '').toLowerCase();
      return status === 'verified';
    }).length;
    return Math.round((verified / receipts.length) * 100);
  }, [receipts]);

  const pageError = tasksError ?? runsError ?? receiptsError ?? violationsError;

  const attentionItems = [
    {
      label: 'Failed tasks',
      value: digest.failedTasks,
      href: '/execution/tasks',
      detail: 'Open failed or cancelled tasks first.',
    },
    {
      label: 'Pending verification',
      value: digest.pendingReceipts,
      href: '/proof/receipts',
      detail: 'Verify receipts before relying on proof state.',
    },
    {
      label: 'Proof mismatch',
      value: digest.proofMismatchTasks,
      href: '/execution/tasks?proof=mismatch',
      detail: 'Review mismatched task proof.',
    },
    {
      label: 'Policy violations',
      value: digest.policyViolations,
      href: '/proof/violations',
      detail: 'Inspect bounded-action evidence.',
    },
  ];

  if (pageError) {
    return (
      <DashboardLayout>
        <ErrorState
          error={pageError}
          title="Verified execution data is unavailable"
          description="Dashboard metrics are shown only from live backend data on this page."
          onRetry={() => {
            void refetchTasks();
            void refetchRuns();
            void refetchReceipts();
            void refetchViolations();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <OnboardingModal />
      <div className="space-y-6">
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">Operator Overview</h1>
          <p className="text-xs text-muted-foreground">
            Find tasks that need attention, proof that needs verification, and runtimes that may affect execution.
          </p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-5 gap-3">
          <SummaryCard label="Active tasks" value={digest.activeTasks} icon={PlayCircle} loading={tasksLoading} />
          <SummaryCard label="Completed tasks" value={digest.completedTasks} icon={ListChecks} loading={tasksLoading} />
          <SummaryCard label="Verified receipts" value={digest.verifiedReceipts} icon={Hash} loading={receiptsLoading} />
          <SummaryCard label="Recovered tasks" value={digest.recoveredTasks} icon={RotateCcw} loading={tasksLoading} />
          <SummaryCard label="Policy violations" value={digest.policyViolations} icon={AlertTriangle} loading={violationsLoading} />
        </div>

        <Surface title="Needs Attention">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 px-4 py-4">
            {attentionItems.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-lg border border-gray-200 bg-white px-3 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-medium text-gray-800">{item.label}</p>
                  <span className={`text-sm font-semibold tabular-nums ${item.value > 0 ? 'text-amber-700' : 'text-gray-500'}`}>
                    {item.value}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-gray-500">{item.value > 0 ? item.detail : 'No current records.'}</p>
              </Link>
            ))}
          </div>
        </Surface>

        <div className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-4">
          <Surface title="Latest Action Task" link={{ href: '/execution/tasks', label: 'All tasks' }}>
            <div className="px-4 py-4 min-h-[250px]">
              {tasksLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-8 w-24" />
                </div>
              ) : !latestActionTask ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No Action Task has been returned yet.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-foreground">{truncateText(latestActionTask.task_id, 28)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Last activity {getRelativeTime(latestActionTask.completed_at ?? latestActionTask.dispatched_at ?? latestActionTask.created_at)}
                      </p>
                    </div>
                    <StatusBadge status={latestActionTask.status.toUpperCase()} />
                  </div>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Actions</p>
                      <p className="mt-1 text-sm font-semibold">{latestActionTask.action_evidence?.length ?? 0}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Recovery</p>
                      <p className="mt-1 text-sm font-semibold">{recoveryLabel(latestActionTask)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Proof</p>
                      <p className="mt-1 text-sm font-semibold">{proofLabel(latestActionTask)}</p>
                    </div>
                    <div className="rounded-lg border border-gray-200 px-3 py-2.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Runtime</p>
                      <p className="mt-1 text-sm font-semibold font-mono">{latestActionTask.runtime_id ? truncateText(latestActionTask.runtime_id, 12) : '—'}</p>
                    </div>
                  </div>
                  <Link
                    href={`/execution/tasks/${encodeURIComponent(latestActionTask.task_id)}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
                  >
                    Open task
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
              )}
            </div>
          </Surface>

          <Surface title="Verify" link={{ href: '/proof/receipts', label: 'Receipts' }}>
            <div className="px-4 py-4 space-y-4">
              <div>
                <div className="flex items-center justify-between text-xs text-gray-700 mb-2">
                  <span>Receipts verified</span>
                  <span className="font-medium tabular-nums">{verificationCoverage}%</span>
                </div>
                <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-green-500" style={{ width: `${verificationCoverage}%` }} />
                </div>
              </div>
              <div className="space-y-3">
                {receiptsLoading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))
                ) : receipts.length === 0 ? (
                  <p className="text-xs text-gray-500">No receipt records were returned.</p>
                ) : (
                  receipts.slice(0, 4).map((receipt) => {
                    const status = String(receipt.status ?? receipt.verification_status ?? 'pending');
                    return (
                      <div key={receipt.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-medium text-gray-800">{status}</span>
                          <span className="text-[11px] text-gray-500">{getRelativeTime(receipt.timestamp)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-gray-600">
                          {truncateText(receipt.execution_id, 18)} · {truncateText(receipt.agent_id, 14)}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </Surface>
        </div>

        <Surface title="Recovery Summary" link={{ href: '/execution/tasks', label: 'Task recovery' }}>
          <div className="px-4 py-4">
            <div className="rounded-lg border border-gray-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium text-gray-800">Recovered tasks</p>
                <span className="text-sm font-semibold tabular-nums text-gray-900">{digest.recoveredTasks}</span>
              </div>
              <p className="mt-1 text-[11px] text-gray-500">
                Recovery evidence is visible on Task Detail. Clean-host or cumulative recovery status is not inferred here.
              </p>
            </div>
          </div>
        </Surface>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_1fr] gap-4">
          <Surface title="Bounded action violations" link={{ href: '/proof/violations', label: 'Violations' }}>
            <div className="divide-y divide-gray-100 min-h-[280px]">
              {violationsLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="px-4 py-3">
                    <Skeleton className="h-3 w-24 mb-1.5" />
                    <Skeleton className="h-3 w-32" />
                  </div>
                ))
              ) : violations.length === 0 ? (
                <div className="px-4 py-10 text-center text-xs text-black">No policy violation records were returned.</div>
              ) : (
                violations.slice(0, 6).map((violation) => (
                  <div key={violation.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-xs font-medium text-gray-700">
                        {violation.violation_type || violation.policy_rule || 'Violation recorded'}
                      </span>
                      <span className="text-[11px] text-black">{getRelativeTime(violation.timestamp)}</span>
                    </div>
                    <p className="text-[11px] text-black mt-0.5">
                      {truncateText(violation.agent_id, 16)} · {truncateText(violation.device_id, 14)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Surface>

          <Surface title="Execution records" link={{ href: '/execution/runs', label: 'Runs' }}>
            <div className="px-4 py-4 space-y-3 min-h-[280px]">
              {runsLoading ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="space-y-1">
                    <Skeleton className="h-3 w-28" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                ))
              ) : runs.length === 0 ? (
                <p className="text-xs text-gray-500">No execution outcomes were returned.</p>
              ) : (
                runs
                  .slice(0, 8)
                  .map((run) => (
                    <div key={run.id} className="rounded-lg border border-gray-200 bg-white px-3 py-2.5">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[11px] font-medium text-gray-800">{truncateText(run.id, 18)}</p>
                        <StatusBadge status={run.has_violation ? 'VIOLATION' : run.status} />
                      </div>
                      <p className="mt-1 text-[11px] text-gray-600 leading-relaxed">
                        {run.runtime_id ? `Runtime ${truncateText(run.runtime_id, 14)}` : truncateText(run.agent_id, 16)} · {run.verification_status || 'verification not recorded'}
                      </p>
                    </div>
                  ))
              )}
            </div>
          </Surface>
        </div>
      </div>
    </DashboardLayout>
  );
}
