'use client';

import { useState, useMemo, useEffect, Suspense, type ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ErrorState } from '@/components/states/ErrorState';
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
  FileCheck, Copy, Check, Download, Eye, CheckCircle2, XCircle, Clock,
  type LucideIcon,
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

interface ViolationRecord {
  timestamp: string;
  violation_type: string;
  policy_rule: string;
  action_taken: string;
}

interface Receipt {
  id: string;
  execution_id: string;
  agent_id: string;
  device_id: string;
  timestamp: string;
  start_time: string;
  end_time: string;
  status: 'verified' | 'unverified' | 'failed';
  signature: string;
  hash: string;
  prev_hash: string;
  has_violation: boolean;
  signed: boolean;
  // resource usage
  cpu_ms: number;
  memory_mb: number;
  tokens_used: number;
  tool_calls: number;
  duration_ms: number;
  // violations
  violations: ViolationRecord[];
  model: string;
}


// ─── Utilities ────────────────────────────────────────────────────────────────

function trunc(s: string, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function truncMiddle(s: string, keep = 10): string {
  if (!s || s.length <= keep * 2 + 3) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
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

// ─── Design primitives ────────────────────────────────────────────────────────

function OverviewCard({
  icon: Icon, label, value, sub, loading,
}: {
  icon: LucideIcon; label: string; value: ReactNode; sub: string; loading?: boolean;
}) {
  return (
    <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-gray-900 tabular-nums">{value}</div>
        )}
        <p className="text-xs text-black mt-1">{sub}</p>
      </div>
    </div>
  );
}

function SurfaceSection({
  icon: Icon, title, description, actions,
  bodyClassName = 'px-4 py-4', className = '', children,
}: {
  icon: LucideIcon; title: string; description: string;
  actions?: ReactNode; bodyClassName?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`border border-gray-200 shadow rounded-3xl overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-gray-700" strokeWidth={1.5} />
            <p className="text-xs font-medium text-black">{title}</p>
          </div>
          <p className="text-[11px] text-black mt-0.5">{description}</p>
        </div>
        {actions}
      </div>
      <div className={`bg-gray-50 border-t border-gray-200 rounded-t-3xl ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(text);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
      }}
      className="flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors"
      title="Copy"
    >
      {ok ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function VerificationBadge({ status }: { status: Receipt['status'] }) {
  const map = {
    verified:   { cls: 'bg-green-50 text-green-700 border-green-200',   label: 'Verified',   Icon: CheckCircle2 },
    unverified: { cls: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Unverified', Icon: Clock },
    failed:     { cls: 'bg-red-50 text-red-600 border-red-200',         label: 'Failed',     Icon: XCircle },
  } as const;
  const { cls, label, Icon } = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

function ViolationCountCell({ count }: { count: number }) {
  if (count === 0) return <span className="text-xs text-gray-300">—</span>;
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-700 border border-orange-200">
      <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
      {count}
    </span>
  );
}

function HashDisplay({ value, label }: { value: string; label: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{label}</span>
        {value && <CopyBtn text={value} />}
      </div>
      <div className="px-3 py-2.5 rounded-md border border-gray-200 bg-gray-50">
        <p className="text-[11px] font-mono text-gray-600 break-all leading-5">
          {value || <span className="text-gray-300">none</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();

  const [search, setSearch] = useState('');
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('receipt'));
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; message: string } | null>(null);

  const { data: allReceipts = [], isLoading, error, refetch } = useQuery<Receipt[]>({
    queryKey: ['proof-receipts'],
    queryFn: () => api.get<Receipt[]>('/proof/receipts?limit=500&sort=timestamp:desc', { allowMockFallback: false }),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { execution_id: string; expected_hash: string; signature: string }) =>
      api.post('/proof/receipts/verify', payload),
    onSuccess: (result: { verified: boolean; message: string }) => {
      setVerifyResult({ ok: result.verified, message: result.message });
    },
    onError: (err: Error) => setVerifyResult({ ok: false, message: err.message }),
  });

  // Sync drawer state to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    selectedId ? p.set('receipt', selectedId) : p.delete('receipt');
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const receipts = useMemo(
    () => filterByTimeRange(allReceipts, timeRange),
    [allReceipts, timeRange],
  );

  const chainStatuses = useMemo(() => computeChainStatuses(receipts), [receipts]);

  const counts = useMemo(() => ({
    total:      receipts.length,
    verified:   receipts.filter((r) => r.status === 'verified').length,
    violations: receipts.filter((r) => r.has_violation).length,
    last:       receipts[0]?.timestamp ?? null,
  }), [receipts]);

  const filtered = useMemo(() =>
    receipts.filter((r) => {
      const q = search.toLowerCase();
      const hit = !q
        || r.execution_id.toLowerCase().includes(q)
        || r.agent_id.toLowerCase().includes(q)
        || r.device_id.toLowerCase().includes(q);
      return hit && (!violationsOnly || r.has_violation);
    }),
    [receipts, search, violationsOnly],
  );

  const selected = useMemo(
    () => receipts.find((r) => r.id === selectedId) ?? null,
    [receipts, selectedId],
  );
  const selectedChainStatus = selected ? (chainStatuses.get(selected.id) ?? 'unknown') : 'unknown';

  const handleVerify = (r: Receipt) => {
    setVerifyResult(null);
    verifyMutation.mutate({
      execution_id: r.execution_id,
      expected_hash: r.hash,
      signature: r.signature,
    });
  };

  if (error) {
    return (
      <DashboardLayout>
        <ErrorState
          error={error}
          title="Receipt records are unavailable"
          description="This page uses live proof receipts only and does not fall back to mock data."
          onRetry={() => {
            void refetch();
          }}
        />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Execution Receipts</h1>
            <p className="text-xs text-black mt-0.5">Signed records of runtime execution.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <TimeRangePicker value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <OverviewCard
            icon={FileCheck}
            label="Receipts"
            value={counts.total}
            sub={`In the last ${timeRange}`}
            loading={isLoading}
          />
          <OverviewCard
            icon={ShieldCheck}
            label="Verified"
            value={counts.verified}
            sub="expected hash matched stored receipt"
            loading={isLoading}
          />
          <OverviewCard
            icon={AlertTriangle}
            label="Violations"
            value={counts.violations}
            sub="Flagged executions"
            loading={isLoading}
          />
          <OverviewCard
            icon={Clock}
            label="Last Receipt"
            value={counts.last ? getRelativeTime(counts.last) : '—'}
            sub="Most recent entry"
            loading={isLoading}
          />
        </div>

        {/* ── Action Bar ────────────────────────────────────────────────────── */}
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

        {/* ── Receipts Table ────────────────────────────────────────────────── */}
        <SurfaceSection
          icon={FileCheck}
          title="Receipt Log"
          description="Signed execution records with hash-chain continuity tracking."
          bodyClassName="px-0 py-0"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mx-4 mb-4">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Timestamp', 'Execution ID', 'Agent', 'Device', 'Status', 'Duration', 'Violations', ''].map((h) => (
                    <TableHead key={h} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((_, j) => (
                        <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-14 text-center text-xs text-gray-400">
                      No receipts found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                    >
                      {/* Timestamp */}
                      <TableCell className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums">
                        {getRelativeTime(r.timestamp)}
                      </TableCell>

                      {/* Execution ID */}
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-1.5 group">
                          <span
                            className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 font-mono"
                            title={r.execution_id}
                            onClick={(e) => { e.stopPropagation(); router.push(`/execution/runs/${r.execution_id}`); }}
                          >
                            {trunc(r.execution_id, 14)}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <CopyBtn text={r.execution_id} />
                          </span>
                        </div>
                      </TableCell>

                      {/* Agent */}
                      <TableCell className="px-4 py-3 text-xs text-gray-600 font-mono" title={r.agent_id}>
                        {trunc(r.agent_id, 12)}
                      </TableCell>

                      {/* Device */}
                      <TableCell className="px-4 py-3 text-xs text-gray-600 font-mono" title={r.device_id}>
                        {trunc(r.device_id, 12)}
                      </TableCell>

                      {/* Status */}
                      <TableCell className="px-4 py-3">
                        <VerificationBadge status={r.status} />
                      </TableCell>

                      {/* Duration */}
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                        {r.duration_ms}ms
                      </TableCell>

                      {/* Violations */}
                      <TableCell className="px-4 py-3">
                        <ViolationCountCell count={r.violations?.length ?? 0} />
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-900 gap-1"
                            onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                          >
                            <Eye className="h-3 w-3" /> View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-900 gap-1"
                            onClick={() => handleVerify(r)}
                            disabled={verifyMutation.isPending}
                          >
                            <Shield className="h-3 w-3" /> Verify
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </SurfaceSection>

        {/* ── Verification Panel ────────────────────────────────────────────── */}
        <SurfaceSection
          icon={Shield}
          title="Receipt Verification"
          description="Inspect the stored receipt hash, signature, and chain link for the selected receipt."
          actions={selected ? (
            <div className="flex items-center gap-2">
              {verifyResult?.ok && (
                <span className="text-xs text-green-700 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Receipt check passed
                </span>
              )}
              {verifyResult && !verifyResult.ok && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> Receipt check failed
                </span>
              )}
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1.5"
                onClick={() => handleVerify(selected)}
                disabled={verifyMutation.isPending}
              >
                {verifyMutation.isPending
                  ? <><RefreshCw className="h-3 w-3 animate-spin" /> Verifying…</>
                  : <><ShieldCheck className="h-3 w-3" /> Check Receipt</>
                }
              </Button>
            </div>
          ) : undefined}
        >
          {!selected ? (
            <p className="text-xs text-gray-400 text-center py-4">
              Select a receipt from the table to inspect its cryptographic proof.
            </p>
          ) : (
            <div className="space-y-4">
              {verifyResult && (
                <div className={`rounded-md border px-3 py-2 text-xs ${verifyResult.ok ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}`}>
                  {verifyResult.message}
                </div>
              )}
              <HashDisplay label="Signature" value={selected.signature} />
              <HashDisplay label="Hash" value={selected.hash} />
              <HashDisplay label="Previous Hash" value={selected.prev_hash || ''} />
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => selected.signature && navigator.clipboard.writeText(selected.signature)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5 flex items-center gap-1.5 transition-colors"
                >
                  <Copy className="h-3 w-3" /> Copy Signature
                </button>
                <button
                  onClick={() => downloadJSON(selected, `receipt-${selected.execution_id}`)}
                  className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2.5 py-1.5 flex items-center gap-1.5 transition-colors"
                >
                  <Download className="h-3 w-3" /> Download JSON
                </button>
              </div>
            </div>
          )}
        </SurfaceSection>
      </div>

      {/* ── Receipt Detail Drawer ──────────────────────────────────────────────── */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <Shield className="h-4 w-4 text-gray-400" />
            Receipt
            {selected && (
              <span className="text-xs text-gray-400 font-normal font-mono">
                {trunc(selected.execution_id, 16)}
              </span>
            )}
          </>
        }
        subtitle={selected ? new Date(selected.timestamp).toISOString() : undefined}
      >
        {selected && (
          <>
            {/* Execution Metadata */}
            <DrawerSection title="Execution Metadata">
              <KeyValueGrid items={[
                {
                  label: 'execution_id',
                  value: selected.execution_id,
                  copyable: true,
                  copyValue: selected.execution_id,
                  href: `/execution/runs/${selected.execution_id}`,
                },
                { label: 'agent_id',   value: selected.agent_id,  copyable: true, copyValue: selected.agent_id },
                { label: 'device_id',  value: selected.device_id, copyable: true, copyValue: selected.device_id },
                { label: 'start_time', value: new Date(selected.start_time).toISOString() },
                { label: 'end_time',   value: new Date(selected.end_time).toISOString() },
                { label: 'status',     value: <VerificationBadge status={selected.status} /> },
              ]} />
            </DrawerSection>

            <Separator />

            {/* Resource Usage */}
            <DrawerSection title="Resource Usage">
              <KeyValueGrid items={[
                { label: 'duration_ms',  value: `${selected.duration_ms}ms` },
                { label: 'cpu_ms',       value: `${selected.cpu_ms}ms` },
                { label: 'memory_mb',    value: `${selected.memory_mb} MB` },
                { label: 'tokens_used',  value: selected.tokens_used.toLocaleString() },
                { label: 'tool_calls',   value: String(selected.tool_calls) },
              ]} />
            </DrawerSection>

            <Separator />

            {/* Violation Records */}
            <DrawerSection title="Violation Records">
              {(selected.violations ?? []).length === 0 ? (
                <p className="text-xs text-gray-400">No violations recorded.</p>
              ) : (
                <div className="rounded-md border border-gray-200 overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent">
                        {['Timestamp', 'Type', 'Policy Rule', 'Action'].map((h) => (
                          <TableHead key={h} className="text-[10px] font-medium text-gray-500 h-8 px-3 bg-gray-50">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(selected.violations ?? []).map((v, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          <TableCell className="px-3 py-2 text-[10px] text-gray-500 tabular-nums whitespace-nowrap">
                            {getRelativeTime(v.timestamp)}
                          </TableCell>
                          <TableCell className="px-3 py-2">
                            <ViolationSeverityBadge kind={v.violation_type} />
                          </TableCell>
                          <TableCell className="px-3 py-2 text-[10px] font-mono text-gray-600">
                            {v.policy_rule}
                          </TableCell>
                          <TableCell className="px-3 py-2 text-[10px] text-gray-600">
                            {v.action_taken}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
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

            {/* Receipt Signature */}
            <DrawerSection title="Receipt Signature">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
                  <span className="text-xs text-gray-500">Signature status</span>
                  <ReceiptStatusBadge signed={selected.signed} />
                </div>
                <HashDisplay label="Signature" value={selected.signature} />
                <HashDisplay label="Hash" value={selected.hash} />
                <HashDisplay label="Previous Hash" value={selected.prev_hash} />
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
