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
import { api } from '@/lib/apiClient';
import { downloadJSON, getRelativeTime } from '@/utils/helpers';
import {
  Search, RefreshCw, AlertTriangle, Clock, Server, Brain,
  Copy, Check, Download, ShieldAlert,
} from 'lucide-react';
import { ViolationSeverityBadge } from '@/components/proof/ViolationSeverityBadge';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { TimeRangePicker, filterByTimeRange, type TimeRange } from '@/components/proof/TimeRangePicker';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Constants ────────────────────────────────────────────────────────────────

const KIND_OPTIONS = ['all', 'CPU_LIMIT', 'MEMORY_LIMIT', 'QUOTA_EXCEEDED', 'TICK_TIMEOUT', 'CAPABILITY_DENIED'];

// ─── Micro-components ─────────────────────────────────────────────────────────

function trunc(s: string, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

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

function ExecutionMiniTable({ executionId }: { executionId: string }) {
  const { data: exec, isLoading } = useQuery<Execution>({
    queryKey: ['execution', executionId],
    queryFn: () => api.get(`/v1/executions/${executionId}`),
    retry: false,
    enabled: !!executionId,
  });

  if (isLoading) return <Skeleton className="h-20 w-full" />;
  if (!exec) return <p className="text-xs text-gray-400 py-2">execution not found</p>;

  const FIELDS = [
    { label: 'Status',     key: 'status' },
    { label: 'Model',      key: 'model' },
    { label: 'Agent',      key: 'agent_id' },
    { label: 'Device',     key: 'device_id' },
    { label: 'Started',    key: 'started_at' },
    { label: 'Duration',   key: 'duration' },
  ];

  return (
    <Table>
      <TableBody>
        {FIELDS.map(({ label, key }) => {
          const val = exec[key];
          if (val == null) return null;
          return (
            <TableRow key={key} className="border-gray-100">
              <TableCell className="text-xs text-gray-400 w-24 py-2 pl-0">{label}</TableCell>
              <TableCell className="text-xs text-gray-700 break-all py-2 pr-0">
                {key === 'started_at' ? new Date(String(val)).toISOString() : String(val)}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function PolicySnapshot({ executionId }: { executionId: string }) {
  const { data: policy, isLoading } = useQuery<Record<string, unknown>>({
    queryKey: ['execution-policy', executionId],
    queryFn: () => api.get(`/v1/executions/${executionId}/policy`),
    retry: false,
    enabled: !!executionId,
  });

  if (isLoading) return <Skeleton className="h-16 w-full" />;
  if (!policy) return <p className="text-xs text-gray-400 py-2">no policy snapshot</p>;

  return (
    <KeyValueGrid
      items={Object.entries(policy).map(([k, v]) => ({
        label: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }))}
    />
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function ViolationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('violation'));

  const { data: allViolations = [], isLoading, refetch } = useQuery<Violation[]>({
    queryKey: ['proof-violations'],
    queryFn: () => api.get('/v1/proof/violations?limit=500&sort=timestamp:desc'),
    retry: false,
  });

  // Sync drawer state to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    selectedId ? p.set('violation', selectedId) : p.delete('violation');
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Time-range slice
  const violations = useMemo(
    () => filterByTimeRange(allViolations, timeRange),
    [allViolations, timeRange],
  );

  // Summary aggregations
  const uniqueDevices = useMemo(
    () => new Set(violations.map((v) => v.device_id)).size,
    [violations],
  );
  const uniqueAgents = useMemo(
    () => new Set(violations.map((v) => v.agent_id)).size,
    [violations],
  );
  const mostCommonKind = useMemo(() => {
    const counts: Record<string, number> = {};
    violations.forEach((v) => { counts[v.kind] = (counts[v.kind] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [violations]);

  // Search + kind filter
  const filtered = useMemo(() =>
    violations.filter((v) => {
      const q = search.toLowerCase();
      const hit = !q
        || v.agent_id.toLowerCase().includes(q)
        || (v.device_id ?? '').toLowerCase().includes(q)
        || v.kind.toLowerCase().includes(q)
        || (v.execution_id ?? '').toLowerCase().includes(q);
      return hit && (kindFilter === 'all' || v.kind === kindFilter);
    }),
    [violations, search, kindFilter],
  );

  const selected = useMemo(
    () => violations.find((v) => v.id === selectedId) ?? null,
    [violations, selectedId],
  );

  const STAT_CARDS = [
    {
      label: `Total (${timeRange})`,
      value: isLoading ? null : violations.length,
      icon: Clock,
      iconClass: violations.length > 0 ? 'text-red-500' : 'text-gray-400',
      num: true,
    },
    {
      label: 'By Device',
      value: isLoading ? null : uniqueDevices,
      icon: Server,
      iconClass: 'text-gray-500',
      sub: 'unique devices',
      num: true,
    },
    {
      label: 'By Agent',
      value: isLoading ? null : uniqueAgents,
      icon: Brain,
      iconClass: 'text-violet-500',
      sub: 'unique agents',
      num: true,
    },
    {
      label: 'Most Common',
      value: isLoading ? null : mostCommonKind?.[0] ?? '—',
      icon: AlertTriangle,
      iconClass: 'text-orange-500',
      sub: mostCommonKind ? `${mostCommonKind[1]}×` : '',
      num: false,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Violations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Policy enforcement events.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <TimeRangePicker value={timeRange} onChange={setTimeRange} />
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => downloadJSON(violations, `violations-${timeRange}`)}
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
                ) : c.num ? (
                  <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                ) : (
                  <span className="text-sm font-semibold text-gray-900 break-all">{c.value}</span>
                )}
                {(c as any).sub && (
                  <p className="text-[10px] text-gray-400 mt-0.5">{(c as any).sub}</p>
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
              placeholder="agent_id / device_id / execution_id"
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={kindFilter} onValueChange={setKindFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="violation type" />
            </SelectTrigger>
            <SelectContent>
              {KIND_OPTIONS.map((k) => (
                <SelectItem key={k} value={k} className="text-xs">
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
                {[
                  'Timestamp', 'Agent', 'Device', 'Violation Type',
                  'Limit', 'Observed', 'Execution ID',
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
                    {Array.from({ length: 7 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-14" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-xs text-gray-400 py-14">
                    no violations found
                  </TableCell>
                </TableRow>
              ) : filtered.map((v) => (
                <TableRow
                  key={v.id}
                  className={`cursor-pointer hover:bg-gray-50 transition-colors ${selectedId === v.id ? 'bg-blue-50/40' : ''}`}
                  onClick={() => setSelectedId(v.id)}
                >
                  <TableCell
                    className="text-xs text-gray-500 whitespace-nowrap"
                    title={new Date(v.timestamp).toISOString()}
                  >
                    {getRelativeTime(v.timestamp)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600" title={v.agent_id}>
                    {trunc(v.agent_id, 12)}
                  </TableCell>
                  <TableCell className="text-xs text-gray-600" title={v.device_id}>
                    {trunc(v.device_id, 12)}
                  </TableCell>
                  <TableCell>
                    <ViolationSeverityBadge kind={v.kind} />
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-gray-500">
                    {v.limit_value}{v.unit ? ` ${v.unit}` : ''}
                  </TableCell>
                  <TableCell className="text-xs tabular-nums text-red-600 font-medium">
                    {v.observed_value}{v.unit ? ` ${v.unit}` : ''}
                  </TableCell>
                  <TableCell>
                    {v.execution_id ? (
                      <div className="flex items-center gap-1 group">
                        <span
                          className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2"
                          title={v.execution_id}
                          onClick={(e) => { e.stopPropagation(); router.push(`/execution/runs/${v.execution_id}`); }}
                        >
                          {trunc(v.execution_id, 10)}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => e.stopPropagation()}>
                          <CopyBtn text={v.execution_id} />
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-200 text-xs">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
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
            <ShieldAlert className="h-4 w-4 text-orange-400" />
            Violation
            {selected && <ViolationSeverityBadge kind={selected.kind} />}
          </>
        }
        subtitle={selected ? new Date(selected.timestamp).toISOString() : undefined}
      >
        {selected && (
          <>
            {/* Violation Detail */}
            <DrawerSection title="Violation Detail">
              <KeyValueGrid items={[
                { label: 'Timestamp', value: new Date(selected.timestamp).toISOString() },
                { label: 'Type', value: <ViolationSeverityBadge kind={selected.kind} /> },
                { label: 'Limit', value: `${selected.limit_value}${selected.unit ? ` ${selected.unit}` : ''}` },
                { label: 'Observed', value: `${selected.observed_value}${selected.unit ? ` ${selected.unit}` : ''}` },
                ...(selected.execution_id ? [{
                  label: 'Execution',
                  value: selected.execution_id,
                  copyable: true,
                  copyValue: selected.execution_id,
                  href: `/execution/runs/${selected.execution_id}`,
                }] : []),
                { label: 'Agent', value: selected.agent_id, copyable: true, copyValue: selected.agent_id },
                { label: 'Device', value: selected.device_id, copyable: true, copyValue: selected.device_id },
              ]} />
            </DrawerSection>

            <Separator />

            {/* Associated Execution + Policy (only when execution_id exists) */}
            {selected.execution_id ? (
              <>
                <DrawerSection title="Associated Execution">
                  <ExecutionMiniTable executionId={selected.execution_id} />
                </DrawerSection>

                <Separator />

                <DrawerSection title="Policy Snapshot">
                  <PolicySnapshot executionId={selected.execution_id} />
                </DrawerSection>

                <Separator />
              </>
            ) : null}

            {/* Raw JSON */}
            <DrawerSection title="Raw">
              <JSONViewer data={selected} filename={`violation-${selected.id}`} />
            </DrawerSection>
          </>
        )}
      </RightSideDrawer>
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
