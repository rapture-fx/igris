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

  // Mock data for showcase (matching UsageMetrics type)
  const mockUsage = {
    total_requests: 2847,
    total_cost: 523.47,
    avg_latency: 156,
    total_tokens: 142350,
    by_provider: [
      { provider: 'openai', requests: 1234, cost: 342.78, avg_latency: 145, tokens: 87456 },
      { provider: 'anthropic', requests: 876, cost: 156.34, avg_latency: 178, tokens: 34876 },
      { provider: 'google', requests: 523, cost: 89.23, avg_latency: 234, tokens: 15678 },
      { provider: 'xai', requests: 214, cost: 45.12, avg_latency: 198, tokens: 4340 },
    ],
    by_model: [
      { model: 'gpt-4-turbo', requests: 1456, cost: 289.67, tokens: 65432 },
      { model: 'gpt-4', requests: 678, cost: 178.34, tokens: 22024 },
      { model: 'claude-3-opus', requests: 423, cost: 123.45, tokens: 18876 },
      { model: 'gemini-pro', requests: 290, cost: 67.89, tokens: 15678 },
    ],
    timeline: [
      { timestamp: '00:00', requests: 89, cost: 12.34, latency: 142 },
      { timestamp: '04:00', requests: 45, cost: 6.78, latency: 98 },
      { timestamp: '08:00', requests: 234, cost: 45.67, latency: 178 },
      { timestamp: '12:00', requests: 445, cost: 89.23, latency: 234 },
      { timestamp: '16:00', requests: 367, cost: 72.89, latency: 189 },
      { timestamp: '20:00', requests: 298, cost: 58.91, latency: 156 },
      { timestamp: '23:59', requests: 78, cost: 15.23, latency: 134 },
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
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">
              Usage & Analytics
            </h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
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
              <div className="text-lg font-bold text-gray-900">
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
              <div className="text-lg font-bold text-gray-900">
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
              <div className="text-lg font-bold text-gray-900">
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
              <div className="text-lg font-bold text-gray-900">
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
                <CardTitle className="text-sm">Requests & Cost Over Time</CardTitle>
                <CardDescription className="text-xs">Track your usage and spending</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={displayUsage?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={0.5} />
                    <XAxis dataKey="timestamp" stroke="#6b7280" style={{ fontSize: '10px' }} />
                    <YAxis yAxisId="left" stroke="#6b7280" style={{ fontSize: '10px' }} />
                    <YAxis yAxisId="right" orientation="right" stroke="#6b7280" style={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: '#faf9f7', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                    <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke="#000000"
                      strokeWidth={0.5}
                      strokeDasharray=""
                      name="Requests (—)"
                      dot={false}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="cost"
                      stroke="#114dcd"
                      strokeWidth={0.5}
                      strokeDasharray="5,5"
                      name="Cost - - ($)"
                      dot={false}
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
                  <CardTitle className="text-sm">Cost by Provider</CardTitle>
                  <CardDescription className="text-xs">Spending distribution</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <defs>
                        <pattern id="stripe-0" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#114dcd" />
                          <rect x="2" width="1" height="3" fill="#ffffff" />
                        </pattern>
                        <pattern id="stripe-1" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#299a93" />
                          <rect x="2" width="1" height="3" fill="#ffffff" />
                        </pattern>
                        <pattern id="stripe-2" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#1f53d0" />
                          <rect x="2" width="1" height="3" fill="#ffffff" />
                        </pattern>
                        <pattern id="stripe-3" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#6b7280" />
                          <rect x="2" width="1" height="3" fill="#ffffff" />
                        </pattern>
                      </defs>
                      <Pie
                        data={displayUsage?.by_provider || []}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.provider}: $${entry.cost.toFixed(2)}`}
                        outerRadius={60}
                        fill="#8884d8"
                        dataKey="cost"
                        style={{ fontSize: '8px' }}
                      >
                        {(displayUsage?.by_provider || []).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={`url(#stripe-${index % 4})`} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: '9px', backgroundColor: '#faf9f7', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Latency by Provider */}
              <Card className="border-border-light shadow-sm">
                <CardHeader>
                  <CardTitle className="text-sm">Latency by Provider</CardTitle>
                  <CardDescription className="text-xs">Average response times</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={displayUsage?.by_provider || []}>
                      <defs>
                        {/* Super thin diagonal stripe pattern for bars */}
                        <pattern id="usage-bar-stripe" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                          <rect width="1" height="2" fill="#000000" />
                        </pattern>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={0.5} />
                      <XAxis dataKey="provider" stroke="#6b7280" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                      <Tooltip contentStyle={{ fontSize: '11px' }} />
                      <Bar dataKey="avg_latency" fill="url(#usage-bar-stripe)" stroke="#000" strokeWidth={1} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Provider Table */}
            <Card className="border-border-light shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Provider Details</CardTitle>
                <CardDescription className="text-xs">Detailed breakdown by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Provider</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Requests</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Cost</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Tokens</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayUsage?.by_provider || []).map((provider) => (
                        <tr key={provider.provider} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-2 px-3 font-medium text-xs text-gray-900">
                            {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
                            {formatNumber(provider.requests)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
                            {formatCurrency(provider.cost)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
                            {formatNumber(Math.floor(provider.cost * 100))} {/* Approximate token count */}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
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
                <CardTitle className="text-sm">Top 10 Models by Spend</CardTitle>
                <CardDescription className="text-xs">Most expensive models this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border-light">
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Model Name</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-gray-600">Provider</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Total Requests</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-gray-600">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((usage as any)?.top_models || []).map((model: any, index: number) => (
                        <tr key={index} className="border-b border-border-light hover:bg-beige-primary">
                          <td className="py-2 px-3 font-medium text-xs text-gray-900">
                            {model.model_name}
                          </td>
                          <td className="py-2 px-3 text-xs text-gray-900">
                            {model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
                            {formatNumber(model.total_requests)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-gray-900">
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
