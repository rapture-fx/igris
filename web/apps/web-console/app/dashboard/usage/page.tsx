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

  const handleExportCSV = () => {
    if (!usage) return;

    const exportData = usage.timeline.map((item) => ({
      timestamp: item.timestamp,
      requests: item.requests,
      cost: item.cost,
      latency: item.latency,
    }));

    downloadCSV(exportData, `schlep-usage-${Date.now()}`);
  };

  const handleExportJSON = () => {
    if (!usage) return;
    downloadJSON(usage, `schlep-usage-${Date.now()}`);
  };

  if (isLoading) {
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
            <Button variant="outline" className="shadow-md" onClick={handleExportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" className="shadow-md" onClick={handleExportJSON}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Metrics Summary */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Requests
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(usage?.total_requests || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Across all providers
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Cost
              </CardTitle>
              <DollarSign className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(usage?.total_cost || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                This period
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Avg Latency
              </CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatLatency(usage?.avg_latency || 0)}
              </div>
              <p className="text-xs text-gray-600 mt-1">
                Response time
              </p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-md">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Tokens
              </CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {formatNumber(usage?.total_tokens || 0)}
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
            <Card className="border-border-light shadow-md">
              <CardHeader>
                <CardTitle>Requests & Cost Over Time</CardTitle>
                <CardDescription>Track your usage and spending</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={350}>
                  <LineChart data={usage?.timeline || []}>
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
              <Card className="border-border-light shadow-md">
                <CardHeader>
                  <CardTitle>Cost by Provider</CardTitle>
                  <CardDescription>Spending distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={usage?.by_provider || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.provider}: $${entry.cost.toFixed(2)}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="cost"
                      >
                        {(usage?.by_provider || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Latency by Provider */}
              <Card className="border-border-light shadow-md">
                <CardHeader>
                  <CardTitle>Latency by Provider</CardTitle>
                  <CardDescription>Average response times</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={usage?.by_provider || []}>
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
            <Card className="border-border-light shadow-md">
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
                      {(usage?.by_provider || []).map((provider) => (
                        <tr key={provider.provider} className="border-b border-border-light hover:bg-beige-secondary">
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
                            {formatNumber(provider.tokens)}
                          </td>
                          <td className="text-right py-3 px-4 text-gray-900">
                            {formatLatency(provider.avg_latency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {/* Top Models Table */}
            <Card className="border-border-light shadow-md">
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
                        <tr key={index} className="border-b border-border-light hover:bg-beige-secondary">
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
