'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Filter,
  Search,
  ShieldCheck,
  Shield,
} from 'lucide-react';
import { type Task, useTask, useTasks, useTaskSteps } from '@/hooks/useTasks';
import {
  CopyButton,
  ExecutionStatusBadge,
  JSONViewer,
  KeyValueGrid,
} from '@/components/execution/shared';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function proofBucket(task: Task): string {
  if (task.proof?.status) return task.proof.status;
  if (task.execution_receipt) return 'signed';
  if (task.execution_envelope) return 'envelope';
  return 'none';
}

function isUnresolvedTask(task: Task): boolean {
  const bucket = proofBucket(task);
  return bucket === 'pending' || bucket === 'missing' || bucket === 'mismatch' || bucket === 'signed' || bucket === 'envelope';
}

function findRelativeTaskByBuckets(
  tasks: Task[],
  selectedIndex: number,
  buckets: string[],
  direction: -1 | 1,
): string | null {
  if (selectedIndex < 0) return null;
  for (
    let index = selectedIndex + direction;
    index >= 0 && index < tasks.length;
    index += direction
  ) {
    if (buckets.includes(proofBucket(tasks[index]))) return tasks[index].task_id;
  }
  return null;
}

// ─── Proof badge ──────────────────────────────────────────────────────────────

function ProofBadge({ task }: { task: Task }) {
  const bucket = proofBucket(task);
  if (bucket === 'verified') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
      <Shield className="h-3 w-3" /> Verified
    </span>
  );
  if (bucket === 'mismatch') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
      <Shield className="h-3 w-3" /> Mismatch
    </span>
  );
  if (bucket === 'pending') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
      <Clock3 className="h-3 w-3" /> Pending
    </span>
  );
  if (bucket === 'missing') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
      <Shield className="h-3 w-3" /> Missing
    </span>
  );
  if (bucket === 'present') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
      <Shield className="h-3 w-3" /> Proof
    </span>
  );
  if (bucket === 'signed') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
      <Shield className="h-3 w-3" /> Signed
    </span>
  );
  if (bucket === 'envelope') return (
    <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
      <Shield className="h-3 w-3" /> Envelope
    </span>
  );
  return <span className="text-muted-foreground">—</span>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

// Helper to find the latest Action Task V1 task
function findLatestActionTask(tasks: Task[]): Task | null {
  const actionTasks = tasks.filter(
    (t) => t.task_type === 'action_workflow' || (t.action_evidence && t.action_evidence.length > 0)
  );
  if (actionTasks.length === 0) return null;
  // Sort by created_at desc and return the first
  return actionTasks.sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0];
}

export default function ExecutionTasksPage() {
  return (
    <Suspense fallback={null}>
      <ExecutionTasksContent />
    </Suspense>
  );
}

function ExecutionTasksContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(searchParams.get('task'));
  const [copiedLink, setCopiedLink] = useState(false);
  const [proofFilter, setProofFilter] = useState<'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing'>(
    (searchParams.get('proof') as any) || 'all'
  );
  const [prioritizeUnresolved, setPrioritizeUnresolved] = useState(searchParams.get('triage') === 'unresolved');

  const { data, isLoading } = useTasks({ limit: 100 });
  const { data: selectedTask } = useTask(selectedTaskId);
  const { data: selectedSteps } = useTaskSteps(selectedTaskId);

  const tasks = data?.tasks ?? [];

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searched = !query ? tasks : tasks.filter((task) =>
      [task.task_id, task.task_type, task.runtime_id, task.status, task.requested_mode, task.resolved_strategy, task.proof?.status]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );
    const proofFiltered = searched.filter((task) => {
      const bucket = proofBucket(task);
      switch (proofFilter) {
        case 'verified':   return bucket === 'verified';
        case 'pending':    return bucket === 'pending' || bucket === 'signed' || bucket === 'envelope';
        case 'unresolved': return bucket === 'pending' || bucket === 'missing' || bucket === 'mismatch' || bucket === 'signed' || bucket === 'envelope';
        case 'mismatch':   return bucket === 'mismatch';
        case 'missing':    return bucket === 'missing' || bucket === 'none';
        default:           return true;
      }
    });
    if (!prioritizeUnresolved) return proofFiltered;
    return [...proofFiltered].sort((a, b) => {
      const ap = isUnresolvedTask(a) ? 0 : 1;
      const bp = isUnresolvedTask(b) ? 0 : 1;
      return ap - bp;
    });
  }, [search, tasks, proofFilter, prioritizeUnresolved]);

  const stats = useMemo(() => {
    const completed    = tasks.filter((t) => t.status === 'completed').length;
    const active       = tasks.filter((t) => ['pending','dispatched','checkpointed','recovering'].includes(t.status)).length;
    const verifiedProof = tasks.filter((t) => t.proof?.status === 'verified' || t.proof?.verified === true).length;
    const pendingProof  = tasks.filter((t) => t.proof?.status === 'pending' || (t.proof?.status === undefined && !!t.execution_receipt)).length;
    const mismatchProof = tasks.filter((t) => t.proof?.status === 'mismatch').length;
    const missingProof  = tasks.filter((t) => t.proof?.status === 'missing' || proofBucket(t) === 'none').length;
    const unresolvedProof = tasks.filter(isUnresolvedTask).length;
    const needsReview = tasks.filter((t) => 
      t.proof?.status === 'mismatch' || 
      t.proof?.status === 'missing' || 
      t.proof?.status === 'pending' ||
      isUnresolvedTask(t)
    ).length;
    return { completed, active, verifiedProof, pendingProof, mismatchProof, missingProof, unresolvedProof, needsReview };
  }, [tasks]);

  const selectedFilteredIndex = useMemo(
    () => filteredTasks.findIndex((t) => t.task_id === selectedTaskId),
    [filteredTasks, selectedTaskId],
  );
  const unresolvedTaskIds = useMemo(
    () => filteredTasks.filter(isUnresolvedTask).map((t) => t.task_id),
    [filteredTasks],
  );
  const selectedUnresolvedIndex = useMemo(
    () => unresolvedTaskIds.findIndex((id) => id === selectedTaskId),
    [unresolvedTaskIds, selectedTaskId],
  );
  const previousUnresolvedTaskId = useMemo(() => {
    if (selectedFilteredIndex < 0) return null;
    for (let i = selectedFilteredIndex - 1; i >= 0; i--) {
      if (isUnresolvedTask(filteredTasks[i])) return filteredTasks[i].task_id;
    }
    return null;
  }, [filteredTasks, selectedFilteredIndex]);
  const nextUnresolvedTaskId = useMemo(() => {
    if (selectedFilteredIndex < 0) return null;
    for (let i = selectedFilteredIndex + 1; i < filteredTasks.length; i++) {
      if (isUnresolvedTask(filteredTasks[i])) return filteredTasks[i].task_id;
    }
    return null;
  }, [filteredTasks, selectedFilteredIndex]);
  const nextMismatchTaskId = useMemo(
    () => findRelativeTaskByBuckets(filteredTasks, selectedFilteredIndex, ['mismatch'], 1),
    [filteredTasks, selectedFilteredIndex],
  );
  const nextMissingTaskId = useMemo(
    () => findRelativeTaskByBuckets(filteredTasks, selectedFilteredIndex, ['missing', 'none'], 1),
    [filteredTasks, selectedFilteredIndex],
  );

  useEffect(() => {
    if (!selectedTaskId) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) return;
      if ((event.key === 'j' || event.key === 'ArrowDown') && nextUnresolvedTaskId) { event.preventDefault(); updateSelectedTask(nextUnresolvedTaskId); }
      if ((event.key === 'k' || event.key === 'ArrowUp') && previousUnresolvedTaskId) { event.preventDefault(); updateSelectedTask(previousUnresolvedTaskId); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextUnresolvedTaskId, previousUnresolvedTaskId, selectedTaskId]);

  useEffect(() => {
    if (!copiedLink) return;
    const t = window.setTimeout(() => setCopiedLink(false), 1500);
    return () => window.clearTimeout(t);
  }, [copiedLink]);

  useEffect(() => {
    setSearch((c) => { const n = searchParams.get('q') ?? ''; return c === n ? c : n; });
    setProofFilter((c) => { const n = (searchParams.get('proof') as any) || 'all'; return c === n ? c : n; });
    setPrioritizeUnresolved((c) => { const n = searchParams.get('triage') === 'unresolved'; return c === n ? c : n; });
    setSelectedTaskId((c) => { const n = searchParams.get('task'); return c === n ? c : n; });
  }, [searchParams]);

  const syncListState = (
    nextProof: 'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing',
    nextPrioritize: boolean,
    nextSearch: string,
    nextTaskId: string | null,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    nextProof === 'all' ? params.delete('proof') : params.set('proof', nextProof);
    nextPrioritize ? params.set('triage', 'unresolved') : params.delete('triage');
    nextSearch.trim() ? params.set('q', nextSearch.trim()) : params.delete('q');
    nextTaskId ? params.set('task', nextTaskId) : params.delete('task');
    const query = params.toString();
    router.replace(query ? `?${query}` : '/execution/tasks', { scroll: false });
  };

  const updateProofFilter = (nextProof: typeof proofFilter, nextPrioritize = prioritizeUnresolved) => {
    setProofFilter(nextProof);
    setPrioritizeUnresolved(nextPrioritize);
    syncListState(nextProof, nextPrioritize, search, selectedTaskId);
  };
  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch);
    syncListState(proofFilter, prioritizeUnresolved, nextSearch, selectedTaskId);
  };
  const togglePrioritize = () => {
    const next = !prioritizeUnresolved;
    setPrioritizeUnresolved(next);
    syncListState(proofFilter, next, search, selectedTaskId);
  };
  const updateSelectedTask = (nextTaskId: string | null) => {
    setSelectedTaskId(nextTaskId);
    syncListState(proofFilter, prioritizeUnresolved, search, nextTaskId);
  };
  const copyCurrentTriageLink = async () => {
    if (typeof window === 'undefined') return;
    try { await navigator.clipboard.writeText(window.location.href); setCopiedLink(true); } catch {}
  };

  const FILTER_PILLS: { label: string; value: typeof proofFilter; count: number; prioritize?: boolean }[] = [
    { label: 'All',          value: 'all',        count: tasks.length },
    { label: 'Needs Review', value: 'unresolved', count: stats.unresolvedProof, prioritize: true },
    { label: 'Verified',     value: 'verified',   count: stats.verifiedProof },
    { label: 'Mismatch',     value: 'mismatch',   count: stats.mismatchProof, prioritize: true },
    { label: 'Missing',      value: 'missing',    count: stats.missingProof, prioritize: true },
    { label: 'Pending',      value: 'pending',    count: stats.pendingProof, prioritize: true },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="space-y-1">
          <h1 className="text-base font-semibold text-foreground">Agent Tasks</h1>
          <p className="text-xs text-muted-foreground">
            Tasks run through Igris with action evidence, recovery state, and verifiable proof.
          </p>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              Active
            </div>
            <div className="bg-white px-4 pt-4 pb-5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-3xl font-bold text-foreground tabular-nums">{stats.active}</div>
              )}
            </div>
          </div>

          <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
              Completed
            </div>
            <div className="bg-white px-4 pt-4 pb-5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-3xl font-bold text-foreground tabular-nums">{stats.completed}</div>
              )}
            </div>
          </div>

          <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-muted-foreground" />
              Verified Proof
            </div>
            <div className="bg-white px-4 pt-4 pb-5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-3xl font-bold text-foreground tabular-nums">{stats.verifiedProof}</div>
              )}
            </div>
          </div>

          <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              Pending Proof
            </div>
            <div className="bg-white px-4 pt-4 pb-5">
              {isLoading ? <Skeleton className="h-8 w-12" /> : (
                <div className="text-3xl font-bold text-foreground tabular-nums">{stats.pendingProof}</div>
              )}
            </div>
          </div>

        </div>

        {/* ── Task Activity ───────────────────────────────────────────── */}
        <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">

          {/* Card header with search + controls */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-sm font-medium text-foreground">Task Activity</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => updateSearch(e.target.value)}
                  placeholder="task · runtime · mode · strategy"
                  className="pl-8 h-8 text-xs w-56"
                />
              </div>
              <div className="inline-flex items-center gap-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-background px-2.5 py-1 text-xs text-muted-foreground">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <select
                  value={proofFilter}
                  onChange={(e) => updateProofFilter(e.target.value as any)}
                  className="bg-transparent outline-none text-xs"
                >
                  <option value="all">All proof states</option>
                  <option value="verified">Verified</option>
                  <option value="pending">Pending</option>
                  <option value="unresolved">Unresolved</option>
                  <option value="mismatch">Mismatch</option>
                  <option value="missing">Missing</option>
                </select>
              </div>
              <Button
                type="button"
                variant={prioritizeUnresolved ? 'default' : 'outline'}
                size="sm"
                onClick={togglePrioritize}
                className="h-8 text-xs"
              >
                Unresolved first
              </Button>
            </div>
          </div>

          {/* Nested inner area */}
          <div className="bg-white overflow-hidden">

            {/* Filter pills */}
            <div className="flex flex-wrap items-center gap-1.5 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
              {FILTER_PILLS.map((pill) => {
                const active = proofFilter === pill.value;
                return (
                  <button
                    key={pill.value}
                    type="button"
                    onClick={() => updateProofFilter(pill.value, pill.prioritize ?? false)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      active
                        ? 'bg-[#ebebeb] dark:bg-white/10 text-foreground font-semibold'
                        : 'bg-white border border-black/[0.08] dark:border-white/[0.08] text-muted-foreground hover:border-gray-300 hover:text-foreground'
                    }`}
                  >
                    {pill.label}
                    <span className={`rounded-lg px-1.5 py-0.5 text-[10px] leading-none ${
                      active ? 'bg-white/40 text-foreground' : 'bg-muted text-muted-foreground'
                    }`}>
                      {isLoading ? '—' : pill.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="space-y-0">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 px-4 py-3 border-b border-black/[0.08] dark:border-white/[0.08]">
                    <Skeleton className="h-3.5 w-40" />
                    <Skeleton className="h-3.5 w-20" />
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3.5 w-16" />
                  </div>
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="px-4 py-16 text-center text-xs text-foreground">
                No tasks matched this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-white border-b border-black/[0.08] dark:border-white/[0.08]">
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Task ID</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Mode</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Strategy</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Proof</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Runtime</th>
                      <th className="px-4 py-2.5 text-left font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Updated</th>
                      <th className="px-4 py-2.5 text-right font-medium text-foreground uppercase tracking-wide whitespace-nowrap">Inspect</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTasks.map((task) => (
                      <tr
                        key={task.task_id}
                        className="bg-white border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => updateSelectedTask(task.task_id)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1 font-mono text-muted-foreground">
                            <span>{truncateText(task.task_id, 18)}</span>
                            <CopyButton value={task.task_id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <ExecutionStatusBadge status={task.status.toUpperCase()} />
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{task.task_type ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{task.requested_mode ?? '—'}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">{task.resolved_strategy ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <div className="space-y-0.5">
                            <ProofBadge task={task} />
                            {task.proof?.checked_at && (
                              <div className="text-[10px] text-muted-foreground">
                                {getRelativeTime(task.proof.checked_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-muted-foreground">
                          {task.runtime_id ? truncateText(task.runtime_id, 18) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground tabular-nums">
                          {getRelativeTime(task.completed_at ?? task.dispatched_at ?? task.created_at)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            href={`/execution/tasks/${encodeURIComponent(task.task_id)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Inspect
                            <ExternalLink className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Bottom row */}
            <div className="px-4 py-3">
              <span className="text-xs text-foreground">
                {filteredTasks.length} task{filteredTasks.length !== 1 ? 's' : ''}
                {proofFilter !== 'all' ? ` · ${proofFilter}` : ''}
              </span>
            </div>

          </div>
        </div>

      </div>

      {/* ── Task Detail Drawer ───────────────────────────────────────────────── */}
      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && updateSelectedTask(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="space-y-1">
                <SheetTitle>Task Detail</SheetTitle>
                {selectedUnresolvedIndex >= 0 && unresolvedTaskIds.length > 0 && (
                  <p className="text-xs text-gray-500">
                    Unresolved {selectedUnresolvedIndex + 1} of {unresolvedTaskIds.length} ·{' '}
                    <span className="text-gray-400 font-mono">j/k</span> to navigate
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={copyCurrentTriageLink}>
                  <Copy className="h-3 w-3" />
                  {copiedLink ? 'Copied' : 'Copy link'}
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                  disabled={!previousUnresolvedTaskId}
                  onClick={() => previousUnresolvedTaskId && updateSelectedTask(previousUnresolvedTaskId)}>
                  <ChevronLeft className="h-3 w-3" /> Prev
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                  disabled={!nextUnresolvedTaskId}
                  onClick={() => nextUnresolvedTaskId && updateSelectedTask(nextUnresolvedTaskId)}>
                  Next <ChevronRight className="h-3 w-3" />
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  disabled={!nextMismatchTaskId}
                  onClick={() => nextMismatchTaskId && updateSelectedTask(nextMismatchTaskId)}>
                  Mismatch
                </Button>
                <Button type="button" variant="outline" size="sm" className="h-7 text-xs"
                  disabled={!nextMissingTaskId}
                  onClick={() => nextMissingTaskId && updateSelectedTask(nextMissingTaskId)}>
                  Missing
                </Button>
                {selectedTaskId && (
                  <Link
                    href={`/execution/tasks/${encodeURIComponent(selectedTaskId)}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                  >
                    Open <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          </SheetHeader>

          <SheetBody className="space-y-6">
            {!selectedTask ? (
              <div className="space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                {/* Execution Summary */}
                <section>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Execution Summary
                  </h3>
                  <KeyValueGrid
                    rows={[
                      { label: 'Task ID', value: <span className="font-mono text-[11px]">{selectedTask.task_id}</span>, copyable: selectedTask.task_id },
                      { label: 'Status', value: <ExecutionStatusBadge status={selectedTask.status.toUpperCase()} /> },
                      { label: 'Task Type', value: selectedTask.task_type ?? '—' },
                      { label: 'Requested Mode', value: selectedTask.requested_mode ?? '—' },
                      { label: 'Resolved Strategy', value: selectedTask.resolved_strategy ?? '—' },
                      { label: 'Runtime', value: selectedTask.runtime_id ?? '—' },
                      {
                        label: 'Created',
                        value: (
                          <div className="space-y-0.5">
                            <div>{formatDateTime(selectedTask.created_at)}</div>
                            <div className="text-gray-400">{getRelativeTime(selectedTask.created_at)}</div>
                          </div>
                        ),
                      },
                      { label: 'Deadline', value: selectedTask.deadline_at ? formatDateTime(selectedTask.deadline_at) : '—' },
                      { label: 'Completed', value: selectedTask.completed_at ? formatDateTime(selectedTask.completed_at) : '—' },
                      { label: 'Checkpoint', value: selectedTask.checkpoint_digest ?? '—', mono: true, copyable: selectedTask.checkpoint_digest },
                      { label: 'Last Step', value: selectedTask.last_step !== undefined ? String(selectedTask.last_step) : '—' },
                      { label: 'Failure', value: selectedTask.failure_reason ?? '—' },
                    ]}
                  />
                </section>

                <Separator />

                {/* Durable State */}
                <section>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Durable State
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">Checkpoint Metadata</p>
                      <JSONViewer data={selectedTask.checkpoint_metadata ?? {}} defaultOpen />
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">Graph Blackboard</p>
                      <JSONViewer data={selectedTask.graph_blackboard ?? {}} defaultOpen={false} />
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">Graph Slots</p>
                      <JSONViewer data={selectedTask.graph_slots ?? {}} defaultOpen={false} />
                    </div>
                    <div>
                      <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-gray-400">Graph Nodes</p>
                      <JSONViewer data={selectedTask.graph_nodes ?? []} defaultOpen={false} />
                    </div>
                  </div>
                </section>

                <Separator />

                {/* WAL Steps */}
                <section>
                  <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    WAL Steps
                  </h3>
                  {!selectedSteps || selectedSteps.steps.length === 0 ? (
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" /> No WAL step data available yet.
                    </p>
                  ) : (
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-gray-200 bg-gray-50">
                            <th className="px-3 py-2 text-left font-medium text-black">Step</th>
                            <th className="px-3 py-2 text-left font-medium text-black">Status</th>
                            <th className="px-3 py-2 text-left font-medium text-black">Runtime</th>
                            <th className="px-3 py-2 text-left font-medium text-black">Recorded</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSteps.steps.map((step) => (
                            <tr key={step.entry_id} className="border-b border-gray-100 last:border-0">
                              <td className="px-3 py-2 text-gray-700">{step.step_index}</td>
                              <td className="px-3 py-2 text-gray-700">{step.status}</td>
                              <td className="px-3 py-2 font-mono text-gray-700">{truncateText(step.runtime_id, 18)}</td>
                              <td className="px-3 py-2 text-gray-500">{formatDateTime(new Date(step.timestamp_ms))}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
