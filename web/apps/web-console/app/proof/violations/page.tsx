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
  Search, RefreshCw, AlertTriangle, Clock, ShieldOff, Eye,
  Download, Copy, Check, Ban, ShieldAlert,
} from 'lucide-react';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { JSONViewer } from '@/components/proof/JSONViewer';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { TimeRangePicker, filterByTimeRange, type TimeRange } from '@/components/proof/TimeRangePicker';

// ─── Types ─────────────────────────────────────────────────────────────────────

type Severity = 'low' | 'medium' | 'high' | 'critical';

interface PolicyViolation {
  id: string;
  timestamp: string;
  execution_id: string;
  agent_id: string;
  device_id: string;
  // classification
  violation_type: string;
  severity: Severity;
  // policy context
  policy_rule: string;
  policy_hash: string;
  capability_rule: string;
  bounds_rule: string;
  // runtime action
  action_taken: string;
  execution_state: string;
  supervisor_action: string;
  containment_result: string;
  // signature record
  signature: string;
  hash: string;
  previous_hash: string;
}

// ─── Mock Data ─────────────────────────────────────────────────────────────────

const _now = Date.now();

const MOCK_VIOLATIONS: PolicyViolation[] = [
  {
    id: 'viol_00000001',
    timestamp: new Date(_now - 4 * 60_000).toISOString(),
    execution_id: 'exec_4a7b8c9d0e1f2a3b',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_9f3a2c1b',
    violation_type: 'CAPABILITY_DENIED',
    severity: 'critical',
    policy_rule: 'allow_shell_exec',
    policy_hash: 'sha256:0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a',
    capability_rule: 'shell:exec:*',
    bounds_rule: 'capability.deny_list',
    action_taken: 'terminated',
    execution_state: 'TERMINATED',
    supervisor_action: 'KILL_EXECUTION',
    containment_result: 'CONTAINED',
    signature: 'ed25519:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hp',
    hash: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
    previous_hash: 'sha256:0f1e2d3c4b5a6978a7b6c5d4e3f2a1b0',
  },
  {
    id: 'viol_00000002',
    timestamp: new Date(_now - 18 * 60_000).toISOString(),
    execution_id: 'exec_b1c2d3e4f5a60001',
    agent_id: 'agent_0x4d5e6f',
    device_id: 'dev_a1b2c3d4',
    violation_type: 'MEMORY_LIMIT',
    severity: 'high',
    policy_rule: 'max_memory_mb',
    policy_hash: 'sha256:1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1',
    capability_rule: '',
    bounds_rule: 'resource.memory.max_mb=512',
    action_taken: 'throttled',
    execution_state: 'RUNNING',
    supervisor_action: 'THROTTLE_MEMORY',
    containment_result: 'MITIGATED',
    signature: 'ed25519:ZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamts',
    hash: 'sha256:2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
    previous_hash: 'sha256:1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
  },
  {
    id: 'viol_00000003',
    timestamp: new Date(_now - 37 * 60_000).toISOString(),
    execution_id: 'exec_c3d4e5f6a7b80002',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_f7e8d9c0',
    violation_type: 'QUOTA_EXCEEDED',
    severity: 'critical',
    policy_rule: 'max_tokens_per_execution',
    policy_hash: 'sha256:2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b',
    capability_rule: '',
    bounds_rule: 'quota.tokens.max=8000',
    action_taken: 'terminated',
    execution_state: 'TERMINATED',
    supervisor_action: 'KILL_EXECUTION',
    containment_result: 'CONTAINED',
    signature: 'ed25519:amtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFy',
    hash: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
    previous_hash: 'sha256:2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e',
  },
  {
    id: 'viol_00000004',
    timestamp: new Date(_now - 55 * 60_000).toISOString(),
    execution_id: 'exec_d5e6f7a8b9c00003',
    agent_id: 'agent_0x7a8b9c',
    device_id: 'dev_9f3a2c1b',
    violation_type: 'TICK_TIMEOUT',
    severity: 'medium',
    policy_rule: 'max_tick_duration_ms',
    policy_hash: 'sha256:3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
    capability_rule: '',
    bounds_rule: 'timing.tick.max_ms=500',
    action_taken: 'warned',
    execution_state: 'RUNNING',
    supervisor_action: 'EMIT_WARNING',
    containment_result: 'MONITORED',
    signature: 'ed25519:c3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXox',
    hash: 'sha256:4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
    previous_hash: 'sha256:3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
  },
  {
    id: 'viol_00000005',
    timestamp: new Date(_now - 72 * 60_000).toISOString(),
    execution_id: 'exec_e7f8a9b0c1d20004',
    agent_id: 'agent_0xd1e2f3',
    device_id: 'dev_c8d9e0f1',
    violation_type: 'CPU_LIMIT',
    severity: 'high',
    policy_rule: 'max_cpu_ms_per_tick',
    policy_hash: 'sha256:4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3',
    capability_rule: '',
    bounds_rule: 'resource.cpu.max_ms=200',
    action_taken: 'throttled',
    execution_state: 'RUNNING',
    supervisor_action: 'THROTTLE_CPU',
    containment_result: 'MITIGATED',
    signature: 'ed25519:MjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw',
    hash: 'sha256:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    previous_hash: 'sha256:4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
  },
  {
    id: 'viol_00000006',
    timestamp: new Date(_now - 91 * 60_000).toISOString(),
    execution_id: 'exec_f1a2b3c4d5e60005',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_a1b2c3d4',
    violation_type: 'CAPABILITY_DENIED',
    severity: 'critical',
    policy_rule: 'allow_network_egress',
    policy_hash: 'sha256:5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4',
    capability_rule: 'network:egress:external',
    bounds_rule: 'capability.deny_list',
    action_taken: 'terminated',
    execution_state: 'TERMINATED',
    supervisor_action: 'KILL_EXECUTION',
    containment_result: 'CONTAINED',
    signature: 'ed25519:NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJj',
    hash: 'sha256:6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
    previous_hash: 'sha256:5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  },
  {
    id: 'viol_00000007',
    timestamp: new Date(_now - 110 * 60_000).toISOString(),
    execution_id: 'exec_a2b3c4d5e6f70006',
    agent_id: 'agent_0x4d5e6f',
    device_id: 'dev_f7e8d9c0',
    violation_type: 'QUOTA_EXCEEDED',
    severity: 'medium',
    policy_rule: 'max_tool_calls',
    policy_hash: 'sha256:6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5',
    capability_rule: '',
    bounds_rule: 'quota.tool_calls.max=10',
    action_taken: 'warned',
    execution_state: 'RUNNING',
    supervisor_action: 'EMIT_WARNING',
    containment_result: 'MONITORED',
    signature: 'ed25519:ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVm',
    hash: 'sha256:7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
    previous_hash: 'sha256:6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
  },
  {
    id: 'viol_00000008',
    timestamp: new Date(_now - 128 * 60_000).toISOString(),
    execution_id: 'exec_b3c4d5e6f7a80007',
    agent_id: 'agent_0x7a8b9c',
    device_id: 'dev_c8d9e0f1',
    violation_type: 'MEMORY_LIMIT',
    severity: 'low',
    policy_rule: 'max_memory_mb',
    policy_hash: 'sha256:7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6',
    capability_rule: '',
    bounds_rule: 'resource.memory.warn_mb=256',
    action_taken: 'warned',
    execution_state: 'RUNNING',
    supervisor_action: 'EMIT_WARNING',
    containment_result: 'MONITORED',
    signature: 'ed25519:WJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpam',
    hash: 'sha256:8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e',
    previous_hash: 'sha256:7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d',
  },
];

// ─── Utilities ─────────────────────────────────────────────────────────────────

function trunc(s: string, n: number): string {
  if (!s) return '—';
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

function truncMiddle(s: string, keep = 12): string {
  if (!s || s.length <= keep * 2 + 3) return s;
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

// ─── Severity Badge ────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<Severity, string> = {
  low:      'bg-gray-50 text-gray-600 border-gray-200',
  medium:   'bg-yellow-50 text-yellow-700 border-yellow-200',
  high:     'bg-orange-50 text-orange-700 border-orange-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-semibold uppercase border rounded ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
}

// ─── Action Badge ──────────────────────────────────────────────────────────────

function ActionBadge({ action }: { action: string }) {
  const cls =
    action === 'terminated' ? 'bg-red-50 text-red-700 border-red-200' :
    action === 'throttled'  ? 'bg-orange-50 text-orange-700 border-orange-200' :
    'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${cls}`}>
      {action}
    </span>
  );
}

// ─── Copy Button ───────────────────────────────────────────────────────────────

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

// ─── Hash Row ──────────────────────────────────────────────────────────────────

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">{label}</span>
        {value && <CopyBtn text={value} />}
      </div>
      <div className="px-3 py-2 rounded border border-gray-200 bg-gray-50">
        <p className="text-[11px] font-mono text-gray-600 break-all leading-5">
          {value || <span className="text-gray-300">none</span>}
        </p>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const VIOLATION_TYPES = ['all', 'CAPABILITY_DENIED', 'CPU_LIMIT', 'MEMORY_LIMIT', 'QUOTA_EXCEEDED', 'TICK_TIMEOUT'];
const SEVERITIES: Array<'all' | Severity> = ['all', 'critical', 'high', 'medium', 'low'];

function ViolationsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState<'all' | Severity>('all');
  const [timeRange, setTimeRange] = useState<TimeRange>('24h');
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('violation'));

  const { data: allViolations = [], isLoading, refetch } = useQuery<PolicyViolation[]>({
    queryKey: ['proof-policy-violations'],
    queryFn: async () => {
      try {
        return await api.get<PolicyViolation[]>('/v1/proof/violations?limit=500&sort=timestamp:desc');
      } catch {
        return MOCK_VIOLATIONS;
      }
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  // Sync drawer state to URL
  useEffect(() => {
    const p = new URLSearchParams(searchParams.toString());
    selectedId ? p.set('violation', selectedId) : p.delete('violation');
    router.replace(`?${p.toString()}`, { scroll: false });
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  const violations = useMemo(
    () => filterByTimeRange(allViolations, timeRange),
    [allViolations, timeRange],
  );

  const counts = useMemo(() => ({
    total:       violations.length,
    critical:    violations.filter((v) => v.severity === 'critical').length,
    terminated:  violations.filter((v) => v.action_taken === 'terminated').length,
    last:        violations[0]?.timestamp ?? null,
  }), [violations]);

  const filtered = useMemo(() =>
    violations.filter((v) => {
      const q = search.toLowerCase();
      const hit = !q
        || v.agent_id.toLowerCase().includes(q)
        || v.device_id.toLowerCase().includes(q)
        || v.execution_id.toLowerCase().includes(q)
        || v.violation_type.toLowerCase().includes(q)
        || v.policy_rule.toLowerCase().includes(q);
      return (
        hit &&
        (typeFilter === 'all' || v.violation_type === typeFilter) &&
        (severityFilter === 'all' || v.severity === severityFilter)
      );
    }),
    [violations, search, typeFilter, severityFilter],
  );

  const selected = useMemo(
    () => violations.find((v) => v.id === selectedId) ?? null,
    [violations, selectedId],
  );

  const STAT_CARDS = [
    {
      label: `Violations (${timeRange})`,
      value: isLoading ? null : counts.total,
      icon: AlertTriangle,
      iconCls: counts.total > 0 ? 'text-red-500' : 'text-gray-300',
    },
    {
      label: 'Critical Violations',
      value: isLoading ? null : counts.critical,
      icon: ShieldOff,
      iconCls: counts.critical > 0 ? 'text-red-600' : 'text-gray-300',
    },
    {
      label: 'Terminated Executions',
      value: isLoading ? null : counts.terminated,
      icon: Ban,
      iconCls: counts.terminated > 0 ? 'text-orange-600' : 'text-gray-300',
    },
    {
      label: 'Last Violation',
      value: isLoading ? null : (counts.last ? getRelativeTime(counts.last) : '—'),
      icon: Clock,
      iconCls: 'text-gray-400',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Policy Violations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Containment events and enforcement actions recorded by the runtime.</p>
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
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.iconCls}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {c.value === null
                  ? <Skeleton className="h-6 w-10" />
                  : <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Bar */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48 max-w-80">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
            <Input
              placeholder="execution / agent / device / policy"
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue placeholder="violation type" />
            </SelectTrigger>
            <SelectContent>
              {VIOLATION_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-xs">
                  {t === 'all' ? 'all types' : t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={(v) => setSeverityFilter(v as 'all' | Severity)}>
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue placeholder="severity" />
            </SelectTrigger>
            <SelectContent>
              {SEVERITIES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs">
                  {s === 'all' ? 'all severities' : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Violations Table */}
        <Card className="border border-gray-200 shadow-none overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5 text-orange-400" />
              Violation Events
              {!isLoading && (
                <span className="ml-1 text-[10px] text-gray-400 font-normal">
                  {filtered.length} of {violations.length}
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Timestamp', 'Execution ID', 'Agent', 'Device', 'Type', 'Policy Rule', 'Severity', 'Action', ''].map((h) => (
                  <TableHead key={h} className="text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-4 bg-gray-50/60 hover:bg-gray-50/60">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-14 text-center text-xs text-gray-400">
                    No violations found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((v) => (
                  <TableRow
                    key={v.id}
                    className={`cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors ${selectedId === v.id ? 'bg-blue-50/50' : ''}`}
                    onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                  >
                    {/* Timestamp */}
                    <TableCell
                      className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap tabular-nums"
                      title={new Date(v.timestamp).toISOString()}
                    >
                      {getRelativeTime(v.timestamp)}
                    </TableCell>

                    {/* Execution ID */}
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5 group">
                        <span
                          className="text-xs text-blue-600 hover:text-blue-700 underline underline-offset-2 font-mono"
                          title={v.execution_id}
                          onClick={(e) => { e.stopPropagation(); router.push(`/execution/runs/${v.execution_id}`); }}
                        >
                          {trunc(v.execution_id, 14)}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <CopyBtn text={v.execution_id} />
                        </span>
                      </div>
                    </TableCell>

                    {/* Agent */}
                    <TableCell className="px-4 py-3 text-xs text-gray-600 font-mono" title={v.agent_id}>
                      {trunc(v.agent_id, 12)}
                    </TableCell>

                    {/* Device */}
                    <TableCell className="px-4 py-3 text-xs text-gray-600 font-mono" title={v.device_id}>
                      {trunc(v.device_id, 12)}
                    </TableCell>

                    {/* Type */}
                    <TableCell className="px-4 py-3">
                      <span className="text-[10px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                        {v.violation_type}
                      </span>
                    </TableCell>

                    {/* Policy Rule */}
                    <TableCell className="px-4 py-3 text-xs font-mono text-gray-600" title={v.policy_rule}>
                      {trunc(v.policy_rule, 22)}
                    </TableCell>

                    {/* Severity */}
                    <TableCell className="px-4 py-3">
                      <SeverityBadge severity={v.severity} />
                    </TableCell>

                    {/* Action */}
                    <TableCell className="px-4 py-3">
                      <ActionBadge action={v.action_taken} />
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] text-gray-500 hover:text-gray-900 gap-1"
                        onClick={() => setSelectedId(v.id === selectedId ? null : v.id)}
                      >
                        <Eye className="h-3 w-3" /> View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* Recent Violation Timeline */}
        <Card className="border border-gray-200 shadow-none overflow-hidden">
          <CardHeader className="px-4 py-3 border-b border-gray-100">
            <CardTitle className="text-xs font-medium text-gray-700 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-400" />
              Recent Violation Timeline
            </CardTitle>
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {['Timestamp', 'Execution ID', 'Type', 'Severity', 'Action'].map((h) => (
                  <TableHead key={h} className="text-[10px] font-medium text-gray-500 uppercase tracking-wide h-9 px-4 bg-gray-50/60 hover:bg-gray-50/60">
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((_, j) => (
                      <TableCell key={j} className="px-4 py-2.5"><Skeleton className="h-3 w-14" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : violations.slice(0, 10).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-xs text-gray-400">
                    No recent violations.
                  </TableCell>
                </TableRow>
              ) : (
                violations.slice(0, 10).map((v) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    onClick={() => setSelectedId(v.id)}
                  >
                    <TableCell className="px-4 py-2.5 text-xs text-gray-500 tabular-nums whitespace-nowrap">
                      {new Date(v.timestamp).toISOString()}
                    </TableCell>
                    <TableCell className="px-4 py-2.5 text-xs text-blue-600 font-mono">
                      {trunc(v.execution_id, 14)}
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <span className="text-[10px] font-mono text-gray-700 bg-gray-100 px-1.5 py-0.5 rounded">
                        {v.violation_type}
                      </span>
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <SeverityBadge severity={v.severity} />
                    </TableCell>
                    <TableCell className="px-4 py-2.5">
                      <ActionBadge action={v.action_taken} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

      </div>

      {/* Violation Details Drawer */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <ShieldAlert className="h-4 w-4 text-orange-400" />
            Violation
            {selected && <SeverityBadge severity={selected.severity} />}
          </>
        }
        subtitle={selected ? new Date(selected.timestamp).toISOString() : undefined}
      >
        {selected && (
          <div className="space-y-0">

              {/* Violation Metadata */}
              <DrawerSection title="Violation Metadata">
                <KeyValueGrid items={[
                  { label: 'violation_id',   value: selected.id,             copyable: true, copyValue: selected.id },
                  { label: 'timestamp',      value: new Date(selected.timestamp).toISOString() },
                  { label: 'execution_id',   value: selected.execution_id,   copyable: true, copyValue: selected.execution_id, href: `/execution/runs/${selected.execution_id}` },
                  { label: 'agent_id',       value: selected.agent_id,       copyable: true, copyValue: selected.agent_id },
                  { label: 'device_id',      value: selected.device_id,      copyable: true, copyValue: selected.device_id },
                  { label: 'severity',       value: <SeverityBadge severity={selected.severity} /> },
                  { label: 'violation_type', value: selected.violation_type },
                ]} />
              </DrawerSection>

              <Separator />

              {/* Policy Context */}
              <DrawerSection title="Policy Context">
                <div className="space-y-3">
                  <KeyValueGrid items={[
                    { label: 'policy_rule',     value: selected.policy_rule },
                    ...(selected.capability_rule ? [{ label: 'capability_rule', value: selected.capability_rule }] : []),
                    ...(selected.bounds_rule ? [{ label: 'bounds_rule', value: selected.bounds_rule }] : []),
                  ]} />
                  <div className="space-y-1 pt-1">
                    <span className="text-xs text-gray-400">policy_hash</span>
                    <div className="px-3 py-2 rounded border border-gray-200 bg-gray-50">
                      <p className="text-[11px] font-mono text-gray-600 break-all leading-5">
                        {truncMiddle(selected.policy_hash, 20)}
                      </p>
                    </div>
                  </div>
                </div>
              </DrawerSection>

              <Separator />

              {/* Runtime Action */}
              <DrawerSection title="Runtime Action">
                <KeyValueGrid items={[
                  { label: 'action_taken',       value: <ActionBadge action={selected.action_taken} /> },
                  { label: 'execution_state',    value: selected.execution_state },
                  { label: 'supervisor_action',  value: selected.supervisor_action },
                  { label: 'containment_result', value: selected.containment_result },
                ]} />
              </DrawerSection>

              <Separator />

              {/* Signature Record */}
              <DrawerSection title="Signature Record">
                <div className="space-y-3">
                  <HashRow label="Signature" value={selected.signature} />
                  <HashRow label="Hash" value={selected.hash} />
                  <HashRow label="Previous Hash" value={selected.previous_hash} />
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
                      onClick={() => downloadJSON(selected, `violation-${selected.id}`)}
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
                <JSONViewer data={selected} filename={`violation-${selected.id}`} />
              </DrawerSection>

          </div>
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
