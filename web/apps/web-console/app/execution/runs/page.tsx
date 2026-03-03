'use client';

import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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

  const { data: runs = [], isLoading, refetch } = useQuery<Execution[]>({
    queryKey: ['execution-runs'],
    queryFn: () => api.get('/v1/execution/runs?limit=500&sort=created_at:desc'),
    retry: false,
  });

  // Keyboard: Escape closes drawer
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

  const STAT_CARDS = [
    {
      label: 'Running',
      value: isLoading ? null : stats.running,
      icon: Activity,
      iconColor: 'text-blue-500',
      valueColor: 'text-blue-700',
    },
    {
      label: 'Completed (24h)',
      value: isLoading ? null : stats.completed24h,
      icon: CheckCircle2,
      iconColor: 'text-green-500',
      valueColor: 'text-gray-900',
    },
    {
      label: 'Violations (24h)',
      value: isLoading ? null : stats.violations24h,
      icon: AlertTriangle,
      iconColor: stats.violations24h > 0 ? 'text-orange-500' : 'text-gray-400',
      valueColor: stats.violations24h > 0 ? 'text-orange-700' : 'text-gray-900',
    },
    {
      label: 'Avg Duration',
      value: isLoading
        ? null
        : stats.avgDuration != null
        ? `${formatDurationMs(stats.avgDuration)} (${stats.avgDuration}ms)`
        : '—',
      icon: Timer,
      iconColor: 'text-gray-400',
      valueColor: 'text-gray-900',
      isString: true,
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Executions</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              All governed execution runs across fleet.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="execution_id · agent_id · device_id"
                className="pl-8 h-8 text-xs w-60"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-32 text-xs">
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
              <SelectTrigger className="h-8 w-20 text-xs">
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
        </div>

        {/* ── Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-1">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.iconColor}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-0">
                {isLoading ? (
                  <Skeleton className="h-5 w-12 mt-0.5" />
                ) : c.isString ? (
                  <span className={`text-sm font-semibold tabular-nums ${c.valueColor}`}>
                    {c.value}
                  </span>
                ) : (
                  <span className={`text-xl font-semibold tabular-nums ${c.valueColor}`}>
                    {c.value}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Table ───────────────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none overflow-hidden p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Execution ID
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Agent
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Device
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Model
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Started
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Duration
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Status
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Violation
                </TableHead>
                <TableHead className="text-xs font-medium text-gray-500 h-9 px-3 whitespace-nowrap">
                  Receipt
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-gray-100">
                    {Array.from({ length: 9 }).map((_, j) => (
                      <TableCell key={j} className="px-3 py-2.5">
                        <Skeleton className="h-3.5 w-16" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-gray-400 text-xs py-16">
                    No executions found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer hover:bg-gray-50 border-b border-gray-100"
                    onClick={() => setSelected(run)}
                  >
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-xs text-gray-700">
                          {truncateText(run.id, 16)}
                        </span>
                        <CopyButton value={run.id} />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-gray-700">
                          {truncateText(run.agent_id, 14)}
                        </span>
                        <CopyButton value={run.agent_id} />
                      </div>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-600 font-mono">
                        {run.device_id ? truncateText(run.device_id, 12) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-600">{run.model ?? '—'}</span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-500 tabular-nums">
                        {getRelativeTime(run.started_at)}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <span className="text-xs text-gray-500 font-mono tabular-nums">
                        {run.duration_ms != null ? formatDurationMs(run.duration_ms) : '—'}
                      </span>
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ExecutionStatusBadge status={run.status} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      <ViolationBadge hasViolation={run.has_violation} />
                    </TableCell>
                    <TableCell className="px-3 py-2.5">
                      {run.receipt_id || run.receipt_signature ? (
                        <button
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(run);
                          }}
                        >
                          <Eye className="h-3 w-3" />
                          View
                        </button>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
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
                    <code className="text-xs font-mono text-gray-500">{selected.id}</code>
                    <CopyButton value={selected.id} />
                  </div>
                </div>
                <SheetClose onClick={() => setSelected(null)} />
              </SheetHeader>

              <SheetBody>
                <div className="space-y-6 py-2">

                  {/* §1 Execution Metadata */}
                  <section>
                    <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" />
                      Execution Metadata
                    </h3>
                    <KeyValueGrid
                      rows={[
                        {
                          label: 'Execution ID',
                          value: selected.id,
                          mono: true,
                          copyable: selected.id,
                        },
                        {
                          label: 'Agent ID',
                          value: selected.agent_id,
                          mono: true,
                          copyable: selected.agent_id,
                        },
                        {
                          label: 'Device ID',
                          value: selected.device_id ?? '—',
                          mono: true,
                          copyable: selected.device_id,
                        },
                        { label: 'Model', value: selected.model ?? '—' },
                        {
                          label: 'Status',
                          value: <ExecutionStatusBadge status={selected.status} />,
                        },
                        {
                          label: 'Started',
                          value: selected.started_at
                            ? `${new Date(selected.started_at).toISOString()}`
                            : '—',
                          mono: true,
                        },
                        {
                          label: 'Ended',
                          value: selected.ended_at
                            ? `${new Date(selected.ended_at).toISOString()}`
                            : '—',
                          mono: true,
                        },
                        {
                          label: 'Duration',
                          value:
                            selected.duration_ms != null
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
                            value:
                              selected.policy_snapshot.cpu_limit_percent != null
                                ? `${selected.policy_snapshot.cpu_limit_percent}%`
                                : '—',
                          },
                          {
                            label: 'Memory Limit',
                            value:
                              selected.policy_snapshot.memory_limit_mb != null
                                ? `${selected.policy_snapshot.memory_limit_mb} MB`
                                : '—',
                          },
                          {
                            label: 'Max Tick',
                            value:
                              selected.policy_snapshot.max_tick_ms != null
                                ? `${selected.policy_snapshot.max_tick_ms}ms`
                                : '—',
                          },
                          {
                            label: 'Quota Limit',
                            value: selected.policy_snapshot.quota_limit as string ?? '—',
                          },
                        ]}
                      />
                    ) : (
                      <p className="text-xs text-gray-400">No policy snapshot available</p>
                    )}
                  </section>

                  <Separator />

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
                            value:
                              selected.capability_snapshot.allow_http != null
                                ? selected.capability_snapshot.allow_http
                                  ? 'Allowed'
                                  : 'Denied'
                                : '—',
                          },
                          {
                            label: 'Shell',
                            value:
                              selected.capability_snapshot.allow_shell != null
                                ? selected.capability_snapshot.allow_shell
                                  ? 'Allowed'
                                  : 'Denied'
                                : '—',
                          },
                          {
                            label: 'Filesystem',
                            value:
                              selected.capability_snapshot.allow_filesystem != null
                                ? selected.capability_snapshot.allow_filesystem
                                  ? 'Allowed'
                                  : 'Denied'
                                : '—',
                          },
                          {
                            label: 'Allowed Domains',
                            value: Array.isArray(selected.capability_snapshot.allowed_domains)
                              ? (selected.capability_snapshot.allowed_domains as string[]).join(', ') || '—'
                              : '—',
                          },
                          {
                            label: 'Max File Write',
                            value:
                              selected.capability_snapshot.max_file_write_bytes != null
                                ? `${selected.capability_snapshot.max_file_write_bytes} bytes`
                                : '—',
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
                        <p className="text-[11px] text-gray-500">No log entries</p>
                      ) : (
                        selected.logs.map((line, i) => (
                          <p
                            key={i}
                            className="text-[11px] text-gray-300 font-mono leading-relaxed"
                          >
                            {line}
                          </p>
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
