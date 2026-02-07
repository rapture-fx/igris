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
  useEscapeVectorStatus,
  useEscapeVectorConfig,
  useEscapeVectorHistory,
  useEscapeVectorAnalytics,
  useUpdateEscapeVectorConfig,
  useRefreshEscapeVectorCache,
  useClearEscapeVectorCache,
} from '@/hooks/useEscapeVector';
import { Shield, RefreshCw, Trash2, Clock, TrendingUp, Database, Zap, CheckCircle, XCircle, AlertTriangle, DollarSign, Activity, Cpu, Box } from 'lucide-react';
import { useWasmEngine } from '@/hooks/useWasmEngine';
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
  const chartTheme = useChartTheme();
  const { data: status, isLoading: statusLoading } = useEscapeVectorStatus();
  const { data: config, isLoading: configLoading } = useEscapeVectorConfig();
  const { data: history, isLoading: historyLoading } = useEscapeVectorHistory();
  const { data: analytics, isLoading: analyticsLoading } = useEscapeVectorAnalytics();

  const { status: wasmStatus, benchmark: wasmBenchmark, runBenchmark } = useWasmEngine();

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
<Badge className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900">
           <CheckCircle className="h-3 w-3 mr-1" />
           Active
         </Badge>
      );
    } else if (cache_status === 'expired') {
      return (
        <Badge className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900">
          <AlertTriangle className="h-3 w-3 mr-1" />
          Expired
        </Badge>
      );
    } else {
      return (
        <Badge className="bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-900">
          <XCircle className="h-3 w-3 mr-1" />
          Empty
        </Badge>
      );
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="pb-4 border-b border-border">
            <h1 className="text-base font-medium text-foreground font-inter">EscapeVector (72-Hour Cached Routing)</h1>
            <p className="text-muted-foreground mt-1 font-inter text-xs">
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
        <div className="bg-card">
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Cache Status</div>
              <div className="pb-2">
                {getStatusBadge()}
              </div>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Time Remaining</div>
              <div className="text-lg font-bold text-foreground">{status?.time_remaining_hours.toFixed(1)}h</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">Until cache expires</p>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-gray-200/20 dark:divide-[#f6f6f4]/5 border-t border-border">
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Hit Rate (24h)</div>
              <div className="text-lg font-bold text-foreground">{status?.hit_rate_24h.toFixed(1)}%</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">Cache efficiency</p>
            </div>
            <div className="p-4">
              <div className="text-xs font-medium text-muted-foreground mb-1">Estimated Savings</div>
              <div className="text-lg font-bold text-foreground">${status?.estimated_savings.toFixed(2)}</div>
              <p className="text-[0.65rem] text-muted-foreground mt-1">Past 24 hours</p>
            </div>
          </div>
        </div>

        {/* WASM Engine Status */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Cpu className="h-4 w-4" />
              WASM Engine Status
            </CardTitle>
            <CardDescription className="text-xs">
              Rust-compiled WebAssembly module for 3-5x faster Thompson Sampling
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Module Status</div>
                  <div className="flex items-center gap-1.5">
                    {wasmStatus.loading ? (
                      <Badge className="bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900">
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                        Loading
                      </Badge>
                    ) : wasmStatus.loaded ? (
                      <Badge className="bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 border-green-200 dark:border-green-900">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Loaded
                      </Badge>
                    ) : wasmStatus.error ? (
                      <Badge className="bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-400 border-yellow-200 dark:border-yellow-900">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Fallback (TS)
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-50 dark:bg-gray-950 text-gray-700 dark:text-gray-400 border-gray-200 dark:border-gray-900">
                        <XCircle className="h-3 w-3 mr-1" />
                        Not Supported
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Module Size</div>
                  <div className="text-lg font-bold text-foreground">
                    {wasmStatus.moduleSize ? `${(wasmStatus.moduleSize / 1024).toFixed(0)} KB` : '--'}
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground">&lt;180 KB gzipped target</p>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-medium text-muted-foreground">Compile Time</div>
                  <div className="text-lg font-bold text-foreground">
                    {wasmStatus.compileTimeMs !== null ? `${wasmStatus.compileTimeMs} ms` : '--'}
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground">Fetch + compile</p>
                </div>
              </div>

              {wasmStatus.loaded && (
                <div className="bg-card border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Box className="h-3 w-3" />
                      Exported Functions ({wasmStatus.exports.length})
                    </h4>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-[0.65rem] px-2 py-0.5 h-6 shadow-sm"
                      onClick={() => runBenchmark(100)}
                    >
                      <Zap className="h-3 w-3 mr-1" />
                      Run Benchmark
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {wasmStatus.exports.slice(0, 12).map((name) => (
                      <span key={name} className="text-[0.6rem] px-1.5 py-0.5 bg-muted rounded font-mono text-muted-foreground">
                        {name}
                      </span>
                    ))}
                    {wasmStatus.exports.length > 12 && (
                      <span className="text-[0.6rem] px-1.5 py-0.5 text-muted-foreground">
                        +{wasmStatus.exports.length - 12} more
                      </span>
                    )}
                  </div>
                  {wasmBenchmark && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <div className="grid grid-cols-3 gap-4 text-xs">
                        <div>
                          <span className="text-muted-foreground">Iterations:</span>{' '}
                          <span className="font-medium text-foreground">{wasmBenchmark.iterations.toLocaleString()}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Total:</span>{' '}
                          <span className="font-medium text-foreground">{wasmBenchmark.totalMs} ms</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Avg/op:</span>{' '}
                          <span className="font-medium text-foreground">{wasmBenchmark.avgPerIterationUs} us</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {wasmStatus.error && (
                <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-3">
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    WASM unavailable: {wasmStatus.error}. Using TypeScript fallback (functionally identical, ~3-5x slower for Thompson Sampling).
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Configuration</CardTitle>
            <CardDescription className="text-xs">Manage EscapeVector cache settings and behavior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="enabled" className="text-xs font-medium text-foreground">Enable EscapeVector</Label>
                    <Switch
                      id="enabled"
                      checked={editableConfig.enabled}
                      onCheckedChange={(checked) => handleConfigChange('enabled', checked)}
                      className="scale-50"
                    />
                  </div>
                  <p className="text-[0.65rem] text-muted-foreground">Activate cached routing fallback</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cache_ttl" className="text-xs font-medium text-foreground">Cache TTL (hours)</Label>
                  <Input
                    id="cache_ttl"
                    type="number"
                    value={editableConfig.cache_ttl_hours}
                    onChange={(e) => handleConfigChange('cache_ttl_hours', parseInt(e.target.value))}
                    className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">How long cache entries remain valid</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quality_threshold" className="text-xs font-medium text-foreground">Min Quality Threshold (%)</Label>
                  <Input
                    id="quality_threshold"
                    type="number"
                    value={editableConfig.min_quality_threshold}
                    onChange={(e) => handleConfigChange('min_quality_threshold', parseInt(e.target.value))}
                    className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">Minimum quality score for caching</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="refresh_interval" className="text-xs font-medium text-foreground">Refresh Interval (hours)</Label>
                  <Input
                    id="refresh_interval"
                    type="number"
                    value={editableConfig.refresh_interval_hours}
                    onChange={(e) => handleConfigChange('refresh_interval_hours', parseInt(e.target.value))}
                    className="text-xs focus-visible:ring-0 focus-visible:ring-offset-0 focus:outline-none focus:border-border"
                  />
                  <p className="text-[0.65rem] text-muted-foreground">Auto-refresh frequency</p>
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
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">Cache Generation History</CardTitle>
            <CardDescription className="text-xs">Recent cache refresh events and details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Timestamp</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Trigger</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Size (MB)</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Entries</th>
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">TTL (hours)</th>
                  </tr>
                </thead>
                <tbody>
                  {history?.map((entry, index) => (
                    <tr key={index} className="border-b border-border hover:bg-muted">
                      <td className="py-2 px-3 text-foreground">
                        {formatDistanceToNow(new Date(entry.timestamp))}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={entry.trigger === 'manual' ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-900' : 'bg-gray-50 text-gray-700 border dark:bg-card dark:text-[#a8a898] dark:border-[#f6f6f4]/5'}>
                          {entry.trigger}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-foreground">{entry.size_mb.toFixed(1)}</td>
                      <td className="py-2 px-3 text-foreground">{entry.entries_count.toLocaleString()}</td>
                      <td className="py-2 px-3 text-foreground">{entry.ttl_hours}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Impact & Analytics Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Cache Usage Over Time</CardTitle>
              <CardDescription className="text-xs">Cache hits vs direct requests (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.cache_usage_timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 8 }}
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                  />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip
                    contentStyle={{ fontSize: '9px', borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Line type="monotone" dataKey="cache_hits" stroke={chartTheme.line} strokeWidth={0.5} name="Cache Hits" dot={false} />
                  <Line type="monotone" dataKey="direct_requests" stroke={CHART_COLORS.gray} strokeWidth={0.5} name="Direct" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Cost Savings Trend</CardTitle>
              <CardDescription className="text-xs">Cumulative savings from cache hits (24h)</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={analytics?.cost_savings_timeline || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fontSize: 8 }}
                    tickFormatter={(value) => new Date(value).getHours() + ':00'}
                  />
                  <YAxis tick={{ fontSize: 8 }} />
                  <Tooltip
                    contentStyle={{ fontSize: '9px', borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text }}
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: any) => `$${value.toFixed(2)}`}
                  />
                  <Line type="monotone" dataKey="cumulative_savings" stroke={chartTheme.line} strokeWidth={0.5} name="Cumulative Savings" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border shadow-sm">
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
                          <rect x="1" width="2" height="3" fill={chartTheme.tooltip.bg} />
                        </pattern>
                      </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartTheme.grid} />
                <XAxis dataKey="provider" tick={{ fontSize: 8 }} />
                <YAxis tick={{ fontSize: 8 }} />
                <Tooltip
                  contentStyle={{ fontSize: '9px', borderRadius: '6px', border: `1px solid ${chartTheme.tooltip.border}`, backgroundColor: chartTheme.tooltip.bg, color: chartTheme.tooltip.text }}
                />
                <Bar dataKey="count" fill="url(#diagonalStripes)" name="Failover Count" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* How EscapeVector Works */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm">How EscapeVector Works</CardTitle>
            <CardDescription className="text-xs">AES-256-GCM encrypted 72-hour routing fallback</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-foreground mb-3">Key Features</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-foreground">Encrypted Storage</span>
                    </div>
                    <p className="text-xs text-muted-foreground">AES-256-GCM encryption with tamper detection</p>
                  </div>
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-foreground">72-Hour TTL</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Cached routing decisions valid for 3 days</p>
                  </div>
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-foreground">Fast Fallback</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Instant routing when providers unavailable</p>
                  </div>
                  <div>
                    <div className="mb-1">
                      <span className="font-medium text-foreground">Quality Filtering</span>
                    </div>
                    <p className="text-xs text-muted-foreground">Only high-quality routes are cached</p>
                  </div>
                </div>
              </div>

              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="text-xs font-medium text-foreground mb-2">Emergency Routing Process</h4>
                <ul className="text-xs text-foreground space-y-1 list-disc list-inside">
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
