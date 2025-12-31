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
import {
  useShadowStatus,
  useShadowConfig,
  useShadowAnalytics,
  useShadowLogs,
  useUpdateShadowConfig,
  useStartShadow,
  useStopShadow,
  usePromoteShadow,
} from '@/hooks/useShadow';
import { Shield, Play, Square, CheckCircle, XCircle, TrendingUp, DollarSign, Zap, ArrowUpCircle, Trash2 } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

export default function OvertureShadowPage() {
  const { data: status } = useShadowStatus();
  const { data: config } = useShadowConfig();
  const { data: analytics } = useShadowAnalytics();
  const { data: logs } = useShadowLogs(10);

  const updateConfigMutation = useUpdateShadowConfig();
  const startMutation = useStartShadow();
  const stopMutation = useStopShadow();
  const promoteMutation = usePromoteShadow();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    shadow_percent: config?.shadow_percent ?? 10,
    primary_provider: config?.primary_provider ?? 'OpenAI',
    shadow_provider: config?.shadow_provider ?? 'Anthropic',
    quality_threshold: config?.quality_threshold ?? 85,
    auto_promote: config?.auto_promote ?? false,
    auto_promote_threshold: config?.auto_promote_threshold ?? 95,
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

  const handleToggle = async () => {
    try {
      if (status?.enabled) {
        await stopMutation.mutateAsync();
        alert('Shadow Mode stopped');
      } else {
        await startMutation.mutateAsync();
        alert('Shadow Mode started');
      }
    } catch (error) {
      alert('Error toggling Shadow Mode');
    }
  };

  const handlePromote = async () => {
    if (!confirm('Promote shadow provider to primary? This will swap providers.')) return;
    try {
      await promoteMutation.mutateAsync();
      alert('Shadow provider promoted successfully');
    } catch (error) {
      alert('Error promoting shadow provider');
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">Shadow Mode</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Compare provider responses in real-time without affecting production
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs px-2 py-1 shadow-sm"
              onClick={handleToggle}
              disabled={startMutation.isPending || stopMutation.isPending}
            >
              {status?.enabled ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
              {status?.enabled ? 'Stop' : 'Start'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs px-2 py-1 shadow-sm"
              onClick={handlePromote}
              disabled={promoteMutation.isPending || !status?.enabled}
            >
              <ArrowUpCircle className="h-3 w-3" />
              Promote
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Status</CardTitle>
              <Shield className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <Badge className="bg-gray-50 text-gray-700 border">
                {status?.enabled ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                {status?.enabled ? 'Active' : 'Inactive'}
              </Badge>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Shadow Traffic</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{status?.shadow_traffic_percent}%</div>
              <p className="text-xs text-gray-600 mt-1">of requests shadowed</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Requests (24h)</CardTitle>
              <Zap className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{status?.requests_24h.toLocaleString()}</div>
              <p className="text-xs text-gray-600 mt-1">shadowed today</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Quality Delta</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{status?.quality_delta}%</div>
              <p className="text-xs text-gray-600 mt-1">{status?.discrepancies_found} discrepancies</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Form */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription className="text-xs">Shadow mode settings and provider selection</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-gray-900">Enable Shadow Mode</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.65rem] text-gray-600">Activate shadow traffic</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shadow_percent" className="text-xs font-medium text-gray-900">Shadow Traffic %</Label>
                  <Input
                    id="shadow_percent"
                    type="number"
                    value={editableConfig.shadow_percent}
                    onChange={(e) => handleConfigChange('shadow_percent', parseInt(e.target.value))}
                    className="text-xs"
                    min="0"
                    max="100"
                  />
                  <p className="text-[0.65rem] text-gray-600">Percentage of traffic to shadow</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="primary_provider" className="text-xs font-medium text-gray-900">Primary Provider</Label>
                  <Input
                    id="primary_provider"
                    value={editableConfig.primary_provider}
                    onChange={(e) => handleConfigChange('primary_provider', e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">Current production provider</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="shadow_provider" className="text-xs font-medium text-gray-900">Shadow Provider</Label>
                  <Input
                    id="shadow_provider"
                    value={editableConfig.shadow_provider}
                    onChange={(e) => handleConfigChange('shadow_provider', e.target.value)}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">Candidate provider to test</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality_threshold" className="text-xs font-medium text-gray-900">Quality Threshold (%)</Label>
                  <Input
                    id="quality_threshold"
                    type="number"
                    value={editableConfig.quality_threshold}
                    onChange={(e) => handleConfigChange('quality_threshold', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">Minimum quality score</p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto_promote" className="text-xs font-medium text-gray-900">Auto-Promote</Label>
                    <Switch
                      id="auto_promote"
                      checked={editableConfig.auto_promote}
                      onCheckedChange={(checked) => handleConfigChange('auto_promote', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.65rem] text-gray-600">Auto-promote if threshold met</p>
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

        {/* Performance Comparison Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Latency Comparison</CardTitle>
              <CardDescription className="text-xs">Primary vs Shadow latency (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.latency_comparison || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 8 }} tickFormatter={(value) => new Date(value).getHours() + ':00'} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip contentStyle={{ fontSize: '9px', backgroundColor: '#faf9f7', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                  <Line type="monotone" dataKey="primary_latency" stroke="#000000" strokeWidth={0.5} name="Primary" dot={false} />
                  <Line type="monotone" dataKey="shadow_latency" stroke="#114dcd" strokeWidth={0.5} strokeDasharray="5,5" name="Shadow" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Quality Comparison</CardTitle>
              <CardDescription className="text-xs">Quality scores over time (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.quality_comparison || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 8 }} tickFormatter={(value) => new Date(value).getHours() + ':00'} />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip 
                    contentStyle={{ fontSize: '9px', backgroundColor: '#faf9f7', borderRadius: '6px', border: '1px solid #e5e7eb' }}
                    formatter={(value: any) => typeof value === 'number' ? value.toFixed(1) : value}
                  />
                  <Line type="monotone" dataKey="primary_quality" stroke="#000000" strokeWidth={0.5} name="Primary" dot={false} />
                  <Line type="monotone" dataKey="shadow_quality" stroke="#114dcd" strokeWidth={0.5} strokeDasharray="5,5" name="Shadow" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Shadow Request Logs */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Recent Shadow Requests</CardTitle>
            <CardDescription className="text-xs">Latest comparisons between primary and shadow</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Request ID</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Primary</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Shadow</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Latency Δ</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Match</th>
                  </tr>
                </thead>
                <tbody>
                  {logs?.map((log, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-beige-secondary">
                      <td className="py-2 px-3 text-gray-900 font-mono">{log.request_id.slice(0, 12)}</td>
                      <td className="py-2 px-3 text-gray-900">{log.primary_provider} ({log.primary_latency}ms)</td>
                      <td className="py-2 px-3 text-gray-900">{log.shadow_provider} ({log.shadow_latency}ms)</td>
                      <td className="py-2 px-3 text-gray-900">{log.shadow_latency - log.primary_latency}ms</td>
                      <td className="py-2 px-3">
                        <Badge className={log.quality_match ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}>
                          {log.quality_match ? 'Match' : 'Mismatch'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* How Shadow Mode Works */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How Shadow Mode Works</CardTitle>
            <CardDescription className="text-xs">Real-time A/B testing without affecting production</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-beige-primary border border-border-light rounded-lg p-4">
              <ul className="text-xs text-gray-800 space-y-1 list-disc list-inside">
                <li>Duplicate requests sent to shadow provider in parallel</li>
                <li>Primary responses returned to users immediately (zero production impact)</li>
                <li>Shadow responses collected and compared for latency, cost, and quality</li>
                <li>Discrepancies logged and analyzed for provider evaluation</li>
                <li>Auto-promote feature can switch providers based on performance</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
