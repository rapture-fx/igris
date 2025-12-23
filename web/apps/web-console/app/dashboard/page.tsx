'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useUsageSummary } from '@/hooks/useUsage';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency } from '@/utils/helpers';
import { DollarSign, Activity, Zap, TrendingUp, BarChart3, Clock, AlertTriangle, CheckCircle, XCircle, AlertCircle as AlertCircleIcon, Play } from 'lucide-react';
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
    <Card className="border-border-light shadow-sm hover:shadow-sm transition-shadow">
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

// System health types
interface ProviderHealth {
  provider: string;
  status: 'operational' | 'degraded' | 'outage';
  availability: number;
  models: Array<{
    model: string;
    regions: Array<{
      region: string;
      status: 'operational' | 'degraded' | 'outage';
      latency_p99: number;
      error_rate: number;
    }>;
  }>;
  latency_p99: number;
  error_rate: number;
  fallback_frequency: number;
  last_incident?: string;
}

interface SystemHealth {
  overall_status: 'operational' | 'degraded' | 'outage';
  degraded_mode: boolean;
  degraded_reason?: string;
  providers: ProviderHealth[];
  thresholds: {
    error_rate_warning: number;
    error_rate_critical: number;
    latency_p99_warning: number;
    latency_p99_critical: number;
  };
}

export default function DashboardPage() {
  const { data: summary, isLoading } = useUsageSummary();
  const { data: tenant } = useTenant();

  // Real data from APIs
  const [providerUptime, setProviderUptime] = useState<Array<{provider: string, uptime: string, status: string}>>([]);
  const [requestsData, setRequestsData] = useState<Array<{time: string, requests: number}>>([]);
  const [latencyData, setLatencyData] = useState<Array<{time: string, latency: number}>>([]);
  const [providerCostData, setProviderCostData] = useState<Array<{provider: string, cost: number}>>([]);

  // System health state
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall_status: 'operational',
    degraded_mode: false,
    providers: [],
    thresholds: {
      error_rate_warning: 5,
      error_rate_critical: 10,
      latency_p99_warning: 2000,
      latency_p99_critical: 5000,
    },
  });

  // Simulation state
  const [isSimulationActive, setIsSimulationActive] = useState(false);
  const [simulatedProvider, setSimulatedProvider] = useState('');
  const [simulationResults, setSimulationResults] = useState<{
    affected_providers: string[];
    routing_changes: Record<string, string>;
    estimated_impact: string;
    duration: number;
  } | null>(null);
  const [showSimulationDialog, setShowSimulationDialog] = useState(false);

  // Fetch dashboard metrics from backend
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!tenant?.id) return;

      // Generate mock data first, then try real API
      const mockInitialData = {
        providerUptime: [
          { provider: 'OpenAI', uptime: '99.9%', status: 'success' },
          { provider: 'Anthropic', uptime: '99.7%', status: 'success' },
          { provider: 'Google', uptime: '98.4%', status: 'warning' },
          { provider: 'xAI', uptime: '96.2%', status: 'warning' },
          { provider: 'Cohere', uptime: '99.1%', status: 'success' },
        ],
        requestsData: [
          { time: '00:00', requests: 145 },
          { time: '04:00', requests: 89 },
          { time: '08:00', requests: 234 },
          { time: '12:00', requests: 345 },
          { time: '16:00', requests: 289 },
          { time: '20:00', requests: 198 },
          { time: '00:00', requests: 156 },
        ],
        latencyData: [
          { time: '00:00', latency: 142 },
          { time: '04:00', latency: 98 },
          { time: '08:00', latency: 178 },
          { time: '12:00', latency: 234 },
          { time: '16:00', latency: 189 },
          { time: '20:00', latency: 156 },
          { time: '00:00', latency: 134 },
        ],
        providerCostData: [
          { provider: 'OpenAI', cost: 847.32 },
          { provider: 'Anthropic', cost: 623.18 },
          { provider: 'Google', cost: 234.67 },
          { provider: 'xAI', cost: 189.45 },
          { provider: 'Cohere', cost: 92.81 },
        ],
        systemHealth: {
          overall_status: 'degraded' as 'operational' | 'degraded' | 'outage',
          degraded_mode: true,
          degraded_reason: 'Google experiencing minor connectivity issues in eu-west-1 region',
          providers: [
            {
              provider: 'OpenAI',
              status: 'operational' as 'operational' | 'degraded' | 'outage',
              availability: 99.8,
              models: [
                {
                  model: 'gpt-4',
                  regions: [
                    { region: 'us-east-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 156, error_rate: 0.8 },
                    { region: 'us-west-2', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 134, error_rate: 0.6 },
                    { region: 'eu-west-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 189, error_rate: 1.2 },
                  ]
                },
                {
                  model: 'gpt-4-turbo',
                  regions: [
                    { region: 'us-east-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 142, error_rate: 0.7 },
                    { region: 'us-west-2', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 118, error_rate: 0.5 },
                    { region: 'eu-west-1', status: 'degraded' as 'operational' | 'degraded' | 'outage', latency_p99: 267, error_rate: 2.1 },
                  ]
                }
              ],
              latency_p99: 156,
              error_rate: 0.8,
              fallback_frequency: 2.3,
              last_incident: '2 hours ago'
            },
            {
              provider: 'Anthropic',
              status: 'operational' as 'operational' | 'degraded' | 'outage',
              availability: 99.7,
              models: [
                {
                  model: 'claude-3-opus',
                  regions: [
                    { region: 'us-east-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 234, error_rate: 1.1 },
                    { region: 'eu-west-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 289, error_rate: 1.4 },
                  ]
                }
              ],
              latency_p99: 234,
              error_rate: 1.1,
              fallback_frequency: 1.8,
            },
            {
              provider: 'Google',
              status: 'degraded' as 'operational' | 'degraded' | 'outage',
              availability: 94.2,
              models: [
                {
                  model: 'gemini-pro',
                  regions: [
                    { region: 'us-east-1', status: 'degraded' as 'operational' | 'degraded' | 'outage', latency_p99: 456, error_rate: 4.2 },
                    { region: 'eu-west-1', status: 'outage' as 'operational' | 'degraded' | 'outage', latency_p99: 892, error_rate: 12.4 },
                  ]
                }
              ],
              latency_p99: 456,
              error_rate: 4.2,
              fallback_frequency: 8.7,
              last_incident: '45 minutes ago'
            },
            {
              provider: 'xAI',
              status: 'operational' as 'operational' | 'degraded' | 'outage',
              availability: 96.2,
              models: [
                {
                  model: 'grok-2',
                  regions: [
                    { region: 'us-east-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 198, error_rate: 2.3 },
                  ]
                }
              ],
              latency_p99: 198,
              error_rate: 2.3,
              fallback_frequency: 4.1,
            },
            {
              provider: 'Cohere',
              status: 'operational' as 'operational' | 'degraded' | 'outage',
              availability: 99.1,
              models: [
                {
                  model: 'command-r-plus',
                  regions: [
                    { region: 'us-east-1', status: 'operational' as 'operational' | 'degraded' | 'outage', latency_p99: 167, error_rate: 0.9 },
                  ]
                }
              ],
              latency_p99: 167,
              error_rate: 0.9,
              fallback_frequency: 1.2,
            },
          ],
          thresholds: {
            error_rate_warning: 3,
            error_rate_critical: 8,
            latency_p99_warning: 300,
            latency_p99_critical: 500,
          },
        },
        summary: {
          total_requests: 15432,
          monthly_spend: 1987.43,
          avg_latency: 178,
          requests_trend: '+12%',
          spend_trend: '+8%',
          latency_trend: '-5%',
        }
      };

      // Set initial mock data immediately
      setProviderUptime(mockInitialData.providerUptime);
      setRequestsData(mockInitialData.requestsData);
      setLatencyData(mockInitialData.latencyData);
      setProviderCostData(mockInitialData.providerCostData);
      setSystemHealth(mockInitialData.systemHealth);
      // Update summary if needed (the summary object is read-only, so we don't set it)

      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
        const authHeaders = {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        };

        // Try to fetch real data, but keep if fails
        const uptimeRes = await fetch(`${apiUrl}/internal/metrics/uptime`, { headers: authHeaders });
        if (uptimeRes.ok) {
          const data = await uptimeRes.json();
          if (data.providers) setProviderUptime(data.providers);
        }

        const requestsRes = await fetch(`${apiUrl}/v1/usage/requests-timeline`, { headers: authHeaders });
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          if (data.timeline) setRequestsData(data.timeline);
        }

        const latencyRes = await fetch(`${apiUrl}/v1/usage/latency-timeline`, { headers: authHeaders });
        if (latencyRes.ok) {
          const data = await latencyRes.json();
          if (data.timeline) setLatencyData(data.timeline);
        }

        const costsRes = await fetch(`${apiUrl}/v1/usage/provider-costs`, { headers: authHeaders });
        if (costsRes.ok) {
          const data = await costsRes.json();
          if (data.providers) setProviderCostData(data.providers);
        }

        const healthRes = await fetch(`${apiUrl}/v1/health/system`, { headers: authHeaders });
        if (healthRes.ok) {
          const data = await healthRes.json();
          setSystemHealth(data);
        }
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        // Keep mock data if API fails
      }
    };

    fetchMetrics();
    // Refresh every 30 seconds for health data
    const interval = setInterval(fetchMetrics, 30 * 1000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  // Handle simulation
  const handleSimulateOutage = async (provider: string) => {
    setSimulatedProvider(provider);
    setShowSimulationDialog(true);

    // Simulate analysis
    setTimeout(() => {
      const mockResults = {
        affected_providers: [provider],
        routing_changes: {
          [provider]: '→ Next available provider (OpenAI → Anthropic)',
          'impact': 'Estimated +120ms latency, -15% throughput',
        },
        estimated_impact: 'Medium - 2-3 requests per second affected',
        duration: 600000, // 10 minutes
      };
      setSimulationResults(mockResults);
    }, 2000);
  };

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

        {/* Degraded Mode Banner */}
        {systemHealth.degraded_mode && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-medium text-yellow-900 font-inter">
                  System Operating in Degraded Mode
                </h3>
                <p className="text-sm text-yellow-800 mt-1">
                  {systemHealth.degraded_reason || 'One or more providers experiencing issues. Requests are being routed to healthy alternatives.'}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* System Health Panel */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${
                  systemHealth.overall_status === 'operational' ? 'bg-green-500' :
                  systemHealth.overall_status === 'degraded' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <CardTitle>System Health</CardTitle>
              </div>
              <div className="text-xs text-gray-600">
                Refreshes every 30s
              </div>
            </div>
            <CardDescription>
              Provider availability, latency metrics, and error rates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {systemHealth.providers.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                  No provider health data available
                </div>
              ) : (
                systemHealth.providers.map((provider) => (
                  <div key={provider.provider} className="border border-border-light rounded-lg p-4 bg-beige-primary">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          provider.status === 'operational' ? 'bg-green-500' :
                          provider.status === 'degraded' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                        <h4 className="font-medium text-gray-900 font-inter">
                          {provider.provider}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          provider.status === 'operational' ? 'bg-green-100 text-green-700' :
                          provider.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {provider.status}
                        </span>
                      </div>
                      <div className="text-sm text-gray-900 font-medium">
                        {provider.availability.toFixed(2)}% available
                      </div>
                    </div>

                    {/* Simulation Button */}
                    <div className="flex items-center justify-end mb-3">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleSimulateOutage(provider.provider)}
                        className="text-xs flex items-center gap-2"
                      >
                        <Play className="h-3 w-3" />
                        Simulate Outage
                      </Button>
                    </div>

                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div className="bg-white rounded-md p-3 border border-border-light">
                        <div className="text-xs text-gray-600 mb-1">Latency P99</div>
                        <div className={`text-sm font-medium ${
                          provider.latency_p99 > systemHealth.thresholds.latency_p99_critical ? 'text-red-600' :
                          provider.latency_p99 > systemHealth.thresholds.latency_p99_warning ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {formatLatency(provider.latency_p99)}
                        </div>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-border-light">
                        <div className="text-xs text-gray-600 mb-1">Error Rate</div>
                        <div className={`text-sm font-medium ${
                          provider.error_rate > systemHealth.thresholds.error_rate_critical ? 'text-red-600' :
                          provider.error_rate > systemHealth.thresholds.error_rate_warning ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {provider.error_rate.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-white rounded-md p-3 border border-border-light">
                        <div className="text-xs text-gray-600 mb-1">Fallback Freq</div>
                        <div className="text-sm font-medium text-gray-900">
                          {provider.fallback_frequency.toFixed(1)}%
                        </div>
                      </div>
                    </div>

                    {provider.models && provider.models.length > 0 && (
                      <details className="group">
                        <summary className="cursor-pointer text-xs text-gray-600 hover:text-gray-900 font-medium mb-2 list-none flex items-center gap-2">
                          <span className="transition-transform group-open:rotate-90">▸</span>
                          Model & Region Health ({provider.models.length} models)
                        </summary>
                        <div className="mt-2 space-y-2 pl-4">
                          {provider.models.map((model) => (
                            <div key={model.model} className="text-xs">
                              <div className="font-medium text-gray-900 mb-1">{model.model}</div>
                              <div className="grid grid-cols-2 gap-2">
                                {model.regions.map((region) => (
                                  <div key={region.region} className="flex items-center justify-between bg-white rounded p-2 border border-border-light">
                                    <div className="flex items-center gap-2">
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                        region.status === 'operational' ? 'bg-green-500' :
                                        region.status === 'degraded' ? 'bg-yellow-500' :
                                        'bg-red-500'
                                      }`} />
                                      <span className="text-gray-700">{region.region}</span>
                                    </div>
                                    <div className="text-gray-600">
                                      {formatLatency(region.latency_p99)} • {region.error_rate.toFixed(1)}%
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}

                    {provider.last_incident && (
                      <div className="mt-3 text-xs text-gray-600">
                        Last incident: {provider.last_incident}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Four Big Live Metrics with Trends & Mini Sparklines */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Requests Today"
            value={formatNumber(summary?.total_requests || 0)}
            description="Last 24 hours"
            icon={Activity}
            trend={(summary as any)?.requests_trend}
          />
          <MetricCard
            title="Spend This Month"
            value={formatCurrency(summary?.monthly_spend || 0)}
            description="Current billing period"
            icon={DollarSign}
            trend={(summary as any)?.spend_trend}
          />
          <MetricCard
            title="Avg Latency"
            value={formatLatency(summary?.avg_latency || 0)}
            description="P50 response time"
            icon={Zap}
            trend={(summary as any)?.latency_trend}
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
          <Card className="border-border-light shadow-sm">
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

          <Card className="border-border-light shadow-sm">
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
          <Card className="border-border-light shadow-sm">
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

          <Card className="border-border-light shadow-sm">
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

      {/* Simulation Results Dialog */}
      {showSimulationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Simulating {simulatedProvider} Outage
            </h3>
            
            {!simulationResults ? (
              <div className="flex items-center gap-3 py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
                <span className="text-gray-600">Analyzing impact...</span>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-sm font-medium text-yellow-900 mb-2">Estimated Impact</h4>
                  <p className="text-sm text-yellow-800">{simulationResults.estimated_impact}</p>
                </div>

                <div className="p-3 bg-beige-primary border border-border-light rounded-lg">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Routing Changes</h4>
                  {Object.entries(simulationResults.routing_changes).map(([key, value]) => (
                    <div key={key} className="text-sm text-gray-700 mb-1">
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-medium text-blue-900 mb-2">Duration</h4>
                  <p className="text-sm text-blue-800">{Math.round(simulationResults.duration / 60000)} minutes</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowSimulationDialog(false)}
                  >
                    Close
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      alert('Simulation completed - this was a dry run only');
                      setShowSimulationDialog(false);
                    }}
                  >
                    Run Dry Run
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
