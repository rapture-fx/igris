'use client';

import { type ReactNode, useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ClientChart } from '@/components/ui/client-chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { RightSideDrawer, DrawerSection } from '@/components/proof/RightSideDrawer';
import { KeyValueGrid } from '@/components/proof/KeyValueGrid';
import { api } from '@/lib/apiClient';
import { API_BASE_URL } from '@/utils/constants';
import { toast } from '@/components/ui/use-toast';
import { getRelativeTime } from '@/utils/helpers';
import { useChartTheme } from '@/utils/chartTheme';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  type LucideIcon,
  ShieldAlert, AlertCircle, AlertTriangle, CheckCircle2, RefreshCw,
  Download, Radio, TrendingUp, ShieldOff, Check, ChevronUp,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type AlertSeverity = 'info' | 'warning' | 'critical';
type AlertStatus = 'open' | 'acknowledged' | 'resolved' | 'escalated';

interface PolicyAlert {
  id: string;
  timestamp: string;
  alert_type: string;
  severity: AlertSeverity;
  category: string;
  source: string;
  message: string;
  status: AlertStatus;
  agent_id?: string;
  policy_rule?: string;
  violation_details?: {
    bound_violated?: string;
    expected?: string | number;
    actual?: string | number;
    [key: string]: unknown;
  } | null;
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_by?: string;
  resolved_at?: string;
}

// ─── Badge helpers ─────────────────────────────────────────────────────────────

const SEV_STYLE: Record<AlertSeverity, string> = {
  info:     'bg-gray-50 text-gray-600 border-gray-200',
  warning:  'bg-yellow-50 text-yellow-700 border-yellow-200',
  critical: 'bg-red-50 text-red-700 border-red-200',
};

const STATUS_STYLE: Record<AlertStatus, string> = {
  open:         'bg-red-50 text-red-700 border-red-200',
  acknowledged: 'bg-orange-50 text-orange-700 border-orange-200',
  resolved:     'bg-green-50 text-green-700 border-green-200',
  escalated:    'bg-purple-50 text-purple-700 border-purple-200',
};

function SeverityBadge({ severity }: { severity: AlertSeverity }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${SEV_STYLE[severity] ?? SEV_STYLE.info}`}>
      {severity}
    </span>
  );
}

function StatusBadge({ status }: { status: AlertStatus }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium border rounded ${STATUS_STYLE[status] ?? STATUS_STYLE.open}`}>
      {status}
    </span>
  );
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
  bodyClassName = 'px-4 py-4', className = '', collapsed = false, children,
}: {
  icon: LucideIcon; title: string; description: string;
  actions?: ReactNode; bodyClassName?: string; className?: string;
  collapsed?: boolean; children: ReactNode;
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
      {!collapsed && (
        <div className={`bg-gray-50 border-t border-gray-200 rounded-t-3xl ${bodyClassName}`}>
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Export CSV ───────────────────────────────────────────────────────────────

function exportCSV(rows: PolicyAlert[]) {
  const headers = ['id', 'timestamp', 'agent_id', 'policy_rule', 'severity', 'bound_violated', 'expected', 'actual', 'status'];
  const lines = rows.map((r) => [
    r.id,
    r.timestamp,
    r.agent_id ?? '',
    r.policy_rule ?? '',
    r.severity,
    r.violation_details?.bound_violated ?? '',
    r.violation_details?.expected ?? '',
    r.violation_details?.actual ?? '',
    r.status,
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...lines].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `policy-violations-${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Page content ─────────────────────────────────────────────────────────────

function ViolationsContent() {
  const chartTheme = useChartTheme();
  const qc = useQueryClient();

  const [timeRange, setTimeRange] = useState('last_24h');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chartCollapsed, setChartCollapsed] = useState(false);

  // SSE live feed
  const [sseConnected, setSseConnected] = useState(false);
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let es: EventSource;
    try {
      es = new EventSource(`${API_BASE_URL}/v1/alerts/stream`, { withCredentials: true });
      es.onopen = () => setSseConnected(true);
      es.addEventListener('alert', (event) => {
        try {
          const a: PolicyAlert = JSON.parse(event.data);
          if (a.category !== 'policy') return;
          qc.setQueryData(['violations-policy', timeRange], (old: PolicyAlert[] | undefined) => {
            if (!old) return [a];
            if (old.some((x) => x.id === a.id)) return old;
            return [a, ...old];
          });
        } catch { /* ignore */ }
      });
      es.onerror = () => { setSseConnected(false); es.close(); };
      sseRef.current = es;
    } catch { /* EventSource unavailable */ }
    return () => { sseRef.current?.close(); setSseConnected(false); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange]);

  // Local optimistic status
  const [localStatus, setLocalStatus] = useState<Record<string, AlertStatus>>({});

  const { data: rawAlerts, isLoading, refetch } = useQuery<PolicyAlert[]>({
    queryKey: ['violations-policy', timeRange],
    queryFn: async () => {
      try {
        const all = await api.get<PolicyAlert[]>(`/v1/history/alerts?range=${timeRange}&limit=500`);
        return all.filter((a) => a.category === 'policy');
      } catch {
        return [] as PolicyAlert[];
      }
    },
    refetchInterval: 15_000,
    retry: false,
    staleTime: 5_000,
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/history/alerts/${id}/acknowledge`, {}),
    onMutate: (id) => setLocalStatus((s) => ({ ...s, [id]: 'acknowledged' })),
    onError: (_e, id) => setLocalStatus((s) => { const n = { ...s }; delete n[id]; return n; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations-policy'] }),
  });

  const resolveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/history/alerts/${id}/resolve`, {}),
    onMutate: (id) => setLocalStatus((s) => ({ ...s, [id]: 'resolved' })),
    onError: (_e, id) => setLocalStatus((s) => { const n = { ...s }; delete n[id]; return n; }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['violations-policy'] }),
  });

  const escalateMutation = useMutation({
    mutationFn: (id: string) => api.post(`/v1/history/alerts/${id}/escalate`, {}),
    onMutate: (id) => setLocalStatus((s) => ({ ...s, [id]: 'escalated' })),
    onError: (_e, id) => {
      setLocalStatus((s) => { const n = { ...s }; delete n[id]; return n; });
      toast({ title: 'Escalation failed', variant: 'destructive' });
    },
    onSuccess: () => {
      toast({ title: 'Violation escalated' });
      qc.invalidateQueries({ queryKey: ['violations-policy'] });
    },
  });

  const alerts = useMemo(() =>
    (rawAlerts ?? []).map((a) => localStatus[a.id] ? { ...a, status: localStatus[a.id] } : a),
    [rawAlerts, localStatus],
  );

  const filtered = useMemo(() => alerts.filter((a) => {
    return severityFilter === 'all' || a.severity === severityFilter;
  }), [alerts, severityFilter]);

  const selected = useMemo(() => alerts.find((a) => a.id === selectedId) ?? null, [alerts, selectedId]);

  // Summary counts
  const totalCount    = alerts.length;
  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const ackCount      = alerts.filter((a) => a.status === 'acknowledged').length;
  const escalatedCount = alerts.filter((a) => a.status === 'escalated').length;

  // Hourly chart data — 24 bars
  const chartData = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({ hour: `${h}:00`, count: 0 }));
    alerts.forEach((a) => {
      const h = new Date(a.timestamp).getHours();
      if (h >= 0 && h < 24) buckets[h].count += 1;
    });
    return buckets;
  }, [alerts]);

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Policy Violations</h1>
            <p className="text-xs text-black mt-0.5">Dedicated policy envelope violations dashboard.</p>
          </div>
          <div className="flex items-center gap-2">
            {sseConnected ? (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md">
                <Radio className="h-3 w-3 animate-pulse" />
                Live
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[11px] text-gray-400 bg-gray-50 border border-gray-200 px-2 py-1 rounded-md">
                <Radio className="h-3 w-3" />
                Polling
              </span>
            )}
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={() => exportCSV(filtered)}
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard icon={ShieldAlert}  label="Total Violations" value={totalCount}     sub="In the last 24h"           loading={isLoading} />
          <OverviewCard icon={AlertCircle}  label="Critical"         value={criticalCount}  sub="High-severity violations"  loading={isLoading} />
          <OverviewCard icon={CheckCircle2} label="Acknowledged"     value={ackCount}       sub="Reviewed violations"       loading={isLoading} />
          <OverviewCard icon={TrendingUp}   label="Escalated"        value={escalatedCount} sub="Passed to next tier"       loading={isLoading} />
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="h-8 w-36 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="last_1h"  className="text-xs">Last 1 hour</SelectItem>
              <SelectItem value="last_6h"  className="text-xs">Last 6 hours</SelectItem>
              <SelectItem value="last_24h" className="text-xs">Last 24 hours</SelectItem>
            </SelectContent>
          </Select>
          <Select value={severityFilter} onValueChange={setSeverityFilter}>
            <SelectTrigger className="h-8 w-32 text-xs bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all"      className="text-xs">All severities</SelectItem>
              <SelectItem value="info"     className="text-xs">Info</SelectItem>
              <SelectItem value="warning"  className="text-xs">Warning</SelectItem>
              <SelectItem value="critical" className="text-xs">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Violations table */}
        <SurfaceSection
          icon={ShieldOff}
          title="Violations"
          description="Policy envelope violations with acknowledgement and escalation controls."
          bodyClassName="px-0 py-0"
          actions={
            !isLoading ? (
              <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                {filtered.length} of {alerts.length}
              </span>
            ) : undefined
          }
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mx-4 mb-4">
            <div
              className="overflow-y-auto"
              style={{ maxHeight: 400, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              <Table className="w-full">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[120px] text-xs font-medium text-gray-500 py-2 px-4">Timestamp</TableHead>
                    <TableHead className="w-[120px] text-xs font-medium text-gray-500 py-2 px-3">Agent</TableHead>
                    <TableHead className="w-[140px] text-xs font-medium text-gray-500 py-2 px-3">Policy Rule</TableHead>
                    <TableHead className="w-[80px]  text-xs font-medium text-gray-500 py-2 px-3">Severity</TableHead>
                    <TableHead className="w-[120px] text-xs font-medium text-gray-500 py-2 px-3">Bound Violated</TableHead>
                    <TableHead className="w-[90px]  text-xs font-medium text-gray-500 py-2 px-3">Expected</TableHead>
                    <TableHead className="w-[90px]  text-xs font-medium text-gray-500 py-2 px-3">Actual</TableHead>
                    <TableHead className="w-[90px]  text-xs font-medium text-gray-500 py-2 px-3">Status</TableHead>
                    <TableHead className="           text-xs font-medium text-gray-500 py-2 px-3">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          {Array.from({ length: 9 }).map((_, j) => (
                            <TableCell key={j} className="py-2.5 px-3"><Skeleton className="h-3.5 w-full" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    : filtered.length === 0
                      ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-xs text-gray-400 py-14">
                            No policy violations found for the selected filters.
                          </TableCell>
                        </TableRow>
                      )
                      : filtered.map((alert) => (
                          <TableRow
                            key={alert.id}
                            className={`border-b border-gray-100 hover:bg-gray-50/60 cursor-pointer ${selectedId === alert.id ? 'bg-blue-50/40' : ''}`}
                            onClick={() => setSelectedId(alert.id === selectedId ? null : alert.id)}
                          >
                            <TableCell className="py-2.5 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                              {getRelativeTime(alert.timestamp)}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-600 font-mono truncate">
                              {alert.agent_id ?? <span className="text-gray-300">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-600 font-mono truncate">
                              {alert.policy_rule ?? <span className="text-gray-300">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <SeverityBadge severity={alert.severity} />
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-600 font-mono truncate">
                              {alert.violation_details?.bound_violated ?? <span className="text-gray-300">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-600 tabular-nums">
                              {alert.violation_details?.expected !== undefined
                                ? String(alert.violation_details.expected)
                                : <span className="text-gray-300">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 px-3 text-xs text-gray-600 tabular-nums">
                              {alert.violation_details?.actual !== undefined
                                ? String(alert.violation_details.actual)
                                : <span className="text-gray-300">—</span>}
                            </TableCell>
                            <TableCell className="py-2.5 px-3">
                              <StatusBadge status={alert.status} />
                            </TableCell>
                            <TableCell className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                {alert.status === 'open' && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[10px] px-2 font-medium"
                                    onClick={() => acknowledgeMutation.mutate(alert.id)}
                                    disabled={acknowledgeMutation.isPending}
                                  >
                                    Ack
                                  </Button>
                                )}
                                {alert.status !== 'escalated' && alert.status !== 'resolved' && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[10px] px-2 font-medium text-purple-700 border-purple-200 hover:bg-purple-50"
                                    onClick={() => escalateMutation.mutate(alert.id)}
                                    disabled={escalateMutation.isPending}
                                  >
                                    Escalate
                                  </Button>
                                )}
                                {alert.status !== 'resolved' && (
                                  <Button
                                    variant="outline" size="sm"
                                    className="h-6 text-[10px] px-2 font-medium text-green-700 border-green-200 hover:bg-green-50"
                                    onClick={() => resolveMutation.mutate(alert.id)}
                                    disabled={resolveMutation.isPending}
                                  >
                                    <Check className="h-2.5 w-2.5 mr-0.5" />
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        {/* Analytics: violations by hour */}
        <SurfaceSection
          icon={TrendingUp}
          title="Violations by Hour"
          description="24-hour distribution of policy violations."
          collapsed={chartCollapsed}
          actions={
            <button
              onClick={() => setChartCollapsed((v) => !v)}
              className="text-gray-400 hover:text-gray-700 transition-colors"
            >
              <ChevronUp className={`h-4 w-4 transition-transform ${chartCollapsed ? 'rotate-180' : ''}`} />
            </button>
          }
        >
          {isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <ClientChart height={160} fallbackClassName="h-40 w-full">
              <BarChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartTheme.grid} />
                <XAxis
                  dataKey="hour"
                  tick={{ fontSize: 9, fill: chartTheme.axis }}
                  tickLine={false}
                  axisLine={false}
                  interval={3}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: chartTheme.axis }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ fontSize: 11, padding: '4px 8px', border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 6, backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text }}
                  itemStyle={{ color: chartTheme.tooltip.text }}
                  labelStyle={{ color: chartTheme.tooltip.text }}
                  cursor={{ fill: chartTheme.tooltip.bg }}
                />
                <Bar dataKey="count" fill="#ef4444" radius={[2, 2, 0, 0]} maxBarSize={20} />
              </BarChart>
            </ClientChart>
          )}
        </SurfaceSection>

      </div>

      {/* Detail drawer */}
      <RightSideDrawer
        open={!!selected}
        onClose={() => setSelectedId(null)}
        title={
          <>
            <ShieldAlert className="h-4 w-4 text-orange-400" />
            <span className="font-mono text-sm">{selected?.alert_type ?? 'Policy Violation'}</span>
            {selected && <SeverityBadge severity={selected.severity} />}
          </>
        }
        subtitle={selected?.id}
      >
        {selected && (
          <>
            <DrawerSection title="Alert Metadata">
              <KeyValueGrid items={[
                { label: 'Alert ID',   value: selected.id,        copyable: true, copyValue: selected.id },
                { label: 'Timestamp', value: new Date(selected.timestamp).toISOString().replace('T', ' ').slice(0, 19) },
                { label: 'Severity',  value: <SeverityBadge severity={selected.severity} /> },
                { label: 'Status',    value: <StatusBadge status={selected.status} /> },
                { label: 'Source',    value: selected.source },
              ]} />
            </DrawerSection>

            <DrawerSection title="Policy Context">
              <KeyValueGrid items={[
                { label: 'Policy Rule',     value: selected.policy_rule     ?? '—' },
                { label: 'Bound Violated',  value: selected.violation_details?.bound_violated ?? '—' },
                { label: 'Expected Value',  value: selected.violation_details?.expected !== undefined ? String(selected.violation_details.expected) : '—' },
                { label: 'Actual Value',    value: selected.violation_details?.actual   !== undefined ? String(selected.violation_details.actual)   : '—' },
                { label: 'Agent ID',        value: selected.agent_id ?? '—', copyable: !!selected.agent_id, copyValue: selected.agent_id },
              ]} />
            </DrawerSection>

            <DrawerSection title="Actions">
              <div className="flex items-center gap-2 flex-wrap">
                {selected.status === 'open' && (
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs gap-1.5"
                    onClick={() => { acknowledgeMutation.mutate(selected.id); setSelectedId(null); }}
                    disabled={acknowledgeMutation.isPending}
                  >
                    <AlertTriangle className="h-3 w-3" />
                    Acknowledge
                  </Button>
                )}
                {selected.status !== 'escalated' && selected.status !== 'resolved' && (
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs gap-1.5 text-purple-700 border-purple-200 hover:bg-purple-50"
                    onClick={() => { escalateMutation.mutate(selected.id); setSelectedId(null); }}
                    disabled={escalateMutation.isPending}
                  >
                    <TrendingUp className="h-3 w-3" />
                    Escalate
                  </Button>
                )}
                {selected.status !== 'resolved' && (
                  <Button
                    variant="outline" size="sm"
                    className="h-7 text-xs gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
                    onClick={() => { resolveMutation.mutate(selected.id); setSelectedId(null); }}
                    disabled={resolveMutation.isPending}
                  >
                    <Check className="h-3 w-3" />
                    Resolve
                  </Button>
                )}
              </div>
              {selected.acknowledged_at && (
                <p className="text-[10px] text-gray-400 mt-2">
                  Acknowledged by <span className="font-mono">{selected.acknowledged_by}</span> at {new Date(selected.acknowledged_at).toISOString().replace('T', ' ').slice(0, 19)}
                </p>
              )}
              {selected.resolved_at && (
                <p className="text-[10px] text-gray-400 mt-1">
                  Resolved by <span className="font-mono">{selected.resolved_by}</span> at {new Date(selected.resolved_at).toISOString().replace('T', ' ').slice(0, 19)}
                </p>
              )}
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
