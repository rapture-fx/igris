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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody,
} from '@/components/ui/sheet';
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

function truncateHash(hash: string, len = 10): string {
  if (!hash) return '—';
  return hash.length > len ? `${hash.slice(0, len)}…` : hash;
}

function computeChainStatuses(receipts: Receipt[]): Map<string, ChainStatus> {
  const map = new Map<string, ChainStatus>();
  for (let i = 0; i < receipts.length; i++) {
    const r = receipts[i];
    if (i === receipts.length - 1) {
      map.set(r.id, !r.prev_hash ? 'first' : 'unknown');
    } else {
      const prev = receipts[i + 1];
      if (!r.prev_hash) {
        map.set(r.id, 'first');
      } else if (r.prev_hash === prev.hash) {
        map.set(r.id, 'intact');
      } else {
        map.set(r.id, 'broken');
      }
    }
  }
  return map;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="text-gray-300 hover:text-gray-600 transition-colors flex-shrink-0" title="Copy">
      {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="text-[10px] font-mono font-medium text-gray-400 uppercase tracking-wider">{title}</div>
      {children}
    </div>
  );
}

function ReceiptsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [violationsOnly, setViolationsOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('receipt')
  );

  const { data: receipts = [], isLoading, refetch } = useQuery<Receipt[]>({
    queryKey: ['proof-receipts'],
    queryFn: () => api.get('/v1/proof/receipts?limit=200&sort=timestamp:desc'),
    retry: false,
  });

  // Sync selected receipt to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId) {
      params.set('receipt', selectedId);
    } else {
      params.delete('receipt');
    }
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Esc closes drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const chainStatuses = useMemo(() => computeChainStatuses(receipts), [receipts]);

  const now = Date.now();
  const last24h = useMemo(
    () => receipts.filter((r) => now - new Date(r.timestamp).getTime() < 86_400_000),
    [receipts]
  );

  const counts = useMemo(() => ({
    total24h: last24h.length,
    signed: receipts.filter((r) => r.signed).length,
    violations: receipts.filter((r) => r.has_violation).length,
    broken: Array.from(chainStatuses.values()).filter((s) => s === 'broken').length,
  }), [receipts, chainStatuses]);

  const chainIntact = counts.broken === 0 && receipts.length > 0;

  const filtered = useMemo(() =>
    receipts.filter((r) => {
      const q = search.toLowerCase();
      const matchSearch = !q ||
        r.execution_id.toLowerCase().includes(q) ||
        (r.agent_id ?? '').toLowerCase().includes(q) ||
        (r.device_id ?? '').toLowerCase().includes(q);
      const matchViolation = !violationsOnly || r.has_violation;
      return matchSearch && matchViolation;
    }),
    [receipts, search, violationsOnly]
  );

  const selected = useMemo(
    () => receipts.find((r) => r.id === selectedId) ?? null,
    [receipts, selectedId]
  );

  const selectedChainStatus = selected ? (chainStatuses.get(selected.id) ?? 'unknown') : 'unknown';

  const STAT_CARDS = [
    {
      label: 'Total (24h)',
      value: isLoading ? null : counts.total24h,
      icon: FileCheck,
      iconClass: 'text-gray-500',
    },
    {
      label: 'Signed',
      value: isLoading ? null : counts.signed,
      icon: ShieldCheck,
      iconClass: 'text-green-600',
    },
    {
      label: 'Violations',
      value: isLoading ? null : counts.violations,
      icon: AlertTriangle,
      iconClass: counts.violations > 0 ? 'text-orange-600' : 'text-gray-400',
    },
    {
      label: 'Chain Integrity',
      value: isLoading ? null : (receipts.length === 0 ? '—' : chainIntact ? 'Intact' : `${counts.broken} break${counts.broken !== 1 ? 's' : ''}`),
      icon: Link2,
      iconClass: receipts.length === 0 ? 'text-gray-400' : chainIntact ? 'text-green-600' : 'text-red-600',
      text: true,
      valueClass: receipts.length === 0 ? 'text-gray-400' : chainIntact ? 'text-green-700' : 'text-red-700',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Execution Receipts</h1>
            <p className="text-xs text-gray-500 mt-0.5">Signed proof of governed execution.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
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
                ) : (c as any).text ? (
                  <span className={`text-sm font-semibold tabular-nums ${(c as any).valueClass ?? 'text-gray-900'}`}>
                    {c.value}
                  </span>
                ) : (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2">
          <div className="relative max-w-72 flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="execution_id / agent_id / device_id"
              className="pl-8 h-8 text-xs font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            onClick={() => setViolationsOnly(!violationsOnly)}
            className={`h-8 px-3 text-xs font-mono border rounded-md transition-colors flex items-center gap-1.5 ${
              violationsOnly
                ? 'bg-orange-50 border-orange-200 text-orange-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
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
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Execution ID</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Agent</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Device</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Timestamp</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Violation</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Hash</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Prev Hash</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Chain</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Sig</TableHead>
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
                  <TableCell colSpan={9} className="text-center text-gray-400 text-xs py-14 font-mono">
                    no receipts found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => {
                  const chainStatus = chainStatuses.get(r.id) ?? 'unknown';
                  return (
                    <TableRow
                      key={r.id}
                      className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === r.id ? 'bg-blue-50/50' : ''}`}
                      onClick={() => setSelectedId(r.id)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-1 group">
                          <span
                            className="text-xs font-mono text-blue-600 hover:text-blue-700 underline underline-offset-2 cursor-pointer"
                            title={r.execution_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/execution/runs/${r.execution_id}`);
                            }}
                          >
                            {truncateHash(r.execution_id, 12)}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <CopyButton text={r.execution_id} />
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs font-mono text-gray-600" title={r.agent_id}>
                        {r.agent_id ? truncateHash(r.agent_id, 10) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell className="text-xs font-mono text-gray-600" title={r.device_id}>
                        {r.device_id ? truncateHash(r.device_id, 10) : <span className="text-gray-300">—</span>}
                      </TableCell>
                      <TableCell
                        className="text-xs text-gray-500 whitespace-nowrap"
                        title={new Date(r.timestamp).toISOString()}
                      >
                        {getRelativeTime(r.timestamp)}
                      </TableCell>
                      <TableCell>
                        {r.has_violation
                          ? <ViolationSeverityBadge kind={r.violation_type ?? 'VIOLATION'} />
                          : <span className="text-gray-200 text-xs font-mono">—</span>}
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-[10px] font-mono text-gray-500 hover:text-gray-800 transition-colors cursor-default"
                          title={r.hash}
                        >
                          {truncateHash(r.hash, 8)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className="text-[10px] font-mono text-gray-400 hover:text-gray-700 transition-colors cursor-default"
                          title={r.prev_hash}
                        >
                          {r.prev_hash ? truncateHash(r.prev_hash, 8) : <span className="text-gray-200">—</span>}
                        </span>
                      </TableCell>
                      <TableCell>
                        <HashChainIndicator status={chainStatus} />
                      </TableCell>
                      <TableCell>
                        <ReceiptStatusBadge signed={r.signed} />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Right-side Drawer */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelectedId(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-gray-400" />
              Receipt
              {selected && (
                <span className="font-mono text-xs text-gray-400 font-normal ml-1">
                  {truncateHash(selected.execution_id, 14)}
                </span>
              )}
            </SheetTitle>
            <SheetClose onClick={() => setSelectedId(null)} />
          </SheetHeader>

          {selected && (
            <SheetBody className="space-y-6 py-5">
              {/* Receipt Metadata */}
              <DrawerSection title="Receipt Metadata">
                <KeyValueGrid items={[
                  {
                    label: 'execution_id',
                    value: selected.execution_id,
                    mono: true,
                    copyable: true,
                    copyValue: selected.execution_id,
                    href: `/execution/runs/${selected.execution_id}`,
                  },
                  {
                    label: 'timestamp',
                    value: new Date(selected.timestamp).toISOString(),
                    mono: true,
                  },
                  {
                    label: 'agent_id',
                    value: selected.agent_id || '—',
                    mono: true,
                    copyable: !!selected.agent_id,
                    copyValue: selected.agent_id,
                  },
                  {
                    label: 'device_id',
                    value: selected.device_id || '—',
                    mono: true,
                    copyable: !!selected.device_id,
                    copyValue: selected.device_id,
                  },
                  ...(selected.model ? [{ label: 'model', value: selected.model, mono: true }] : []),
                  ...(selected.duration != null ? [{
                    label: 'duration',
                    value: `${selected.duration}ms`,
                    mono: true,
                  }] : []),
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
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-400 w-16 flex-shrink-0">hash</span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-gray-600 break-all" title={selected.hash}>
                        {selected.hash || '—'}
                      </span>
                      {selected.hash && <CopyButton text={selected.hash} />}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-gray-400 w-16 flex-shrink-0">prev_hash</span>
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] font-mono text-gray-600 break-all" title={selected.prev_hash}>
                        {selected.prev_hash || <span className="text-gray-300 italic not-italic">none</span>}
                      </span>
                      {selected.prev_hash && <CopyButton text={selected.prev_hash} />}
                    </div>
                  </div>
                </div>
              </DrawerSection>

              <Separator />

              {/* Signature Verification */}
              <DrawerSection title="Signature Verification">
                <div className="space-y-3">
                  <div className="p-3 rounded-md border border-gray-100 bg-gray-50 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono text-gray-400">status</span>
                      <ReceiptStatusBadge signed={selected.signed} />
                    </div>
                    {selected.verification_status && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-400">verified</span>
                        <span className="text-[10px] font-mono text-gray-600">{selected.verification_status}</span>
                      </div>
                    )}
                  </div>

                  {selected.signature && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-400">signature</span>
                        <CopyButton text={selected.signature} />
                      </div>
                      <div className="px-2.5 py-2 rounded border border-gray-200 bg-gray-50">
                        <p className="text-[10px] font-mono text-gray-600 break-all leading-relaxed">
                          {selected.signature}
                        </p>
                      </div>
                    </div>
                  )}

                  {selected.public_key && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-gray-400">public_key</span>
                        <CopyButton text={selected.public_key} />
                      </div>
                      <div className="px-2.5 py-2 rounded border border-gray-200 bg-gray-50">
                        <p className="text-[10px] font-mono text-gray-600 break-all leading-relaxed">
                          {selected.public_key}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 pt-1">
                    {selected.signature && (
                      <button
                        onClick={() => navigator.clipboard.writeText(selected.signature)}
                        className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 flex items-center gap-1.5 transition-colors"
                      >
                        <Copy className="h-3 w-3" /> Copy Signature
                      </button>
                    )}
                    <button
                      onClick={() => downloadJSON(selected, `receipt-${selected.execution_id}`)}
                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1 flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="h-3 w-3" /> Download Receipt JSON
                    </button>
                  </div>
                </div>
              </DrawerSection>

              {/* Violation Snapshot (conditional) */}
              {selected.has_violation && (
                <>
                  <Separator />
                  <DrawerSection title="Violation Snapshot">
                    <KeyValueGrid items={[
                      ...(selected.violation_type ? [{
                        label: 'violation_type',
                        value: <ViolationSeverityBadge kind={selected.violation_type} />,
                      }] : []),
                      ...(selected.limit_value != null ? [{
                        label: 'limit',
                        value: String(selected.limit_value),
                        mono: true,
                      }] : []),
                      ...(selected.observed_value != null ? [{
                        label: 'observed',
                        value: String(selected.observed_value),
                        mono: true,
                      }] : []),
                      ...(selected.device_context ? [{
                        label: 'device_context',
                        value: JSON.stringify(selected.device_context),
                        mono: true,
                      }] : []),
                      ...(selected.agent_context ? [{
                        label: 'agent_context',
                        value: JSON.stringify(selected.agent_context),
                        mono: true,
                      }] : []),
                    ]} />
                  </DrawerSection>
                </>
              )}

              <Separator />

              {/* Raw JSON */}
              <DrawerSection title="Raw">
                <JSONViewer data={selected} filename={`receipt-${selected.execution_id}`} />
              </DrawerSection>
            </SheetBody>
          )}
        </SheetContent>
      </Sheet>
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
