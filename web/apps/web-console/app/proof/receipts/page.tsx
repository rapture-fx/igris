'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  FileCheck, Copy, Check, Download, Link2, Eye, CheckCircle2, XCircle, Clock,
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const _now = Date.now();

const MOCK_RECEIPTS: Receipt[] = [
  {
    id: 'rcpt_00000001',
    execution_id: 'exec_4a7b8c9d0e1f2a3b',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_9f3a2c1b',
    timestamp: new Date(_now - 18 * 60_000).toISOString(),
    start_time: new Date(_now - 18 * 60_000).toISOString(),
    end_time: new Date(_now - 18 * 60_000 + 842).toISOString(),
    status: 'verified',
    signature: 'ed25519:YWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hp',
    hash: 'sha256:0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d',
    prev_hash: 'sha256:1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c',
    has_violation: false,
    signed: true,
    cpu_ms: 589, memory_mb: 192, tokens_used: 2840, tool_calls: 3, duration_ms: 842,
    violations: [],
    model: 'claude-sonnet-4-6',
  },
  {
    id: 'rcpt_00000002',
    execution_id: 'exec_b1c2d3e4f5a60001',
    agent_id: 'agent_0x4d5e6f',
    device_id: 'dev_a1b2c3d4',
    timestamp: new Date(_now - 36 * 60_000).toISOString(),
    start_time: new Date(_now - 36 * 60_000).toISOString(),
    end_time: new Date(_now - 36 * 60_000 + 1204).toISOString(),
    status: 'verified',
    signature: 'ed25519:ZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamts',
    hash: 'sha256:1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c',
    prev_hash: 'sha256:2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
    has_violation: false,
    signed: true,
    cpu_ms: 843, memory_mb: 256, tokens_used: 4120, tool_calls: 5, duration_ms: 1204,
    violations: [],
    model: 'gpt-4o',
  },
  {
    id: 'rcpt_00000003',
    execution_id: 'exec_c3d4e5f6a7b80002',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_f7e8d9c0',
    timestamp: new Date(_now - 54 * 60_000).toISOString(),
    start_time: new Date(_now - 54 * 60_000).toISOString(),
    end_time: new Date(_now - 54 * 60_000 + 2018).toISOString(),
    status: 'verified',
    signature: 'ed25519:amtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFy',
    hash: 'sha256:2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b',
    prev_hash: 'sha256:3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
    has_violation: true,
    signed: true,
    cpu_ms: 1412, memory_mb: 384, tokens_used: 8640, tool_calls: 7, duration_ms: 2018,
    violations: [
      {
        timestamp: new Date(_now - 54 * 60_000 + 1200).toISOString(),
        violation_type: 'token_budget_exceeded',
        policy_rule: 'max_tokens_per_execution',
        action_taken: 'truncated',
      },
    ],
    model: 'claude-sonnet-4-6',
  },
  {
    id: 'rcpt_00000004',
    execution_id: 'exec_d5e6f7a8b9c00003',
    agent_id: 'agent_0x7a8b9c',
    device_id: 'dev_9f3a2c1b',
    timestamp: new Date(_now - 72 * 60_000).toISOString(),
    start_time: new Date(_now - 72 * 60_000).toISOString(),
    end_time: new Date(_now - 72 * 60_000 + 614).toISOString(),
    status: 'unverified',
    signature: '',
    hash: 'sha256:3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a',
    prev_hash: 'sha256:BROKEN_mismatch_a4b5c6d7e8f90a1b',
    has_violation: false,
    signed: false,
    cpu_ms: 430, memory_mb: 128, tokens_used: 1200, tool_calls: 1, duration_ms: 614,
    violations: [],
    model: 'gpt-4o-mini',
  },
  {
    id: 'rcpt_00000005',
    execution_id: 'exec_e7f8a9b0c1d20004',
    agent_id: 'agent_0xd1e2f3',
    device_id: 'dev_c8d9e0f1',
    timestamp: new Date(_now - 90 * 60_000).toISOString(),
    start_time: new Date(_now - 90 * 60_000).toISOString(),
    end_time: new Date(_now - 90 * 60_000 + 998).toISOString(),
    status: 'verified',
    signature: 'ed25519:c3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXox',
    hash: 'sha256:4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f',
    prev_hash: 'sha256:5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
    has_violation: false,
    signed: true,
    cpu_ms: 699, memory_mb: 192, tokens_used: 3280, tool_calls: 4, duration_ms: 998,
    violations: [],
    model: 'deepseek-chat',
  },
  {
    id: 'rcpt_00000006',
    execution_id: 'exec_f1a2b3c4d5e60005',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_a1b2c3d4',
    timestamp: new Date(_now - 108 * 60_000).toISOString(),
    start_time: new Date(_now - 108 * 60_000).toISOString(),
    end_time: new Date(_now - 108 * 60_000 + 3411).toISOString(),
    status: 'failed',
    signature: 'ed25519:INVALID_eXoxMjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXox',
    hash: 'sha256:5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e',
    prev_hash: 'sha256:6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d',
    has_violation: true,
    signed: true,
    cpu_ms: 2388, memory_mb: 512, tokens_used: 12400, tool_calls: 11, duration_ms: 3411,
    violations: [
      {
        timestamp: new Date(_now - 108 * 60_000 + 800).toISOString(),
        violation_type: 'capability_violation',
        policy_rule: 'allow_shell',
        action_taken: 'terminated',
      },
      {
        timestamp: new Date(_now - 108 * 60_000 + 1400).toISOString(),
        violation_type: 'rate_limit_exceeded',
        policy_rule: 'max_requests_per_minute',
        action_taken: 'throttled',
      },
    ],
    model: 'claude-sonnet-4-6',
  },
  {
    id: 'rcpt_00000007',
    execution_id: 'exec_a2b3c4d5e6f70006',
    agent_id: 'agent_0x4d5e6f',
    device_id: 'dev_f7e8d9c0',
    timestamp: new Date(_now - 126 * 60_000).toISOString(),
    start_time: new Date(_now - 126 * 60_000).toISOString(),
    end_time: new Date(_now - 126 * 60_000 + 722).toISOString(),
    status: 'verified',
    signature: 'ed25519:MjM0NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkw',
    hash: 'sha256:6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d',
    prev_hash: 'sha256:7f6e5d4c3b2a1908a7b6c5d4e3f2a1b0',
    has_violation: false,
    signed: true,
    cpu_ms: 505, memory_mb: 128, tokens_used: 1840, tool_calls: 2, duration_ms: 722,
    violations: [],
    model: 'gpt-4o-mini',
  },
  {
    id: 'rcpt_00000008',
    execution_id: 'exec_b3c4d5e6f7a80007',
    agent_id: 'agent_0x7a8b9c',
    device_id: 'dev_c8d9e0f1',
    timestamp: new Date(_now - 144 * 60_000).toISOString(),
    start_time: new Date(_now - 144 * 60_000).toISOString(),
    end_time: new Date(_now - 144 * 60_000 + 1560).toISOString(),
    status: 'verified',
    signature: 'ed25519:NTY3ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJj',
    hash: 'sha256:7f6e5d4c3b2a1908a7b6c5d4e3f2a1b0',
    prev_hash: 'sha256:8e7d6c5b4a3928170f1e2d3c4b5a6978',
    has_violation: false,
    signed: true,
    cpu_ms: 1092, memory_mb: 256, tokens_used: 5210, tool_calls: 6, duration_ms: 1560,
    violations: [],
    model: 'claude-haiku-4-5',
  },
  {
    id: 'rcpt_00000009',
    execution_id: 'exec_c4d5e6f7a8b90008',
    agent_id: 'agent_0xd1e2f3',
    device_id: 'dev_9f3a2c1b',
    timestamp: new Date(_now - 162 * 60_000).toISOString(),
    start_time: new Date(_now - 162 * 60_000).toISOString(),
    end_time: new Date(_now - 162 * 60_000 + 488).toISOString(),
    status: 'verified',
    signature: 'ed25519:ODkwYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVm',
    hash: 'sha256:8e7d6c5b4a3928170f1e2d3c4b5a6978',
    prev_hash: 'sha256:9d8c7b6a5e4f3d2c1b0a9f8e7d6c5b4a',
    has_violation: false,
    signed: true,
    cpu_ms: 342, memory_mb: 128, tokens_used: 980, tool_calls: 1, duration_ms: 488,
    violations: [],
    model: 'deepseek-chat',
  },
  {
    id: 'rcpt_00000010',
    execution_id: 'exec_d5e6f7a8b9c00009',
    agent_id: 'agent_0x1a2b3c',
    device_id: 'dev_a1b2c3d4',
    timestamp: new Date(_now - 180 * 60_000).toISOString(),
    start_time: new Date(_now - 180 * 60_000).toISOString(),
    end_time: new Date(_now - 180 * 60_000 + 1102).toISOString(),
    status: 'verified',
    signature: 'ed25519:WJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoxMjM0NTY3ODkwYWJjZGVmZ2hpam',
    hash: 'sha256:9d8c7b6a5e4f3d2c1b0a9f8e7d6c5b4a',
    prev_hash: '',
    has_violation: false,
    signed: true,
    cpu_ms: 771, memory_mb: 192, tokens_used: 3610, tool_calls: 3, duration_ms: 1102,
    violations: [],
    model: 'gpt-4o',
  },
];

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
  const [verifyResult, setVerifyResult] = useState<'ok' | 'failed' | null>(null);

  const { data: allReceipts = [], isLoading, refetch } = useQuery<Receipt[]>({
    queryKey: ['proof-receipts'],
    queryFn: async () => {
      try { return await api.get<Receipt[]>('/proof/receipts?limit=500&sort=timestamp:desc'); }
      catch { return MOCK_RECEIPTS; }
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const verifyMutation = useMutation({
    mutationFn: (payload: { execution_id: string; hash: string; signature: string }) =>
      api.post('/proof/receipts/verify', payload),
    onSuccess: () => setVerifyResult('ok'),
    onError: () => setVerifyResult('failed'),
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
      hash: r.hash,
      signature: r.signature,
    });
  };

  const STAT_CARDS = [
    {
      label: `Receipts (${timeRange})`,
      value: isLoading ? null : String(counts.total),
      icon: FileCheck,
      iconCls: 'text-gray-400',
    },
    {
      label: 'Verified',
      value: isLoading ? null : String(counts.verified),
      icon: ShieldCheck,
      iconCls: 'text-green-600',
    },
    {
      label: 'Violations Recorded',
      value: isLoading ? null : String(counts.violations),
      icon: AlertTriangle,
      iconCls: counts.violations > 0 ? 'text-orange-500' : 'text-gray-300',
    },
    {
      label: 'Last Receipt',
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
            <h1 className="text-base font-semibold text-gray-900">Execution Receipts</h1>
            <p className="text-xs text-gray-500 mt-0.5">Signed records of runtime execution.</p>
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
                  ? <Skeleton className="h-6 w-16" />
                  : <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                }
              </CardContent>
            </Card>
          ))}
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
        <Card className="border border-gray-200 shadow-none overflow-hidden">
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
        </Card>

        {/* ── Verification Panel ────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-gray-400" />
              Receipt Verification
            </CardTitle>
            {selected && (
              <div className="flex items-center gap-2">
                {verifyResult === 'ok' && (
                  <span className="text-xs text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Chain verified
                  </span>
                )}
                {verifyResult === 'failed' && (
                  <span className="text-xs text-red-600 flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Verification failed
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
                    : <><ShieldCheck className="h-3 w-3" /> Verify Chain</>
                  }
                </Button>
              </div>
            )}
          </CardHeader>
          <Separator />
          <CardContent className="px-4 py-4">
            {!selected ? (
              <p className="text-xs text-gray-400 text-center py-4">
                Select a receipt from the table to inspect its cryptographic proof.
              </p>
            ) : (
              <div className="space-y-4">
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
          </CardContent>
        </Card>
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
