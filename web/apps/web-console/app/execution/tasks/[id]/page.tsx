'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
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
  CheckCircle2,
  Clock3,
  ExternalLink,
  Hash,
  ListOrdered,
  Network,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { useTask, useTaskSteps } from '@/hooks/useTasks';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import {
  CopyButton,
  ExecutionStatusBadge,
  JSONViewer,
  KeyValueGrid,
  LifecycleTimeline,
} from '@/components/execution/shared';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';

// Derive a friendly action label from a WAL step's `step_type`. For tool steps
// (the building blocks of an Action Task) this surfaces the underlying action:
// `filesystem` (read_file), `http_request` (http_call), `database_write`
// (db_write), etc. Falls back to the raw discriminator when unrecognised.
function describeStepAction(stepType: unknown): string {
  if (!stepType || typeof stepType !== 'object') return '—';
  const obj = stepType as Record<string, unknown>;
  const inner = (key: string): Record<string, unknown> | null => {
    const v = obj[key];
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null;
  };
  const tool = inner('ToolCall') ?? inner('tool_call');
  if (tool) {
    const name = tool.tool_name;
    return typeof name === 'string' && name ? `Tool · ${name}` : 'Tool';
  }
  const infer = inner('Inference') ?? inner('inference');
  if (infer) {
    const model = infer.model;
    return typeof model === 'string' && model ? `Inference · ${model}` : 'Inference';
  }
  const robotics = inner('RoboticsAction') ?? inner('robotics_action');
  if (robotics) {
    const action = robotics.action;
    return typeof action === 'string' && action ? `Robotics · ${action}` : 'Robotics';
  }
  if ('BtNode' in obj || 'bt_node' in obj) return 'Behavior tree';
  const key = Object.keys(obj)[0];
  return key ? key : '—';
}

function verificationLabel(status?: string | null): string {
  if (!status) return 'Pending';
  const normalized = String(status).toLowerCase();
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'mismatch') return 'Mismatch';
  if (normalized === 'present') return 'Recorded';
  if (normalized === 'missing') return 'Missing';
  return String(status);
}

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
  const { toast } = useToast();
  const [verifyResult, setVerifyResult] = useState<null | boolean>(null);

  const { data: task, isLoading } = useTask(taskId || null);
  const { data: steps, isLoading: stepsLoading } = useTaskSteps(taskId || null);

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!taskId) {
        throw new Error('Task id is required');
      }
      return api.post<{ proof?: { status?: string } }>(
        `/v1/tasks/${encodeURIComponent(taskId)}/proof/verify`,
        {},
      );
    },
    onSuccess: (result) => {
      const status = result.proof?.status;
      const valid = status === 'verified';
      setVerifyResult(valid);
      toast({
        title: valid ? 'Receipt verified' : 'Receipt mismatch',
        description: valid
          ? 'The stored proof receipt matches the task execution artifact.'
          : 'The stored proof receipt did not match the expected hash.',
      });
    },
    onError: (error: Error) => {
      setVerifyResult(false);
      toast({
        variant: 'destructive',
        title: 'Receipt verification failed',
        description: error.message,
      });
    },
  });

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

    if (task.checkpoint_summary) {
      events.push({
        state: 'CHECKPOINTED',
        timestamp: task.dispatched_at ?? task.created_at,
        note: `Checkpoint recorded at step ${
          task.checkpoint_summary.last_committed_step ?? task.last_step ?? '—'
        }.`,
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

  const receiptSummary = useMemo(() => {
    const receipt = task?.execution_receipt as Record<string, unknown> | undefined;
    const envelope = task?.execution_envelope as Record<string, unknown> | undefined;
    return {
      executionId: typeof receipt?.execution_id === 'string' ? receipt.execution_id : '—',
      receiptHash:
        typeof receipt?.receipt_hash === 'string'
          ? receipt.receipt_hash
          : typeof receipt?.hash === 'string'
            ? receipt.hash
            : undefined,
      receiptSignature:
        typeof receipt?.signature === 'string' ? receipt.signature : undefined,
      envelopeSignature:
        typeof envelope?.signature === 'string' ? envelope.signature : undefined,
    };
  }, [task]);

  const recoveryEvidence = useMemo(() => {
    const walSteps = steps?.steps ?? [];
    const stepIndices = walSteps.map((step) => step.step_index);
    const uniqueStepCount = new Set(stepIndices).size;
    const duplicateStepsDetected = stepIndices.length !== uniqueStepCount;
    const ordered = [...walSteps].sort((a, b) => a.step_index - b.step_index);
    const originalRuntimeId = ordered[0]?.runtime_id;
    const recoveryRuntimeId =
      ordered.find((step) => step.runtime_id && step.runtime_id !== originalRuntimeId)?.runtime_id ??
      (task?.runtime_id && task.runtime_id !== originalRuntimeId ? task.runtime_id : undefined);
    const finalStep = ordered.length > 0 ? Math.max(...stepIndices) : undefined;
    const checkpointStep = task?.checkpoint_summary?.last_committed_step ?? task?.last_step;

    return {
      hasCheckpoint: Boolean(task?.checkpoint_summary || task?.checkpoint_digest),
      recovered: Boolean(originalRuntimeId && recoveryRuntimeId && originalRuntimeId !== recoveryRuntimeId),
      originalRuntimeId,
      recoveryRuntimeId,
      resumedFromStep:
        checkpointStep !== undefined && recoveryRuntimeId ? checkpointStep + 1 : undefined,
      finalStep,
      duplicateStepsDetected,
      walStepCount: walSteps.length,
    };
  }, [steps?.steps, task]);

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
                label="Steps Committed"
                value={
                  steps?.total !== undefined && steps.total > 0
                    ? String(steps.total)
                    : task.checkpoint_summary?.last_committed_step !== undefined
                      ? String((task.checkpoint_summary.last_committed_step ?? 0) + 1)
                      : task.last_step !== undefined
                        ? String(task.last_step + 1)
                        : '—'
                }
                icon={ListOrdered}
              />
              <InspectorStat label="Runtime" value={task.runtime_id ?? '—'} icon={Network} />
              <InspectorStat
                label="Receipt"
                value={verificationLabel(task.proof?.status)}
                icon={Hash}
              />
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

            <Card className="border-gray-200 shadow-none">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-gray-900">
                  Checkpoint and Recovery
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!recoveryEvidence.hasCheckpoint ? (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Clock3 className="h-3.5 w-3.5" />
                    No checkpoint has been recorded for this task.
                  </div>
                ) : (
                  <>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Checkpoint Status',
                          value: task.checkpoint_summary?.checkpoint_status ?? task.status,
                        },
                        {
                          label: 'Last Committed Step',
                          value:
                            task.checkpoint_summary?.last_committed_step !== undefined
                              ? String(task.checkpoint_summary.last_committed_step)
                              : task.last_step !== undefined
                                ? String(task.last_step)
                                : '—',
                        },
                        {
                          label: 'Checkpoint Runtime',
                          value:
                            task.checkpoint_summary?.checkpoint_runtime_id ??
                            task.checkpoint_runtime_id ??
                            '—',
                          mono: Boolean(
                            task.checkpoint_summary?.checkpoint_runtime_id ||
                              task.checkpoint_runtime_id,
                          ),
                        },
                        {
                          label: 'Checkpoint Digest',
                          value:
                            task.checkpoint_summary?.checkpoint_digest ??
                            task.checkpoint_digest ??
                            '—',
                          mono: Boolean(
                            task.checkpoint_summary?.checkpoint_digest ||
                              task.checkpoint_digest,
                          ),
                          copyable:
                            task.checkpoint_summary?.checkpoint_digest ??
                            task.checkpoint_digest,
                        },
                        {
                          label: 'Resume Token',
                          value: task.checkpoint_summary?.resume_token_present
                            ? 'Present'
                            : 'Not exposed',
                        },
                        {
                          label: 'Proof Status',
                          value: task.checkpoint_summary?.proof_status ?? task.proof?.status ?? '—',
                        },
                      ]}
                    />
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Recovered',
                          value: recoveryEvidence.recovered ? 'Yes' : 'No',
                        },
                        {
                          label: 'Original Runtime',
                          value: recoveryEvidence.originalRuntimeId ?? '—',
                          mono: Boolean(recoveryEvidence.originalRuntimeId),
                        },
                        {
                          label: 'Recovery Runtime',
                          value: recoveryEvidence.recoveryRuntimeId ?? '—',
                          mono: Boolean(recoveryEvidence.recoveryRuntimeId),
                        },
                        {
                          label: 'Resumed From Step',
                          value:
                            recoveryEvidence.resumedFromStep !== undefined
                              ? String(recoveryEvidence.resumedFromStep)
                              : '—',
                        },
                        {
                          label: 'Final Step',
                          value:
                            recoveryEvidence.finalStep !== undefined
                              ? String(recoveryEvidence.finalStep)
                              : '—',
                        },
                        {
                          label: 'WAL Step Count',
                          value: String(recoveryEvidence.walStepCount),
                        },
                        {
                          label: 'Duplicate Steps',
                          value: recoveryEvidence.duplicateStepsDetected ? 'Detected' : 'None detected',
                        },
                      ]}
                    />
                  </>
                )}
              </CardContent>
            </Card>

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
                      {
                        label: 'Proof Status',
                        value: task.proof?.status ?? '—',
                      },
                      {
                        label: 'Proof Checked',
                        value: task.proof?.checked_at ? formatDateTime(task.proof.checked_at) : '—',
                      },
                      {
                        label: 'Execution ID',
                        value: task.proof?.execution_id ?? receiptSummary.executionId,
                        mono: (task.proof?.execution_id ?? receiptSummary.executionId) !== '—',
                        copyable:
                          (task.proof?.execution_id ?? receiptSummary.executionId) !== '—'
                            ? (task.proof?.execution_id ?? receiptSummary.executionId)
                            : undefined,
                      },
                    ]}
                  />
                  <div className="flex items-center gap-3 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      disabled={!task.execution_receipt || verifyMutation.isPending}
                      onClick={() => {
                        setVerifyResult(null);
                        verifyMutation.mutate();
                      }}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {verifyMutation.isPending ? 'Verifying…' : 'Verify receipt'}
                    </Button>
                    {(task.proof?.execution_id || task.links?.run) && (
                      <Button asChild variant="outline" size="sm" className="gap-1.5">
                        <Link
                          href={`/execution/runs/${encodeURIComponent(task.proof?.execution_id ?? '')}`}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          View execution run
                        </Link>
                      </Button>
                    )}
                    {verifyResult === true && (
                      <span className="inline-flex items-center gap-1 text-xs text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        Verified against proof store
                      </span>
                    )}
                    {verifyResult === false && !verifyMutation.isPending && (
                      <span className="inline-flex items-center gap-1 text-xs text-red-700">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        Verification failed
                      </span>
                    )}
                  </div>
                  <div>
                    <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-gray-500">
                      Checkpoint Metadata
                    </p>
                    <JSONViewer data={task.checkpoint_metadata ?? {}} defaultOpen />
                  </div>
                  <KeyValueGrid
                    rows={[
                      {
                        label: 'Receipt Hash',
                        value: receiptSummary.receiptHash ?? '—',
                        mono: !!receiptSummary.receiptHash,
                        copyable: receiptSummary.receiptHash,
                      },
                      {
                        label: 'Proof Hash',
                        value: task.proof?.stored_hash ?? '—',
                        mono: !!task.proof?.stored_hash,
                        copyable: task.proof?.stored_hash,
                      },
                      {
                        label: 'Receipt Signature',
                        value: receiptSummary.receiptSignature ?? '—',
                        mono: !!receiptSummary.receiptSignature,
                        copyable: receiptSummary.receiptSignature,
                      },
                      {
                        label: 'Proof Signature',
                        value: task.proof?.signature ?? '—',
                        mono: !!task.proof?.signature,
                        copyable: task.proof?.signature,
                      },
                      {
                        label: 'Envelope Signature',
                        value: receiptSummary.envelopeSignature ?? '—',
                        mono: !!receiptSummary.envelopeSignature,
                        copyable: receiptSummary.envelopeSignature,
                      },
                    ]}
                  />
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
                          <TableHead>Action</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Runtime</TableHead>
                          <TableHead>Input Digest</TableHead>
                          <TableHead>Result Digest</TableHead>
                          <TableHead>Recorded</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {steps.steps.map((step) => (
                          <TableRow key={step.entry_id}>
                            <TableCell className="text-xs text-gray-700">{step.step_index}</TableCell>
                            <TableCell className="text-xs text-gray-700">
                              {describeStepAction(step.step_type)}
                            </TableCell>
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
