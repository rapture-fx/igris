'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
  fetchExecutionReceipts,
  fetchExecutionRun,
  fetchExecutionViolations,
  formatDurationMs,
  type ExecutionReceipt,
  type ExecutionRun,
  type ExecutionViolation,
} from '@/lib/executionRuns';
import { api } from '@/lib/apiClient';
import { formatDateTime, getRelativeTime } from '@/utils/helpers';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Cpu,
  FileText,
  Hash,
  Pause,
  RotateCcw,
  Shield,
  Terminal,
  XCircle,
} from 'lucide-react';

function guessProvider(model?: string, endpoint?: string): string | null {
  const source = `${model ?? ''} ${endpoint ?? ''}`.toLowerCase();
  if (!source) return null;
  if (source.includes('openai') || source.includes('gpt-') || source.includes('o1') || source.includes('o3')) return 'OpenAI';
  if (source.includes('claude') || source.includes('anthropic')) return 'Anthropic';
  if (source.includes('gemini') || source.includes('google')) return 'Google';
  if (source.includes('deepseek')) return 'DeepSeek';
  if (source.includes('xai') || source.includes('grok')) return 'xAI';
  return null;
}

function extractObservedEndpoint(logs?: string[]): string | null {
  if (!logs?.length) return null;
  for (const line of logs) {
    const match = line.match(/https?:\/\/([^/\s")]+)/i);
    if (match?.[1]) return match[1];
  }
  return null;
}

function summarizeFallback(logs?: string[]): string {
  const text = logs?.join(' ').toLowerCase() ?? '';
  if (!text) return 'Not recorded in the current execution record.';
  if (text.includes('fallback') || text.includes('failover')) return 'Fallback or failover activity was recorded in execution logs.';
  if (text.includes('retry')) return 'Retry attempts were recorded, but no provider fallback was explicitly logged.';
  return 'No fallback event was recorded in the execution logs.';
}

function verificationLabel(receipt?: ExecutionReceipt | null): string {
  const status = receipt?.status ?? receipt?.verification_status;
  if (!status) return 'Pending';
  const normalized = String(status).toLowerCase();
  if (normalized === 'verified') return 'Verified';
  if (normalized === 'failed') return 'Failed';
  if (normalized === 'unverified') return 'Unverified';
  return String(status);
}

function runStatusAllowsReplay(status: string): boolean {
  return ['COMPLETED', 'ERROR', 'VIOLATION', 'CANCELLED'].includes(status);
}

function runStatusAllowsPause(status: string): boolean {
  return status === 'RUNNING';
}

function runStatusAllowsCancel(status: string): boolean {
  return status === 'RUNNING';
}

function violationRows(run: ExecutionRun, receipt: ExecutionReceipt | null, violations: ExecutionViolation[]) {
  if (violations.length > 0) {
    return violations.map((violation) => ({
      id: violation.id,
      label: violation.kind,
      observed: violation.observed_value ?? '—',
      limit: violation.limit_value ?? '—',
      timestamp: violation.timestamp,
    }));
  }

  if (receipt?.violation_type) {
    return [{
      id: receipt.id,
      label: receipt.violation_type,
      observed: receipt.observed_value ?? '—',
      limit: receipt.limit_value ?? '—',
      timestamp: receipt.timestamp,
    }];
  }

  if (run.has_violation) {
    return [{
      id: `${run.id}-violation`,
      label: 'Violation recorded',
      observed: 'See execution logs',
      limit: 'See policy bounds',
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

  const { data: run, isLoading: runLoading, refetch: refetchRun } = useQuery<ExecutionRun | null>({
    queryKey: ['execution-run-detail', runId],
    queryFn: () => fetchExecutionRun(runId),
    enabled: !!runId,
    retry: false,
  });

  const { data: receipts = [] } = useQuery<ExecutionReceipt[]>({
    queryKey: ['execution-run-receipts', runId],
    queryFn: () => fetchExecutionReceipts(),
    enabled: !!runId,
    retry: false,
    staleTime: 30_000,
  });

  const { data: allViolations = [] } = useQuery<ExecutionViolation[]>({
    queryKey: ['execution-run-violations', runId],
    queryFn: () => fetchExecutionViolations(),
    enabled: !!runId,
    retry: false,
    staleTime: 30_000,
  });

  const receipt = useMemo(
    () => receipts.find((entry) => entry.execution_id === runId) ?? null,
    [receipts, runId],
  );
  const violations = useMemo(
    () => allViolations.filter((entry) => entry.execution_id === runId),
    [allViolations, runId],
  );

  const endpoint = extractObservedEndpoint(run?.logs);
  const provider = guessProvider(run?.model, endpoint ?? undefined);
  const routeDecision = provider
    ? `Observed provider-selected path via ${provider}.`
    : 'Structured routing metadata is not returned for this run.';
  const providerPath = endpoint
    ? `Observed endpoint: ${endpoint}`
    : provider
      ? `${provider} path inferred from the run model.`
      : 'Provider endpoint not recorded in the execution record.';
  const fallbackStatus = summarizeFallback(run?.logs);
  const receiptStatus = verificationLabel(receipt);
  const violationList = useMemo(() => run ? violationRows(run, receipt, violations) : [], [run, receipt, violations]);

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

  const replayMutation = useMutation({
    mutationFn: () => api.post(`/v1/execution/runs/${runId}/replay`, {}),
    onSuccess: async () => {
      toast({ title: 'Run replay requested' });
      await refreshExecutionQueries();
    },
    onError: () => toast({ title: 'Failed to replay run', variant: 'destructive' }),
  });

  const verifyMutation = useMutation({
    mutationFn: () =>
      api.post('/proof/receipts/verify', {
        execution_id: runId,
        hash: receipt?.hash ?? run?.receipt_hash,
        signature: receipt?.signature ?? run?.receipt_signature,
      }),
    onSuccess: () => {
      setVerifyResult(true);
      toast({ title: 'Receipt verified' });
    },
    onError: () => {
      setVerifyResult(false);
      toast({ title: 'Receipt verification failed', variant: 'destructive' });
    },
  });

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
            <h1 className="text-base font-semibold text-gray-900">Run record</h1>
            <p className="mt-0.5 text-xs text-gray-500">
              Verified execution metadata, proof status, policy scope, and enforcement evidence.
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
              <p className="mt-1 text-xs text-gray-500">
                The backend may not expose direct run lookup yet, and the record was not present in the current run list window.
              </p>
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
                  {receipt?.signed || run.receipt_signature ? 'Signed execution receipt present.' : 'Receipt not signed yet.'}
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
              {runStatusAllowsReplay(run.status) && (
                <Button variant="outline" size="sm" className="gap-1.5" disabled={replayMutation.isPending} onClick={() => replayMutation.mutate()}>
                  <RotateCcw className="h-3.5 w-3.5" />
                  Replay
                </Button>
              )}
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <Surface title="Execution metadata" icon={FileText}>
                <KeyValueGrid
                  rows={[
                    { label: 'Run ID', value: run.id, mono: true, copyable: run.id },
                    { label: 'Agent ID', value: run.agent_id, mono: true, copyable: run.agent_id },
                    { label: 'Device ID', value: run.device_id ?? '—', mono: true, copyable: run.device_id },
                    { label: 'Model', value: run.model ?? '—' },
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

              <Surface title="Execution path" icon={Shield}>
                <div className="mb-3 rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5">
                  <p className="text-[11px] text-gray-500">
                    Derived from the execution record and logs when structured route metadata is unavailable.
                  </p>
                </div>
                <KeyValueGrid
                  rows={[
                    { label: 'Route decision', value: routeDecision },
                    { label: 'Provider / path', value: providerPath },
                    { label: 'Fallback status', value: fallbackStatus },
                    { label: 'Verification status', value: receiptStatus },
                  ]}
                />
              </Surface>
            </div>

            <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Surface title="Policy bounds" icon={Shield}>
                {run.policy_snapshot ? (
                  <KeyValueGrid
                    rows={[
                      {
                        label: 'CPU limit',
                        value: run.policy_snapshot.cpu_limit_percent != null ? `${String(run.policy_snapshot.cpu_limit_percent)}%` : '—',
                      },
                      {
                        label: 'Memory limit',
                        value: run.policy_snapshot.memory_limit_mb != null ? `${String(run.policy_snapshot.memory_limit_mb)} MB` : '—',
                      },
                      {
                        label: 'Max tick',
                        value: run.policy_snapshot.max_tick_ms != null ? `${String(run.policy_snapshot.max_tick_ms)} ms` : '—',
                      },
                      { label: 'Quota limit', value: run.policy_snapshot.quota_limit != null ? String(run.policy_snapshot.quota_limit) : '—' },
                    ]}
                  />
                ) : (
                  <p className="text-xs text-gray-500">No policy snapshot was returned for this run.</p>
                )}
              </Surface>

              <Surface title="Capabilities" icon={Cpu}>
                {run.capability_snapshot ? (
                  <KeyValueGrid
                    rows={[
                      { label: 'HTTP', value: run.capability_snapshot.allow_http ? 'Allowed' : 'Denied' },
                      { label: 'Shell', value: run.capability_snapshot.allow_shell ? 'Allowed' : 'Denied' },
                      { label: 'Filesystem', value: run.capability_snapshot.allow_filesystem ? 'Allowed' : 'Denied' },
                      {
                        label: 'Allowed domains',
                        value: Array.isArray(run.capability_snapshot.allowed_domains)
                          ? (run.capability_snapshot.allowed_domains as string[]).join(', ') || '—'
                          : '—',
                      },
                      {
                        label: 'Max file write',
                        value: run.capability_snapshot.max_file_write_bytes != null
                          ? `${String(run.capability_snapshot.max_file_write_bytes)} bytes`
                          : '—',
                      },
                    ]}
                  />
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
                    { label: 'Public key', value: receipt?.public_key ?? '—', mono: !!receipt?.public_key, copyable: receipt?.public_key },
                  ]}
                />
                <div className="mt-4 space-y-3">
                  <ReceiptVerificationPanel
                    signature={receipt?.signature ?? run.receipt_signature}
                    hash={receipt?.hash ?? run.receipt_hash}
                    previousHash={receipt?.prev_hash ?? run.receipt_previous_hash}
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
                          Verification passed
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
