'use client';

import { type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ClientChart } from '@/components/ui/client-chart';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { api } from '@/lib/apiClient';
import { getRelativeTime } from '@/utils/helpers';
import { useChartTheme } from '@/utils/chartTheme';
import {
  Coins, Zap, CalendarDays, TrendingUp, BarChart3, Activity,
  type LucideIcon,
} from 'lucide-react';

interface UsageSummary {
  tokens_24h: number;
  cost_24h: number;
  tokens_30d: number;
  estimated_monthly: number;
}

interface ProviderCost {
  id: string;
  provider: string;
  kind: string;
  requests: number;
  tokens: number;
  avg_latency_ms: number;
  cost: number;
  usage_percent: number;
}

interface ModelUsage {
  id: string;
  model: string;
  provider: string;
  kind: string;
  requests: number;
  tokens: number;
  avg_latency_ms: number;
  cost: number;
}

interface DailySpend {
  date: string;
  cost: number;
}

interface CostEvent {
  id: string;
  timestamp: string;
  request_id: string;
  provider: string;
  model: string;
  tokens: number;
  cost: number;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function fmtCost(n: number): string {
  return `$${n.toFixed(n < 1 ? 3 : 2)}`;
}

function fmtRequests(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function UsageBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-gray-900 rounded-full" style={{ width: `${percent}%` }} />
      </div>
      <span className="text-xs tabular-nums text-gray-600">{percent}%</span>
    </div>
  );
}

function SpendTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  const chartTheme = useChartTheme();
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 shadow-sm"
      style={{ backgroundColor: chartTheme.tooltip.bg, border: `1px solid ${chartTheme.tooltip.border}` }}
    >
      <p className="text-[10px] mb-0.5" style={{ color: chartTheme.axis }}>{label}</p>
      <p className="text-xs font-semibold" style={{ color: chartTheme.tooltip.text }}>${payload[0]?.value?.toFixed(2)}</p>
    </div>
  );
}

function OverviewCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  sub: string;
  loading?: boolean;
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
  icon: Icon,
  title,
  description,
  actions,
  bodyClassName = 'px-4 py-4',
  className = '',
  children,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  bodyClassName?: string;
  className?: string;
  children: ReactNode;
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

export default function ModelsCostPage() {
  const chartTheme = useChartTheme();
  const { data: summary, isLoading: summaryLoading } = useQuery<UsageSummary>({
    queryKey: ['usage-summary'],
    queryFn: async () => {
      try { return await api.get<UsageSummary>('/models/usage/summary'); }
      catch { return null as unknown as UsageSummary; }
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: providers = [], isLoading: providersLoading } = useQuery<ProviderCost[]>({
    queryKey: ['usage-providers'],
    queryFn: async () => {
      try { return await api.get<ProviderCost[]>('/models/usage/providers'); }
      catch { return [] as ProviderCost[]; }
    },
    retry: false,
    staleTime: 30_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelUsage[]>({
    queryKey: ['usage-models'],
    queryFn: async () => {
      try { return await api.get<ModelUsage[]>('/models/usage/models'); }
      catch { return [] as ModelUsage[]; }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: daily = [], isLoading: dailyLoading } = useQuery<DailySpend[]>({
    queryKey: ['usage-daily'],
    queryFn: async () => {
      try { return await api.get<DailySpend[]>('/models/usage/daily'); }
      catch { return [] as DailySpend[]; }
    },
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery<CostEvent[]>({
    queryKey: ['usage-events'],
    queryFn: async () => {
      try { return await api.get<CostEvent[]>('/models/usage/events'); }
      catch { return [] as CostEvent[]; }
    },
    retry: false,
    staleTime: 15_000,
    refetchInterval: 30_000,
    refetchOnWindowFocus: false,
  });

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Usage & Cost</h1>
          <p className="text-xs text-black mt-0.5">Token usage and provider spending across the system.</p>
        </div>

        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <OverviewCard
            icon={Zap}
            label="Tokens (24h)"
            value={fmtTokens(summary?.tokens_24h ?? 0)}
            sub="Tokens consumed in the last 24 hours."
            loading={summaryLoading}
          />
          <OverviewCard
            icon={Coins}
            label="Cost (24h)"
            value={fmtCost(summary?.cost_24h ?? 0)}
            sub="Spend across all providers today."
            loading={summaryLoading}
          />
          <OverviewCard
            icon={CalendarDays}
            label="Tokens (30d)"
            value={fmtTokens(summary?.tokens_30d ?? 0)}
            sub="Rolling 30-day token volume."
            loading={summaryLoading}
          />
          <OverviewCard
            icon={TrendingUp}
            label="Est. Monthly Cost"
            value={fmtCost(summary?.estimated_monthly ?? 0)}
            sub="Projected from current daily run rate."
            loading={summaryLoading}
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
          <SurfaceSection
            icon={BarChart3}
            title="Provider Cost Breakdown"
            description="Requests, tokens, and spend per provider over the current period."
            className="xl:col-span-3"
            bodyClassName="px-4 py-4"
          >
            <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      {['Provider', 'Requests', 'Tokens', 'Avg Latency', 'Cost', 'Usage %'].map((col) => (
                        <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                          {col}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {providersLoading ? (
                      Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 6 }).map((_, j) => (
                            <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                          ))}
                        </TableRow>
                      ))
                    ) : providers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="px-4 py-10 text-center text-xs text-gray-500">
                          No provider cost data available yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      providers.map((p) => (
                        <TableRow key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <TableCell className="px-4 py-2.5 text-xs font-medium text-gray-900">{p.provider}</TableCell>
                          <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{fmtRequests(p.requests)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{fmtTokens(p.tokens)}</TableCell>
                          <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{p.avg_latency_ms}ms</TableCell>
                          <TableCell className="px-4 py-2.5 text-xs font-medium tabular-nums text-gray-900">{fmtCost(p.cost)}</TableCell>
                          <TableCell className="px-4 py-2.5"><UsageBar percent={p.usage_percent} /></TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          </SurfaceSection>

          <SurfaceSection
            icon={TrendingUp}
            title="Daily Spend"
            description="Cost per day over the last 30 days."
            className="xl:col-span-2"
            bodyClassName="px-4 py-4"
          >
            {dailyLoading ? (
              <Skeleton className="h-[196px] w-full rounded-2xl" />
            ) : daily.length === 0 ? (
              <div className="h-[196px] rounded-2xl border border-dashed border-gray-300 bg-white flex items-center justify-center">
                <p className="text-xs text-gray-400">No daily spend data yet.</p>
              </div>
            ) : (
              <div className="rounded-2xl border border-gray-200 bg-white px-3 py-3">
                <ClientChart height={172} fallbackClassName="h-[172px] w-full">
                  <LineChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: chartTheme.axis }}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: chartTheme.axis }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <RechartsTooltip content={<SpendTooltip />} cursor={{ stroke: chartTheme.grid, strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke={chartTheme.line}
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: chartTheme.line, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ClientChart>
              </div>
            )}
          </SurfaceSection>
        </div>

        <SurfaceSection
          icon={Activity}
          title="Model Usage"
          description="Token consumption and cost broken down by model."
          bodyClassName="px-4 py-4"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Model', 'Provider', 'Requests', 'Tokens', 'Avg Latency', 'Cost'].map((col) => (
                      <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {modelsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : models.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-10 text-center text-xs text-gray-500">
                        No model usage recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    models.map((m) => (
                      <TableRow key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="px-4 py-2.5">
                          <span className="text-xs font-mono font-medium text-gray-900">{m.model}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs text-gray-600">{m.provider}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{fmtRequests(m.requests)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{fmtTokens(m.tokens)}</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">{m.avg_latency_ms}ms</TableCell>
                        <TableCell className="px-4 py-2.5 text-xs font-medium tabular-nums text-gray-900">{fmtCost(m.cost)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>

        <SurfaceSection
          icon={Coins}
          title="Recent Cost Events"
          description="Per-request cost log, refreshed every 30 seconds."
          bodyClassName="px-4 py-4"
        >
          <div className="rounded-2xl border border-gray-200 overflow-hidden bg-white">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    {['Timestamp', 'Request', 'Provider', 'Model', 'Tokens', 'Cost'].map((col) => (
                      <TableHead key={col} className="text-xs font-medium text-gray-500 h-9 px-4 bg-gray-50 hover:bg-gray-50">
                        {col}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {eventsLoading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <TableRow key={i}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <TableCell key={j} className="px-4 py-3"><Skeleton className="h-3.5 w-14" /></TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : events.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="px-4 py-10 text-center text-xs text-gray-500">
                        No cost events recorded yet.
                      </TableCell>
                    </TableRow>
                  ) : (
                    events.map((e) => (
                      <TableRow key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-500">
                          {getRelativeTime(e.timestamp)}
                        </TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="text-xs font-mono text-gray-700">{e.request_id}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs text-gray-700">{e.provider}</TableCell>
                        <TableCell className="px-4 py-2.5">
                          <span className="text-xs font-mono text-gray-600">{e.model}</span>
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs tabular-nums text-gray-700">
                          {e.tokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="px-4 py-2.5 text-xs font-medium tabular-nums text-gray-900">
                          {fmtCost(e.cost)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </SurfaceSection>
      </div>
    </DashboardLayout>
  );
}
