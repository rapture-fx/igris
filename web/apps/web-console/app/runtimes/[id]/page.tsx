'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Suspense, type ReactNode, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GovernanceBadge, HandoffBadge, ProofBadge, ViolationSeverityBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useGovernanceBoundaries,
  useGovernanceBoundaryViolations,
  useGovernanceHandoffEvents,
  useGovernanceRecoveryEvents,
  useGovernanceRuntime,
  useGovernanceVerificationResults,
} from '@/hooks/useGovernance';
import { runtimeTrustLabel } from '@/lib/governance';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';

function capabilityText(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.map(String).join(', ') : 'Not available';
  if (value && typeof value === 'object') return Object.keys(value).join(', ') || 'Not available';
  return 'Not available';
}

function TrustBadge({ state }: { state?: string }) {
  const label = runtimeTrustLabel(state);
  return <GovernanceBadge label={label.label} tone={label.tone} />;
}

function Field({ label, value, mono = false }: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-md border border-gray-200 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 break-all text-xs text-foreground ${mono ? 'font-mono' : ''}`}>{value}</div>
    </div>
  );
}

function RuntimeDetailPageInner() {
  const params = useParams<{ id: string }>();
  const runtimeId = decodeURIComponent(String(params.id ?? ''));
  const { data: runtime, isLoading } = useGovernanceRuntime(runtimeId);
  const common = { limit: 200, runtime_id: runtimeId };
  const [activeTab, setActiveTab] = useState('overview');
  const loadBoundaries = activeTab === 'boundaries' || activeTab === 'raw evidence';
  const loadViolations = activeTab === 'violations' || activeTab === 'raw evidence';
  const loadRecovery = activeTab === 'recovery' || activeTab === 'raw evidence';
  const loadProof = activeTab === 'proof' || activeTab === 'raw evidence';
  const { data: boundaries, isLoading: boundariesLoading } = useGovernanceBoundaries(common, { enabled: loadBoundaries });
  const { data: violations, isLoading: violationsLoading } = useGovernanceBoundaryViolations(common, { enabled: loadViolations });
  const { data: recovery, isLoading: recoveryLoading } = useGovernanceRecoveryEvents(common, { enabled: loadRecovery });
  const { data: handoffs } = useGovernanceHandoffEvents(common, { enabled: loadRecovery });
  const { data: proof, isLoading: proofLoading } = useGovernanceVerificationResults(common, { enabled: loadProof });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Link href="/runtimes" className="mb-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Runtimes
            </Link>
            <h1 className="text-base font-semibold text-foreground">Runtime Detail</h1>
            <p className="mt-0.5 font-mono text-xs text-muted-foreground">{runtimeId}</p>
          </div>
          {runtime && <TrustBadge state={runtime.trust_state} />}
        </div>

        {isLoading ? (
          <Skeleton className="h-28 w-full" />
        ) : !runtime ? (
          <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-8 text-center text-xs text-muted-foreground">
            Evidence not available. This runtime summary was not returned for the current tenant.
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Field label="Runtime ID" value={runtime.runtime_id} mono />
              <Field label="Runtime label" value={runtime.runtime_label || 'Not available'} mono />
              <Field label="Last seen" value={runtime.last_seen ? getRelativeTime(runtime.last_seen) : 'Not available'} />
              <Field label="Trust state" value={<TrustBadge state={runtime.trust_state} />} />
            </div>

            {runtime.enforcement_warning && (
              <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-2 text-xs text-yellow-800">
                {runtime.enforcement_warning}
              </div>
            )}

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
              <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
                {['overview', 'capabilities', 'boundaries', 'violations', 'recovery', 'proof', 'raw evidence'].map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs data-[state=active]:bg-gray-900 data-[state=active]:text-white">
                    {tab}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="overview" className="space-y-3">
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Active runs" value={runtime.active_execution_count} />
                  <Field label="Recent runs" value={runtime.recent_execution_count} />
                  <Field label="Boundary records" value={runtime.boundary_count} />
                  <Field label="Boundary violations" value={runtime.violation_count} />
                  <Field label="Handoff events" value={runtime.handoff_count} />
                  <Field label="Proof" value={`${runtime.verified_proof_count} verified / ${runtime.failed_verification_count} failed`} />
                </div>
              </TabsContent>

              <TabsContent value="capabilities" className="space-y-3">
                <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
                  <h2 className="text-sm font-semibold text-foreground">Capabilities</h2>
                  <p className="mt-1 text-xs text-muted-foreground">{capabilityText(runtime.capability_summary)}</p>
                  <div className="mt-3 flex flex-wrap gap-1">
                    <GovernanceBadge label={`same_runtime_only: ${runtime.checkpoint_portability_summary.same_runtime_only}`} tone="neutral" showDot={false} />
                    <GovernanceBadge label={`compatible_runtime: ${runtime.checkpoint_portability_summary.compatible_runtime}`} tone="warning" showDot={false} />
                    <GovernanceBadge label={`any_runtime: ${runtime.checkpoint_portability_summary.any_runtime}`} tone="warning" showDot={false} />
                  </div>
                  <SafeEvidenceJsonPanel title="Capability evidence" data={runtime.capability_summary ?? null} defaultOpen={false} className="mt-3" />
                </div>
              </TabsContent>

              <TabsContent value="boundaries">
                <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
                  <div className="px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Boundaries</h2></div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Scopes</TableHead><TableHead>Digest</TableHead><TableHead>Created</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {boundariesLoading ? <TableRow><TableCell colSpan={4}><Skeleton className="h-5 w-full" /></TableCell></TableRow> : (boundaries?.items ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="py-10 text-center text-xs text-muted-foreground">Evidence not available. No boundary records returned.</TableCell></TableRow>
                      ) : boundaries?.items.map((boundary) => (
                        <TableRow key={boundary.boundary_id}>
                          <TableCell>{boundary.task_id ? <Link href={`/runs/${encodeURIComponent(boundary.task_id)}`} className="group flex items-center gap-1.5 font-mono text-xs text-foreground">{truncateText(boundary.task_id, 18)}<ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" /></Link> : <span className="text-xs text-muted-foreground">Not available</span>}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{boundary.network_scope} / {boundary.filesystem_scope} / {boundary.api_scope}</TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{truncateText(boundary.boundary_digest, 18)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{getRelativeTime(boundary.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="violations">
                <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
                  <div className="px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Violations</h2></div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Severity</TableHead><TableHead>Type</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {violationsLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow> : (violations?.items ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Evidence not available. No violations returned.</TableCell></TableRow>
                      ) : violations?.items.map((violation) => (
                        <TableRow key={violation.violation_id}>
                          <TableCell>{violation.task_id ? <Link href={`/runs/${encodeURIComponent(violation.task_id)}`} className="font-mono text-xs text-foreground">{truncateText(violation.task_id, 18)}</Link> : <span className="text-xs text-muted-foreground">Not available</span>}</TableCell>
                          <TableCell><ViolationSeverityBadge severity={violation.severity} /></TableCell>
                          <TableCell className="text-xs text-muted-foreground">{violation.violation_type}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{violation.reason || 'Evidence not available'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{getRelativeTime(violation.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="recovery" className="space-y-3">
                <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
                  <div className="px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Recovery Events</h2></div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Event</TableHead><TableHead>Checkpoint</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {recoveryLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow> : (recovery?.items ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Evidence not available. No recovery events returned.</TableCell></TableRow>
                      ) : recovery?.items.map((event) => (
                        <TableRow key={event.recovery_event_id}>
                          <TableCell><Link href={`/runs/${encodeURIComponent(event.task_id)}`} className="font-mono text-xs text-foreground">{truncateText(event.task_id, 18)}</Link></TableCell>
                          <TableCell><GovernanceBadge label={event.event_type.replace(/_/g, ' ')} tone={event.replay_allowed === false ? 'warning' : 'neutral'} /></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{event.checkpoint_digest ? truncateText(event.checkpoint_digest, 18) : 'Not available'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{event.reason || 'Evidence not available'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{getRelativeTime(event.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
                <div className="grid gap-2">
                  {(handoffs?.items ?? []).length === 0 ? <p className="text-xs text-muted-foreground">Evidence not available. No handoff events returned.</p> : handoffs?.items.map((event) => (
                    <Link key={event.handoff_event_id} href={`/runs/${encodeURIComponent(event.task_id)}`} className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-xs hover:bg-gray-50">
                      <span className="font-mono text-foreground">{truncateText(event.task_id, 18)}</span>
                      <HandoffBadge decision={event.decision} />
                      <span className="font-mono text-muted-foreground">{truncateText(event.source_runtime_id || 'unknown', 12)} -&gt; {truncateText(event.target_runtime_id || 'unknown', 12)}</span>
                      <span className="text-muted-foreground">{event.reason}</span>
                    </Link>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="proof">
                <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
                  <div className="px-4 py-3"><h2 className="text-sm font-semibold text-foreground">Proof</h2></div>
                  <Table>
                    <TableHeader><TableRow><TableHead>Run / Execution</TableHead><TableHead>Status</TableHead><TableHead>Evidence</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {proofLoading ? <TableRow><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow> : (proof?.items ?? []).length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="py-10 text-center text-xs text-muted-foreground">Evidence not available. No proof records returned for this runtime.</TableCell></TableRow>
                      ) : proof?.items.map((item) => (
                        <TableRow key={item.verification_id}>
                          <TableCell>
                            {item.task_id ? <Link href={`/runs/${encodeURIComponent(item.task_id)}`} className="font-mono text-xs text-foreground">{truncateText(item.task_id, 18)}</Link> : <span className="text-xs text-muted-foreground">Run not available</span>}
                            <div className="font-mono text-[10px] text-muted-foreground">{item.execution_id ? truncateText(item.execution_id, 22) : 'Execution not available'}</div>
                          </TableCell>
                          <TableCell><ProofBadge status={item.status} /></TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">{item.evidence_digest ? truncateText(item.evidence_digest, 18) : 'Not available'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{item.reason || 'Evidence not available'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{getRelativeTime(item.created_at)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </section>
              </TabsContent>

              <TabsContent value="raw evidence">
                <SafeEvidenceJsonPanel title="Runtime evidence" data={{ runtime, boundaries: boundaries?.items ?? [], violations: violations?.items ?? [], recovery: recovery?.items ?? [], handoffs: handoffs?.items ?? [], proof: proof?.items ?? [] }} defaultOpen />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function RuntimeDetailPage() {
  return (
    <Suspense fallback={<DashboardLayout><div className="flex-1" /></DashboardLayout>}>
      <RuntimeDetailPageInner />
    </Suspense>
  );
}
