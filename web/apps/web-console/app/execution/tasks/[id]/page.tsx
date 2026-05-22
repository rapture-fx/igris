'use client';

/**
 * Execution detail — the flight recorder for one governed AI action.
 *
 * Reshaped around the execution story: a vertical timeline from requested
 * action to proof, plus tabs that inspect each phase (Policy, Boundary,
 * Recovery, Proof) and a redacted Raw Evidence tab. Every value is a real field
 * from `GET /v1/tasks/:id`; missing data is shown as "not available", never
 * faked.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { ArrowLeft, Clock3, ListChecks } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useTask, useTaskSteps } from '@/hooks/useTasks';
import { api } from '@/lib/apiClient';
import { useToast } from '@/components/ui/use-toast';
import { CopyButton } from '@/components/execution/shared';
import { ExecutionStoryTimeline } from '@/components/governance/ExecutionStoryTimeline';
import { PolicyDecisionCard } from '@/components/governance/PolicyDecisionCard';
import { RuntimeBoundaryCard } from '@/components/governance/RuntimeBoundaryCard';
import { RecoveryStateCard } from '@/components/governance/RecoveryStateCard';
import { ProofVerificationCard } from '@/components/governance/ProofVerificationCard';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import {
  GovernanceBadge,
  PolicyBadge,
  ProofBadge,
  RecoveryBadge,
  RiskBadge,
} from '@/components/governance/GovernanceBadge';
import { buildExecutionStory } from '@/lib/executionStory';
import { formatDateTime, getRelativeTime, truncateText } from '@/utils/helpers';

// ── Top summary field ───────────────────────────────────────────────────────

function SummaryField({
  label,
  children,
  mono,
  copyable,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
  copyable?: string;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <div
        className={`mt-1 flex items-center gap-1 text-xs text-foreground ${
          mono ? 'font-mono break-all' : ''
        }`}
      >
        <span>{children}</span>
        {copyable && <CopyButton value={copyable} />}
      </div>
    </div>
  );
}

export default function ExecutionDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = decodeURIComponent(params?.id ?? '');
  const { toast } = useToast();
  const [verified, setVerified] = useState<boolean | null>(null);

  const { data: task, isLoading } = useTask(taskId || null);
  const { data: stepsData } = useTaskSteps(taskId || null);
  const steps = stepsData?.steps ?? [];

  const verifyMutation = useMutation({
    mutationFn: () =>
      api.post<{ proof?: { status?: string } }>(
        `/v1/tasks/${encodeURIComponent(taskId)}/proof/verify`,
        {},
      ),
    onSuccess: (result) => {
      const ok = result.proof?.status === 'verified';
      setVerified(ok);
      toast({
        title: ok ? 'Receipt verified' : 'Receipt verification failed',
        description: ok
          ? 'The stored receipt matches the execution artifact.'
          : 'The stored receipt did not match the expected hash.',
        variant: ok ? undefined : 'destructive',
      });
    },
    onError: (error: Error) => {
      setVerified(false);
      toast({ variant: 'destructive', title: 'Verification failed', description: error.message });
    },
  });

  const story = useMemo(() => buildExecutionStory(task, steps), [task, steps]);
  const actionEvidence = task?.action_evidence ?? [];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <Button asChild variant="outline" size="sm" className="mb-2 gap-1.5">
            <Link href="/execution/tasks">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to executions
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-base font-semibold text-foreground">
              Execution {truncateText(taskId, 24)}
            </h1>
            {taskId && <CopyButton value={taskId} />}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            The full execution story — requested action, policy decision, runtime boundary,
            recovery, and proof.
          </p>
        </div>

        {isLoading || !task ? (
          <div className="space-y-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : (
          <>
            {/* Top summary */}
            <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-1.5">
                <GovernanceBadge
                  label={task.status.replace(/_/g, ' ')}
                  tone={
                    task.status === 'completed'
                      ? 'success'
                      : task.status === 'failed'
                        ? 'danger'
                        : task.status === 'recovering' || task.status === 'approval_required'
                          ? 'warning'
                          : 'info'
                  }
                />
                <PolicyBadge decision={task.policy?.decision} />
                <RecoveryBadge status={task.status} />
                <ProofBadge
                  status={task.proof?.verified === false ? 'failed_verification' : task.proof?.status}
                />
                <RiskBadge risk={task.policy?.risk_level} />
                {task.policy?.irreversible && (
                  <GovernanceBadge label="Irreversible" tone="danger" />
                )}
                {task.policy?.human_gated && (
                  <GovernanceBadge label="Human-gated" tone="warning" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-5 gap-y-3 md:grid-cols-3 xl:grid-cols-4">
                <SummaryField label="Task ID" mono copyable={task.task_id}>
                  {truncateText(task.task_id, 22)}
                </SummaryField>
                <SummaryField
                  label="Execution ID"
                  mono={Boolean(task.proof?.execution_id)}
                  copyable={task.proof?.execution_id}
                >
                  {task.proof?.execution_id ? (
                    truncateText(task.proof.execution_id, 22)
                  ) : (
                    <span className="text-muted-foreground/60">Not available</span>
                  )}
                </SummaryField>
                <SummaryField
                  label="Runtime ID"
                  mono={Boolean(task.runtime_id)}
                  copyable={task.runtime_id}
                >
                  {task.runtime_id ? (
                    <Link href={`/runtimes/${encodeURIComponent(task.runtime_id)}`} className="hover:underline">
                      {truncateText(task.runtime_id, 22)}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                </SummaryField>
                <SummaryField label="Runtime label">
                  {task.runtime_boundary?.environment_label ?? (
                    <span className="text-muted-foreground/60">Not available</span>
                  )}
                </SummaryField>
                <SummaryField label="Agent ID">
                  <span className="text-muted-foreground/60">Not available</span>
                </SummaryField>
                <SummaryField label="Boundary">
                  {task.runtime_boundary?.environment_label ?? (
                    <span className="text-muted-foreground/60">Not available</span>
                  )}
                </SummaryField>
                <SummaryField label="Task type">
                  {task.task_type ?? <span className="text-muted-foreground/60">—</span>}
                </SummaryField>
                <SummaryField label="Replay class">
                  {task.policy?.replay_class?.replace(/_/g, ' ') ?? (
                    <span className="text-muted-foreground/60">Not evaluated</span>
                  )}
                </SummaryField>
                <SummaryField label="Created">{formatDateTime(task.created_at)}</SummaryField>
                <SummaryField label="Completed">
                  {task.completed_at ? (
                    formatDateTime(task.completed_at)
                  ) : (
                    <span className="text-muted-foreground/60">In progress</span>
                  )}
                </SummaryField>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="story">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                {['story', 'policy', 'boundary', 'recovery', 'proof', 'evidence'].map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="capitalize">
                    {tab === 'evidence' ? 'Raw Evidence' : tab}
                  </TabsTrigger>
                ))}
              </TabsList>

              {/* Story */}
              <TabsContent value="story" className="mt-4 space-y-4">
                <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">
                    Execution story
                  </h2>
                  <ExecutionStoryTimeline nodes={story} />
                </div>

                {actionEvidence.length > 0 && (
                  <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white p-4">
                    <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <ListChecks className="h-4 w-4 text-muted-foreground" />
                      Action evidence
                    </h2>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Every external action this task performed, in execution order — safe
                      summaries only, no file contents or request bodies.
                    </p>
                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>#</TableHead>
                            <TableHead>Action</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Target</TableHead>
                            <TableHead>Result digest</TableHead>
                            <TableHead>Recorded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {[...actionEvidence]
                            .sort((a, b) => a.step_index - b.step_index)
                            .map((row) => (
                              <TableRow key={`${row.step_index}-${row.node_id ?? row.action_type}`}>
                                <TableCell className="text-xs text-muted-foreground">
                                  {row.step_index}
                                </TableCell>
                                <TableCell className="text-xs font-medium text-foreground">
                                  {row.action_type}
                                </TableCell>
                                <TableCell className="text-xs">
                                  {row.status ? (
                                    <GovernanceBadge
                                      label={row.status}
                                      tone={
                                        row.status.toLowerCase().includes('commit') ||
                                        row.status.toLowerCase().includes('complete')
                                          ? 'success'
                                          : 'neutral'
                                      }
                                      showDot={false}
                                    />
                                  ) : (
                                    '—'
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {row.target_summary ?? (
                                    <span className="text-muted-foreground/60">Not recorded</span>
                                  )}
                                </TableCell>
                                <TableCell className="font-mono text-xs text-muted-foreground">
                                  {row.result_digest ? truncateText(row.result_digest, 16) : '—'}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {row.recorded_at ? getRelativeTime(row.recorded_at) : '—'}
                                </TableCell>
                              </TableRow>
                            ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Policy */}
              <TabsContent value="policy" className="mt-4">
                <PolicyDecisionCard policy={task.policy} />
              </TabsContent>

              {/* Boundary */}
              <TabsContent value="boundary" className="mt-4 space-y-4">
                <RuntimeBoundaryCard task={task} />
                <SafeEvidenceJsonPanel
                  title="Runtime capabilities (declared)"
                  data={task.runtime_boundary?.runtime_capabilities}
                  exportName={`boundary-${taskId}`}
                />
                <SafeEvidenceJsonPanel
                  title="Resource limits"
                  data={task.runtime_boundary?.resource_limits}
                />
              </TabsContent>

              {/* Recovery */}
              <TabsContent value="recovery" className="mt-4">
                <RecoveryStateCard task={task} />
              </TabsContent>

              {/* Proof */}
              <TabsContent value="proof" className="mt-4 space-y-4">
                <ProofVerificationCard
                  task={task}
                  onVerify={() => {
                    setVerified(null);
                    verifyMutation.mutate();
                  }}
                  verifying={verifyMutation.isPending}
                />
                {verified !== null && (
                  <p
                    className={`text-xs ${verified ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {verified
                      ? 'Verified this session against the proof store.'
                      : 'Verification did not pass this session.'}
                  </p>
                )}
                <SafeEvidenceJsonPanel
                  title="Execution receipt"
                  data={task.execution_receipt}
                  exportName={`receipt-${taskId}`}
                />
                <SafeEvidenceJsonPanel
                  title="Execution envelope"
                  data={task.execution_envelope}
                  exportName={`envelope-${taskId}`}
                />
              </TabsContent>

              {/* Raw Evidence */}
              <TabsContent value="evidence" className="mt-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Raw persisted evidence. Sensitive fields — resume tokens, secrets,
                  credentials — are redacted before display and export.
                </p>
                <SafeEvidenceJsonPanel title="Checkpoint metadata" data={task.checkpoint_metadata} />
                <SafeEvidenceJsonPanel title="Graph blackboard" data={task.graph_blackboard} />
                <SafeEvidenceJsonPanel title="Graph nodes" data={task.graph_nodes} />
                <SafeEvidenceJsonPanel title="Graph slots" data={task.graph_slots} />

                <div className="rounded-lg border-[0.5px] border-black/[0.08] dark:border-white/[0.08] bg-white p-4">
                  <h2 className="mb-3 text-sm font-semibold text-foreground">WAL steps</h2>
                  {steps.length === 0 ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" />
                      No durable WAL steps recorded yet.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Step</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Runtime</TableHead>
                            <TableHead>Input digest</TableHead>
                            <TableHead>Output digest</TableHead>
                            <TableHead>Recorded</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {steps.map((step) => (
                            <TableRow key={step.entry_id}>
                              <TableCell className="text-xs text-muted-foreground">
                                {step.step_index}
                              </TableCell>
                              <TableCell className="text-xs text-foreground">
                                {step.status}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {truncateText(step.runtime_id, 16)}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {truncateText(step.input_digest, 14)}
                              </TableCell>
                              <TableCell className="font-mono text-xs text-muted-foreground">
                                {step.output_digest ? truncateText(step.output_digest, 14) : '—'}
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground">
                                {formatDateTime(new Date(step.timestamp_ms))}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
