'use client';

export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useChartTheme } from '@/utils/chartTheme';
import {
  useSpeculativeStatus,
  useSpeculativeConfig,
  useSpeculativeAnalytics,
  useSpeculativeRaces,
  useUpdateSpeculativeConfig,
  useForceSimulation,
} from '@/hooks/useSpeculative';
import { Zap, CheckCircle, XCircle, TrendingUp, DollarSign, Clock, Target, PlayCircle } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

const PIE_COLORS = ['#114dcd', '#299a93', '#1f53d0', '#6b7280'];

const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, provider, win_rate }: any) => {
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 20;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      fill="#374151"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: '8px', fontFamily: 'Inter, sans-serif' }}
    >
      {`${provider}: ${win_rate.toFixed(1)}%`}
    </text>
  );
};

export default function SpeculativeRouterPage() {
  const chartTheme = useChartTheme();
  const { data: status } = useSpeculativeStatus();
  const { data: config } = useSpeculativeConfig();
  const { data: analytics } = useSpeculativeAnalytics();
  const { data: races } = useSpeculativeRaces(10);

  const updateConfigMutation = useUpdateSpeculativeConfig();
  const simulateMutation = useForceSimulation();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    max_parallel_providers: config?.max_parallel_providers ?? 3,
    timeout_ms: config?.timeout_ms ?? 2000,
    first_token_threshold_ms: config?.first_token_threshold_ms ?? 500,
  });

  const [configChanged, setConfigChanged] = useState(false);

  const handleConfigChange = (field: string, value: any) => {
    setEditableConfig(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editableConfig as any);
      alert('Configuration saved successfully');
      setConfigChanged(false);
    } catch (error) {
      alert('Error saving configuration');
    }
  };

  const handleSimulate = async () => {
    try {
      await simulateMutation.mutateAsync();
      alert('Simulation race initiated');
    } catch (error) {
      alert('Error running simulation');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border">
            <h1 className="text-base font-medium text-foreground font-inter">Speculative Router</h1>
            <p className="text-muted-foreground mt-1 font-inter text-xs">
              Race multiple providers in parallel, use fastest response
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-1 text-xs px-2 py-1 shadow-sm"
            onClick={handleSimulate}
            disabled={simulateMutation.isPending}
          >
            <PlayCircle className="h-3 w-3" />
            Simulate Race
          </Button>
        </div>

        {/* Overview Cards */}
        <div className="bg-card">
          <div className="grid grid-cols-2 divide-x divide-border-light">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Status</div>
              <div className="pb-2">
                <Badge className="bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5">
                  {status?.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                  {status?.enabled ? 'Enabled' : 'Disabled'}
                </Badge>
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Success Rate</div>
              <div className="text-lg font-bold text-foreground">{status?.success_rate.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">{status?.races_24h.toLocaleString()} races today</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-border-light border-t border-border">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Latency Gain</div>
              <div className="text-lg font-bold text-foreground">{status?.latency_improvement_ms}ms</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">average improvement</p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Cost Delta</div>
              <div className="text-lg font-bold text-foreground">+{status?.cost_delta_percent.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">extra provider calls</p>
            </div>
          </div>
        </div>

        {/* Configuration Form */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription className="text-xs">Speculative routing settings and thresholds</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-foreground">Enable Speculative Router</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground">Race providers in parallel</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max_parallel" className="text-xs font-medium text-foreground">Max Parallel Providers</Label>
                  <Input
                    id="max_parallel"
                    type="number"
                    value={editableConfig.max_parallel_providers}
                    onChange={(e) => handleConfigChange('max_parallel_providers', parseInt(e.target.value))}
                    className="text-xs"
                    min="2"
                    max="5"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">Providers to race simultaneously</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="timeout" className="text-xs font-medium text-foreground">Timeout (ms)</Label>
                  <Input
                    id="timeout"
                    type="number"
                    value={editableConfig.timeout_ms}
                    onChange={(e) => handleConfigChange('timeout_ms', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">Maximum race duration</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="first_token" className="text-xs font-medium text-foreground">First Token Threshold (ms)</Label>
                  <Input
                    id="first_token"
                    type="number"
                    value={editableConfig.first_token_threshold_ms}
                    onChange={(e) => handleConfigChange('first_token_threshold_ms', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">Winner selection cutoff</p>
                </div>
              </div>

              {configChanged && (
                <Button
                  onClick={handleSaveConfig}
                  disabled={updateConfigMutation.isPending}
                  variant="outline"
                  className="text-xs shadow-sm"
                  size="sm"
                >
                  {updateConfigMutation.isPending ? 'Saving...' : 'Save Configuration'}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Performance Metrics */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Race Win Rate by Provider</CardTitle>
              <CardDescription className="text-xs">Which providers win most races</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <defs>
                    <pattern id="pieStripe0" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                      <rect width="2" height="3" fill="#114dcd" />
                      <rect x="2" width="1" height="3" fill="#ffffff" />
                    </pattern>
                    <pattern id="pieStripe1" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                      <rect width="2" height="3" fill="#299a93" />
                      <rect x="2" width="1" height="3" fill="#ffffff" />
                    </pattern>
                    <pattern id="pieStripe2" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                      <rect width="2" height="3" fill="#1f53d0" />
                      <rect x="2" width="1" height="3" fill="#ffffff" />
                    </pattern>
                    <pattern id="pieStripe3" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                      <rect width="2" height="3" fill="#6b7280" />
                      <rect x="2" width="1" height="3" fill="#ffffff" />
                    </pattern>
                  </defs>
                  <Pie
                    data={analytics?.race_win_rate || []}
                    dataKey="wins"
                    nameKey="provider"
                    cx="50%"
                    cy="50%"
                    outerRadius={60}
                    label={renderCustomLabel}
                    labelLine={false}
                  >
                    {analytics?.race_win_rate.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#pieStripe${index % PIE_COLORS.length})`} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Latency Distribution</CardTitle>
              <CardDescription className="text-xs">Response time histogram</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={analytics?.latency_distribution || []}>
                  <defs>
                    <pattern id="diagStripes" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                      <rect width="1" height="3" fill="#000000" />
                      <rect x="1" width="2" height="3" fill="#e5e7eb" />
                    </pattern>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis dataKey="bucket" tick={{ fontSize: 8 }} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }} />
                  <Bar dataKey="count" fill="url(#diagStripes)" name="Requests" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Cost Savings Trend</CardTitle>
            <CardDescription className="text-xs">Savings from faster completions (24h)</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={analytics?.cost_savings_timeline || []}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="timestamp" tick={{ fontSize: 8 }} tickFormatter={(value) => new Date(value).getHours() + ':00'} />
                <YAxis tick={{ fontSize: 8 }} />
                <Tooltip
                  contentStyle={{ fontSize: '9px', backgroundColor: chartTheme.tooltip.bg, borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, color: chartTheme.tooltip.text }}
                  formatter={(value: any) => `$${value.toFixed(2)}`}
                />
                <Line type="monotone" dataKey="cumulative_savings" stroke={chartTheme.line} strokeWidth={0.5} name="Cumulative Savings" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Recent Races Table */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Recent Races</CardTitle>
            <CardDescription className="text-xs">Latest provider races and outcomes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Request ID</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Winner</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Participants</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Latency Gain</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Cost Saving</th>
                  </tr>
                </thead>
                <tbody>
                  {races?.map((race, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-muted">
                      <td className="py-2 px-3 text-foreground font-mono">{race.request_id.slice(0, 12)}</td>
                      <td className="py-2 px-3">
                        <Badge className="bg-green-50 text-green-700 border border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-900">
                          {race.winner}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">{race.participants.join(', ')}</td>
                      <td className="py-2 px-3 text-foreground">{race.latency_gain_ms}ms</td>
                      <td className="py-2 px-3 text-foreground">${race.cost_saving_usd.toFixed(3)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* How Speculative Router Works */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How Speculative Router Works</CardTitle>
            <CardDescription className="text-xs">Parallel provider racing for optimal latency</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-card border border-border rounded-lg p-4">
              <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
                <li>Simultaneously sends requests to multiple providers in parallel</li>
                <li>Uses response from fastest provider (first to return first token)</li>
                <li>Cancels slower providers once winner is selected</li>
                <li>Reduces time-to-first-token by up to 60%</li>
                <li>Costs ~8% more due to redundant calls (losers are cancelled early)</li>
                <li>Ideal for latency-sensitive applications and user-facing features</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
