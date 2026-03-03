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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose, SheetBody,
} from '@/components/ui/sheet';
import { api } from '@/lib/apiClient';
import { downloadJSON, getRelativeTime } from '@/utils/helpers';
import {
  Search, RefreshCw, AlertTriangle, Clock, Server, Brain,
  Copy, Check, Download, ShieldAlert,
} from 'lucide-react';
import { ViolationSeverityBadge } from '@/components/proof/ViolationSeverityBadge';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';

interface Violation {
  id: string;
  execution_id?: string;
  timestamp: string;
  kind: string;
  agent_id: string;
  device_id: string;
  limit_value: number | string;
  observed_value: number | string;
  unit?: string;
  policy?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

interface Execution {
  id: string;
  status?: string;
  model?: string;
  agent_id?: string;
  device_id?: string;
  started_at?: string;
  duration?: number;
  [key: string]: unknown;
}

const KIND_OPTIONS = [
  'all',
  'CPU_LIMIT',
  'MEMORY_LIMIT',
  'QUOTA_EXCEEDED',
  'TICK_TIMEOUT',
  'CAPABILITY_DENIED',
];

function truncateId(id: string, len = 12): string {
  if (!id) return '—';
  return id.length > len ? `${id.slice(0, len)}…` : id;
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

function ExecutionMiniTable({ executionId }: { executionId: string }) {
  const { data: execution, isLoading } = useQuery<Execution>({
    queryKey: ['execution', executionId],
    queryFn: () => api.get(`/v1/executions/${executionId}`),
    retry: false,
    enabled: !!executionId,
  });

  if (isLoading) {
    return <Skeleton className="h-16 w-full" />;
  }
  if (!execution) {
    return (
      <div className="text-xs font-mono text-gray-400 py-2">
        execution not found
      </div>
    );
  }

  const fields: Array<{ label: string; key: string }> = [
    { label: 'status', key: 'status' },
    { label: 'model', key: 'model' },
    { label: 'agent_id', key: 'agent_id' },
    { label: 'device_id', key: 'device_id' },
    { label: 'started_at', key: 'started_at' },
    { label: 'duration', key: 'duration' },
  ];

  return (
    <div className="rounded-md border border-gray-200 overflow-hidden">
      <table className="w-full text-[10px] font-mono">
        <tbody>
          {fields.map(({ label, key }) => {
            const val = execution[key];
            if (val == null) return null;
            return (
              <tr key={key} className="border-b border-gray-100 last:border-0">
                <td className="px-3 py-1.5 text-gray-400 w-28 whitespace-nowrap">{label}</td>
                <td className="px-3 py-1.5 text-gray-700 break-all">
                  {key === 'started_at' ? new Date(String(val)).toISOString() : String(val)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PolicySnapshot({ executionId }: { executionId: string }) {
  const { data: policy, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['execution-policy', executionId],
    queryFn: () => api.get(`/v1/executions/${executionId}/policy`),
    retry: false,
    enabled: !!executionId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!policy) return (
    <div className="text-xs font-mono text-gray-400 py-2">no policy found</div>
  );

  const items = Object.entries(policy).map(([k, v]) => ({
    label: k,
    value: typeof v === 'object' ? JSON.stringify(v) : String(v),
    mono: true,
  }));

  return <KeyValueGrid items={items} />;
}

function ViolationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get('violation')
  );

  const { data: violations = [], isLoading, refetch } = useQuery<Violation[]>({
    queryKey: ['proof-violations'],
    queryFn: () => api.get('/v1/proof/violations?limit=200&sort=timestamp:desc'),
    retry: false,
  });

  // Sync selected to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedId) {
      params.set('violation', selectedId);
    } else {
      params.delete('violation');
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

  const now = Date.now();
  const last24h = useMemo(
    () => violations.filter((v) => now - new Date(v.timestamp).getTime() < 86_400_000),
    [violations]
  );

  const uniqueDevices = useMemo(
    () => new Set(violations.map((v) => v.device_id)).size,
    [violations]
  );

  const uniqueAgents = useMemo(
    () => new Set(violations.map((v) => v.agent_id)).size,
    [violations]
  );

  const mostCommonKind = useMemo(() => {
    const counts: Record<string, number> = {};
    violations.forEach((v) => { counts[v.kind] = (counts[v.kind] ?? 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0] ?? null;
  }, [violations]);

  const filtered = useMemo(() =>
    violations.filter((v) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        v.agent_id.toLowerCase().includes(q) ||
        (v.device_id ?? '').toLowerCase().includes(q) ||
        v.kind.toLowerCase().includes(q) ||
        (v.execution_id ?? '').toLowerCase().includes(q);
      const matchKind = kindFilter === 'all' || v.kind === kindFilter;
      return matchSearch && matchKind;
    }),
    [violations, search, kindFilter]
  );

  const selected = useMemo(
    () => violations.find((v) => v.id === selectedId) ?? null,
    [violations, selectedId]
  );

  const STAT_CARDS = [
    {
      label: 'Total (24h)',
      value: isLoading ? null : last24h.length,
      icon: Clock,
      iconClass: last24h.length > 0 ? 'text-red-500' : 'text-gray-400',
    },
    {
      label: 'By Device',
      value: isLoading ? null : uniqueDevices,
      icon: Server,
      iconClass: 'text-gray-500',
      sub: 'unique devices',
    },
    {
      label: 'By Agent',
      value: isLoading ? null : uniqueAgents,
      icon: Brain,
      iconClass: 'text-violet-500',
      sub: 'unique agents',
    },
    {
      label: 'Most Common',
      value: isLoading ? null : mostCommonKind ? mostCommonKind[0] : '—',
      icon: AlertTriangle,
      iconClass: 'text-orange-500',
      text: true,
      sub: mostCommonKind ? `${mostCommonKind[1]}×` : '',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Violations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Policy enforcement events.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => downloadJSON(violations, 'violations')}
            >
              <Download className="h-3.5 w-3.5" /> Export
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
                ) : (c as any).text ? (
                  <span className="text-sm font-mono font-semibold text-gray-900 break-all">{c.value}</span>
                ) : (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                )}
                {(c as any).sub && (
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">{(c as any).sub}</p>
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
              placeholder="agent_id / device_id / execution_id"
              className="pl-8 h-8 text-xs font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-8 w-44 text-xs font-mono">
              <SelectValue placeholder="violation type" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs font-mono">
                  {k === 'all' ? 'all types' : k}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card className="border border-gray-200 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50/60">
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Timestamp</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Agent</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Device</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Type</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Limit</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Observed</TableHead>
                <TableHead className="text-[10px] font-mono font-medium text-gray-500 uppercase tracking-wide">Execution ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-14" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-gray-400 text-xs py-14 font-mono">
                    no violations found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow
                    key={v.id}
                    className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === v.id ? 'bg-blue-50/50' : ''}`}
                    onClick={() => setSelectedId(v.id)}
                  >
                    <TableCell
                      className="text-xs text-gray-500 whitespace-nowrap"
                      title={new Date(v.timestamp).toISOString()}
                    >
                      {getRelativeTime(v.timestamp)}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600" title={v.agent_id}>
                      {truncateId(v.agent_id, 12)}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-gray-600" title={v.device_id}>
                      {truncateId(v.device_id, 12)}
                    </TableCell>
                    <TableCell>
                      <ViolationSeverityBadge kind={v.kind} />
                    </TableCell>
                    <TableCell className="text-xs tabular-nums font-mono text-gray-500">
                      {v.limit_value}{v.unit ? ` ${v.unit}` : ''}
                    </TableCell>
                    <TableCell className="text-xs tabular-nums font-mono text-red-600 font-medium">
                      {v.observed_value}{v.unit ? ` ${v.unit}` : ''}
                    </TableCell>
                    <TableCell>
                      {v.execution_id ? (
                        <div className="flex items-center gap-1 group">
                          <span
                            className="text-xs font-mono text-blue-600 hover:text-blue-700 underline underline-offset-2"
                            title={v.execution_id}
                            onClick={(e) => {
                              e.stopPropagation();
                              router.push(`/execution/runs/${v.execution_id}`);
                            }}
                          >
                            {truncateId(v.execution_id, 10)}
                          </span>
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                            <CopyButton text={v.execution_id} />
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-200 font-mono text-xs">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
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
              <ShieldAlert className="h-4 w-4 text-orange-400" />
              Violation
              {selected && (
                <ViolationSeverityBadge kind={selected.kind} />
              )}
            </SheetTitle>
            <SheetClose onClick={() => setSelectedId(null)} />
          </SheetHeader>

          {selected && (
            <SheetBody className="space-y-6 py-5">
              {/* Violation Detail */}
              <DrawerSection title="Violation Detail">
                <KeyValueGrid items={[
                  {
                    label: 'timestamp',
                    value: new Date(selected.timestamp).toISOString(),
                    mono: true,
                  },
                  {
                    label: 'violation_type',
                    value: <ViolationSeverityBadge kind={selected.kind} />,
                  },
                  {
                    label: 'limit',
                    value: `${selected.limit_value}${selected.unit ? ` ${selected.unit}` : ''}`,
                    mono: true,
                  },
                  {
                    label: 'observed',
                    value: `${selected.observed_value}${selected.unit ? ` ${selected.unit}` : ''}`,
                    mono: true,
                  },
                  ...(selected.execution_id ? [{
                    label: 'execution_id',
                    value: selected.execution_id,
                    mono: true,
                    copyable: true,
                    copyValue: selected.execution_id,
                    href: `/execution/runs/${selected.execution_id}`,
                  }] : []),
                  {
                    label: 'agent_id',
                    value: selected.agent_id,
                    mono: true,
                    copyable: true,
                    copyValue: selected.agent_id,
                  },
                  {
                    label: 'device_id',
                    value: selected.device_id,
                    mono: true,
                    copyable: true,
                    copyValue: selected.device_id,
                  },
                ]} />
              </DrawerSection>

              <Separator />

              {/* Associated Execution */}
              {selected.execution_id && (
                <>
                  <DrawerSection title="Associated Execution">
                    <ExecutionMiniTable executionId={selected.execution_id} />
                  </DrawerSection>

                  <Separator />

                  {/* Policy Snapshot */}
                  <DrawerSection title="Policy Snapshot">
                    <PolicySnapshot executionId={selected.execution_id} />
                  </DrawerSection>

                  <Separator />
                </>
              )}

              {/* Raw JSON */}
              <DrawerSection title="Raw">
                <JSONViewer data={selected} filename={`violation-${selected.id}`} />
              </DrawerSection>
            </SheetBody>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}

export default function ProofViolationsPage() {
  return (
    <Suspense>
      <ViolationsContent />
    </Suspense>
  );
}
