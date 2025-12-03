'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsageSummary } from '@/hooks/useUsage';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency } from '@/utils/helpers';
import { DollarSign, Activity, Zap, TrendingUp, BarChart3, Clock } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

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
  const { data: tenant } = useTenant();

  // Real data from APIs
  const [providerUptime, setProviderUptime] = useState<Array<{provider: string, uptime: string, status: string}>>([]);
  const [requestsData, setRequestsData] = useState<Array<{time: string, requests: number}>>([]);
  const [latencyData, setLatencyData] = useState<Array<{time: string, latency: number}>>([]);
  const [providerCostData, setProviderCostData] = useState<Array<{provider: string, cost: number}>>([]);

  // Fetch dashboard metrics from backend
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!tenant?.tenant_id) return;

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const authHeaders = {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        };

        // Fetch uptime
        const uptimeRes = await fetch(`${apiUrl}/internal/metrics/uptime`, { headers: authHeaders });
        if (uptimeRes.ok) {
          const data = await uptimeRes.json();
          if (data.providers) setProviderUptime(data.providers);
        }

        // Fetch requests timeline
        const requestsRes = await fetch(`${apiUrl}/v1/usage/requests-timeline`, { headers: authHeaders });
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          if (data.timeline) setRequestsData(data.timeline);
        }

        // Fetch latency data
        const latencyRes = await fetch(`${apiUrl}/v1/usage/latency-timeline`, { headers: authHeaders });
        if (latencyRes.ok) {
          const data = await latencyRes.json();
          if (data.timeline) setLatencyData(data.timeline);
        }

        // Fetch provider costs
        const costsRes = await fetch(`${apiUrl}/v1/usage/provider-costs`, { headers: authHeaders });
        if (costsRes.ok) {
          const data = await costsRes.json();
          if (data.providers) setProviderCostData(data.providers);
        }
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
      }
    };

    fetchMetrics();
    // Refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [tenant?.tenant_id]);

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
            trend={summary?.requests_trend}
          />
          <MetricCard
            title="Spend This Month"
            value={formatCurrency(summary?.monthly_spend || 0)}
            description="Current billing period"
            icon={DollarSign}
            trend={summary?.spend_trend}
          />
          <MetricCard
            title="Avg Latency"
            value={formatLatency(summary?.avg_latency || 0)}
            description="P50 response time"
            icon={Zap}
            trend={summary?.latency_trend}
          />
          <MetricCard
            title="Active Providers"
            value={String(providerUptime.length || 0)}
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
                {providerUptime.map((item, i) => (
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
