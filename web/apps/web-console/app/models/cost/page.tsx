'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';
import { api } from '@/lib/apiClient';
import { getRelativeTime } from '@/utils/helpers';
import { Coins, Zap, CalendarDays, TrendingUp } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Static Config ────────────────────────────────────────────────────────────

const PROVIDER_AVATAR: Record<string, { bg: string; text: string; initial: string }> = {
  openai:    { bg: 'bg-[#10a37f]',  text: 'text-white',      initial: 'O' },
  anthropic: { bg: 'bg-orange-100', text: 'text-orange-700', initial: 'A' },
  deepseek:  { bg: 'bg-blue-100',   text: 'text-blue-700',   initial: 'D' },
  google:    { bg: 'bg-red-100',    text: 'text-red-700',    initial: 'G' },
  xai:       { bg: 'bg-gray-900',   text: 'text-white',      initial: 'X' },
};

// ─── Formatters ───────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProviderAvatar({ kind }: { kind: string }) {
  const meta = PROVIDER_AVATAR[kind] ?? { bg: 'bg-gray-100', text: 'text-gray-600', initial: kind[0]?.toUpperCase() ?? '?' };
  return (
    <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold flex-shrink-0 ${meta.bg} ${meta.text}`}>
      {meta.initial}
    </span>
  );
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
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
      <p className="text-[10px] text-gray-500 mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-gray-900">${payload[0]?.value?.toFixed(2)}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ModelsCostPage() {
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

  const STAT_CARDS = [
    { label: 'Tokens (24h)',      value: summaryLoading ? null : fmtTokens(summary?.tokens_24h ?? 0),        icon: Zap,          color: 'text-blue-600'   },
    { label: 'Cost (24h)',        value: summaryLoading ? null : fmtCost(summary?.cost_24h ?? 0),            icon: Coins,        color: 'text-green-600'  },
    { label: 'Tokens (30d)',      value: summaryLoading ? null : fmtTokens(summary?.tokens_30d ?? 0),        icon: CalendarDays, color: 'text-gray-500'   },
    { label: 'Est. Monthly Cost', value: summaryLoading ? null : fmtCost(summary?.estimated_monthly ?? 0),  icon: TrendingUp,   color: 'text-violet-600' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900">Usage & Cost</h1>
          <p className="text-xs text-gray-500 mt-0.5">Token usage and provider spending across the system.</p>
        </div>

        {/* ── Stat Cards ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200 shadow-none">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {c.value === null
                  ? <Skeleton className="h-6 w-20" />
                  : <span className="text-base font-semibold text-gray-900 tabular-nums">{c.value}</span>
                }
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ── Provider Cost + Daily Spend ────────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">

          {/* Provider Cost Breakdown */}
          <Card className="xl:col-span-3 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900">Provider Cost Breakdown</CardTitle>
            </CardHeader>
            <Separator />
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
                ) : (
                  providers.map((p) => (
                    <TableRow key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <TableCell className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-900">{p.provider}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtRequests(p.requests)}</TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtTokens(p.tokens)}</TableCell>
                      <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{p.avg_latency_ms}ms</TableCell>
                      <TableCell className="px-4 py-3 text-xs font-medium tabular-nums text-gray-900">{fmtCost(p.cost)}</TableCell>
                      <TableCell className="px-4 py-3"><UsageBar percent={p.usage_percent} /></TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>

          {/* Daily Spend Chart */}
          <Card className="xl:col-span-2 border border-gray-200 shadow-none">
            <CardHeader className="px-4 pt-4 pb-3">
              <CardTitle className="text-sm font-medium text-gray-900">Daily Spend</CardTitle>
            </CardHeader>
            <Separator />
            <CardContent className="px-2 pt-4 pb-3">
              {dailyLoading ? (
                <div className="h-[188px] px-2">
                  <Skeleton className="h-full w-full rounded-md" />
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={188}>
                  <LineChart data={daily} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: '#9ca3af' }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <RechartsTooltip content={<SpendTooltip />} cursor={{ stroke: '#e5e7eb', strokeWidth: 1 }} />
                    <Line
                      type="monotone"
                      dataKey="cost"
                      stroke="#111827"
                      strokeWidth={1.5}
                      dot={false}
                      activeDot={{ r: 3, fill: '#111827', strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Model Usage Table ──────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Model Usage</CardTitle>
          </CardHeader>
          <Separator />
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
              ) : (
                models.map((m) => (
                  <TableRow key={m.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-mono font-medium text-gray-900">{m.model}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-gray-600">{m.provider}</span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtRequests(m.requests)}</TableCell>
                    <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{fmtTokens(m.tokens)}</TableCell>
                    <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">{m.avg_latency_ms}ms</TableCell>
                    <TableCell className="px-4 py-3 text-xs font-medium tabular-nums text-gray-900">{fmtCost(m.cost)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

        {/* ── Recent Cost Events ─────────────────────────────────────────────── */}
        <Card className="border border-gray-200 shadow-none">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Recent Cost Events</CardTitle>
          </CardHeader>
          <Separator />
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
                  <TableCell colSpan={6} className="py-10 text-center text-xs text-gray-400">
                    No cost events recorded.
                  </TableCell>
                </TableRow>
              ) : (
                events.map((e) => (
                  <TableRow key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <TableCell className="px-4 py-3 text-xs text-gray-500 tabular-nums">
                      {getRelativeTime(e.timestamp)}
                    </TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-700">{e.request_id}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs text-gray-700">{e.provider}</TableCell>
                    <TableCell className="px-4 py-3">
                      <span className="text-xs font-mono text-gray-600">{e.model}</span>
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs tabular-nums text-gray-700">
                      {e.tokens.toLocaleString()}
                    </TableCell>
                    <TableCell className="px-4 py-3 text-xs font-medium tabular-nums text-gray-900">
                      {fmtCost(e.cost)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>

      </div>
    </DashboardLayout>
  );
}
