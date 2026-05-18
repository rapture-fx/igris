'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ErrorState } from '@/components/states/ErrorState';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  CopyButton,
  ExecutionStatusBadge,
  JSONViewer,
  KeyValueGrid,
  ReceiptVerificationPanel,
} from '@/components/execution/shared';
import {
  fetchExecutionRun,
  formatDurationMs,
  type ExecutionRunDetail,
  type ExecutionViolation,
} from '@/lib/executionRuns';
import { buildExecutionTimeline } from '@/lib/executionTimeline';
import { api } from '@/lib/apiClient';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  Hash,
  Pause,
  Shield,
  Terminal,
  XCircle,
} from 'lucide-react';

function formatSnapshotValue(value: unknown): string {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.length ? value.map((item) => String(item)).join(', ') : '—';
  try {
    return JSON.stringify(value);
  } catch {
    return '—';
  }
}

function unixMsToDisplay(value: unknown): string {
  if (typeof value !== 'number' || Number.isNaN(value) || value <= 0) return '—';
  return formatDateTime(new Date(value).toISOString());
}

function verificationLabel(status?: string | null): string {
  if (!status) return 'Pending';
  const normalized = String(status).toLowerCase();
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'unverified') return 'Unverified';
  if (normalized === 'mismatch') return 'Mismatch';
  if (normalized === 'present') return 'Recorded';
  if (normalized === 'missing') return 'Missing';
  return String(status);
}

function runStatusAllowsPause(status: string): boolean {
  return status === 'RUNNING';
}

function runStatusAllowsCancel(status: string): boolean {
  return status === 'RUNNING';
}

function violationRows(run: ExecutionRunDetail, violations: ExecutionViolation[]) {
  if (violations.length > 0) {
    return violations.map((violation) => ({
      id: violation.id,
      label: violation.violation_type || violation.policy_rule || 'Violation recorded',
      observed: violation.observed_value ?? '—',
      limit: violation.limit_value ?? '—',
      timestamp: violation.timestamp,
    }));
  }

  if (run.has_violation) {
    return [{
      id: `${run.id}-violation`,
      label: 'Violation recorded',
      observed: 'Not recorded',
      limit: 'Not recorded',
      timestamp: run.ended_at ?? run.started_at,
    }];
  }

  return [];
}

function Surface({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-gray-200 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <Icon className="h-4 w-4 text-gray-500" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export default function ExecutionRunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = decodeURIComponent(params?.id ?? '');
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifyResult, setVerifyResult] = useState<null | boolean>(null);

  const { data: run, isLoading: runLoading, error: runError, refetch: refetchRun } = useQuery<ExecutionRunDetail | null>({
    queryKey: ['execution-run-detail', runId],
    queryFn: () => fetchExecutionRun(runId, { strict: true }),
    enabled: !!runId,
    retry: false,
  });

  const receipt = run?.receipt ?? null;
  const violations = run?.violations ?? [];
  const routeDecision = run?.route_decision ?? 'Route decision was not recorded for this run.';
  const providerDisplay = run?.provider ?? 'Not recorded';
  const providerPath = run?.provider_path ?? 'Provider path was not recorded for this run.';
  const runtimeId = run?.runtime_id ?? run?.device_id ?? '';
  const runtimeLabel = run?.runtime_label ?? 'Not recorded';
  const receiptStatus = verificationLabel(receipt?.verification_status ?? run?.verification_status);
  const violationList = useMemo(() => run ? violationRows(run, violations) : [], [run, violations]);
  const policySnapshot = run?.policy_snapshot ?? null;
  const capabilitySnapshot = run?.capability_snapshot ?? null;
  const timeline = useMemo(() => buildExecutionTimeline(run?.events, run?.logs), [run?.events, run?.logs]);

  const refreshExecutionQueries = async () => {
    await refetchRun();
    await queryClient.invalidateQueries({ queryKey: ['execution-runs'] });
  };

  const pauseMutation = useMutation({
    mutationFn: () => api.post(`/v1/execution/runs/${runId}/pause`, {}),
    onSuccess: async () => {
      toast({ title: 'Run paused' });
      await refreshExecutionQueries();
    },
    onError: () => toast({ title: 'Failed to pause run', variant: 'destructive' }),
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.post(`/v1/execution/runs/${runId}/cancel`, {}),
    onSuccess: async () => {
      toast({ title: 'Run cancelled' });
      await refreshExecutionQueries();
    },
    onError: () => toast({ title: 'Failed to cancel run', variant: 'destructive' }),
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      api.post<{ verified: boolean; message: string }>('/proof/receipts/verify', {
        execution_id: runId,
        expected_hash: receipt?.hash ?? run?.receipt_hash,
        signature: receipt?.signature ?? run?.receipt_signature,
      }),
    onSuccess: (result) => {
      setVerifyResult(result.verified);
      toast({
        title: result.verified ? 'Receipt check passed' : 'Receipt check failed',
        description: result.message,
        variant: result.verified ? 'default' : 'destructive',
      });
    },
    onError: () => {
      setVerifyResult(false);
      toast({ title: 'Receipt verification failed', variant: 'destructive' });
    },
  });

  if (runError) {
    return (
      <DashboardLayout>
        <ErrorState
          error={runError}
          title="Run detail is unavailable"
          description="This page requires the live run-detail endpoint and does not fall back to mock records."
          onRetry={() => {
            void refetchRun();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="mb-2">
              <Button asChild variant="outline" size="sm" className="gap-1.5">
                <Link href="/execution/runs">
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to runs
                </Link>
              </Button>
            </div>
            <h1 className="text-base font-semibold text-gray-900">Execution Record {truncateText(runId, 24)}</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Runtime events, receipt references, and task linkage for this execution.
            </p>
          </div>
          {runId && (
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5">
              <span className="font-mono text-[11px] text-gray-700">{runId}</span>
              <CopyButton value={runId} />
            </div>
          )}
        </div>

        {runLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : !run ? (
          <Card className="border-gray-200 shadow-none">
            <CardContent className="py-10">
              <p className="text-sm text-gray-700">No execution record was found for this run id.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Surface title="Status" icon={CheckCircle2}>
                <div className="flex items-center justify-between">
                  <ExecutionStatusBadge status={run.status} />
                  <span className="text-xs text-gray-500">{getRelativeTime(run.started_at)}</span>
                </div>
              </Surface>
              <Surface title="Receipt" icon={Hash}>
                <p className="text-lg font-semibold text-gray-900">{receiptStatus}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {receipt?.signed || run.receipt_signature ? 'Signed execution receipt present.' : 'No signed receipt was returned.'}
                </p>
              </Surface>
              <Surface title="Violations" icon={AlertTriangle}>
                <p className="text-lg font-semibold text-gray-900">{violationList.length}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {run.has_violation ? 'Policy or runtime enforcement was triggered.' : 'No violation was recorded.'}
                </p>
              </Surface>
              <Surface title="Duration" icon={Clock3}>
                <p className="text-lg font-semibold text-gray-900">
                  {run.duration_ms != null ? formatDurationMs(run.duration_ms) : '—'}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {run.duration_ms != null ? `${run.duration_ms} ms` : 'Run still active or duration unavailable.'}
                </p>
              </Surface>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {runStatusAllowsPause(run.status) && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={pauseMutation.isPending} onClick={() => pauseMutation.mutate()}>
                  <Pause className="h-3.5 w-3.5" />
                  Pause
                </Button>
              )}
              {runStatusAllowsCancel(run.status) && (
                <Button variant="outline" size="sm" className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate()}>
                  <XCircle className="h-3.5 w-3.5" />
                  Cancel
                </Button>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Surface title="Execution metadata" icon={FileText}>
                <KeyValueGrid
                  rows={[
                    { label: 'Run ID', value: run.id, mono: true, copyable: run.id },
                    {
                      label: 'Task ID',
                      value: run.task_id ? (
                        <Link
                          href={`/execution/tasks/${encodeURIComponent(run.task_id)}`}
                          className="font-mono text-[11px] text-blue-700 hover:underline"
                        >
                          {run.task_id}
                        </Link>
                      ) : (
                        '—'
                      ),
                      copyable: run.task_id,
                    },
                    { label: 'Agent ID', value: run.agent_id, mono: true, copyable: run.agent_id },
                    { label: 'Runtime ID', value: runtimeId || 'Not recorded', mono: true, copyable: runtimeId || undefined },
                    { label: 'Status', value: <ExecutionStatusBadge status={run.status} /> },
                    { label: 'Started', value: formatDateTime(run.started_at) },
                    { label: 'Ended', value: run.ended_at ? formatDateTime(run.ended_at) : '—' },
                    {
                      label: 'Duration',
                      value: run.duration_ms != null ? `${formatDurationMs(run.duration_ms)} (${run.duration_ms} ms)` : '—',
                    },
                  ]}
                />
              </Surface>

              <Surface title="Advanced routing metadata" icon={Shield}>
                <KeyValueGrid
                  rows={[
                    { label: 'Runtime label', value: runtimeLabel },
                    { label: 'Verification status', value: receiptStatus },
                    { label: 'Route decision', value: routeDecision },
                    { label: 'Provider', value: providerDisplay },
                    { label: 'Provider path', value: providerPath },
                  ]}
                />
              </Surface>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Surface title="Policy bounds" icon={Shield}>
                {policySnapshot ? (
                  <div className="space-y-4">
                    <KeyValueGrid
                      rows={[
                        { label: 'Bounds applied', value: formatSnapshotValue(policySnapshot.bounds_applied) },
                        { label: 'Policy decision ID', value: formatSnapshotValue(policySnapshot.policy_decision_id), mono: typeof policySnapshot.policy_decision_id === 'string' },
                        { label: 'Policy decision hash', value: formatSnapshotValue(policySnapshot.policy_decision_hash), mono: typeof policySnapshot.policy_decision_hash === 'string' },
                        { label: 'Governed action hash', value: formatSnapshotValue(policySnapshot.governed_action_hash), mono: typeof policySnapshot.governed_action_hash === 'string' },
                        { label: 'Violation marker', value: formatSnapshotValue(policySnapshot.violation) },
                      ]}
                    />
                    <JSONViewer data={policySnapshot} defaultOpen={false} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No policy snapshot was returned for this run.</p>
                )}
              </Surface>

              <Surface title="Capabilities" icon={Cpu}>
                {capabilitySnapshot ? (
                  <div className="space-y-4">
                    <KeyValueGrid
                      rows={[
                        { label: 'Required capabilities', value: formatSnapshotValue(capabilitySnapshot.required_capabilities) },
                        { label: 'Granted capabilities', value: formatSnapshotValue(capabilitySnapshot.granted_capability_count) },
                        { label: 'Denied capabilities', value: formatSnapshotValue(capabilitySnapshot.denied_capability_count) },
                        { label: 'Permission signed', value: formatSnapshotValue(capabilitySnapshot.permission_signed) },
                        { label: 'Issued at', value: unixMsToDisplay(capabilitySnapshot.issued_at_unix_ms) },
                        { label: 'Expires at', value: unixMsToDisplay(capabilitySnapshot.expires_at_unix_ms) },
                      ]}
                    />
                    <JSONViewer data={capabilitySnapshot} defaultOpen={false} />
                  </div>
                ) : (
                  <p className="text-xs text-gray-500">No capability snapshot was returned for this run.</p>
                )}
              </Surface>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Surface title="Receipt verification" icon={Hash}>
                <KeyValueGrid
                  rows={[
                    { label: 'Receipt ID', value: receipt?.id ?? run.receipt_id ?? '—', mono: !!(receipt?.id || run.receipt_id), copyable: receipt?.id ?? run.receipt_id },
                    { label: 'Verification', value: receiptStatus },
                    { label: 'Signed', value: receipt?.signed || run.receipt_signature ? 'Yes' : 'No' },
                  ]}
                />
                <div className="mt-4 space-y-3">
                  <ReceiptVerificationPanel
                    signature={receipt?.signature ?? run.receipt_signature}
                    hash={receipt?.hash ?? run.receipt_hash}
                    previousHash={receipt?.previous_hash ?? run.receipt_previous_hash}
                    receiptData={receipt ? receipt as unknown as Record<string, unknown> : undefined}
                  />
                  {(receipt?.signature || run.receipt_signature) && (receipt?.hash || run.receipt_hash) && (
                    <div className="flex items-center gap-3 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        disabled={verifyMutation.isPending}
                        onClick={() => {
                          setVerifyResult(null);
                          verifyMutation.mutate();
                        }}
                      >
                        <Shield className="h-3.5 w-3.5" />
                        {verifyMutation.isPending ? 'Verifying…' : 'Verify receipt'}
                      </Button>
                      {verifyResult === true && (
                        <span className="inline-flex items-center gap-1 text-xs text-green-700">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                          Stored receipt matched the submitted check
                        </span>
                      )}
                      {verifyResult === false && (
                        <span className="inline-flex items-center gap-1 text-xs text-red-700">
                          <XCircle className="h-3.5 w-3.5 text-red-500" />
                          Verification failed
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </Surface>

              <Surface title="Violations" icon={AlertTriangle}>
                {violationList.length === 0 ? (
                  <p className="text-xs text-gray-500">No policy violation entries were returned for this run.</p>
                ) : (
                  <div className="space-y-3">
                    {violationList.map((violation) => (
                      <div key={violation.id} className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-orange-800">{violation.label}</p>
                          <span className="text-[11px] text-orange-700">{getRelativeTime(violation.timestamp)}</span>
                        </div>
                        <p className="mt-1 text-[11px] text-orange-800">
                          Limit: <span className="font-medium">{String(violation.limit)}</span>
                          {' · '}
                          Observed: <span className="font-medium">{String(violation.observed)}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </div>

            <Surface title="Execution timeline" icon={Clock3}>
              {timeline.length === 0 ? (
                <p className="text-xs text-gray-500">No execution events recorded for this run.</p>
              ) : (
                <div className="space-y-3">
                  {timeline.map((item) => (
                    <div key={item.id} className="flex gap-3">
                      <div className="w-28 shrink-0 pt-1">
                        <p className="text-[11px] font-medium text-gray-700">
                          {item.timestamp ? formatDateTime(item.timestamp) : 'Not recorded'}
                        </p>
                        {item.timestamp ? (
                          <p className="mt-0.5 text-[11px] text-gray-500">{getRelativeTime(item.timestamp)}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold text-gray-900">{item.label}</p>
                          <span
                            className={[
                              'text-[11px]',
                              item.severity === 'error'
                                ? 'text-red-700'
                                : item.severity === 'warning'
                                  ? 'text-orange-700'
                                  : item.severity === 'success'
                                    ? 'text-green-700'
                                    : 'text-gray-500',
                            ].join(' ')}
                          >
                            {item.source === 'event' ? 'Event' : 'Log'}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-gray-700">{item.detail}</p>
                        {item.kind ? (
                          <p className="mt-1 text-[11px] text-gray-500">
                            Kind: <span className="font-mono">{item.kind}</span>
                          </p>
                        ) : null}
                        {item.metadata?.raw_log ? (
                          <p className="mt-1 break-all font-mono text-[11px] text-gray-500">{String(item.metadata.raw_log)}</p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Surface>

            <Surface title="Execution logs" icon={Terminal}>
              <div className="rounded-md bg-gray-950 p-3 max-h-80 overflow-auto">
                {!run.logs?.length ? (
                  <p className="text-xs text-gray-500">No log entries were returned for this run.</p>
                ) : (
                  run.logs.map((line, index) => (
                    <p key={index} className="text-xs text-gray-300 leading-normal">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </Surface>

            <Surface title="Raw record" icon={FileText}>
              <JSONViewer
                data={{
                  run,
                  receipt,
                  violations,
                  timeline,
                }}
                defaultOpen={false}
              />
            </Surface>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
