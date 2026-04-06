'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ArrowLeft,
  BrainCircuit,
  Clock3,
  Network,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import { useTask, useTaskSteps } from '@/hooks/useTasks';
import {
  CopyButton,
  ExecutionStatusBadge,
  JSONViewer,
  KeyValueGrid,
  LifecycleTimeline,
} from '@/components/execution/shared';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';

function InspectorStat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof ShieldCheck;
}) {
  return (
    <Card className="border-gray-200 shadow-none">
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{label}</p>
            <p className="mt-2 text-lg font-semibold text-gray-900">{value}</p>
          </div>
          <div className="rounded-full border border-gray-200 bg-gray-50 p-2.5 text-gray-600">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExecutionTaskInspectorPage() {
  const params = useParams<{ id: string }>();
  const taskId = decodeURIComponent(params?.id ?? '');

  const { data: task, isLoading } = useTask(taskId || null);
  const { data: steps, isLoading: stepsLoading } = useTaskSteps(taskId || null);

  const timelineEvents = useMemo(() => {
    if (!task) return [];
    const events = [
      {
        state: 'PENDING',
        timestamp: task.created_at,
        note: 'Task accepted by the control plane.',
      },
    ];

    if (task.dispatched_at) {
      events.push({
        state: 'DISPATCHED',
        timestamp: task.dispatched_at,
        note: task.runtime_id
          ? `Dispatched to runtime ${task.runtime_id}.`
          : 'Dispatched to runtime.',
      });
    }

    if (task.completed_at) {
      events.push({
        state: task.status.toUpperCase(),
        timestamp: task.completed_at,
        note: task.failure_reason
          ? `Completed with failure: ${task.failure_reason}`
          : 'Task reached a terminal state.',
      });
    }

    return events;
  }, [task]);

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/execution/tasks">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to tasks
                </Link>
              </Button>
            </div>
            <h1 className="text-base font-semibold text-gray-900">Task Inspector</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Live durable execution state for agent tasks, including graph state, checkpoints,
              and WAL progression.
            </p>
          </div>
          {taskId && (
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              <span className="font-mono text-[11px] text-gray-700">{truncateText(taskId, 28)}</span>
              <CopyButton value={taskId} />
            </div>
          )}
        </div>

        {isLoading || !task ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-52 w-full" />
            <Skeleton className="h-52 w-full" />
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <InspectorStat label="Status" value={task.status} icon={ShieldCheck} />
              <InspectorStat
                label="Requested Mode"
                value={task.requested_mode ?? '—'}
                icon={BrainCircuit}
              />
              <InspectorStat
                label="Strategy"
                value={task.resolved_strategy ?? '—'}
                icon={Workflow}
              />
              <InspectorStat label="Runtime" value={task.runtime_id ?? '—'} icon={Network} />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
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
                        value: <span className="font-mono text-[11px]">{task.task_id}</span>,
                        copyable: task.task_id,
                      },
                      {
                        label: 'Status',
                        value: <ExecutionStatusBadge status={task.status.toUpperCase()} />,
                      },
                      { label: 'Task Type', value: task.task_type ?? '—' },
                      { label: 'Runtime', value: task.runtime_id ?? '—' },
                      { label: 'Requested Mode', value: task.requested_mode ?? '—' },
                      { label: 'Resolved Strategy', value: task.resolved_strategy ?? '—' },
                      {
                        label: 'Created',
                        value: (
                          <div className="space-y-0.5">
                            <div>{formatDateTime(task.created_at)}</div>
                            <div className="text-gray-400">{getRelativeTime(task.created_at)}</div>
                          </div>
                        ),
                      },
                      {
                        label: 'Dispatched',
                        value: task.dispatched_at ? formatDateTime(task.dispatched_at) : '—',
                      },
                      {
                        label: 'Deadline',
                        value: task.deadline_at ? formatDateTime(task.deadline_at) : '—',
                      },
                      {
                        label: 'Completed',
                        value: task.completed_at ? formatDateTime(task.completed_at) : '—',
                      },
                      {
                        label: 'Checkpoint Digest',
                        value: task.checkpoint_digest ?? '—',
                        mono: true,
                        copyable: task.checkpoint_digest,
                      },
                      {
                        label: 'Last Step',
                        value:
                          task.last_step !== undefined ? String(task.last_step) : '—',
                      },
                      { label: 'Failure Reason', value: task.failure_reason ?? '—' },
                    ]}
                  />
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    Lifecycle
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <LifecycleTimeline events={timelineEvents} />
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Card className="border-gray-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    Durable Graph State
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Graph Blackboard
                    </p>
                    <JSONViewer data={task.graph_blackboard ?? {}} defaultOpen />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Graph Slots
                    </p>
                    <JSONViewer data={task.graph_slots ?? {}} defaultOpen={false} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Graph Nodes
                    </p>
                    <JSONViewer data={task.graph_nodes ?? []} defaultOpen={false} />
                  </div>
                </CardContent>
              </Card>

              <Card className="border-gray-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-gray-900">
                    Signed Artifacts
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <KeyValueGrid
                    rows={[
                      {
                        label: 'Checkpoint Digest',
                        value: task.checkpoint_digest ?? '—',
                        mono: true,
                        copyable: task.checkpoint_digest,
                      },
                      {
                        label: 'Envelope',
                        value: task.execution_envelope ? 'Available' : '—',
                      },
                      {
                        label: 'Receipt',
                        value: task.execution_receipt ? 'Available' : '—',
                      },
                    ]}
                  />
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Checkpoint Metadata
                    </p>
                    <JSONViewer data={task.checkpoint_metadata ?? {}} defaultOpen />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Execution Envelope
                    </p>
                    <JSONViewer data={task.execution_envelope ?? {}} defaultOpen={false} />
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Execution Receipt
                    </p>
                    <JSONViewer data={task.execution_receipt ?? {}} defaultOpen={false} />
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900">WAL Steps</CardTitle>
              </CardHeader>
              <CardContent>
                {stepsLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                ) : !steps || steps.steps.length === 0 ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    No WAL steps available yet.
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-gray-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Step</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Runtime</TableHead>
                          <TableHead>Input Digest</TableHead>
                          <TableHead>Output Digest</TableHead>
                          <TableHead>Recorded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {steps.steps.map((step) => (
                          <TableRow key={step.entry_id}>
                            <TableCell className="text-xs text-gray-700">{step.step_index}</TableCell>
                            <TableCell className="text-xs text-gray-700">{step.status}</TableCell>
                            <TableCell className="font-mono text-xs text-gray-700">
                              {truncateText(step.runtime_id, 18)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600">
                              {truncateText(step.input_digest, 16)}
                            </TableCell>
                            <TableCell className="font-mono text-xs text-gray-600">
                              {step.output_digest ? truncateText(step.output_digest, 16) : '—'}
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
      </div>
    </DashboardLayout>
  );
}
