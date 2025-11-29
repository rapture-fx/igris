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
            Dashboard
          </h1>
          <p className="text-gray-600 mt-1 font-inter">
            Overview of your AI inference infrastructure
          </p>
        </div>

        {/* Metrics Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Monthly Spend"
            value={formatCurrency(summary?.monthly_spend || 0)}
            description="Current billing period"
            icon={DollarSign}
            trend="+12.5%"
          />
          <MetricCard
            title="Total Requests"
            value={formatNumber(summary?.total_requests || 0)}
            description="This month"
            icon={Activity}
            trend="+23.1%"
          />
          <MetricCard
            title="Avg Latency"
            value={formatLatency(summary?.avg_latency || 0)}
            description="Response time"
            icon={Zap}
            trend="-5.2%"
          />
          <MetricCard
            title="Budget Utilization"
            value={`${summary?.budget_utilization || 0}%`}
            description="Of monthly budget"
            icon={TrendingUp}
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Requests Over Time */}
          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-gray-900" />
                Requests Over Time
              </CardTitle>
              <CardDescription>Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke={CHART_COLORS.primary}
                    strokeWidth={2}
                    dot={{ fill: CHART_COLORS.primary }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Cost by Provider */}
          <Card className="border-border-light shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-gray-900" />
                Cost by Provider
              </CardTitle>
              <CardDescription>This month</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={providerCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="provider" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Bar dataKey="cost" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Latency Distribution */}
          <Card className="border-border-light shadow-md md:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-gray-900" />
                Latency Distribution
              </CardTitle>
              <CardDescription>Average response time over last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="time" stroke="#6b7280" />
                  <YAxis stroke="#6b7280" />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke={CHART_COLORS.secondary}
                    fill={CHART_COLORS.secondary}
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Activity Feed */}
        <Card className="border-border-light shadow-md">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest events and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { event: 'API key added for OpenAI', time: '2 minutes ago', status: 'success' },
                { event: 'Policy updated: Max monthly cost set to $500', time: '1 hour ago', status: 'info' },
                { event: 'High latency detected on Anthropic endpoint', time: '3 hours ago', status: 'warning' },
                { event: 'Monthly usage report generated', time: '1 day ago', status: 'success' },
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-4 p-3 rounded-lg bg-beige-secondary">
                  <div className={`w-2 h-2 rounded-full ${
                    activity.status === 'success' ? 'bg-green-500' :
                    activity.status === 'warning' ? 'bg-yellow-500' : 'bg-blue-500'
                  }`} />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.event}</p>
                    <p className="text-xs text-gray-600">{activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
