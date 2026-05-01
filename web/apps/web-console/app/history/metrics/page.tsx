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
          <div>
            <h1 className="text-base font-semibold text-gray-900">Metrics</h1>
            <p className="text-xs text-black mt-0.5">Performance, resource, and fleet metrics.</p>
          </div>
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
          <OverviewCard icon={Activity}     label="Executions / min"  value={s ? s.executions_per_minute : '—'}       sub="Rolling average"  loading={isLoading} />
          <OverviewCard icon={Zap}          label="Avg Latency"        value={s ? `${s.avg_latency_ms} ms` : '—'}      sub="All providers"    loading={isLoading} />
          <OverviewCard icon={CheckCircle2} label="Success Rate"       value={s ? `${s.success_rate_percent}%` : '—'}  sub="Last window"      loading={isLoading} />
          <OverviewCard icon={ShieldAlert}  label="Policy Violations"  value={s ? s.policy_violations : '—'}           sub="In time range"    loading={isLoading} />
        </div>

        {/* 2×2 Chart grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Execution Throughput */}
          <SurfaceSection
            icon={Activity}
            title="Execution Throughput"
            description="Executions per minute over time."
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
            description="Request latency in milliseconds per provider."
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
            description="CPU and memory utilization over time."
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
            description="Active devices and executions over time."
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
          description="Raw metric events recorded in the selected time window."
          bodyClassName="px-0 py-0"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white mx-4 mb-4">
            <div
              className="overflow-y-auto relative"
              style={{ height: 'calc(100vh - 640px)', minHeight: 220, scrollbarWidth: 'none', msOverflowStyle: 'none' } as React.CSSProperties}
            >
              <Table className="w-full table-fixed">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-gray-50 border-b border-gray-200 hover:bg-gray-50">
                    <TableHead className="w-[148px] text-xs font-medium text-gray-500 py-2 px-4">Timestamp</TableHead>
                    <TableHead className="w-[148px] text-xs font-medium text-gray-500 py-2 px-3">Metric</TableHead>
                    <TableHead className="w-[100px] text-xs font-medium text-gray-500 py-2 px-3">Value</TableHead>
                    <TableHead className="w-[118px] text-xs font-medium text-gray-500 py-2 px-3">Agent</TableHead>
                    <TableHead className="w-[110px] text-xs font-medium text-gray-500 py-2 px-3">Device</TableHead>
                    <TableHead className="w-[90px] text-xs font-medium text-gray-500 py-2 px-3">Provider</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <TableRow key={i} className="border-b border-gray-100">
                          <TableCell className="py-2 px-4"><Skeleton className="h-3.5 w-28" /></TableCell>
                          <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-24" /></TableCell>
                          <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                          <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-20" /></TableCell>
                          <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-16" /></TableCell>
                          <TableCell className="py-2 px-3"><Skeleton className="h-3.5 w-16" /></TableCell>
                        </TableRow>
                      ))
                    : (metrics?.events ?? []).length === 0
                    ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-10 text-center text-xs text-gray-400">
                            No metric events in this time range.
                          </TableCell>
                        </TableRow>
                      )
                    : (metrics?.events ?? []).map((ev) => (
                        <TableRow key={ev.id} className="border-b border-gray-100 hover:bg-gray-50/60">
                          <TableCell className="py-2 px-4 text-xs text-gray-500 font-mono whitespace-nowrap">
                            {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </TableCell>
                          <TableCell className="py-2 px-3">
                            <MetricNameBadge name={ev.metric_name} />
                          </TableCell>
                          <TableCell className="py-2 px-3 text-xs text-gray-800 font-mono tabular-nums">
                            {ev.metric_value.toFixed(2)}{ev.unit ? ` ${ev.unit}` : ''}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-xs text-gray-600 font-mono truncate">
                            {ev.agent_id}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-xs text-gray-600 font-mono truncate">
                            {ev.device_id}
                          </TableCell>
                          <TableCell className="py-2 px-3 text-xs text-gray-500 capitalize">
                            {ev.provider}
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
