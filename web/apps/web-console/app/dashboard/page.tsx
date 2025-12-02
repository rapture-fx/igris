'use client';

export const dynamic = 'force-dynamic';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsageSummary } from '@/hooks/useUsage';
import { formatCurrency, formatNumber, formatLatency } from '@/utils/helpers';
import { DollarSign, Activity, Zap, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

// Mock data for charts (replace with real data from API)
const requestsData = [
  { time: '00:00', requests: 120 },
  { time: '04:00', requests: 80 },
  { time: '08:00', requests: 200 },
  { time: '12:00', requests: 350 },
  { time: '16:00', requests: 280 },
  { time: '20:00', requests: 150 },
];

const providerCostData = [
  { provider: 'OpenAI', cost: 45.20 },
  { provider: 'Anthropic', cost: 32.50 },
  { provider: 'Google', cost: 18.30 },
  { provider: 'Cohere', cost: 12.00 },
  { provider: 'xAI', cost: 8.50 },
  { provider: 'Mistral', cost: 6.20 },
  { provider: 'Together', cost: 4.80 },
  { provider: 'Replicate', cost: 3.10 },
];

const latencyData = [
  { time: '00:00', latency: 120 },
  { time: '04:00', latency: 95 },
  { time: '08:00', latency: 110 },
  { time: '12:00', latency: 130 },
  { time: '16:00', latency: 105 },
  { time: '20:00', latency: 90 },
];

function MetricCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string;
  description: string;
  icon: any;
  trend?: string;
}) {
  return (
    <Card className="border-border-light shadow-md hover:shadow-lg transition-shadow">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-gray-600">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-gray-900" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-gray-900">{value}</div>
        <p className="text-xs text-gray-600 mt-1">
          {description}
          {trend && (
            <span className="ml-2 text-green-600 font-medium">
              {trend}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useUsageSummary();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-medium text-gray-900 font-inter">
            Welcome back
          </h1>
          <p className="text-gray-600 mt-1 font-inter">
            Overview of your AI infrastructure
          </p>
        </div>

        {/* Four Big Live Metrics with Trends & Mini Sparklines */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Requests Today"
            value={formatNumber(summary?.total_requests || 0)}
            description="Last 24 hours"
            icon={Activity}
            trend="+12.5%"
          />
          <MetricCard
            title="Spend This Month"
            value={formatCurrency(summary?.monthly_spend || 0)}
            description="Current billing period"
            icon={DollarSign}
            trend="+8.3%"
          />
          <MetricCard
            title="Avg Latency"
            value={formatLatency(summary?.avg_latency || 0)}
            description="P50 response time"
            icon={Zap}
            trend="-5.2%"
          />
          <MetricCard
            title="Active Providers"
            value={summary?.active_providers || '3'}
            description="Currently configured"
            icon={TrendingUp}
          />
        </div>

        {/* Two Mini Charts: Requests/Cost last 7 days + Latency P95 last 24h */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-900" />
                Requests & Cost
              </CardTitle>
              <CardDescription>Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#f8f6f3',
                      border: '1px solid #e5e1d8',
                      borderRadius: '6px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#000000"
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 3, fill: "#000000" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-900" />
                Latency P95
              </CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#f8f6f3',
                      border: '1px solid #e5e1d8',
                      borderRadius: '6px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#000000"
                    fill="#000000"
                    fillOpacity={0.1}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Top 5 Models by Spend and Provider Reliability */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-900" />
                Top Models by Spend
              </CardTitle>
              <CardDescription>This month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {providerCostData.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-beige-primary">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-900">{i + 1}.</span>
                      <span className="text-sm text-gray-900">{item.provider}</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{formatCurrency(item.cost)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle>Provider Reliability</CardTitle>
              <CardDescription>Last 7 days uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { provider: 'OpenAI', uptime: '99.8%', status: 'success' },
                  { provider: 'Anthropic', uptime: '99.9%', status: 'success' },
                  { provider: 'Google', uptime: '98.2%', status: 'warning' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border-light">
                    <span className="text-sm font-medium text-gray-900">{item.provider}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">{item.uptime}</span>
                      <div className={`w-2 h-2 rounded-full ${
                        item.status === 'success' ? 'bg-green-500' : 'bg-yellow-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
