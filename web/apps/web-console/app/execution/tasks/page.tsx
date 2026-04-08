'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Activity,
  CheckCircle2,
  Clock3,
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

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Activity;
}) {
  return (
    <Card className="border-gray-200 shadow-none">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
          </div>
          <div className="rounded-full border border-gray-200 bg-gray-50 p-2.5 text-gray-600">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function proofBucket(task: Task): string {
  if (task.proof?.status) return task.proof.status;
  if (task.execution_receipt) return 'signed';
  if (task.execution_envelope) return 'envelope';
  return 'none';
}

export default function ExecutionTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('q') ?? '');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [proofFilter, setProofFilter] = useState<'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing'>(
    (searchParams.get('proof') as 'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing') || 'all'
  );
  const [prioritizeUnresolved, setPrioritizeUnresolved] = useState(searchParams.get('triage') === 'unresolved');

  const { data, isLoading } = useTasks({ limit: 100 });
  const { data: selectedTask } = useTask(selectedTaskId);
  const { data: selectedSteps } = useTaskSteps(selectedTaskId);

  const tasks = data?.tasks ?? [];

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const searched = !query ? tasks : tasks.filter((task) =>
      [
        task.task_id,
        task.task_type,
        task.runtime_id,
        task.status,
        task.requested_mode,
        task.resolved_strategy,
        task.proof?.status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query))
    );

    const proofFiltered = searched.filter((task) => {
      const bucket = proofBucket(task);
      switch (proofFilter) {
        case 'all':
          return true;
        case 'verified':
          return bucket === 'verified';
        case 'pending':
          return bucket === 'pending' || bucket === 'signed' || bucket === 'envelope';
        case 'unresolved':
          return bucket === 'pending' || bucket === 'missing' || bucket === 'mismatch' || bucket === 'signed' || bucket === 'envelope';
        case 'mismatch':
          return bucket === 'mismatch';
        case 'missing':
          return bucket === 'missing' || bucket === 'none';
        default:
          return true;
      }
    });

    if (!prioritizeUnresolved) {
      return proofFiltered;
    }

    return [...proofFiltered].sort((left, right) => {
      const leftBucket = proofBucket(left);
      const rightBucket = proofBucket(right);
      const leftPriority = leftBucket === 'mismatch' || leftBucket === 'missing' || leftBucket === 'pending' || leftBucket === 'signed' || leftBucket === 'envelope' ? 0 : 1;
      const rightPriority = rightBucket === 'mismatch' || rightBucket === 'missing' || rightBucket === 'pending' || rightBucket === 'signed' || rightBucket === 'envelope' ? 0 : 1;
      if (leftPriority !== rightPriority) return leftPriority - rightPriority;
      return 0;
    });
  }, [search, tasks, proofFilter, prioritizeUnresolved]);

  const stats = useMemo(() => {
    const completed = tasks.filter((task) => task.status === 'completed').length;
    const active = tasks.filter((task) =>
      task.status === 'pending' ||
      task.status === 'dispatched' ||
      task.status === 'checkpointed' ||
      task.status === 'recovering'
    ).length;
    const verifiedProof = tasks.filter((task) => task.proof?.status === 'verified').length;
    const pendingProof = tasks.filter((task) =>
      task.proof?.status === 'pending' ||
      ((task.proof?.status === undefined || task.proof?.status === '') && !!task.execution_receipt)
    ).length;
    const mismatchProof = tasks.filter((task) => task.proof?.status === 'mismatch').length;
    const missingProof = tasks.filter((task) =>
      task.proof?.status === 'missing' || proofBucket(task) === 'none'
    ).length;
    const unresolvedProof = tasks.filter((task) => {
      const bucket = proofBucket(task);
      return bucket === 'pending' || bucket === 'missing' || bucket === 'mismatch' || bucket === 'signed' || bucket === 'envelope';
    }).length;
    return { completed, active, verifiedProof, pendingProof, mismatchProof, missingProof, unresolvedProof };
  }, [tasks]);

  const syncListState = (
    nextProof: 'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing',
    nextPrioritize: boolean,
    nextSearch: string,
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    if (nextProof === 'all') {
      params.delete('proof');
    } else {
      params.set('proof', nextProof);
    }
    if (nextPrioritize) {
      params.set('triage', 'unresolved');
    } else {
      params.delete('triage');
    }
    if (nextSearch.trim()) {
      params.set('q', nextSearch.trim());
    } else {
      params.delete('q');
    }
    const query = params.toString();
    router.replace(query ? `?${query}` : '/execution/tasks', { scroll: false });
  };

  const updateProofFilter = (
    nextProof: 'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing',
    nextPrioritize = prioritizeUnresolved,
  ) => {
    setProofFilter(nextProof);
    setPrioritizeUnresolved(nextPrioritize);
    syncListState(nextProof, nextPrioritize, search);
  };

  const updateSearch = (nextSearch: string) => {
    setSearch(nextSearch);
    syncListState(proofFilter, prioritizeUnresolved, nextSearch);
  };

  const togglePrioritize = () => {
    const next = !prioritizeUnresolved;
    setPrioritizeUnresolved(next);
    syncListState(proofFilter, next, search);
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Durable Tasks</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Durable agent execution across Runtime with receipts, checkpoints, and routing
              strategy visibility.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Active" value={isLoading ? '—' : stats.active} icon={Activity} />
          <StatCard
            label="Completed"
            value={isLoading ? '—' : stats.completed}
            icon={CheckCircle2}
          />
          <StatCard
            label="Verified Proof"
            value={isLoading ? '—' : stats.verifiedProof}
            icon={ShieldCheck}
          />
          <StatCard
            label="Pending Proof"
            value={isLoading ? '—' : stats.pendingProof}
            icon={Clock3}
          />
        </div>

        <Card className="border-gray-200 shadow-none">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-900">Task Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative max-w-md flex-1 min-w-[260px]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  value={search}
                  onChange={(event) => updateSearch(event.target.value)}
                  placeholder="Search task, runtime, mode, or strategy"
                  className="pl-9"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600">
                  <Filter className="h-3.5 w-3.5 text-gray-400" />
                  <select
                    value={proofFilter}
                    onChange={(event) =>
                      updateProofFilter(
                        event.target.value as 'all' | 'verified' | 'pending' | 'unresolved' | 'mismatch' | 'missing'
                      )
                    }
                    className="bg-transparent outline-none"
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
                  className="h-9"
                >
                  Unresolved First
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'all' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('all', false)}
                className="h-8"
              >
                All
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {tasks.length}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'unresolved' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('unresolved', true)}
                className="h-8"
              >
                Needs Review
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {stats.unresolvedProof}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'verified' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('verified')}
                className="h-8"
              >
                Verified
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {stats.verifiedProof}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'mismatch' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('mismatch', true)}
                className="h-8"
              >
                Mismatch
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {stats.mismatchProof}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'missing' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('missing', true)}
                className="h-8"
              >
                Missing
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {stats.missingProof}
                </span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant={proofFilter === 'pending' ? 'default' : 'outline'}
                onClick={() => updateProofFilter('pending', true)}
                className="h-8"
              >
                Pending
                <span className="ml-1 rounded-full bg-white/70 px-1.5 py-0.5 text-[10px] text-gray-700">
                  {stats.pendingProof}
                </span>
              </Button>
            </div>

            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                <p className="text-sm text-gray-600">No durable tasks matched this filter.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Task</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Mode</TableHead>
                      <TableHead>Strategy</TableHead>
                      <TableHead>Proof</TableHead>
                      <TableHead>Runtime</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead className="text-right">Inspect</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow
                        key={task.task_id}
                        className="cursor-pointer"
                        onClick={() => setSelectedTaskId(task.task_id)}
                      >
                        <TableCell className="font-mono text-xs text-gray-900">
                          <div className="flex items-center gap-2">
                            <span>{truncateText(task.task_id, 18)}</span>
                            <CopyButton value={task.task_id} />
                          </div>
                        </TableCell>
                        <TableCell>
                          <ExecutionStatusBadge status={task.status.toUpperCase()} />
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {task.task_type ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {task.requested_mode ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {task.resolved_strategy ?? '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-700">
                          {task.proof?.status === 'verified' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                <Shield className="h-3 w-3" />
                                Verified
                              </span>
                              <div className="text-[10px] text-gray-400">
                                {task.proof.checked_at
                                  ? `checked ${getRelativeTime(task.proof.checked_at)}`
                                  : 'proof cached'}
                              </div>
                            </div>
                          ) : task.proof?.status === 'mismatch' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-medium text-red-700">
                                <Shield className="h-3 w-3" />
                                Mismatch
                              </span>
                              <div className="text-[10px] text-gray-400">
                                {task.proof.checked_at
                                  ? `checked ${getRelativeTime(task.proof.checked_at)}`
                                  : 'needs attention'}
                              </div>
                            </div>
                          ) : task.proof?.status === 'pending' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                                <Clock3 className="h-3 w-3" />
                                Pending
                              </span>
                              <div className="text-[10px] text-gray-400">awaiting lineage sync</div>
                            </div>
                          ) : task.proof?.status === 'missing' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                                <Shield className="h-3 w-3" />
                                Missing
                              </span>
                              <div className="text-[10px] text-gray-400">
                                {task.proof.checked_at
                                  ? `checked ${getRelativeTime(task.proof.checked_at)}`
                                  : 'not reconciled yet'}
                              </div>
                            </div>
                          ) : task.proof?.status === 'present' ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                <Shield className="h-3 w-3" />
                                Proof
                              </span>
                              <div className="text-[10px] text-gray-400">
                                {task.proof.checked_at
                                  ? `checked ${getRelativeTime(task.proof.checked_at)}`
                                  : 'present in lineage'}
                              </div>
                            </div>
                          ) : task.execution_receipt ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10px] font-medium text-green-700">
                                <Shield className="h-3 w-3" />
                                Signed
                              </span>
                              <div className="text-[10px] text-gray-400">proof not checked yet</div>
                            </div>
                          ) : task.execution_envelope ? (
                            <div className="space-y-1">
                              <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                <Shield className="h-3 w-3" />
                                Envelope
                              </span>
                              <div className="text-[10px] text-gray-400">receipt pending</div>
                            </div>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs text-gray-700">
                          {task.runtime_id ? truncateText(task.runtime_id, 18) : '—'}
                        </TableCell>
                        <TableCell className="text-xs text-gray-500">
                          {getRelativeTime(task.completed_at ?? task.dispatched_at ?? task.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Link
                            href={`/execution/tasks/${encodeURIComponent(task.task_id)}`}
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                          >
                            Inspect
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Sheet open={!!selectedTaskId} onOpenChange={(open) => !open && setSelectedTaskId(null)}>
        <SheetContent className="w-full sm:max-w-2xl">
          <SheetHeader>
            <div className="flex items-center justify-between gap-3">
              <SheetTitle>Task Detail</SheetTitle>
              {selectedTaskId && (
                <Link
                  href={`/execution/tasks/${encodeURIComponent(selectedTaskId)}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                >
                  Open inspector
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              )}
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
                <Card className="border-gray-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-900">
                      Execution Summary
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Task ID',
                          value: (
                            <span className="font-mono text-[11px]">
                              {selectedTask.task_id}
                            </span>
                          ),
                          copyable: selectedTask.task_id,
                        },
                        {
                          label: 'Status',
                          value: (
                            <ExecutionStatusBadge status={selectedTask.status.toUpperCase()} />
                          ),
                        },
                        { label: 'Task Type', value: selectedTask.task_type ?? '—' },
                        { label: 'Requested Mode', value: selectedTask.requested_mode ?? '—' },
                        {
                          label: 'Resolved Strategy',
                          value: selectedTask.resolved_strategy ?? '—',
                        },
                        { label: 'Runtime', value: selectedTask.runtime_id ?? '—' },
                        {
                          label: 'Created',
                          value: (
                            <div className="space-y-0.5">
                              <div>{formatDateTime(selectedTask.created_at)}</div>
                              <div className="text-gray-400">
                                {getRelativeTime(selectedTask.created_at)}
                              </div>
                            </div>
                          ),
                        },
                        {
                          label: 'Deadline',
                          value: selectedTask.deadline_at
                            ? formatDateTime(selectedTask.deadline_at)
                            : '—',
                        },
                        {
                          label: 'Completed',
                          value: selectedTask.completed_at
                            ? formatDateTime(selectedTask.completed_at)
                            : '—',
                        },
                        {
                          label: 'Checkpoint',
                          value: selectedTask.checkpoint_digest ?? '—',
                          mono: true,
                          copyable: selectedTask.checkpoint_digest,
                        },
                        {
                          label: 'Last Step',
                          value:
                            selectedTask.last_step !== undefined
                              ? String(selectedTask.last_step)
                              : '—',
                        },
                        {
                          label: 'Failure',
                          value: selectedTask.failure_reason ?? '—',
                        },
                      ]}
                    />
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-900">
                      Durable State
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                        Checkpoint Metadata
                      </p>
                      <JSONViewer data={selectedTask.checkpoint_metadata ?? {}} defaultOpen />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                        Graph Blackboard
                      </p>
                      <JSONViewer data={selectedTask.graph_blackboard ?? {}} defaultOpen={false} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                        Graph Slots
                      </p>
                      <JSONViewer data={selectedTask.graph_slots ?? {}} defaultOpen={false} />
                    </div>
                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                        Graph Nodes
                      </p>
                      <JSONViewer data={selectedTask.graph_nodes ?? []} defaultOpen={false} />
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-gray-200 shadow-none">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-gray-900">
                      WAL Steps
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!selectedSteps || selectedSteps.steps.length === 0 ? (
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Clock3 className="h-3.5 w-3.5" />
                        No WAL step data available yet.
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-gray-200">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Step</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Runtime</TableHead>
                              <TableHead>Recorded</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedSteps.steps.map((step) => (
                              <TableRow key={step.entry_id}>
                                <TableCell className="text-xs text-gray-700">
                                  {step.step_index}
                                </TableCell>
                                <TableCell className="text-xs text-gray-700">
                                  {step.status}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-gray-700">
                                  {truncateText(step.runtime_id, 18)}
                                </TableCell>
                                <TableCell className="text-xs text-gray-500">
                                  {formatDateTime(new Date(step.timestamp_ms))}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </SheetBody>
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
