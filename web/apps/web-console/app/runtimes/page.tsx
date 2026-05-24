'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { GovernanceBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { useGovernanceRuntimes } from '@/hooks/useGovernance';
import { runtimeTrustLabel, type GovernanceRuntimeSummary } from '@/lib/governance';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { ArrowUpRight, AlertTriangle, Cpu, Search, ShieldCheck } from 'lucide-react';

function capabilityText(value: unknown): string {
  if (Array.isArray(value)) return value.length ? value.slice(0, 4).map(String).join(', ') : 'Not available';
  if (value && typeof value === 'object') return Object.keys(value).slice(0, 4).join(', ') || 'Not available';
  return 'Not available';
}

function TrustBadge({ state }: { state?: string }) {
  const label = runtimeTrustLabel(state);
  return <GovernanceBadge label={label.label} tone={label.tone} />;
}

export default function RuntimesPage() {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GovernanceRuntimeSummary | null>(null);
  const { data, isLoading } = useGovernanceRuntimes({ limit: 200 });
  const runtimes = data?.items ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return runtimes;
    return runtimes.filter((runtime) =>
      [runtime.runtime_id, runtime.runtime_label, runtime.trust_state, capabilityText(runtime.capability_summary)]
        .some((value) => value.toLowerCase().includes(query)),
    );
  }, [runtimes, search]);

  return (
    <DashboardLayout>
      <div className="space-y-5 px-6 pr-8 py-6">
        <div className="flex flex-wrap items-start justify-end gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search runtime, trust, capability..." className="h-8 pl-8 text-xs" />
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-end px-4 py-3">
            {!isLoading && <span className="text-[11px] tabular-nums text-muted-foreground">{filtered.length} of {data?.total ?? 0}</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Runtime</TableHead>
                <TableHead>Trust</TableHead>
                <TableHead>Capabilities</TableHead>
                <TableHead>Executions</TableHead>
                <TableHead>Boundaries</TableHead>
                <TableHead>Recovery / Proof</TableHead>
                <TableHead>Last seen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={7}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No runtime summaries match these filters.</TableCell></TableRow>
              ) : (
                filtered.map((runtime) => (
                  <TableRow key={runtime.runtime_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(runtime)}>
                    <TableCell>
                      <Link href={`/runtimes/${encodeURIComponent(runtime.runtime_id)}`} className="group flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                        <span className="text-xs text-foreground">{truncateText(runtime.runtime_label || runtime.runtime_id, 22)}</span>
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                      </Link>
                      <div className="text-[10px] text-muted-foreground">{truncateText(runtime.runtime_id, 24)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <TrustBadge state={runtime.trust_state} />
                        {runtime.enforcement_warning && <GovernanceBadge label="Runtime support warning" tone="warning" showDot={false} />}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[220px] text-xs text-muted-foreground">{capabilityText(runtime.capability_summary)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{runtime.active_execution_count} active</div>
                      <div>{runtime.recent_execution_count} recent</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{runtime.boundary_count} records</div>
                      <div>{runtime.violation_count} violations</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div>{runtime.handoff_count} handoffs</div>
                      <div>{runtime.verified_proof_count} verified / {runtime.failed_verification_count} failed</div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{runtime.last_seen ? getRelativeTime(runtime.last_seen) : 'Not available'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <SafeEvidenceJsonPanel title="Selected runtime evidence" data={selected} defaultOpen={Boolean(selected)} />
      </div>
    </DashboardLayout>
  );
}
