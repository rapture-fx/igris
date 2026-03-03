'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { api } from '@/lib/apiClient';
import { DollarSign, TrendingUp, TrendingDown, Cpu, RefreshCw } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';

interface CostSummary {
  total_cost_usd: number;
  total_tokens: number;
  cost_trend_percent: number;
  top_model: string;
  by_model: ModelCost[];
  by_day: DailyCost[];
}

interface ModelCost {
  model: string;
  provider: string;
  tokens_used: number;
  cost_usd: number;
  request_count: number;
  cost_per_1k_tokens: number;
}

interface DailyCost {
  date: string;
  cost_usd: number;
}

type TimeRange = '7d' | '30d' | '90d';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const TIME_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
  { label: 'Last 90 days', value: '90d' },
];

export default function ModelsCostPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  const { data: cost, isLoading, refetch } = useQuery<CostSummary>({
    queryKey: ['models-cost', timeRange],
    queryFn: () => api.get(`/v1/model/cost?range=${timeRange}`),
    retry: false,
  });

  const dailyData = (cost?.by_day ?? []).map((d) => ({
    date: new Date(d.date).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    cost: d.cost_usd,
  }));

  const trendUp = (cost?.cost_trend_percent ?? 0) > 0;

  const STAT_CARDS = [
    {
      label: 'Total Cost',
      value: cost?.total_cost_usd != null ? `$${cost.total_cost_usd.toFixed(2)}` : '—',
      icon: DollarSign,
      color: 'text-gray-700',
      sub: `Last ${timeRange}`,
    },
    {
      label: 'Total Tokens',
      value: cost?.total_tokens != null ? cost.total_tokens.toLocaleString() : '—',
      icon: Cpu,
      color: 'text-blue-600',
      sub: 'Consumed',
    },
    {
      label: 'Cost Trend',
      value: cost?.cost_trend_percent != null
        ? `${trendUp ? '+' : ''}${cost.cost_trend_percent.toFixed(1)}%`
        : '—',
      icon: trendUp ? TrendingUp : TrendingDown,
      color: trendUp ? 'text-red-600' : 'text-green-600',
      sub: 'vs. prior period',
    },
    {
      label: 'Top Model',
      value: cost?.top_model ?? '—',
      icon: Cpu,
      color: 'text-violet-600',
      sub: 'Highest spend',
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">Cost</h1>
            <p className="text-xs text-gray-500 mt-0.5">Model inference spend and token usage.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {STAT_CARDS.map((c) => (
            <Card key={c.label} className="border border-gray-200">
              <CardHeader className="px-4 pt-3 pb-0">
                <CardTitle className="text-xs font-medium text-gray-500 flex items-center gap-1.5">
                  <c.icon className={`h-3.5 w-3.5 ${c.color}`} />
                  {c.label}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 pt-1">
                {isLoading ? <Skeleton className="h-6 w-20" /> : (
                  <span className="text-lg font-semibold text-gray-900 tabular-nums">{c.value}</span>
                )}
                <p className="text-xs text-gray-400 mt-0.5">{c.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Daily Cost Chart */}
        <Card className="border border-gray-200">
          <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium text-gray-900">Daily Spend (USD)</CardTitle>
          </CardHeader>
          <Separator />
          <CardContent className="px-4 pt-3 pb-4">
            {isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : dailyData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-xs text-gray-400">
                No cost data available
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#9ca3af' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `$${v.toFixed(2)}`}
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: 'none' }}
                    formatter={(v: number) => [`$${v.toFixed(4)}`, 'Cost']}
                  />
                  <Bar dataKey="cost" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Cost by Model Table */}
        <Card className="border border-gray-200">
          <CardHeader className="px-4 pt-4 pb-3">
            <CardTitle className="text-sm font-medium text-gray-900">Cost by Model</CardTitle>
          </CardHeader>
          <Separator />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Model</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Requests</TableHead>
                <TableHead>Tokens Used</TableHead>
                <TableHead>Cost / 1K Tokens</TableHead>
                <TableHead>Total Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 6 }).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-16" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (cost?.by_model ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-gray-400 py-12">No cost data</TableCell>
                </TableRow>
              ) : (
                (cost?.by_model ?? [])
                  .sort((a, b) => b.cost_usd - a.cost_usd)
                  .map((m, i) => (
                    <TableRow key={m.model}>
                      <TableCell className="text-xs font-medium flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: COLORS[i % COLORS.length] }}
                        />
                        {m.model}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded border border-gray-200">
                          {m.provider}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-gray-600">
                        {m.request_count.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-gray-600">
                        {m.tokens_used.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums text-gray-600">
                        ${m.cost_per_1k_tokens.toFixed(4)}
                      </TableCell>
                      <TableCell className="text-xs tabular-nums font-medium text-gray-800">
                        ${m.cost_usd.toFixed(4)}
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
