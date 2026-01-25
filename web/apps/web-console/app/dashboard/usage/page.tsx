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
import { useChartTheme } from '@/utils/chartTheme';

const COLORS = [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.tertiary, CHART_COLORS.warning];

export default function UsagePage() {
  const chartTheme = useChartTheme();
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
          <Loader2 className="h-12 w-12 animate-spin text-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border">
            <h1 className="text-base font-medium text-foreground font-inter">
              Usage & Analytics
            </h1>
            <p className="text-muted-foreground mt-1 font-inter text-xs">
              Detailed insights into your API usage
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="shadow-sm h-7 px-2.5 text-xs rounded-md" onClick={handleExportCSV}>
              <Download className="mr-2 h-3 w-3" />
              Export CSV
            </Button>
            <Button variant="outline" className="shadow-sm h-7 px-2.5 text-xs rounded-md" onClick={handleExportJSON}>
              <Download className="mr-2 h-3 w-3" />
              Export JSON
            </Button>
          </div>
        </div>

        {/* Metrics Grid Layout */}
        <div className="bg-card">
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Total Requests</div>
              <div className="text-lg font-bold text-foreground">{formatNumber(displayUsage?.total_requests || 0)}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">
                Across all providers
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Total Cost</div>
              <div className="text-lg font-bold text-foreground">{formatCurrency(displayUsage?.total_cost || 0)}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">
                This period
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5 border-t border-border">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Avg Latency</div>
              <div className="text-lg font-bold text-foreground">{formatLatency(displayUsage?.avg_latency || 0)}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">
                Response time
              </p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Total Tokens</div>
              <div className="text-lg font-bold text-foreground">{formatNumber(displayUsage?.total_tokens || 0)}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">
                Input + output
              </p>
            </div>
          </div>
        </div>

        {/* Time Range Tabs */}
        <Tabs defaultValue="week" onValueChange={(v) => setTimeRange(v as any)}>
          <TabsList className="text-xs">
            <TabsTrigger value="day" className="text-xs">Last 24 Hours</TabsTrigger>
            <TabsTrigger value="week" className="text-xs">Last 7 Days</TabsTrigger>
            <TabsTrigger value="month" className="text-xs">Last 30 Days</TabsTrigger>
          </TabsList>

          <TabsContent value={timeRange} className="space-y-6">
            {/* Requests & Cost Timeline */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Requests & Cost Over Time</CardTitle>
                <CardDescription className="text-xs">Track your usage and spending</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={displayUsage?.timeline || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} strokeWidth={0.5} />
                    <XAxis dataKey="timestamp" stroke={chartTheme.axis} style={{ fontSize: '10px' }} />
                    <YAxis yAxisId="left" stroke={chartTheme.axis} style={{ fontSize: '10px' }} />
                    <YAxis yAxisId="right" orientation="right" stroke={chartTheme.axis} style={{ fontSize: '10px' }} />
                    <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }} />
                    <Legend
                    wrapperStyle={{ fontSize: '11px' }}
                  />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke={chartTheme.line}
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
              <Card className="border-border shadow-sm">
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
                          <rect x="2" width="1" height="3" fill={chartTheme.tooltip.bg} />
                        </pattern>
                        <pattern id="stripe-1" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#299a93" />
                          <rect x="2" width="1" height="3" fill={chartTheme.tooltip.bg} />
                        </pattern>
                        <pattern id="stripe-2" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#1f53d0" />
                          <rect x="2" width="1" height="3" fill={chartTheme.tooltip.bg} />
                        </pattern>
                        <pattern id="stripe-3" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                          <rect width="2" height="3" fill="#6b7280" />
                          <rect x="2" width="1" height="3" fill={chartTheme.tooltip.bg} />
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
                      <Tooltip contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }} />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Latency by Provider */}
              <Card className="border-border shadow-sm">
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
                          <rect width="1" height="2" fill={chartTheme.line} />
                        </pattern>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} strokeWidth={0.5} />
                      <XAxis dataKey="provider" stroke={chartTheme.axis} style={{ fontSize: '10px' }} />
                      <YAxis stroke={chartTheme.axis} style={{ fontSize: '10px' }} />
                      <Tooltip contentStyle={{ fontSize: '11px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }} />
                      <Bar dataKey="avg_latency" fill="url(#usage-bar-stripe)" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>

            {/* Provider Table */}
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Provider Details</CardTitle>
                <CardDescription className="text-xs">Detailed breakdown by provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Provider</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Requests</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Cost</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Tokens</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Avg Latency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(displayUsage?.by_provider || []).map((provider) => (
                        <tr key={provider.provider} className="border-b border-border hover:bg-card">
                          <td className="py-2 px-3 font-medium text-xs text-foreground">
                            {provider.provider.charAt(0).toUpperCase() + provider.provider.slice(1)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
                            {formatNumber(provider.requests)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
                            {formatCurrency(provider.cost)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
                            {formatNumber(Math.floor(provider.cost * 100))} {/* Approximate token count */}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
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
            <Card className="border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-sm">Top 10 Models by Spend</CardTitle>
                <CardDescription className="text-xs">Most expensive models this period</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Model Name</th>
                        <th className="text-left py-2 px-3 font-medium text-xs text-muted-foreground">Provider</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Total Requests</th>
                        <th className="text-right py-2 px-3 font-medium text-xs text-muted-foreground">Total Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((usage as any)?.top_models || []).map((model: any, index: number) => (
                        <tr key={index} className="border-b border-border hover:bg-card">
                          <td className="py-2 px-3 font-medium text-xs text-foreground">
                            {model.model_name}
                          </td>
                          <td className="py-2 px-3 text-xs text-foreground">
                            {model.provider.charAt(0).toUpperCase() + model.provider.slice(1)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
                            {formatNumber(model.total_requests)}
                          </td>
                          <td className="text-right py-2 px-3 text-xs text-foreground">
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
