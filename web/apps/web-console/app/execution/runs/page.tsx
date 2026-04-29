'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/use-toast';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
  SheetBody,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { api } from '@/lib/apiClient';
import { getRelativeTime, truncateText } from '@/utils/helpers';
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  Timer,
  Search,
  RefreshCw,
  FileText,
  Shield,
  Cpu,
  Terminal,
  Hash,
  Eye,
  Pause,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import {
  ExecutionStatusBadge,
  ViolationBadge,
  KeyValueGrid,
  JSONViewer,
  ReceiptVerificationPanel,
  CopyButton,
} from '@/components/execution/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Execution {
  id: string;
  agent_id: string;
  model: string;
  device_id: string;
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  status: string;
  has_violation: boolean;
  receipt_id?: string;
  receipt_signature?: string;
  receipt_hash?: string;
  receipt_previous_hash?: string;
  policy_snapshot?: Record<string, unknown>;
  capability_snapshot?: Record<string, unknown>;
  logs?: string[];
  llm_proposal?: string;
  enforced_output?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(2)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.floor(s % 60);
  return `${m}m ${rem}s`;
}

function isWithin24h(dateStr: string): boolean {
  return new Date(dateStr) > new Date(Date.now() - 24 * 60 * 60 * 1000);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = ['all', 'RUNNING', 'COMPLETED', 'ERROR', 'VIOLATION'];

const TIME_OPTIONS = [
  { label: '24h', value: '24h' },
  { label: '7d', value: '7d' },
  { label: '30d', value: '30d' },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExecutionRunsPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [timeRange, setTimeRange] = useState('24h');
  const [selected, setSelected] = useState<Execution | null>(null);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: runs = [], isLoading, refetch } = useQuery<Execution[]>({
    queryKey: ['execution-runs', page, statusFilter, timeRange],
    queryFn: async () => {
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(page * PAGE_SIZE),
          sort: 'created_at:desc',
          range: timeRange,
        });
        if (statusFilter !== 'all') params.set('status', statusFilter);
        return await api.get(`/v1/execution/runs?${params}`);
      } catch {
        return [] as Execution[];
      }
    },
    retry: false,
  });

  const pauseMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/execution/runs/${id}/pause`, {}),
    onSuccess: (_, id) => {
      qc.setQueryData<Execution[]>(['execution-runs', page, statusFilter, timeRange], (old) =>
        old?.map((r) => r.id === id ? { ...r, status: 'PAUSED' } : r) ?? []
      );
      setSelected((s) => s?.id === id ? { ...s, status: 'PAUSED' } : s);
      toast({ title: 'Execution paused' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to pause execution' }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/execution/runs/${id}/cancel`, {}),
    onSuccess: (_, id) => {
      qc.setQueryData<Execution[]>(['execution-runs', page, statusFilter, timeRange], (old) =>
        old?.map((r) => r.id === id ? { ...r, status: 'CANCELLED' } : r) ?? []
      );
      setSelected((s) => s?.id === id ? { ...s, status: 'CANCELLED' } : s);
      toast({ title: 'Execution cancelled' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to cancel execution' }),
  });

  const replayMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/execution/runs/${id}/replay`, {}),
    onSuccess: () => {
      refetch();
      toast({ title: 'Execution replayed', description: 'New run started' });
    },
    onError: () => toast({ variant: 'destructive', title: 'Failed to replay execution' }),
  });

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return runs.filter((r) => {
      const matchSearch =
        !q ||
        r.id.toLowerCase().includes(q) ||
        r.agent_id?.toLowerCase().includes(q) ||
        r.device_id?.toLowerCase().includes(q);
      const matchStatus =
        statusFilter === 'all' ||
        r.status === statusFilter ||
        (statusFilter === 'VIOLATION' && r.has_violation);
      return matchSearch && matchStatus;
    });
  }, [runs, search, statusFilter]);

  const stats = useMemo(() => {
    const recent = runs.filter((r) => isWithin24h(r.started_at));
    const running = runs.filter((r) => r.status === 'RUNNING').length;
    const completed24h = recent.filter((r) => r.status === 'COMPLETED').length;
    const violations24h = recent.filter((r) => r.has_violation).length;
    const durations = recent
      .filter((r) => r.duration_ms != null && r.status === 'COMPLETED')
      .map((r) => r.duration_ms!);
    const avgDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : null;
    return { running, completed24h, violations24h, avgDuration };
  }, [runs]);

  return (
    <DashboardLayout>
      <div className="space-y-6">

        {/* ── Page Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Executions</h1>
            <p className="text-xs text-black mt-0.5">All governed execution runs across fleet.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => refetch()}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {/* ── Stat Cards ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

          {/* Running */}
          <div className="border border-gray-200 shadow hover:border-gray-300 transition-colors rounded-3xl overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-gray-400" />
              Running
            </div>
            <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-5 pb-6">
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-4xl font-bold text-blue-700 tabular-nums">
                  {stats.running}
                </div>
              )}
              <p className="text-xs text-black mt-1 text-right">active now</p>
            </div>
          </div>

          {/* Completed 24h */}
          <div className="border border-gray-200 shadow hover:border-gray-300 transition-colors rounded-3xl overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-gray-400" />
              Completed
            </div>
            <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-5 pb-6">
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className="text-4xl font-bold text-gray-900 tabular-nums">
                  {stats.completed24h}
                </div>
              )}
              <p className="text-xs text-black mt-1 text-right">last 24 hours</p>
            </div>
          </div>

          {/* Violations 24h */}
          <div className="border border-gray-200 shadow hover:border-gray-300 transition-colors rounded-3xl overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-gray-400" />
              Violations
            </div>
            <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-5 pb-6">
              {isLoading ? (
                <Skeleton className="h-9 w-16" />
              ) : (
                <div className={`text-4xl font-bold tabular-nums ${stats.violations24h > 0 ? 'text-orange-600' : 'text-gray-900'}`}>
                  {stats.violations24h}
                </div>
              )}
              <p className="text-xs text-black mt-1 text-right">last 24 hours</p>
            </div>
          </div>

          {/* Avg Duration */}
          <div className="border border-gray-200 shadow hover:border-gray-300 transition-colors rounded-3xl overflow-hidden bg-white">
            <div className="px-4 pt-4 pb-2 text-xs font-medium text-black flex items-center gap-1.5">
              <Timer className="h-3.5 w-3.5 text-gray-400" />
              Avg Duration
            </div>
            <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl px-4 pt-5 pb-6">
              {isLoading ? (
                <Skeleton className="h-9 w-20" />
              ) : (
                <div className="text-2xl font-bold text-gray-900 tabular-nums leading-tight">
                  {stats.avgDuration != null ? formatDurationMs(stats.avgDuration) : '—'}
                </div>
              )}
              <p className="text-xs text-black mt-1 text-right">completed runs</p>
            </div>
          </div>

        </div>

        {/* ── Runs Table Card ─────────────────────────────────────────────── */}
        <div className="border border-gray-200 shadow rounded-3xl overflow-hidden bg-white">

          {/* Card header with filters */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-medium text-black">Execution Runs</span>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="id · agent · device"
                  className="pl-8 h-7 text-xs w-52"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-7 w-32 text-xs">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s === 'all' ? 'All statuses' : s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_OPTIONS.map((t) => (
                    <SelectItem key={t.value} value={t.value} className="text-xs">
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Nested inner table area */}
          <div className="bg-gray-50 border-t border-gray-200 rounded-t-3xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Execution ID</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Agent</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Device</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Model</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Started</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Duration</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Status</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Violation</th>
                    <th className="px-4 py-2.5 text-left font-medium text-black whitespace-nowrap">Receipt</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="border-b border-gray-100">
                        {Array.from({ length: 9 }).map((_, j) => (
                          <td key={j} className="px-4 py-2.5">
                            <Skeleton className="h-3.5 w-16" />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-16 text-center text-black">
                        No executions found
                      </td>
                    </tr>
                  ) : (
                    filtered.map((run) => (
                      <tr
                        key={run.id}
                        className="border-b border-gray-100 hover:bg-gray-100/50 transition-colors cursor-pointer"
                        onClick={() => setSelected(run)}
                      >
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700">{truncateText(run.id, 16)}</span>
                            <CopyButton value={run.id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1">
                            <span className="text-gray-700">{truncateText(run.agent_id, 14)}</span>
                            <CopyButton value={run.agent_id} />
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">
                          {run.device_id ? truncateText(run.device_id, 12) : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-gray-600">{run.model ?? '—'}</td>
                        <td className="px-4 py-2.5 text-gray-500 tabular-nums">
                          {getRelativeTime(run.started_at)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500 tabular-nums">
                          {run.duration_ms != null ? formatDurationMs(run.duration_ms) : '—'}
                        </td>
                        <td className="px-4 py-2.5">
                          <ExecutionStatusBadge status={run.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <ViolationBadge hasViolation={run.has_violation} />
                        </td>
                        <td className="px-4 py-2.5">
                          {run.receipt_id || run.receipt_signature ? (
                            <button
                              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
                              onClick={(e) => { e.stopPropagation(); setSelected(run); }}
                            >
                              <Eye className="h-3 w-3" />
                              View
                            </button>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
              <span className="text-xs text-black">
                Page {page + 1} · {filtered.length} results
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  disabled={page === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}>
                  Previous
                </Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  disabled={filtered.length < PAGE_SIZE}
                  onClick={() => setPage((p) => p + 1)}>
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Execution Detail Drawer ─────────────────────────────────────────── */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent>
          {selected && (
            <>
              <SheetHeader>
                <div>
                  <SheetTitle>Execution Detail</SheetTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    <code className="text-xs text-gray-500">{selected.id}</code>
                    <CopyButton value={selected.id} />
                  </div>
                </div>
                <SheetClose onClick={() => setSelected(null)} />
              </SheetHeader>

              <SheetBody>
                <div className="space-y-6 py-2">

                  {/* §0 Run Controls */}
                  {(selected.status === 'RUNNING' || selected.status === 'PAUSED' ||
                    selected.status === 'COMPLETED' || selected.status === 'ERROR' ||
                    selected.status === 'VIOLATION' || selected.status === 'CANCELLED') && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Activity className="h-3.5 w-3.5" />
                        Run Controls
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        {selected.status === 'RUNNING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5"
                              disabled={pauseMutation.isPending}
                              onClick={() => pauseMutation.mutate(selected.id)}
                            >
                              <Pause className="h-3 w-3" />
                              Pause
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                              disabled={cancelMutation.isPending}
                              onClick={() => cancelMutation.mutate(selected.id)}
                            >
                              <XCircle className="h-3 w-3" />
                              Cancel
                            </Button>
                          </>
                        )}
                        {(selected.status === 'COMPLETED' || selected.status === 'ERROR' ||
                          selected.status === 'VIOLATION' || selected.status === 'CANCELLED') && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1.5"
                            disabled={replayMutation.isPending}
                            onClick={() => replayMutation.mutate(selected.id)}
                          >
                            <RotateCcw className="h-3 w-3" />
                            Replay
                          </Button>
                        )}
                      </div>
                    </section>
                  )}

                  <Separator />

                  {/* §1 Execution Metadata */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Execution Metadata
                    </h3>
                    <KeyValueGrid
                      rows={[
                        { label: 'Execution ID', value: selected.id, mono: true, copyable: selected.id },
                        { label: 'Agent ID', value: selected.agent_id, mono: true, copyable: selected.agent_id },
                        { label: 'Device ID', value: selected.device_id ?? '—', mono: true, copyable: selected.device_id },
                        { label: 'Model', value: selected.model ?? '—' },
                        { label: 'Status', value: <ExecutionStatusBadge status={selected.status} /> },
                        {
                          label: 'Started',
                          value: selected.started_at ? new Date(selected.started_at).toISOString() : '—',
                          mono: true,
                        },
                        {
                          label: 'Ended',
                          value: selected.ended_at ? new Date(selected.ended_at).toISOString() : '—',
                          mono: true,
                        },
                        {
                          label: 'Duration',
                          value: selected.duration_ms != null
                            ? `${formatDurationMs(selected.duration_ms)} (${selected.duration_ms}ms)`
                            : '—',
                          mono: true,
                        },
                      ]}
                    />
                  </section>

                  <Separator />

                  {/* §2 Policy Snapshot */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      Policy Snapshot
                    </h3>
                    {selected.policy_snapshot ? (
                      <KeyValueGrid
                        rows={[
                          {
                            label: 'CPU Limit',
                            value: selected.policy_snapshot.cpu_limit_percent != null
                              ? `${selected.policy_snapshot.cpu_limit_percent}%` : '—',
                          },
                          {
                            label: 'Memory Limit',
                            value: selected.policy_snapshot.memory_limit_mb != null
                              ? `${selected.policy_snapshot.memory_limit_mb} MB` : '—',
                          },
                          {
                            label: 'Max Tick',
                            value: selected.policy_snapshot.max_tick_ms != null
                              ? `${selected.policy_snapshot.max_tick_ms}ms` : '—',
                          },
                          { label: 'Quota Limit', value: selected.policy_snapshot.quota_limit as string ?? '—' },
                        ]}
                      />
                    ) : (
                      <p className="text-xs text-gray-400">No policy snapshot available</p>
                    )}
                  </section>

                  <Separator />

                  {/* §2.5 LLM Proposal vs Runtime Enforced */}
                  {(selected.llm_proposal || selected.enforced_output) && (
                    <section>
                      <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <Eye className="h-3.5 w-3.5" />
                        LLM Proposal vs Runtime Enforced
                      </h3>

                      {selected.has_violation && (
                        <div className="flex items-start gap-2 mb-3 px-3 py-2.5 rounded-md bg-red-50 border border-red-300">
                          <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-red-700">Governance Override</p>
                            <p className="text-[11px] text-red-600 leading-relaxed mt-0.5">
                              The runtime enforcer rejected or modified the LLM&apos;s proposed output because it violated active policy bounds.
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className="h-2 w-2 rounded-full bg-blue-400 flex-shrink-0" />
                            <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wider">LLM Proposed</p>
                          </div>
                          <div className="bg-blue-50 border border-blue-200 rounded p-2 min-h-[60px] max-h-40 overflow-auto">
                            {selected.llm_proposal ? (
                              <pre className="text-[11px] text-blue-900 whitespace-pre-wrap break-words leading-relaxed">
                                {selected.llm_proposal}
                              </pre>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`h-2 w-2 rounded-full flex-shrink-0 ${selected.has_violation ? 'bg-red-500' : 'bg-green-500'}`} />
                            <p className={`text-[10px] font-semibold uppercase tracking-wider ${selected.has_violation ? 'text-red-700' : 'text-green-700'}`}>
                              Runtime {selected.has_violation ? '— VIOLATION' : '— PASSED'}
                            </p>
                          </div>
                          <div className={`border rounded p-2 min-h-[60px] max-h-40 overflow-auto ${selected.has_violation ? 'bg-red-50 border-red-300' : 'bg-green-50 border-green-200'}`}>
                            {selected.enforced_output ? (
                              <pre className={`text-[11px] whitespace-pre-wrap break-words leading-relaxed ${selected.has_violation ? 'text-red-900' : 'text-green-900'}`}>
                                {selected.enforced_output}
                              </pre>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}

                  {(selected.llm_proposal || selected.enforced_output) && <Separator />}

                  {/* §3 Capability Snapshot */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5" />
                      Capability Snapshot
                    </h3>
                    {selected.capability_snapshot ? (
                      <KeyValueGrid
                        rows={[
                          {
                            label: 'HTTP',
                            value: selected.capability_snapshot.allow_http != null
                              ? (selected.capability_snapshot.allow_http ? 'Allowed' : 'Denied') : '—',
                          },
                          {
                            label: 'Shell',
                            value: selected.capability_snapshot.allow_shell != null
                              ? (selected.capability_snapshot.allow_shell ? 'Allowed' : 'Denied') : '—',
                          },
                          {
                            label: 'Filesystem',
                            value: selected.capability_snapshot.allow_filesystem != null
                              ? (selected.capability_snapshot.allow_filesystem ? 'Allowed' : 'Denied') : '—',
                          },
                          {
                            label: 'Allowed Domains',
                            value: Array.isArray(selected.capability_snapshot.allowed_domains)
                              ? (selected.capability_snapshot.allowed_domains as string[]).join(', ') || '—' : '—',
                          },
                          {
                            label: 'Max File Write',
                            value: selected.capability_snapshot.max_file_write_bytes != null
                              ? `${selected.capability_snapshot.max_file_write_bytes} bytes` : '—',
                          },
                        ]}
                      />
                    ) : (
                      <p className="text-xs text-gray-400">No capability snapshot available</p>
                    )}
                  </section>

                  <Separator />

                  {/* §4 Execution Logs */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Terminal className="h-3.5 w-3.5" />
                      Execution Logs
                    </h3>
                    <div className="bg-gray-950 rounded-md p-3 max-h-56 overflow-auto">
                      {!selected.logs || selected.logs.length === 0 ? (
                        <p className="text-xs text-gray-500">No log entries</p>
                      ) : (
                        selected.logs.map((line, i) => (
                          <p key={i} className="text-xs text-gray-300 leading-normal">{line}</p>
                        ))
                      )}
                    </div>
                  </section>

                  <Separator />

                  {/* §5 Receipt Verification */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" />
                      Receipt Verification
                    </h3>
                    <ReceiptVerificationPanel
                      signature={selected.receipt_signature}
                      hash={selected.receipt_hash}
                      previousHash={selected.receipt_previous_hash}
                      receiptData={
                        selected.receipt_signature || selected.receipt_hash
                          ? {
                              execution_id: selected.id,
                              signature: selected.receipt_signature,
                              hash: selected.receipt_hash,
                              previous_hash: selected.receipt_previous_hash,
                            }
                          : undefined
                      }
                    />
                  </section>

                  <Separator />

                  {/* §6 Raw JSON */}
                  <section>
                    <JSONViewer data={selected} />
                  </section>

                </div>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
  );
}
