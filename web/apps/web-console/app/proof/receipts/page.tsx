'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { downloadJSON, getRelativeTime } from '@/utils/helpers';
import {
  Search, RefreshCw, Shield, ShieldCheck, AlertTriangle,
  FileCheck, Copy, Check, Download, Link2,
} from 'lucide-react';
import { HashChainIndicator, type ChainStatus } from '@/components/proof/HashChainIndicator';
import { ReceiptStatusBadge } from '@/components/proof/ReceiptStatusBadge';
import { ViolationSeverityBadge } from '@/components/proof/ViolationSeverityBadge';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { ChainContinuityBar } from '@/components/proof/ChainContinuityBar';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { TimeRangePicker, filterByTimeRange, type TimeRange } from '@/components/proof/TimeRangePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Receipt {
  id: string;
  execution_id: string;
  timestamp: string;
  signature: string;
  hash: string;
  prev_hash: string;
  has_violation: boolean;
  signed: boolean;
  agent_id?: string;
  device_id?: string;
  model?: string;
  duration?: number;
  violation_type?: string;
  limit_value?: number | string;
  observed_value?: number | string;
  device_context?: Record<string, unknown>;
  agent_context?: Record<string, unknown>;
  public_key?: string;
  verification_status?: string;
  metadata?: Record<string, unknown>;
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function trunc(s: string, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function computeChainStatuses(receipts: Receipt[]): Map<string, ChainStatus> {
  const map = new Map<string, ChainStatus>();
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (i === receipts.length - 1) {
      map.set(r.id, !r.prev_hash ? 'first' : 'unknown');
    } else {
      const older = receipts[i + 1];
      if (!r.prev_hash) map.set(r.id, 'first');
      else if (r.prev_hash === older.hash) map.set(r.id, 'intact');
      else map.set(r.id, 'broken');
    }
  }
  return map;
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1500); }}
      className="flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('receipt'));

  const { data: allReceipts = [], isLoading, refetch } = useQuery<Receipt[]>({
    queryKey: ['proof-receipts'],
    queryFn: () => api.get('/v1/proof/receipts?limit=500&sort=timestamp:desc'),
    retry: false,
  });

  // Sync drawer state to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    selectedId ? p.set('receipt', selectedId) : p.delete('receipt');
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time-range slice (sorted desc, so chain logic is correct)
  const receipts = useMemo(
    () => filterByTimeRange(allReceipts, timeRange),
    [allReceipts, timeRange],
  );

  const chainStatuses = useMemo(() => computeChainStatuses(receipts), [receipts]);

  const counts = useMemo(() => ({
    total:      receipts.length,
    signed:     receipts.filter((r) => r.signed).length,
    violations: receipts.filter((r) => r.has_violation).length,
    broken:     Array.from(chainStatuses.values()).filter((s) => s === 'broken').length,
  }), [receipts, chainStatuses]);

  const chainIntact = counts.total > 0 && counts.broken === 0;

  const filtered = useMemo(() =>
    receipts.filter((r) => {
      const q = search.toLowerCase();
      const hit = !q
        || r.execution_id.toLowerCase().includes(q)
        || (r.agent_id ?? '').toLowerCase().includes(q)
        || (r.device_id ?? '').toLowerCase().includes(q);
      return hit && (!violationsOnly || r.has_violation);
    }),
    [receipts, search, violationsOnly],
  );

  const selected = useMemo(
    () => receipts.find((r) => r.id === selectedId) ?? null,
    [receipts, selectedId],
  );
  const selectedChainStatus = selected ? (chainStatuses.get(selected.id) ?? 'unknown') : 'unknown';

  const STAT_CARDS = [
    {
      label: `Total (${timeRange})`,
      value: isLoading ? null : counts.total,
      icon: FileCheck,
      iconClass: 'text-gray-400',
      num: true,
    },
    {
      label: 'Signed',
      value: isLoading ? null : counts.signed,
      icon: ShieldCheck,
      iconClass: 'text-green-600',
      num: true,
    },
    {
      label: 'Violations',
      value: isLoading ? null : counts.violations,
      icon: AlertTriangle,
      iconClass: counts.violations > 0 ? 'text-orange-500' : 'text-gray-300',
      num: true,
    },
    {
      label: 'Chain Integrity',
      value: isLoading
        ? null
        : counts.total === 0
          ? '—'
          : chainIntact
            ? 'Intact'
            : `${counts.broken} break${counts.broken !== 1 ? 's' : ''}`,
      icon: Link2,
      iconClass: counts.total === 0 ? 'text-gray-300' : chainIntact ? 'text-green-600' : 'text-red-500',
      valueClass: counts.total === 0 ? 'text-gray-400' : chainIntact ? 'text-green-700' : 'text-red-700',
      num: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Execution Receipts</h1>
            <p className="text-xs text-gray-500 mt-0.5">Signed proof of governed execution.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <TimeRangePicker value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.iconClass}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {c.value === null ? (
                  <Skeleton className="h-6 w-10" />
                ) : c.num ? (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                ) : (
                  <span className={`text-sm font-semibold ${(c as any).valueClass ?? 'text-gray-900'}`}>
                    {c.value}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="execution_id / agent_id / device_id"
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setViolationsOnly((v) => !v)}
            className={[
              'h-8 px-3 text-xs border rounded-md transition-colors flex items-center gap-1.5',
              violationsOnly
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300',
            ].join(' ')}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            violations only
          </button>
        </div>

        {/* Table */}
        <Card className="border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/60">
                {[
                  'Execution ID', 'Agent', 'Device', 'Timestamp',
                  'Violation', 'Hash', 'Prev Hash', 'Chain', 'Sig',
                ].map((h) => (
                  <TableHead key={h} className="text-[10px] font-medium text-gray-500 uppercase tracking-wide">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-14" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-xs text-gray-400 py-14">
                    no receipts found
                  </TableCell>
                </TableRow>
              ) : filtered.map((r) => {
                const chain = chainStatuses.get(r.id) ?? 'unknown';
                return (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-blue-50/40' : ''}`}
                    onClick={() => setSelectedId(r.id)}
                  >
                    {/* Execution ID */}
                    <TableCell>
                      <div className="flex items-center gap-1 group">
                        <span
                          className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
                          title={r.execution_id}
                          onClick={(e) => { e.stopPropagation(); router.push(`/execution/runs/${r.execution_id}`); }}
                        >
                          {trunc(r.execution_id, 12)}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <CopyBtn text={r.execution_id} />
                        </span>
                      </div>
                    </TableCell>
                    {/* Agent */}
                    <TableCell className="text-xs text-gray-600" title={r.agent_id}>
                      {r.agent_id ? trunc(r.agent_id, 10) : <span className="text-gray-300">—</span>}
                    </TableCell>
                    {/* Device */}
                    <TableCell className="text-xs text-gray-600" title={r.device_id}>
                      {r.device_id ? trunc(r.device_id, 10) : <span className="text-gray-300">—</span>}
                    </TableCell>
                    {/* Timestamp */}
                    <TableCell
                      className="text-xs text-gray-500 whitespace-nowrap"
                      title={new Date(r.timestamp).toISOString()}
                    >
                      {getRelativeTime(r.timestamp)}
                    </TableCell>
                    {/* Violation */}
                    <TableCell>
                      {r.has_violation
                        ? <ViolationSeverityBadge kind={r.violation_type ?? 'VIOLATION'} />
                        : <span className="text-gray-200 text-xs">—</span>}
                    </TableCell>
                    {/* Hash */}
                    <TableCell>
                      <span className="text-[10px] text-gray-500" title={r.hash}>
                        {trunc(r.hash, 8)}
                      </span>
                    </TableCell>
                    {/* Prev Hash */}
                    <TableCell>
                      <span className="text-[10px] text-gray-400" title={r.prev_hash}>
                        {r.prev_hash ? trunc(r.prev_hash, 8) : <span className="text-gray-200">—</span>}
                      </span>
                    </TableCell>
                    {/* Chain */}
                    <TableCell><HashChainIndicator status={chain} /></TableCell>
                    {/* Sig */}
                    <TableCell><ReceiptStatusBadge signed={r.signed} /></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Right-side Drawer */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <Shield className="h-4 w-4 text-gray-400" />
            Receipt
            {selected && (
              <span className="text-xs text-gray-400 font-normal">
                {trunc(selected.execution_id, 16)}
              </span>
            )}
          </>
        }
        subtitle={selected ? new Date(selected.timestamp).toISOString() : undefined}
      >
        {selected && (
          <>
            {/* Receipt Metadata */}
            <DrawerSection title="Receipt Metadata">
              <KeyValueGrid items={[
                {
                  label: 'execution_id',
                  value: selected.execution_id,
                  copyable: true,
                  copyValue: selected.execution_id,
                  href: `/execution/runs/${selected.execution_id}`,
                },
                { label: 'timestamp', value: new Date(selected.timestamp).toISOString() },
                {
                  label: 'agent_id',
                  value: selected.agent_id || '—',
                  copyable: !!selected.agent_id,
                  copyValue: selected.agent_id,
                },
                {
                  label: 'device_id',
                  value: selected.device_id || '—',
                  copyable: !!selected.device_id,
                  copyValue: selected.device_id,
                },
                ...(selected.model ? [{ label: 'model', value: selected.model }] : []),
                ...(selected.duration != null ? [{ label: 'duration', value: `${selected.duration}ms` }] : []),
              ]} />
            </DrawerSection>

            <Separator />

            {/* Hash Continuity */}
            <DrawerSection title="Hash Continuity">
              <ChainContinuityBar
                hash={selected.hash}
                prevHash={selected.prev_hash}
                status={selectedChainStatus}
              />
            </DrawerSection>

            <Separator />

            {/* Signature Verification */}
            <DrawerSection title="Signature Verification">
              <div className="space-y-3">
                {/* Status + verified row */}
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Signature status</span>
                  <ReceiptStatusBadge signed={selected.signed} />
                </div>
                {selected.verification_status && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Verified</span>
                    <span className="text-xs text-gray-700">{selected.verification_status}</span>
                  </div>
                )}

                {/* Signature */}
                {selected.signature && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Signature</span>
                      <CopyBtn text={selected.signature} />
                    </div>
                    <div className="px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-600 break-all leading-5">
                        {selected.signature}
                      </p>
                    </div>
                  </div>
                )}

                {/* Public key */}
                {selected.public_key && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">Public key</span>
                      <CopyBtn text={selected.public_key} />
                    </div>
                    <div className="px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
                      <p className="text-xs text-gray-600 break-all leading-5">
                        {selected.public_key}
                      </p>
                    </div>
                  </div>
                )}

                {/* Hash */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Hash</span>
                    {selected.hash && <CopyBtn text={selected.hash} />}
                  </div>
                  <div className="px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600 break-all leading-5">
                      {selected.hash || <span className="text-gray-300">—</span>}
                    </p>
                  </div>
                </div>

                {/* Previous Hash */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">Previous Hash</span>
                    {selected.prev_hash && <CopyBtn text={selected.prev_hash} />}
                  </div>
                  <div className="px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
                    <p className="text-xs text-gray-600 break-all leading-5">
                      {selected.prev_hash || <span className="text-gray-300">none</span>}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1">
                  {selected.signature && (
                    <button
                      onClick={() => navigator.clipboard.writeText(selected.signature)}
                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5 flex items-center gap-1.5 transition-colors"
                    >
                      <Copy className="h-3 w-3" /> Copy Signature
                    </button>
                  )}
                  <button
                    onClick={() => downloadJSON(selected, `receipt-${selected.execution_id}`)}
                    className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5 flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="h-3 w-3" /> Download JSON
                  </button>
                </div>
              </div>
            </DrawerSection>

            {/* Violation Snapshot — conditional */}
            {selected.has_violation && (
              <>
                <Separator />
                <DrawerSection title="Violation Snapshot">
                  <KeyValueGrid items={[
                    ...(selected.violation_type ? [{ label: 'Violation type', value: <ViolationSeverityBadge kind={selected.violation_type} /> }] : []),
                    ...(selected.limit_value != null ? [{ label: 'Limit', value: String(selected.limit_value) }] : []),
                    ...(selected.observed_value != null ? [{ label: 'Observed', value: String(selected.observed_value) }] : []),
                    ...(selected.device_context ? [{ label: 'Device context', value: JSON.stringify(selected.device_context) }] : []),
                    ...(selected.agent_context ? [{ label: 'Agent context', value: JSON.stringify(selected.agent_context) }] : []),
                  ]} />
                </DrawerSection>
              </>
            )}

            <Separator />

            {/* Raw JSON */}
            <DrawerSection title="Raw">
              <JSONViewer data={selected} filename={`receipt-${selected.execution_id}`} />
            </DrawerSection>
          </>
        )}
      </RightSideDrawer>
    </DashboardLayout>
  );
}

export default function ProofReceiptsPage() {
  return (
    <Suspense>
      <ReceiptsContent />
    </Suspense>
  );
}
