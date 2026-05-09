'use client';

import { type ReactNode, useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { ClientChart } from '@/components/ui/client-chart';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { useChartTheme } from '@/utils/chartTheme';
import { type LucideIcon, RefreshCw, Activity, Zap, CheckCircle2, ShieldAlert, Users, Cpu } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TimeSeriesPoint {
  time: string;
  [key: string]: number | string;
}

interface MetricEvent {
  id: string;
  timestamp: string;
  metric_name: string;
  metric_value: number;
  unit: string;
  agent_id: string;
  device_id: string;
  provider: string;
}

interface MetricsData {
  summary: {
    executions_per_minute: number;
    avg_latency_ms: number;
    success_rate_percent: number;
    policy_violations: number;
  };
  throughput: TimeSeriesPoint[];
  provider_latency: TimeSeriesPoint[];
  resource_usage: TimeSeriesPoint[];
  fleet_activity: TimeSeriesPoint[];
  events: MetricEvent[];
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIME_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

const AGENTS = ['All Agents'];
const DEVICES = ['All Devices'];
const PROVIDERS = ['All Providers'];

const PROVIDER_COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444', '#06b6d4'];

// ─── Sub-components ───────────────────────────────────────────────────────────

function OverviewCard({
  icon: Icon, label, value, loading,
}: {
  icon: LucideIcon; label: string; value: ReactNode; loading?: boolean;
}) {
  return (
    <div className="border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white">
      <div className="px-4 pt-4 pb-2 text-xs font-medium text-foreground flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
        {label}
      </div>
      <div className="bg-white border-t border-black/[0.08] dark:border-white/[0.08] px-4 pt-4 pb-5">
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <div className="text-3xl font-bold text-foreground tabular-nums">{value}</div>
        )}
      </div>
    </div>
  );
}

function SurfaceSection({
  icon: Icon, title, actions,
  bodyClassName = 'px-4 py-4', className = '', children,
}: {
  icon: LucideIcon; title: string;
  actions?: ReactNode; bodyClassName?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`border-[0.5px] border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden bg-white ${className}`}>
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-4">
        <div className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-xs font-medium text-foreground">{title}</p>
        </div>
        {actions}
      </div>
      <div className={`bg-white border-t border-black/[0.08] dark:border-white/[0.08] ${bodyClassName}`}>
        {children}
      </div>
    </div>
  );
}

function MetricNameBadge({ name }: { name: string }) {
  const colors: Record<string, string> = {
    latency_ms: 'bg-blue-50 text-blue-700',
    tokens_used: 'bg-purple-50 text-purple-700',
    cpu_percent: 'bg-orange-50 text-orange-700',
    memory_mb: 'bg-cyan-50 text-cyan-700',
    policy_score: 'bg-green-50 text-green-700',
    throughput_rps: 'bg-emerald-50 text-emerald-700',
  };
  const cls = colors[name] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${cls}`}>
      {name}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryMetricsPage() {
  const chartTheme = useChartTheme();
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [agent, setAgent] = useState('All Agents');
  const [device, setDevice] = useState('All Devices');
  const [provider, setProvider] = useState('All Providers');

  // Fetch filter options from API
  const { data: filterOptions } = useQuery<{
    agents: string[];
    devices: string[];
    providers: string[];
  }>({
    queryKey: ['metrics-filter-options'],
    queryFn: async () => {
      try {
        return await api.get('/v1/history/metrics/filters');
      } catch {
        return { agents: [], devices: [], providers: [] };
      }
    },
    staleTime: 60_000,
    retry: false,
  });

  const agents = ['All Agents', ...(filterOptions?.agents ?? [])];
  const devices = ['All Devices', ...(filterOptions?.devices ?? [])];
  const providers = ['All Providers', ...(filterOptions?.providers ?? [])];

  const { data: metrics, isLoading, refetch } = useQuery<MetricsData>({
    queryKey: ['history-metrics', timeRange, agent, device, provider],
    queryFn: async () => {
      const params = new URLSearchParams({ range: timeRange });
      if (agent !== 'All Agents') params.set('agent_id', agent);
      if (device !== 'All Devices') params.set('device_id', device);
      if (provider !== 'All Providers') params.set('provider', provider);
      return await api.get<MetricsData>(`/v1/history/metrics?${params}`);
    },
    refetchInterval: 15_000,
    retry: false,
  });

  const providerKeys = useMemo(() => {
    const pts = metrics?.provider_latency ?? [];
    if (!pts.length) return [];
    return Object.keys(pts[0]).filter((k) => k !== 'time');
  }, [metrics]);

  const s = metrics?.summary;

  const chartTooltipStyle = {
    contentStyle: { fontSize: 11, border: `1px solid ${chartTheme.tooltip.border}`, borderRadius: 6, boxShadow: 'none', padding: '6px 10px', backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text },
    itemStyle: { color: chartTheme.tooltip.text },
    labelStyle: { color: chartTheme.tooltip.text, marginBottom: 2 },
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-base font-semibold text-gray-900">Metrics</h1>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
            <SelectTrigger className="h-8 w-28 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_OPTIONS.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className="h-8 w-36 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={device} onValueChange={setDevice}>
            <SelectTrigger className="h-8 w-36 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {devices.map((d) => (
                <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={provider} onValueChange={setProvider}>
            <SelectTrigger className="h-8 w-36 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((p) => (
                <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard icon={Activity}     label="Executions / min"  value={s ? s.executions_per_minute : '—'}       loading={isLoading} />
          <OverviewCard icon={Zap}          label="Avg Latency"        value={s ? `${s.avg_latency_ms} ms` : '—'}      loading={isLoading} />
          <OverviewCard icon={CheckCircle2} label="Success Rate"       value={s ? `${s.success_rate_percent}%` : '—'}  loading={isLoading} />
          <OverviewCard icon={ShieldAlert}  label="Policy Violations"  value={s ? s.policy_violations : '—'}           loading={isLoading} />
        </div>

        {/* 2×2 Chart grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Execution Throughput */}
          <SurfaceSection
            icon={Activity}
            title="Execution Throughput"
            bodyClassName="px-4 pb-4 pt-3"
          >
            {isLoading ? <Skeleton className="h-36 w-full" /> : (
              <ClientChart height={148} fallbackClassName="h-[148px] w-full">
                <AreaChart data={metrics?.throughput ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="tpFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 4" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Area type="monotone" dataKey="executions" stroke="#3b82f6" strokeWidth={1.5} fill="url(#tpFill)" dot={false} name="exec/min" />
                </AreaChart>
              </ClientChart>
            )}
          </SurfaceSection>

          {/* Provider Latency */}
          <SurfaceSection
            icon={Zap}
            title="Provider Latency"
            bodyClassName="px-4 pb-4 pt-3"
          >
            {isLoading ? <Skeleton className="h-36 w-full" /> : (
              <ClientChart height={148} fallbackClassName="h-[148px] w-full">
                <LineChart data={metrics?.provider_latency ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} />
                  {providerKeys.length > 0 && <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />}
                  {providerKeys.map((key, i) => (
                    <Line key={key} type="monotone" dataKey={key} stroke={PROVIDER_COLORS[i % PROVIDER_COLORS.length]} strokeWidth={1.5} dot={false} name={key} />
                  ))}
                </LineChart>
              </ClientChart>
            )}
          </SurfaceSection>

          {/* Resource Usage */}
          <SurfaceSection
            icon={Cpu}
            title="Runtime Resource Usage"
            bodyClassName="px-4 pb-4 pt-3"
          >
            {isLoading ? <Skeleton className="h-36 w-full" /> : (
              <ClientChart height={148} fallbackClassName="h-[148px] w-full">
                <LineChart data={metrics?.resource_usage ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} domain={[0, 100]} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="cpu" stroke="#ef4444" strokeWidth={1.5} dot={false} name="CPU %" />
                  <Line type="monotone" dataKey="memory" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Memory %" />
                </LineChart>
              </ClientChart>
            )}
          </SurfaceSection>

          {/* Fleet Activity */}
          <SurfaceSection
            icon={Users}
            title="Fleet Activity"
            bodyClassName="px-4 pb-4 pt-3"
          >
            {isLoading ? <Skeleton className="h-36 w-full" /> : (
              <ClientChart height={148} fallbackClassName="h-[148px] w-full">
                <LineChart data={metrics?.fleet_activity ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={chartTheme.grid} vertical={false} />
                  <XAxis dataKey="time" tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: chartTheme.axis }} axisLine={false} tickLine={false} />
                  <Tooltip {...chartTooltipStyle} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="active_devices" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="Active Devices" />
                  <Line type="monotone" dataKey="active_executions" stroke="#f97316" strokeWidth={1.5} dot={false} name="Active Executions" />
                </LineChart>
              </ClientChart>
            )}
          </SurfaceSection>
        </div>

        {/* Metrics Events Table */}
        <SurfaceSection
          icon={Activity}
          title="Metric Events"
          bodyClassName="px-0 py-0"
        >
          <div
            className="overflow-y-auto flex-1 min-h-0"
            style={{ height: 'calc(100vh - 560px)', minHeight: 220, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
          >
            <Table className="w-full table-fixed">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="hover:bg-transparent bg-white">
                  <TableHead className="w-[148px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-4 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Timestamp</TableHead>
                  <TableHead className="w-[148px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-3 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Metric</TableHead>
                  <TableHead className="w-[100px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-3 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Value</TableHead>
                  <TableHead className="w-[118px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-3 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Agent</TableHead>
                  <TableHead className="w-[110px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-3 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Device</TableHead>
                  <TableHead className="w-[90px] text-xs font-medium text-muted-foreground uppercase tracking-wide h-9 px-3 bg-white border-b border-black/[0.08] dark:border-white/[0.08]">Provider</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i} className="bg-white">
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j} className="px-3 py-2">
                            <div className="h-3 rounded bg-gray-100 animate-pulse" style={{ width: `${(i * 37 + j * 19) % 80 + 32}px` }} />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : (metrics?.events ?? []).length === 0
                  ? (
                      <TableRow className="bg-white">
                        <TableCell colSpan={6} className="py-16 text-center text-xs text-muted-foreground">
                          No metric events in this time range.
                        </TableCell>
                      </TableRow>
                    )
                  : (metrics?.events ?? []).map((ev) => (
                      <TableRow key={ev.id} className="border-b border-black/[0.08] dark:border-white/[0.08] hover:bg-gray-50 bg-white">
                        <TableCell className="px-4 py-2 text-xs text-muted-foreground font-mono whitespace-nowrap">
                          {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </TableCell>
                        <TableCell className="px-3 py-2">
                          <MetricNameBadge name={ev.metric_name} />
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-foreground font-mono tabular-nums">
                          {ev.metric_value.toFixed(2)}{ev.unit ? ` ${ev.unit}` : ''}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                          {ev.agent_id}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground font-mono truncate">
                          {ev.device_id}
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground capitalize">
                          {ev.provider}
                        </TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
