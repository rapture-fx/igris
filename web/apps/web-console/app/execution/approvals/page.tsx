'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { useGovernancePolicyDecisions } from '@/hooks/useGovernance';
import type { GovernancePolicyDecision } from '@/lib/governance';
import { GovernanceBadge, PolicyBadge, ReplayClassBadge, RiskBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { ArrowUpRight, CheckCircle2, Clock, RefreshCw, Search } from 'lucide-react';

interface PausedRun {
  id: string;
  agent_id: string;
  namespace?: string;
  paused_at: string;
  pause_reason?: string;
  model?: string;
  violation_type?: string;
}

type DecisionFilter = 'all' | 'allowed' | 'denied' | 'approval_required';
type ReplayFilter = 'all' | 'irreversible' | 'human_gated' | 'retryable' | 'non_retryable';

function FilterButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded border px-2.5 py-1 text-[11px] font-medium ${
        active ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-muted-foreground hover:text-foreground'
      }`}
    >
      {label}
    </button>
  );
}

function DetailCard({ decision }: { decision: GovernancePolicyDecision | null }) {
  if (!decision) {
    return (
      <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4 text-xs text-muted-foreground">
        Select a policy decision to inspect its reason, replay class, digest, and references.
      </div>
    );
  }
  return (
    <div className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <PolicyBadge decision={decision.decision} />
        <RiskBadge risk={decision.risk_level} />
        <ReplayClassBadge replayClass={decision.replay_class} />
        {decision.irreversible && <GovernanceBadge label="Irreversible" tone="danger" />}
        {decision.human_gated && <GovernanceBadge label="Human-gated" tone="warning" />}
      </div>
      <p className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-foreground">
        {decision.policy_reason || 'Evidence not available'}
      </p>
      <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
        {[
          ['Policy version', decision.policy_version],
          ['Decision ID', decision.decision_id],
          ['Task ID', decision.task_id],
          ['Agent ID', decision.agent_id || 'Not available'],
          ['Runtime ID', decision.runtime_id || 'Not available'],
          ['Action digest', decision.action_digest],
          ['Boundary digest', decision.boundary_digest || 'Not available'],
          ['Checkpoint portability', decision.checkpoint_portability],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-gray-200 px-3 py-2">
            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
            <div className="mt-1 break-all font-mono text-[11px] text-foreground">{value}</div>
          </div>
        ))}
      </div>
      <SafeEvidenceJsonPanel title="Safe policy evidence" data={decision} defaultOpen={false} className="mt-3" />
    </div>
  );
}

export default function ApprovalsPage() {
  const [decisionFilter, setDecisionFilter] = useState<DecisionFilter>('all');
  const [replayFilter, setReplayFilter] = useState<ReplayFilter>('all');
  const [riskFilter, setRiskFilter] = useState('all');
  const [agentFilter, setAgentFilter] = useState('');
  const [runtimeFilter, setRuntimeFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = {
    limit: 200,
    decision: decisionFilter,
    risk_level: riskFilter,
    agent_id: agentFilter.trim(),
    runtime_id: runtimeFilter.trim(),
    action: actionFilter.trim(),
    replay_class: replayFilter === 'retryable' || replayFilter === 'non_retryable' ? replayFilter : undefined,
    irreversible: replayFilter === 'irreversible' ? true : undefined,
    human_gated: replayFilter === 'human_gated' ? true : undefined,
  };
  const { data, isLoading, refetch, isFetching } = useGovernancePolicyDecisions(params);
  const decisions = data?.items ?? [];
  const selected = decisions.find((item) => item.decision_id === selectedId) ?? decisions[0] ?? null;

  const { data: runs = [], isLoading: approvalsLoading } = useQuery<PausedRun[]>({
    queryKey: ['paused-runs-readonly'],
    queryFn: async () => {
      try {
        return await api.get<PausedRun[]>('/v1/execution/runs?status=PAUSED', { allowMockFallback: false });
      } catch {
        return [];
      }
    },
    refetchInterval: 10_000,
    retry: false,
  });

  const counts = useMemo(
    () => ({
      allowed: decisions.filter((item) => item.decision === 'allowed').length,
      denied: decisions.filter((item) => item.decision === 'denied').length,
      approval: decisions.filter((item) => item.decision === 'approval_required').length,
      humanGated: decisions.filter((item) => item.human_gated).length,
    }),
    [decisions],
  );

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Policy &amp; Approvals</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tenant-wide action decisions from the governance ledger, plus the live approval queue when available.
            </p>
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[
            { label: 'Allowed', value: counts.allowed, tone: 'success' as const },
            { label: 'Denied', value: counts.denied, tone: 'danger' as const },
            { label: 'Approval required', value: counts.approval, tone: 'warning' as const },
            { label: 'Human-gated', value: counts.humanGated, tone: 'warning' as const },
          ].map((card) => (
            <div key={card.label} className="rounded-lg border-[0.5px] border-black/[0.08] bg-white p-4">
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
              <div className="mt-3 text-3xl font-bold tabular-nums text-foreground">{card.value}</div>
            </div>
          ))}
        </div>

        <section className="rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="space-y-3 px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Policy Decisions</h2>
              <p className="text-[11px] text-muted-foreground">Backed by `GET /v1/execution/governance/policy-decisions`.</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <FilterButton label="All" active={decisionFilter === 'all'} onClick={() => setDecisionFilter('all')} />
              <FilterButton label="Allowed" active={decisionFilter === 'allowed'} onClick={() => setDecisionFilter('allowed')} />
              <FilterButton label="Denied" active={decisionFilter === 'denied'} onClick={() => setDecisionFilter('denied')} />
              <FilterButton label="Approval required" active={decisionFilter === 'approval_required'} onClick={() => setDecisionFilter('approval_required')} />
              <FilterButton label="Irreversible" active={replayFilter === 'irreversible'} onClick={() => setReplayFilter(replayFilter === 'irreversible' ? 'all' : 'irreversible')} />
              <FilterButton label="Human-gated" active={replayFilter === 'human_gated'} onClick={() => setReplayFilter(replayFilter === 'human_gated' ? 'all' : 'human_gated')} />
              <FilterButton label="Retryable" active={replayFilter === 'retryable'} onClick={() => setReplayFilter(replayFilter === 'retryable' ? 'all' : 'retryable')} />
              <FilterButton label="Non-replayable" active={replayFilter === 'non_retryable'} onClick={() => setReplayFilter(replayFilter === 'non_retryable' ? 'all' : 'non_retryable')} />
              {['low', 'medium', 'high', 'critical'].map((risk) => (
                <FilterButton key={risk} label={`${risk} risk`} active={riskFilter === risk} onClick={() => setRiskFilter(riskFilter === risk ? 'all' : risk)} />
              ))}
            </div>
            <div className="grid gap-2 md:grid-cols-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={actionFilter} onChange={(event) => setActionFilter(event.target.value)} placeholder="Action filter" className="h-8 pl-8 text-xs" />
              </div>
              <Input value={agentFilter} onChange={(event) => setAgentFilter(event.target.value)} placeholder="Agent ID filter" className="h-8 text-xs" />
              <Input value={runtimeFilter} onChange={(event) => setRuntimeFilter(event.target.value)} placeholder="Runtime ID filter" className="h-8 text-xs" />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>Decision</TableHead>
                <TableHead>Risk</TableHead>
                <TableHead>Replay</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
                ))
              ) : decisions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No policy decisions match these filters.</TableCell>
                </TableRow>
              ) : (
                decisions.map((decision) => (
                  <TableRow key={decision.decision_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelectedId(decision.decision_id)}>
                    <TableCell>
                      <Link href={decision.task_id ? `/execution/tasks/${encodeURIComponent(decision.task_id)}` : '#'} className="group flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <span className="text-xs font-medium text-foreground">{decision.action_name || 'Action not available'}</span>
                        {decision.task_id && <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />}
                      </Link>
                      <div className="font-mono text-[10px] text-muted-foreground">{decision.task_id ? truncateText(decision.task_id, 18) : 'Task not available'}</div>
                      {decision.runtime_id && (
                        <Link href={`/runtimes/${encodeURIComponent(decision.runtime_id)}`} className="group mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground" onClick={(event) => event.stopPropagation()}>
                          runtime {truncateText(decision.runtime_id, 16)}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Link>
                      )}
                    </TableCell>
                    <TableCell><PolicyBadge decision={decision.decision} /></TableCell>
                    <TableCell><RiskBadge risk={decision.risk_level} /></TableCell>
                    <TableCell><ReplayClassBadge replayClass={decision.replay_class} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <GovernanceBadge label={decision.irreversible ? 'Irreversible' : 'Reversible'} tone={decision.irreversible ? 'danger' : 'neutral'} showDot={false} />
                        <GovernanceBadge label={decision.human_gated ? 'Human-gated' : 'No human gate'} tone={decision.human_gated ? 'warning' : 'neutral'} showDot={false} />
                      </div>
                    </TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">{decision.policy_reason || 'Evidence not available'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getRelativeTime(decision.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <DetailCard decision={selected} />

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Approval Queue</h2>
            <p className="text-[11px] text-muted-foreground">Read-only unless the existing paused-run approval workflow is available.</p>
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Run</TableHead><TableHead>Agent</TableHead><TableHead>Paused</TableHead><TableHead>Reason</TableHead><TableHead>Actions</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {approvalsLoading ? (
                <TableRow><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ) : runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center">
                    <CheckCircle2 className="mx-auto mb-2 h-7 w-7 text-green-500" />
                    <p className="text-xs text-foreground">No actions are waiting for approval.</p>
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-mono text-xs">{truncateText(run.id, 18)}</TableCell>
                    <TableCell className="text-xs">{truncateText(run.agent_id, 18)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground"><Clock className="mr-1 inline h-3 w-3" />{getRelativeTime(run.paused_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{run.pause_reason ?? run.model ?? 'Evidence not available'}</TableCell>
                    <TableCell><GovernanceBadge label="Review in execution detail" tone="neutral" showDot={false} /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </DashboardLayout>
  );
}
