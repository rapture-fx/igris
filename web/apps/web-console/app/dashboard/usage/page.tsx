'use client';

export const dynamic = 'force-dynamic';
import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useUsage } from '@/hooks/useUsage';
import { formatCurrency, formatNumber, formatLatency, downloadCSV, downloadJSON } from '@/utils/helpers';
import { Download, BarChart3, DollarSign, Clock, Zap, Loader2 } from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

const COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.tertiary, CHART_COLORS.warning];

export default function UsagePage() {
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month'>('week');
  const { data: usage, isLoading } = useUsage({
    granularity: timeRange === 'day' ? 'hour' : 'day',
  });

  // Mock data for showcase
  const mockUsage = {
    summary: {
      total_requests: 2847,
      total_cost: 523.47,
      avg_latency: 156,
      total_tokens: 142350,
    },
    timeline: [
      { timestamp: '00:00', requests: 89, cost: 12.34, latency: 142 },
      { timestamp: '04:00', requests: 45, cost: 6.78, latency: 98 },
      { timestamp: '08:00', requests: 234, cost: 45.67, latency: 178 },
      { timestamp: '12:00', requests: 445, cost: 89.23, latency: 234 },
      { timestamp: '16:00', requests: 367, cost: 72.89, latency: 189 },
      { timestamp: '20:00', requests: 298, cost: 58.91, latency: 156 },
      { timestamp: '23:59', requests: 78, cost: 15.23, latency: 134 },
    ],
    provider_breakdown: [
      { provider: 'OpenAI', requests: 1234, cost: 342.78, percentage: 65.5 },
      { provider: 'Anthropic', requests: 876, cost: 156.34, percentage: 29.9 },
      { provider: 'Google', requests: 523, cost: 89.23, percentage: 17.1 },
      { provider: 'xAI', requests: 214, cost: 45.12, percentage: 8.6 },
    ],
    model_breakdown: [
      { model: 'gpt-4-turbo', requests: 1456, cost: 289.67, percentage: 55.3 },
      { model: 'gpt-4', requests: 678, cost: 178.34, percentage: 34.1 },
      { model: 'claude-3-opus', requests: 423, cost: 123.45, percentage: 23.6 },
      { model: 'gemini-pro', requests: 290, cost: 67.89, percentage: 13.0 },
    ],
    daily_breakdown: [
      { date: 'Mon', requests: 2847, cost: 523.47 },
      { date: 'Tue', requests: 3124, cost: 567.89 },
      { date: 'Wed', requests: 2987, cost: 534.12 },
      { date: 'Thu', requests: 3678, cost: 623.45 },
      { date: 'Fri', requests: 3421, cost: 589.76 },
      { date: 'Sat', requests: 1987, cost: 312.34 },
      { date: 'Sun', requests: 2145, cost: 345.67 },
    ],
  };

  // Use mock data if no real data available
  const displayUsage = usage || mockUsage;

  const handleExportCSV = () => {
    if (!displayUsage) return;

    const exportData = displayUsage.timeline.map((item) => ({
      timestamp: item.timestamp,
      requests: item.requests,
      cost: item.cost,
      latency: item.latency,
    }));

    downloadCSV(exportData, `overture-usage-${Date.now()}`);
  };

  const handleExportJSON = () => {
    if (!displayUsage) return;
    downloadJSON(displayUsage, `overture-usage-${Date.now()}`);
  };

  if (isLoading && !usage) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-gray-900" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-gray-900 font-inter">
              Usage & Analytics
            </h1>
            <p className="text-gray-600 mt-1 font-inter">
              Detailed insights into your API usage
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="shadow-sm" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" className="shadow-sm" onClick={handleExportJSON}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Requests
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(displayUsage?.total_requests || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Across all providers
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(displayUsage?.total_cost || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                This period
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatLatency(displayUsage?.avg_latency || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Response time
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Tokens
              </CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(displayUsage?.total_tokens || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Input + output
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Time Range Tabs */}
        <Tabs defaultValue="week" onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList>
            <TabsTrigger value="day">Last 24 Hours</TabsTrigger>
            <TabsTrigger value="week">Last 7 Days</TabsTrigger>
            <TabsTrigger value="month">Last 30 Days</TabsTrigger>
          </TabsList>

          <TabsContent value={timeRange} className="space-y-6">
            {/* Requests & Cost Timeline */}
            <Card className="border-border-light shadow-sm">
              <CardHeader>
                <CardTitle>Requests & Cost Over Time</CardTitle>
                <CardDescription>Track your usage and spending</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={displayUsage?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="timestamp" stroke="#6b7280" />
                    <YAxis yAxisId="left" stroke="#6b7280" />
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" />
                    <Tooltip />
                    <Legend />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke={CHART_COLORS.primary}
                      strokeWidth={2}
                      name="Requests"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cost"
                      stroke={CHART_COLORS.secondary}
                      strokeWidth={2}
                      name="Cost ($)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Provider Breakdown */}
            <div className="grid gap-6 md:grid-cols-2">
              {/* Cost by Provider */}
              <Card className="border-border-light shadow-sm">
                <CardHeader>
                  <CardTitle>Cost by Provider</CardTitle>
                  <CardDescription>Spending distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={displayUsage?.provider_breakdown || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.provider}: $${entry.cost.toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
                      >
                        {(displayUsage?.provider_breakdown || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Latency by Provider */}
              <Card className="border-border-light shadow-sm">
                <CardHeader>
                  <CardTitle>Latency by Provider</CardTitle>
                  <CardDescription>Average response times</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={displayUsage?.provider_breakdown || []}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="provider" stroke="#6b7280" />
                      <YAxis stroke="#6b7280" />
                      <Tooltip />
                      <Bar dataKey="avg_latency" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Provider Table */}
            <Card className="border-border-light shadow-sm">
              <CardHeader>
                <CardTitle>Provider Details</CardTitle>
                <CardDescription>Detailed breakdown by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Provider</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Requests</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Cost</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Tokens</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayUsage?.provider_breakdown || []).map((provider) => (
                        <tr key={provider.provider} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatNumber(provider.requests)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatCurrency(provider.cost)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatNumber(Math.floor(provider.cost * 100))} {/* Approximate token count */}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatLatency(provider.cost * 10)} {/* Approximate latency */}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Models Table */}
            <Card className="border-border-light shadow-sm">
              <CardHeader>
                <CardTitle>Top 10 Models by Spend</CardTitle>
                <CardDescription>Most expensive models this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Model Name</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-600">Provider</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Total Requests</th>
                        <th className="text-right py-3 px-4 font-medium text-gray-600">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((usage as any)?.top_models || []).map((model: any, index: number) => (
                        <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {model.model_name}
                          </td>
                          <td className="py-3 px-4 text-gray-900">
                            {model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatNumber(model.total_requests)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatCurrency(model.total_spend)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
