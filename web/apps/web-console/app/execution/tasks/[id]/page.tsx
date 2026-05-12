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
  ListChecks,
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

// ── Action Task V1 evidence helpers ────────────────────────────────────────────
//
// An Action Task (`task_type: "action_workflow"`) compiles to a runtime
// execution graph whose nodes are sandboxed local tools. Each customer-facing
// step maps to one tool and one durable WAL entry:
//   read_file  -> filesystem      (graph node id `read_file-<i>`)
//   http_call  -> http_request    (graph node id `http_call-<i>`)
//   db_write   -> database_write  (graph node id `db_write-<i>`)
// We surface that sequence from the *real* persisted evidence only — committed
// WAL steps joined with the graph blackboard nodes — never synthesised data.

const ACTION_LABELS: Record<string, string> = {
  read_file: 'Read file',
  http_call: 'HTTP call',
  db_write: 'Database write',
};

const ACTION_TOOL_LABELS: Record<string, string> = {
  filesystem: 'Read file',
  http_request: 'HTTP call',
  database_write: 'Database write',
};

function actionFromNodeId(nodeId: unknown): { action: string; index: number } | null {
  if (typeof nodeId !== 'string') return null;
  const match = nodeId.match(/^(read_file|http_call|db_write)-(\d+)$/);
  if (!match) return null;
  return { action: match[1], index: Number(match[2]) };
}

function toolNameFromStepType(stepType: unknown): string | null {
  if (!stepType || typeof stepType !== 'object') return null;
  const obj = stepType as Record<string, unknown>;
  const tool = (obj.ToolCall ?? obj.tool_call) as Record<string, unknown> | undefined;
  if (tool && typeof tool === 'object' && typeof tool.tool_name === 'string' && tool.tool_name) {
    return tool.tool_name;
  }
  return null;
}

// Best-effort, read-only summary of *what* an action touched, pulled from the
// graph blackboard node (and its `metadata`) when present. Falls back to
// undefined — the target may legitimately not be echoed back in the blackboard.
function describeActionTarget(
  action: string | undefined,
  node: Record<string, unknown> | null | undefined,
): string | undefined {
  if (!node) return undefined;
  const meta =
    node.metadata && typeof node.metadata === 'object' && !Array.isArray(node.metadata)
      ? (node.metadata as Record<string, unknown>)
      : undefined;
  const pick = (...keys: string[]): string | undefined => {
    for (const src of [node, meta]) {
      if (!src) continue;
      for (const key of keys) {
        const value = src[key];
        if (typeof value === 'string' && value) return value;
        if (typeof value === 'number' && Number.isFinite(value)) return String(value);
      }
    }
    return undefined;
  };
  if (action === 'read_file') return pick('path', 'file', 'target');
  if (action === 'http_call') {
    const url = pick('url', 'target');
    const code = pick('status_code', 'http_status', 'response_status');
    if (url && code) return `${url} → ${code}`;
    return url ?? (code ? `HTTP ${code}` : undefined);
  }
  if (action === 'db_write') {
    const table = pick('table');
    const rowId = pick('row_id', 'id');
    if (table && rowId) return `${table} · row ${rowId}`;
    return table ?? (rowId ? `row ${rowId}` : undefined);
  }
  return pick('target', 'url', 'path', 'table');
}

const RESULT_KEY_LABELS: Record<string, string> = {
  bytes_read: 'bytes',
  content_digest: 'content digest',
  status_code: 'HTTP status',
  response_digest: 'response digest',
  row_id: 'row',
  table: 'table',
};

function formatResultSummary(
  summary?: Record<string, string | number> | null,
): string | undefined {
  if (!summary || typeof summary !== 'object') return undefined;
  const parts = Object.entries(summary)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      let display = String(value);
      // Digests are long hex strings — show a recognizable prefix only.
      if (key.endsWith('digest') && display.length > 16) {
        display = `${display.slice(0, 12)}…`;
      }
      return `${RESULT_KEY_LABELS[key] ?? key}: ${display}`;
    });
  return parts.length > 0 ? parts.join(' · ') : undefined;
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
  const [chainResult, setChainResult] = useState<null | boolean>(null);

  const { data: task, isLoading } = useTask(taskId || null);
  const { data: steps, isLoading: stepsLoading } = useTaskSteps(taskId || null);

  // Prefer this session's manual verify result, else the persisted proof
  // summary from the last /proof/verify run; null ⇒ verification not run yet.
  const persistedVerified =
    typeof task?.proof?.verified === 'boolean' ? task.proof.verified : null;
  const persistedChainValid =
    typeof task?.proof?.chain_link_valid === 'boolean' ? task.proof.chain_link_valid : null;
  const effectiveVerified: boolean | null = verifyResult ?? persistedVerified;
  const effectiveChainValid: boolean | null = chainResult ?? persistedChainValid;

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!taskId) {
        throw new Error('Task id is required');
      }
      return api.post<{ proof?: { status?: string; chain_link_valid?: boolean } }>(
        `/v1/tasks/${encodeURIComponent(taskId)}/proof/verify`,
        {},
      );
    },
    onSuccess: (result) => {
      const status = result.proof?.status;
      const valid = status === 'verified';
      setVerifyResult(valid);
      setChainResult(
        typeof result.proof?.chain_link_valid === 'boolean' ? result.proof.chain_link_valid : null,
      );
      toast({
        title: valid ? 'Receipt verified' : 'Receipt mismatch',
        description: valid
          ? 'The stored proof receipt matches the task execution artifact.'
          : 'The stored proof receipt did not match the expected hash.',
      });
    },
    onError: (error: Error) => {
      setVerifyResult(false);
      setChainResult(null);
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

  const actionEvidence = useMemo(() => {
    if (!task) return null;

    type ActionRow = {
      index: number;
      label: string;
      nodeId?: string;
      status?: string;
      runtimeId?: string;
      resultDigest?: string;
      recordedAt?: Date;
      target?: string;
      resultSummary?: string;
      raw?: unknown;
    };

    // Authoritative path: the API exposes a safe `action_evidence` array for
    // Action Task V1 tasks (compiled graph + WAL + checkpoint blackboard,
    // summaries only — no file contents, request/response bodies, or records).
    if (Array.isArray(task.action_evidence) && task.action_evidence.length > 0) {
      const rows: ActionRow[] = [...task.action_evidence]
        .sort((a, b) => a.step_index - b.step_index)
        .map((row) => ({
          index: row.step_index,
          label:
            ACTION_LABELS[row.action_type] ??
            (row.tool_name ? ACTION_TOOL_LABELS[row.tool_name] : undefined) ??
            row.action_type,
          nodeId: row.node_id,
          status: row.status,
          runtimeId: row.runtime_id,
          resultDigest: row.result_digest,
          recordedAt: row.recorded_at ? new Date(row.recorded_at) : undefined,
          target: row.target_summary,
          resultSummary: formatResultSummary(row.result_summary),
          raw: row,
        }));
      return {
        authoritative: true,
        rows,
        receiptAvailable: Boolean(task.execution_receipt),
        proofStatus: task.proof?.status,
      };
    }

    // Fallback path: best-effort join of committed WAL steps with the graph
    // blackboard nodes (older runs, or before the API exposed action_evidence).
    const rawNodes =
      task.graph_nodes && typeof task.graph_nodes === 'object' && !Array.isArray(task.graph_nodes)
        ? (task.graph_nodes as Record<string, unknown>)
        : {};
    const nodeByIndex = new Map<
      number,
      { nodeId: string; action: string; node: Record<string, unknown> }
    >();
    for (const [nodeId, value] of Object.entries(rawNodes)) {
      const parsed = actionFromNodeId(nodeId);
      if (!parsed) continue;
      nodeByIndex.set(parsed.index, {
        nodeId,
        action: parsed.action,
        node: value && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {},
      });
    }

    const isActionWorkflow = task.task_type === 'action_workflow' || nodeByIndex.size > 0;
    if (!isActionWorkflow) return null;

    const walSteps = [...(steps?.steps ?? [])].sort((a, b) => a.step_index - b.step_index);
    const rows: ActionRow[] = [];

    if (walSteps.length > 0) {
      for (const step of walSteps) {
        const meta = nodeByIndex.get(step.step_index);
        const toolName = toolNameFromStepType(step.step_type);
        const label = meta
          ? ACTION_LABELS[meta.action] ?? meta.action
          : toolName
            ? ACTION_TOOL_LABELS[toolName] ?? describeStepAction(step.step_type)
            : describeStepAction(step.step_type);
        rows.push({
          index: step.step_index,
          label,
          nodeId: meta?.nodeId,
          status: step.status,
          runtimeId: step.runtime_id,
          resultDigest: step.output_digest,
          recordedAt: Number.isFinite(step.timestamp_ms) ? new Date(step.timestamp_ms) : undefined,
          target: describeActionTarget(meta?.action, meta?.node),
          raw: meta?.node,
        });
      }
    } else {
      for (const [index, meta] of [...nodeByIndex.entries()].sort((a, b) => a[0] - b[0])) {
        rows.push({
          index,
          label: ACTION_LABELS[meta.action] ?? meta.action,
          nodeId: meta.nodeId,
          status: typeof meta.node.status === 'string' ? meta.node.status : undefined,
          target: describeActionTarget(meta.action, meta.node),
          raw: meta.node,
        });
      }
    }

    return {
      authoritative: false,
      rows,
      receiptAvailable: Boolean(task.execution_receipt),
      proofStatus: task.proof?.status,
    };
  }, [task, steps?.steps]);

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

            {actionEvidence && (
              <Card className="border-gray-200 shadow-none">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ListChecks className="h-4 w-4 text-gray-500" />
                    Action Evidence
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-xs text-gray-500">
                    Every external action this task performed, in execution order — the controlled
                    target, committed status, recorded result, and durable digest.{' '}
                    {actionEvidence.authoritative
                      ? 'Sourced from the task API’s safe action evidence (compiled graph, WAL, and checkpoint); raw WAL, graph nodes, and signed artifacts remain below.'
                      : 'Best-effort view joined from committed WAL steps and graph blackboard nodes — raw WAL, graph nodes, and signed artifacts remain below.'}
                  </p>
                  {actionEvidence.rows.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      No action steps have been committed yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-lg border border-gray-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Result</TableHead>
                            <TableHead>Runtime</TableHead>
                            <TableHead>Result Digest</TableHead>
                            <TableHead>Recorded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {actionEvidence.rows.map((row) => (
                            <TableRow key={`${row.index}-${row.nodeId ?? row.label}`}>
                              <TableCell className="text-xs text-gray-700">{row.index}</TableCell>
                              <TableCell className="text-xs font-medium text-gray-900">
                                {row.label}
                                {row.nodeId && (
                                  <span className="ml-1.5 font-mono text-[10px] text-gray-400">
                                    {row.nodeId}
                                  </span>
                                )}
                              </TableCell>
                              <TableCell className="text-xs">
                                {row.status ? (
                                  <ExecutionStatusBadge status={row.status.toUpperCase()} />
                                ) : (
                                  '—'
                                )}
                              </TableCell>
                              <TableCell className="text-xs text-gray-700">
                                {row.target ?? '—'}
                              </TableCell>
                              <TableCell className="text-xs text-gray-700">
                                {row.resultSummary ?? '—'}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-gray-600">
                                {row.runtimeId ? truncateText(row.runtimeId, 18) : '—'}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-gray-600">
                                {row.resultDigest ? truncateText(row.resultDigest, 16) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-gray-500">
                                {row.recordedAt ? formatDateTime(row.recordedAt) : '—'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-xs">
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      <ShieldCheck className="h-3.5 w-3.5 text-gray-500" />
                      Signed receipt:
                      <span className="font-medium text-gray-900">
                        {actionEvidence.receiptAvailable ? 'Recorded' : 'Not yet recorded'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      <Hash className="h-3.5 w-3.5 text-gray-500" />
                      Receipt verification:
                      <span className="font-medium text-gray-900">
                        {verificationLabel(actionEvidence.proofStatus)}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-gray-700">
                      Chain:
                      <span className="font-medium text-gray-900">
                        {effectiveChainValid === true
                          ? 'Intact'
                          : effectiveChainValid === false
                            ? 'Broken'
                            : 'Unknown — run verification'}
                      </span>
                    </span>
                    {effectiveVerified === true && (
                      <span className="inline-flex items-center gap-1 text-green-700">
                        <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                        Receipt verified
                      </span>
                    )}
                    {effectiveVerified === false && !verifyMutation.isPending && (
                      <span className="inline-flex items-center gap-1 text-red-700">
                        <XCircle className="h-3.5 w-3.5 text-red-500" />
                        Verification failed
                      </span>
                    )}
                    <a
                      href="#signed-artifacts"
                      className="ml-auto inline-flex items-center gap-1 text-gray-500 underline-offset-2 hover:text-gray-800 hover:underline"
                    >
                      Receipt &amp; signatures
                    </a>
                  </div>
                </CardContent>
              </Card>
            )}

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

              <Card id="signed-artifacts" className="scroll-mt-20 border-gray-200 shadow-none">
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
                        setChainResult(null);
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
