'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { useGovernanceVerificationResults } from '@/hooks/useGovernance';
import type { GovernanceVerificationResult } from '@/lib/governance';
import { GovernanceBadge, ProofBadge } from '@/components/governance/GovernanceBadge';
import { SafeEvidenceJsonPanel } from '@/components/governance/SafeEvidenceJsonPanel';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import { ArrowUpRight, Search, ShieldCheck } from 'lucide-react';

interface ReceiptSummary {
  id: string;
  execution_id: string;
  task_id?: string;
  agent_id?: string;
  runtime_id?: string;
  status?: string;
  verification_status?: string;
  hash?: string;
  prev_hash?: string;
  signed?: boolean;
  timestamp: string;
}

const PROOF_STATUSES = ['all', 'verified', 'partially_verified', 'unverifiable', 'failed_verification', 'policy_violation'];

function CheckBadge({ label, value }: { label: string; value?: boolean }) {
  return (
    <GovernanceBadge
      label={`${label}: ${value === undefined ? 'Not available' : value ? 'Pass' : 'Fail'}`}
      tone={value === false ? 'danger' : value ? 'success' : 'neutral'}
      showDot={false}
    />
  );
}

export default function ProofPage() {
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<GovernanceVerificationResult | ReceiptSummary | null>(null);

  const { data, isLoading } = useGovernanceVerificationResults({ limit: 200, status });
  const results = data?.items ?? [];
  const { data: receipts = [], isLoading: receiptsLoading } = useQuery<ReceiptSummary[]>({
    queryKey: ['proof-receipts-summary'],
    queryFn: async () => {
      try {
        return await api.get<ReceiptSummary[]>('/proof/receipts?limit=100&sort=timestamp:desc', { allowMockFallback: false });
      } catch {
        return [];
      }
    },
    retry: false,
    staleTime: 30_000,
  });

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return results;
    return results.filter((item) =>
      [item.task_id, item.execution_id, item.action_digest, item.reason, item.checkpoint_digest]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [results, search]);

  const counts = useMemo(
    () => ({
      verified: results.filter((item) => item.status === 'verified').length,
      partial: results.filter((item) => item.status === 'partially_verified').length,
      failed: results.filter((item) => item.status === 'failed_verification' || item.status === 'policy_violation').length,
      unverifiable: results.filter((item) => item.status === 'unverifiable').length,
    }),
    [results],
  );

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-foreground">Proof</h1>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Verification results and receipt summaries. Logs are supporting evidence, not proof.
            </p>
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search task, execution, digest..." className="h-8 pl-8 text-xs" />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {PROOF_STATUSES.map((value) => (
            <button key={value} type="button" onClick={() => setStatus(value)} className={`rounded border px-2.5 py-1 text-[11px] font-medium ${status === value ? 'border-gray-900 bg-gray-900 text-white' : 'border-gray-200 bg-white text-muted-foreground'}`}>
              {value.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Verification Results</h2>
            <p className="text-[11px] text-muted-foreground">Backed by `GET /v1/execution/governance/verification-results`.</p>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Task / Execution</TableHead><TableHead>Status</TableHead><TableHead>Checks</TableHead><TableHead>Evidence</TableHead><TableHead>Reason</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, index) => <TableRow key={index}><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>)
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-12 text-center text-xs text-muted-foreground">Evidence not available. No verification results match these filters.</TableCell></TableRow>
              ) : (
                filtered.map((item) => (
                  <TableRow key={item.verification_id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(item)}>
                    <TableCell>
                      {item.task_id ? (
                        <Link href={`/execution/tasks/${encodeURIComponent(item.task_id)}`} className="group flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <span className="font-mono text-xs text-foreground">{truncateText(item.task_id, 18)}</span>
                          <ArrowUpRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100" />
                        </Link>
                      ) : <span className="text-xs text-muted-foreground">Task not available</span>}
                      <div className="font-mono text-[10px] text-muted-foreground">{item.execution_id ? truncateText(item.execution_id, 24) : 'Execution not available'}</div>
                      {item.runtime_id && (
                        <Link href={`/runtimes/${encodeURIComponent(item.runtime_id)}`} className="group mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                          runtime {truncateText(item.runtime_id, 16)}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Link>
                      )}
                    </TableCell>
                    <TableCell><ProofBadge status={item.status} /></TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <CheckBadge label="Policy" value={item.policy_compliant} />
                        <CheckBadge label="Hash" value={item.hash_valid} />
                        <CheckBadge label="Signature" value={item.signature_matches} />
                        <CheckBadge label="Runtime key" value={item.runtime_key_found} />
                        <CheckBadge label="Chain" value={item.chain_link_valid} />
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{item.evidence_digest ? truncateText(item.evidence_digest, 18) : 'Not available'}</TableCell>
                    <TableCell className="max-w-md text-xs text-muted-foreground">{item.reason || 'Evidence not available'}</TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getRelativeTime(item.created_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <section className="overflow-hidden rounded-lg border-[0.5px] border-black/[0.08] bg-white">
          <div className="px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">Receipt Summaries</h2>
            <p className="text-[11px] text-muted-foreground">Receipts are proof only after hash/signature verification succeeds.</p>
          </div>
          <Table>
            <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Execution</TableHead><TableHead>Status</TableHead><TableHead>Hash</TableHead><TableHead>Signed</TableHead><TableHead>When</TableHead></TableRow></TableHeader>
            <TableBody>
              {receiptsLoading ? (
                <TableRow><TableCell colSpan={6}><Skeleton className="h-5 w-full" /></TableCell></TableRow>
              ) : receipts.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="py-10 text-center text-xs text-muted-foreground">Evidence not available. No receipts returned.</TableCell></TableRow>
              ) : (
                receipts.slice(0, 25).map((receipt) => (
                  <TableRow key={receipt.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(receipt)}>
                    <TableCell className="font-mono text-xs">{truncateText(receipt.id, 18)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {truncateText(receipt.execution_id, 22)}
                      {receipt.runtime_id && (
                        <Link href={`/runtimes/${encodeURIComponent(receipt.runtime_id)}`} className="group mt-0.5 flex items-center gap-1.5 text-[10px] hover:text-foreground" onClick={(e) => e.stopPropagation()}>
                          runtime {truncateText(receipt.runtime_id, 16)}
                          <ArrowUpRight className="h-3 w-3 opacity-0 group-hover:opacity-100" />
                        </Link>
                      )}
                    </TableCell>
                    <TableCell><ProofBadge status={receipt.verification_status ?? receipt.status} /></TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{receipt.hash ? truncateText(receipt.hash, 18) : 'Not available'}</TableCell>
                    <TableCell><GovernanceBadge label={receipt.signed ? 'Signature present' : 'Signature not available'} tone={receipt.signed ? 'success' : 'neutral'} showDot={false} /></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{getRelativeTime(receipt.timestamp)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>

        <SafeEvidenceJsonPanel title="Selected proof evidence" data={selected} defaultOpen={Boolean(selected)} />
      </div>
    </DashboardLayout>
  );
}
