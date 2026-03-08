'use client';

import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatusBadge } from '@/components/ui/status-badge';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
import { getRelativeTime, formatDuration, truncateText } from '@/utils/helpers';
import {
  Terminal, AlertTriangle, Server, Cpu, Gauge, Bell, ArrowRight, Zap,
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';

interface OverviewStats {
  active_executions: number;
  violations_24h: number;
  online_devices: number;
  model_requests_24h: number;
  quota_usage_percent: number;
  active_alerts: number;
}

interface Execution {
  id: string;
  agent_id: string;
  model: string;
  device_id: string;
  started_at: string;
  duration_ms: number;
  status: string;
  has_violation: boolean;
}

interface Violation {
  id: string;
  kind: string;
  agent_id: string;
  device_id: string;
  created_at: string;
}

interface ModelUsagePoint {
  hour: string;
  requests: number;
}

interface RuntimeUsage {
  tier: string;
  tier_name: string;
  monthly_price_cents: number;
  runtimes: {
    used: number;
    limit: number;
    percent: number;
  };
  upgrade_tier: string;
}

interface UsageSummary {
  cost_24h: number;
}

interface DailySpend {
  date: string;
  cost: number;
}


const SUMMARY_CARDS = [
  { key: 'active_executions', label: 'Active Executions', icon: Terminal, sub: 'Currently running', link: '/execution/runs' },
  { key: 'violations_24h', label: 'Violations', icon: AlertTriangle, sub: 'Last 24 hours', link: '/proof/violations' },
  { key: 'online_devices', label: 'Online Devices', icon: Server, sub: 'Fleet status', link: '/fleet/devices' },
  { key: 'model_requests_24h', label: 'Model Requests', icon: Cpu, sub: 'Last 24 hours', link: '/models/routing' },
  { key: 'quota_usage_percent', label: 'Quota Usage', icon: Gauge, sub: '% of limit used', link: '/settings/license', suffix: '%' },
  { key: 'active_alerts', label: 'Active Alerts', icon: Bell, sub: 'Requiring attention', link: '/history/alerts' },
];

function StatCard({
  label, icon: Icon, sub, link, value, suffix = '', loading,
}: {
  label: string; icon: any; sub: string; link: string;
  value?: number; suffix?: string; loading: boolean;
}) {
  return (
    <Link href={link}>
      <Card className="border border-gray-200 shadow-sm hover:border-gray-300 transition-colors cursor-pointer group">
        <CardHeader className="pb-1 pt-4 px-4">
          <CardTitle className="text-xs font-medium text-black flex items-center gap-1.5">
            <Icon className="h-3.5 w-3.5 text-black" />
            {label}
          </CardTitle>
        </CardHeader>
        <CardContent className="pb-4 px-4">
          {loading ? (
            <Skeleton className="h-7 w-16 mt-1" />
          ) : (
            <div className={`text-base font-semibold text-gray-900 tabular-nums`}>
              {value ?? '—'}{suffix}
            </div>
          )}
          <p className="text-xs text-black mt-0.5">{sub}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery<OverviewStats>({
    queryKey: ['dashboard-stats'],
    queryFn: () => api.get('/v1/stats/overview'),
    retry: false,
  });

  const { data: executions, isLoading: execLoading } = useQuery<Execution[]>({
    queryKey: ['recent-executions'],
    queryFn: () => api.get('/v1/execution/runs?limit=20&sort=created_at:desc'),
    retry: false,
  });

  const { data: violations, isLoading: violLoading } = useQuery<Violation[]>({
    queryKey: ['recent-violations'],
    queryFn: () => api.get('/v1/proof/violations?limit=8'),
    retry: false,
  });

  const { data: modelUsage } = useQuery<ModelUsagePoint[]>({
    queryKey: ['model-usage-24h'],
    queryFn: () => api.get('/v1/stats/model-usage?period=24h'),
    retry: false,
  });

  const { data: runtimeUsage } = useQuery<RuntimeUsage>({
    queryKey: ['subscription-status'],
    queryFn: () => api.get('/api/subscription/status'),
    retry: false,
  });

  const { data: usageSummary, isLoading: summaryLoading } = useQuery<UsageSummary>({
    queryKey: ['usage-summary'],
    queryFn: () => api.get('/v1/usage/summary'),
    retry: false,
  });

  const { data: dailySpend = [], isLoading: dailyLoading } = useQuery<DailySpend[]>({
    queryKey: ['usage-daily'],
    queryFn: async () => {
      try { return await api.get<DailySpend[]>('/models/usage/daily'); }
      catch { return []; }
    },
    retry: false,
  });

  const chartData = modelUsage ?? Array.from({ length: 12 }, (_, i) => ({
    hour: `${i * 2}h`,
    requests: 0,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div>
          <h1 className="text-base font-semibold text-gray-900">System Overview</h1>
          <p className="text-xs text-black mt-0.5">Live state of governed execution across fleet.</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          {SUMMARY_CARDS.map((card) => (
            <StatCard
              key={card.key}
              label={card.label}
              icon={card.icon}
              sub={card.sub}
              link={card.link}
              value={(stats as any)?.[card.key]}
              suffix={card.suffix}
              loading={statsLoading}
            />
          ))}
        </div>

        {/* Runtime Usage Card */}
        {runtimeUsage && (
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="px-4 pt-4 pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-medium text-gray-900 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-gray-700" />
                Runtime Usage
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-gray-500 capitalize">
                  {runtimeUsage.tier_name} · ${Math.round(runtimeUsage.monthly_price_cents / 100)}/mo
                </span>
                {runtimeUsage.runtimes.percent >= 80 && (
                  <Link
                    href="/settings/billing"
                    className="text-[11px] text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-500">Runtimes registered</span>
                <span className="tabular-nums font-medium text-gray-900">
                  {runtimeUsage.runtimes.used} / {runtimeUsage.runtimes.limit}
                </span>
              </div>
              <Progress value={runtimeUsage.runtimes.percent} className="h-1.5" />
              {runtimeUsage.runtimes.percent >= 100 && (
                <p className="text-[11px] text-red-600 mt-2">
                  Runtime limit reached.{' '}
                  <Link href="/settings/billing" className="underline">Upgrade to add more.</Link>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main + Side */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Recent Executions */}
          <div className="xl:col-span-2">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-900">Recent Executions</CardTitle>
                <Link href="/execution/runs" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <Separator />
              <div className="overflow-auto max-h-72 scrollbar-hide">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-4 py-2.5 text-left font-medium text-black">ID</th>
                      <th className="px-4 py-2.5 text-left font-medium text-black">Agent</th>
                      <th className="px-4 py-2.5 text-left font-medium text-black">Model</th>
                      <th className="px-4 py-2.5 text-left font-medium text-black">Started</th>
                      <th className="px-4 py-2.5 text-left font-medium text-black">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {execLoading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-b border-gray-50">
                          {Array.from({ length: 5 }).map((_, j) => (
                            <td key={j} className="px-4 py-2.5">
                              <Skeleton className="h-4 w-20" />
                            </td>
                          ))}
                        </tr>
                      ))
                    ) : (executions ?? []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-black">No executions found</td>
                      </tr>
                    ) : (
                      (executions ?? []).map((ex) => (
                        <tr key={ex.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                          <td className="px-4 py-2.5 text-black">{truncateText(ex.id, 12)}</td>
                          <td className="px-4 py-2.5 text-gray-700">{truncateText(ex.agent_id, 14)}</td>
                          <td className="px-4 py-2.5 text-black">{ex.model ?? '—'}</td>
                          <td className="px-4 py-2.5 text-black">{getRelativeTime(ex.started_at)}</td>
                          <td className="px-4 py-2.5">
                            <StatusBadge status={ex.has_violation ? 'VIOLATION' : ex.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Recent Violations */}
          <div>
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-900">Recent Violations</CardTitle>
                <Link href="/proof/violations" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <Separator />
              <div className="divide-y divide-gray-50 max-h-72 overflow-y-auto scrollbar-hide">
                {violLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-3">
                      <Skeleton className="h-3 w-24 mb-1.5" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  ))
                ) : (violations ?? []).length === 0 ? (
                  <div className="px-4 py-8 text-center text-xs text-black">No violations</div>
                ) : (
                  (violations ?? []).map((v) => (
                    <div key={v.id} className="px-4 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-700">{v.kind}</span>
                        <span className="text-[11px] text-black">{getRelativeTime(v.created_at)}</span>
                      </div>
                      <p className="text-[11px] text-black mt-0.5">
                        {truncateText(v.agent_id, 16)} · {truncateText(v.device_id, 12)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Model Usage Chart + Daily Spend */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Model Requests Chart */}
          <div className="xl:col-span-2">
            <Card className="border border-gray-200 shadow-sm">
              <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-900">Model Requests (24h)</CardTitle>
                <Link href="/models/routing" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  Routing <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <Separator />
              <CardContent className="px-4 pt-3 pb-4">
                <ResponsiveContainer width="100%" height={160}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 4" stroke="#efefef" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: 'none' }}
                      itemStyle={{ color: '#374151' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      strokeWidth={1}
                      fill="url(#requestsFill)"
                      dot={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Daily Spend */}
          <div>
            <Card className="border border-gray-200 h-full">
              <CardHeader className="px-4 pt-4 pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium text-gray-900">Daily Spend</CardTitle>
                <Link href="/models/cost" className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                  See more <ArrowRight className="h-3 w-3" />
                </Link>
              </CardHeader>
              <Separator />
              <CardContent className="px-2 pt-4 pb-3">
                {dailyLoading ? (
                  <Skeleton className="h-[160px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={dailySpend.slice(-14)} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
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
                      <Tooltip
                        contentStyle={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: 'none' }}
                        formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cost']}
                      />
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
        </div>
      </div>
    </DashboardLayout>
  );
}
