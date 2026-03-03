'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { api } from '@/lib/apiClient';
import { RefreshCw } from 'lucide-react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

interface MetricsData {
  timestamps: string[];
  latency_p50: number[];
  latency_p95: number[];
  latency_p99: number[];
  throughput: number[];
  error_rate: number[];
  cpu_percent: number[];
  memory_mb: number[];
}

type TimeRange = '1h' | '6h' | '24h' | '7d';

const TIME_OPTIONS: { label: string; value: TimeRange }[] = [
  { label: '1 hour', value: '1h' },
  { label: '6 hours', value: '6h' },
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
];

function toChartSeries(timestamps: string[], values: number[], key: string) {
  return (timestamps ?? []).map((t, i) => ({
    time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    [key]: values?.[i] ?? 0,
  }));
}

function MetricChart({
  title, data, children, loading,
}: {
  title: string;
  data: any[];
  children: React.ReactNode;
  loading: boolean;
}) {
  return (
    <Card className="border border-gray-200">
      <CardHeader className="px-4 pt-4 pb-3">
        <CardTitle className="text-sm font-medium text-gray-900">{title}</CardTitle>
      </CardHeader>
      <Separator />
      <CardContent className="px-4 pt-3 pb-4">
        {loading ? (
          <Skeleton className="h-36 w-full" />
        ) : (
          <ResponsiveContainer width="100%" height={144}>
            {children as any}
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

const CHART_TOOLTIP_STYLE = {
  contentStyle: { fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, boxShadow: 'none' },
  itemStyle: { color: '#374151' },
};

export default function HistoryMetricsPage() {
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');

  const { data: metrics, isLoading, refetch } = useQuery<MetricsData>({
    queryKey: ['history-metrics', timeRange],
    queryFn: () => api.get(`/v1/history/metrics?range=${timeRange}`),
    retry: false,
  });

  const ts = metrics?.timestamps ?? [];

  const latencyData = ts.map((t, i) => ({
    time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    p50: metrics?.latency_p50?.[i] ?? 0,
    p95: metrics?.latency_p95?.[i] ?? 0,
    p99: metrics?.latency_p99?.[i] ?? 0,
  }));

  const throughputData = toChartSeries(ts, metrics?.throughput ?? [], 'req/s');
  const errorData = toChartSeries(ts, metrics?.error_rate ?? [], 'error%');
  const cpuData = ts.map((t, i) => ({
    time: new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    cpu: metrics?.cpu_percent?.[i] ?? 0,
    memory: Math.round((metrics?.memory_mb?.[i] ?? 0) / 10) / 100,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Metrics</h1>
            <p className="text-xs text-gray-500 mt-0.5">Performance and system metrics.</p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={timeRange} onValueChange={(v) => setTimeRange(v as TimeRange)}>
              <SelectTrigger className="h-8 w-28 text-xs">
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

        {/* 2x2 Chart Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* Latency */}
          <MetricChart title="Latency (ms)" data={latencyData} loading={isLoading}>
            <LineChart data={latencyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="p50" stroke="#3b82f6" strokeWidth={1.5} dot={false} name="p50" />
              <Line type="monotone" dataKey="p95" stroke="#f59e0b" strokeWidth={1.5} dot={false} name="p95" />
              <Line type="monotone" dataKey="p99" stroke="#ef4444" strokeWidth={1.5} dot={false} name="p99" />
            </LineChart>
          </MetricChart>

          {/* Throughput */}
          <MetricChart title="Throughput (req/s)" data={throughputData} loading={isLoading}>
            <AreaChart data={throughputData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="tpFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="req/s" stroke="#10b981" strokeWidth={1.5} fill="url(#tpFill)" dot={false} />
            </AreaChart>
          </MetricChart>

          {/* Error Rate */}
          <MetricChart title="Error Rate (%)" data={errorData} loading={isLoading}>
            <AreaChart data={errorData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="errFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Area type="monotone" dataKey="error%" stroke="#ef4444" strokeWidth={1.5} fill="url(#errFill)" dot={false} />
            </AreaChart>
          </MetricChart>

          {/* Resource Usage */}
          <MetricChart title="Resource Usage" data={cpuData} loading={isLoading}>
            <LineChart data={cpuData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
              <Tooltip {...CHART_TOOLTIP_STYLE} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="cpu" stroke="#8b5cf6" strokeWidth={1.5} dot={false} name="CPU %" />
              <Line type="monotone" dataKey="memory" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="Mem GB" />
            </LineChart>
          </MetricChart>
        </div>
      </div>
    </DashboardLayout>
  );
}
