'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useGovernanceBoundaryViolations,
  useGovernanceHandoffEvents,
  useGovernancePolicyDecisions,
  useGovernanceRecoveryEvents,
  useGovernanceVerificationResults,
} from '@/hooks/useGovernance';
import { GovernanceBadge, PolicyBadge, ProofBadge, ViolationSeverityBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { AlertTriangle, ArrowUpRight, Search, ShieldOff } from 'lucide-react';

type ViolationItem = {
  id: string;
  kind: string;
  severity: string;
  task_id?: string;
  runtime_id?: string;
  action?: string;
  reason: string;
  created_at: string;
  evidence: unknown;
};

const ranges = ['last_1h', 'last_6h', 'last_24h', 'last_7d', 'last_30d'];

export default function ViolationsPage() {
  const [range, setRange] = useState('last_24h');
  const [severity, setSeverity] = useState('all');
  const [search, setSearch] = useState('');
  const [runtimeFilter, setRuntimeFilter] = useState('');
  const [selected, setSelected] = useState<ViolationItem | null>(null);

  const common = { limit: 200, range, runtime_id: runtimeFilter.trim() };
  const { data: policyData, isLoading: policyLoading } = useGovernancePolicyDecisions({ ...common, decision: 'denied' });
  const { data: boundaryData, isLoading: boundaryLoading } = useGovernanceBoundaryViolations({ ...common, severity });
  const { data: proofData, isLoading: proofLoading } = useGovernanceVerificationResults({ ...common });
  const { data: recoveryData, isLoading: recoveryLoading } = useGovernanceRecoveryEvents(common);
  const { data: handoffData, isLoading: handoffLoading } = useGovernanceHandoffEvents({ ...common, handoff_decision: 'denied' });
  const isLoading = policyLoading || boundaryLoading || proofLoading || recoveryLoading || handoffLoading;

  const items = useMemo<ViolationItem[]>(() => {
    const policy = (policyData?.items ?? []).map((item) => ({
      id: item.decision_id,
      kind: 'Policy violation',
      severity: 'critical',
      task_id: item.task_id,
      runtime_id: item.runtime_id,
      action: item.action_name,
      reason: item.policy_reason,
      created_at: item.created_at,
      evidence: item,
    }));
    const boundary = (boundaryData?.items ?? []).map((item) => ({
      id: item.violation_id,
      kind: 'Boundary violation',
      severity: item.severity,
      task_id: item.task_id,
      runtime_id: item.runtime_id,
      action: item.violation_type,
      reason: item.reason,
      created_at: item.created_at,
      evidence: item,
    }));
    const proof = (proofData?.items ?? [])
      .filter((item) => item.status === 'failed_verification' || item.status === 'policy_violation')
      .map((item) => ({
        id: item.verification_id,
        kind: item.status === 'policy_violation' ? 'Policy violation' : 'Failed verification',
        severity: 'critical',
        task_id: item.task_id,
        runtime_id: item.runtime_id,
        action: item.action_digest,
        reason: item.reason,
        created_at: item.created_at,
        evidence: item,
      }));
    const recovery = (recoveryData?.items ?? [])
      .filter((item) => item.replay_allowed === false || item.event_type.toLowerCase().includes('skip'))
      .map((item) => ({
        id: item.recovery_event_id,
        kind: item.replay_allowed === false ? 'Unsafe replay blocked' : 'Non-replayable recovery skipped',
        severity: 'warning',
        task_id: item.task_id,
        runtime_id: item.target_runtime_id || item.source_runtime_id,
        action: item.event_type,
        reason: item.reason,
        created_at: item.created_at,
        evidence: item,
      }));
    const handoff = (handoffData?.items ?? []).map((item) => ({
      id: item.handoff_event_id,
      kind: 'Denied runtime handoff',
      severity: 'warning',
      task_id: item.task_id,
      runtime_id: item.target_runtime_id || item.source_runtime_id,
      action: item.checkpoint_portability,
      reason: item.reason,
      created_at: item.created_at,
      evidence: item,
    }));
    return [...policy, ...boundary, ...proof, ...recovery, ...handoff]
      .filter((item) => severity === 'all' || item.severity === severity)
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  }, [boundaryData, handoffData, policyData, proofData, recoveryData, severity]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => [item.kind, item.task_id, item.runtime_id, item.action, item.reason]
      .filter(Boolean).some((value) => String(value).toLowerCase().includes(query)));
  }, [items, search]);

  const counts = {
    critical: items.filter((item) => item.severity === 'critical' || item.severity === 'error').length,
    warning: items.filter((item) => item.severity === 'warning').length,
    boundary: items.filter((item) => item.kind === 'Boundary violation').length,
    proof: items.filter((item) => item.kind === 'Failed verification').length,
  };

  return (
    <DashboardLayout>
      <div className="space-y-5 px-6 pr-8 py-6">
        <div className="flex flex-wrap items-start justify-end gap-4">
          <div className="grid w-full max-w-xl gap-2 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, action, reason..." className="h-8 pl-8 text-xs" />
            </div>
            <Input value={runtimeFilter} onChange={(event) => setRuntimeFilter(event.target.value)} placeholder="Runtime ID filter" className="h-8 text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {['all', 'critical', 'error', 'warning', 'info'].map((value) => (
            <button key={value} type="button" onClick={() => setSeverity(value)} className={`rounded border px-2.5 py-1 text-[11px] font-medium ${severity === value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-muted-foreground'}`}>
              {value}
            </button>
          ))}
          {ranges.map((value) => (
            <button key={value} type="button" onClick={() => setRange(value)} className={`rounded border px-2.5 py-1 text-[11px] font-medium ${range === value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-muted-foreground'}`}>
              {value.replace('last_', 'last ')}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <Table>
            <TableHeader><TableRow><TableHead>Event</TableHead><TableHead>Severity</TableHead><TableHead>Task</TableHead><TableHead>Runtime</TableHead><TableHead>Action</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No violations match these filters.</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={`${item.kind}-${item.id}`} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(item)}>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {item.kind === 'Policy violation' ? <PolicyBadge decision="denied" /> : item.kind === 'Failed verification' ? <ProofBadge status="failed_verification" /> : <GovernanceBadge label={item.kind} tone={item.severity === 'critical' || item.severity === 'error' ? 'danger' : 'warning'} />}
                      </div>
                    </TableCell>
                    <TableCell><ViolationSeverityBadge severity={item.severity} /></TableCell>
                    <TableCell>
                      {item.task_id ? (
                        <Link href={`/execution/tasks/${encodeURIComponent(item.task_id)}`} className="group flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-xs text-foreground">{truncateText(item.task_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">Not available</span>}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.runtime_id ? (
                        <Link href={`/runtimes/${encodeURIComponent(item.runtime_id)}`} className="group flex items-center gap-1.5 hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                          {truncateText(item.runtime_id, 18)}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Link>
                      ) : 'Not available'}
                    </TableCell>
                    <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">{item.action || 'Not available'}</TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">{item.reason || 'Evidence not available'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getRelativeTime(item.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <SafeEvidenceJsonPanel title="Selected violation evidence" data={selected?.evidence ?? null} defaultOpen={Boolean(selected)} />
      </div>
    </DashboardLayout>
  );
}
