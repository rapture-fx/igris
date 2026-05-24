'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { GovernanceBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGovernanceBoundaries } from '@/hooks/useGovernance';
import type { GovernanceExecutionBoundary } from '@/lib/governance';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { ArrowUpRight, Search } from 'lucide-react';

export default function BoundariesPage() {
  const [search, setSearch] = useState('');
  const [runtimeFilter, setRuntimeFilter] = useState('');
  const [selected, setSelected] = useState<GovernanceExecutionBoundary | null>(null);
  const { data, isLoading } = useGovernanceBoundaries({ limit: 200, runtime_id: runtimeFilter.trim() });
  const boundaries = data?.items ?? [];

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return boundaries;
    return boundaries.filter((boundary) =>
      [boundary.task_id, boundary.runtime_id, boundary.boundary_digest, boundary.network_scope, boundary.filesystem_scope, boundary.api_scope]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [boundaries, search]);

  return (
    <DashboardLayout>
      <div className="space-y-5 px-6 pr-8 py-6">
        <div className="flex flex-wrap items-start justify-end gap-4">
          <div className="grid w-full max-w-xl gap-2 md:grid-cols-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, runtime, digest..." className="h-8 pl-8 text-xs" />
            </div>
            <Input value={runtimeFilter} onChange={(event) => setRuntimeFilter(event.target.value)} placeholder="Runtime ID filter" className="h-8 text-xs" />
          </div>
        </div>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="flex items-center justify-end px-4 py-3">
            {!isLoading && <span className="text-[11px] tabular-nums text-muted-foreground">{filtered.length} of {data?.total ?? 0}</span>}
          </div>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Task</TableHead><TableHead>Runtime</TableHead><TableHead>Scopes</TableHead><TableHead>Digest</TableHead><TableHead>Created</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={5}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No boundary records match these filters.</TableCell></TableRow>
              ) : (
                filtered.map((boundary) => (
                  <TableRow key={boundary.boundary_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(boundary)}>
                    <TableCell>
                      {boundary.task_id ? (
                        <Link href={`/execution/tasks/${encodeURIComponent(boundary.task_id)}`} className="group flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                          <span className="text-xs text-foreground">{truncateText(boundary.task_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">Not available</span>}
                    </TableCell>
                    <TableCell>
                      {boundary.runtime_id ? (
                        <Link href={`/runtimes/${encodeURIComponent(boundary.runtime_id)}`} className="group flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                          <span className="text-xs text-foreground">{truncateText(boundary.runtime_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">Not available</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <GovernanceBadge label={`Network: ${boundary.network_scope}`} tone="neutral" showDot={false} />
                        <GovernanceBadge label={`File: ${boundary.filesystem_scope}`} tone="neutral" showDot={false} />
                        <GovernanceBadge label={`API: ${boundary.api_scope}`} tone="neutral" showDot={false} />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{truncateText(boundary.boundary_digest, 18)}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getRelativeTime(boundary.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <SafeEvidenceJsonPanel title="Selected boundary evidence" data={selected} defaultOpen={Boolean(selected)} />
      </div>
    </DashboardLayout>
  );
}
