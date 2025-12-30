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
  useEscapeVectorStatus,
  useEscapeVectorConfig,
  useEscapeVectorHistory,
  useEscapeVectorAnalytics,
  useUpdateEscapeVectorConfig,
  useRefreshEscapeVectorCache,
  useClearEscapeVectorCache,
} from '@/hooks/useEscapeVector';
import { Shield, RefreshCw, Trash2, Clock, TrendingUp, Database, Zap, CheckCircle, XCircle, AlertTriangle, DollarSign, Activity } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';

// Helper function to format relative time
function formatDistanceToNow(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins} minutes ago`;
  if (diffHours < 24) return `${diffHours} hours ago`;
  return `${diffDays} days ago`;
}

export default function EscapeVectorPage() {
  const { data: status, isLoading: statusLoading } = useEscapeVectorStatus();
  const { data: config, isLoading: configLoading } = useEscapeVectorConfig();
  const { data: history, isLoading: historyLoading } = useEscapeVectorHistory();
  const { data: analytics, isLoading: analyticsLoading } = useEscapeVectorAnalytics();

  const updateConfigMutation = useUpdateEscapeVectorConfig();
  const refreshCacheMutation = useRefreshEscapeVectorCache();
  const clearCacheMutation = useClearEscapeVectorCache();

  const [editableConfig, setEditableConfig] = useState({
    enabled: config?.enabled ?? true,
    cache_ttl_hours: config?.cache_ttl_hours ?? 72,
    min_quality_threshold: config?.min_quality_threshold ?? 85,
    refresh_interval_hours: config?.refresh_interval_hours ?? 24,
  });

  const [configChanged, setConfigChanged] = useState(false);

  const handleConfigChange = (field: string, value: any) => {
    setEditableConfig(prev => ({ ...prev, [field]: value }));
    setConfigChanged(true);
  };

  const handleSaveConfig = async () => {
    try {
      await updateConfigMutation.mutateAsync(editableConfig);
      alert('Configuration saved successfully');
      setConfigChanged(false);
    } catch (error) {
      alert('Error saving configuration. Please try again.');
    }
  };

  const handleRefreshCache = async () => {
    try {
      await refreshCacheMutation.mutateAsync();
      alert('Cache refresh initiated successfully');
    } catch (error) {
      alert('Error refreshing cache. Please try again.');
    }
  };

  const handleClearCache = async () => {
    if (!confirm('Are you sure you want to clear the EscapeVector cache? This action cannot be undone.')) {
      return;
    }
    try {
      await clearCacheMutation.mutateAsync();
      alert('Cache cleared successfully');
    } catch (error) {
      alert('Error clearing cache. Please try again.');
    }
  };

  const getStatusBadge = () => {
    if (!status) return null;
    const { cache_status } = status;
    if (cache_status === 'active') {
      return (
        <Badge className="bg-gray-50 text-gray-700 border">
          <CheckCircle className="h-3 w-3 mr-1" />
          Active
        </Badge>
      );
    } else if (cache_status === 'expired') {
      return (
        <Badge className="bg-yellow-50 text-yellow-700 border border-yellow-200">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-50 text-gray-500 border">
          <XCircle className="h-3 w-3 mr-1" />
          Empty
        </Badge>
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border-light">
            <h1 className="text-base font-medium text-gray-900 font-inter">EscapeVector (72-Hour Cached Routing)</h1>
            <p className="text-gray-600 mt-1 font-inter text-xs">
              Emergency fallback routing with AES-256-GCM encrypted cache for seamless degradation
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs px-2 py-1 shadow-sm"
              onClick={handleRefreshCache}
              disabled={refreshCacheMutation.isPending}
            >
              <RefreshCw className={`h-3 w-3 ${refreshCacheMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Cache
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-1 text-xs px-2 py-1 shadow-sm"
              onClick={handleClearCache}
              disabled={clearCacheMutation.isPending}
            >
              <Trash2 className="h-3 w-3" />
              Clear Cache
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border-light shadow-sm bg-beige-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2 bg-transparent">
              <CardTitle className="text-xs font-medium text-gray-600">Cache Status</CardTitle>
              <Shield className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent className="bg-transparent">
              {getStatusBadge()}
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Time Remaining</CardTitle>
              <Clock className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{status?.time_remaining_hours.toFixed(1)}h</div>
              <p className="text-xs text-gray-600 mt-1">Until cache expires</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Hit Rate (24h)</CardTitle>
              <TrendingUp className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">{status?.hit_rate_24h.toFixed(1)}%</div>
              <p className="text-xs text-gray-600 mt-1">Cache efficiency</p>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-medium text-gray-600">Estimated Savings</CardTitle>
              <DollarSign className="h-4 w-4 text-gray-900" />
            </CardHeader>
            <CardContent>
              <div className="text-lg font-bold text-gray-900">${status?.estimated_savings.toFixed(2)}</div>
              <p className="text-xs text-gray-600 mt-1">Past 24 hours</p>
            </CardContent>
          </Card>
        </div>

        {/* Configuration Form */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription className="text-xs">Manage EscapeVector cache settings and behavior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-gray-900">Enable EscapeVector</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.65rem] text-gray-600">Activate cached routing fallback</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache_ttl" className="text-xs font-medium text-gray-900">Cache TTL (hours)</Label>
                  <Input
                    id="cache_ttl"
                    type="number"
                    value={editableConfig.cache_ttl_hours}
                    onChange={(e) => handleConfigChange('cache_ttl_hours', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">How long cache entries remain valid</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality_threshold" className="text-xs font-medium text-gray-900">Min Quality Threshold (%)</Label>
                  <Input
                    id="quality_threshold"
                    type="number"
                    value={editableConfig.min_quality_threshold}
                    onChange={(e) => handleConfigChange('min_quality_threshold', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">Minimum quality score for caching</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refresh_interval" className="text-xs font-medium text-gray-900">Refresh Interval (hours)</Label>
                  <Input
                    id="refresh_interval"
                    type="number"
                    value={editableConfig.refresh_interval_hours}
                    onChange={(e) => handleConfigChange('refresh_interval_hours', parseInt(e.target.value))}
                    className="text-xs"
                  />
                  <p className="text-[0.65rem] text-gray-600">Auto-refresh frequency</p>
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

        {/* Cache Details & History */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Cache Generation History</CardTitle>
            <CardDescription className="text-xs">Recent cache refresh events and details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border-light">
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Timestamp</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Trigger</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Size (MB)</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">Entries</th>
                    <th className="text-left py-2 px-3 font-medium text-gray-600">TTL (hours)</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((entry, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-beige-secondary">
                      <td className="py-2 px-3 text-gray-900">
                        {formatDistanceToNow(new Date(entry.timestamp))}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={entry.trigger === 'manual' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-gray-50 text-gray-700 border'}>
                          {entry.trigger}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-gray-900">{entry.size_mb.toFixed(1)}</td>
                      <td className="py-2 px-3 text-gray-900">{entry.entries_count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-gray-900">{entry.ttl_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Impact & Analytics Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Cache Usage Over Time</CardTitle>
              <CardDescription className="text-xs">Cache hits vs direct requests (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.cache_usage_timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 8 }}
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                  />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip
                    contentStyle={{ fontSize: '9px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#faf9f7' }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="cache_hits" stroke={CHART_COLORS.primary} strokeWidth={0.5} name="Cache Hits" dot={false} />
                  <Line type="monotone" dataKey="direct_requests" stroke={CHART_COLORS.gray} strokeWidth={0.5} name="Direct" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Cost Savings Trend</CardTitle>
              <CardDescription className="text-xs">Cumulative savings from cache hits (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.cost_savings_timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 8 }}
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                  />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip
                    contentStyle={{ fontSize: '9px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#faf9f7' }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: any) => `$${value.toFixed(2)}`}
                  />
                  <Line type="monotone" dataKey="cumulative_savings" stroke="#000000" strokeWidth={0.5} name="Cumulative Savings" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Provider Failover Events</CardTitle>
            <CardDescription className="text-xs">Times EscapeVector provided fallback routing per provider</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics?.provider_failover_events || []}>
                <defs>
                  <pattern id="diagonalStripes" patternUnits="userSpaceOnUse" width="3" height="3" patternTransform="rotate(45)">
                    <rect width="1" height="3" fill="#000000" />
                    <rect x="1" width="2" height="3" fill="#e5e7eb" />
                  </pattern>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="provider" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 8 }} />
                <Tooltip
                  contentStyle={{ fontSize: '9px', borderRadius: '6px', border: '1px solid #e5e7eb', backgroundColor: '#faf9f7' }}
                />
                <Bar dataKey="count" fill="url(#diagonalStripes)" name="Failover Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* How EscapeVector Works */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How EscapeVector Works</CardTitle>
            <CardDescription className="text-xs">AES-256-GCM encrypted 72-hour routing fallback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-900 mb-3">Key Features</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Shield className="h-4 w-4 text-gray-900" />
                      <span className="font-medium text-gray-900">Encrypted Storage</span>
                    </div>
                    <p className="text-xs text-gray-600">AES-256-GCM encryption with tamper detection</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Database className="h-4 w-4 text-gray-900" />
                      <span className="font-medium text-gray-900">72-Hour TTL</span>
                    </div>
                    <p className="text-xs text-gray-600">Cached routing decisions valid for 3 days</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Zap className="h-4 w-4 text-gray-900" />
                      <span className="font-medium text-gray-900">Fast Fallback</span>
                    </div>
                    <p className="text-xs text-gray-600">Instant routing when providers unavailable</p>
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Activity className="h-4 w-4 text-gray-900" />
                      <span className="font-medium text-gray-900">Quality Filtering</span>
                    </div>
                    <p className="text-xs text-gray-600">Only high-quality routes are cached</p>
                  </div>
                </div>
              </div>

              <div className="bg-beige-primary border border-border-light rounded-lg p-4">
                <h4 className="text-xs font-medium text-gray-900 mb-2">Emergency Routing Process</h4>
                <ul className="text-xs text-gray-800 space-y-1 list-disc list-inside">
                  <li>Overture monitors provider health and routing decisions</li>
                  <li>High-quality routes are encrypted and cached for 72 hours</li>
                  <li>When a provider fails, cached route immediately used as fallback</li>
                  <li>Cache automatically refreshes every 24 hours (configurable)</li>
                  <li>Tamper detection ensures cache integrity</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
