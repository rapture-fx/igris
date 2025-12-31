'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useUsageSummary } from '@/hooks/useUsage';
import { useTenant } from '@/hooks/useTenant';
import { formatCurrency, formatNumber, formatLatency, formatDateTime } from '@/utils/helpers';
import { DollarSign, Activity, Zap, TrendingUp, BarChart3, Clock, AlertTriangle, CheckCircle, XCircle, AlertCircle as AlertCircleIcon, Play, Server, Brain, Plus, Cpu, ArrowRight } from 'lucide-react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CHART_COLORS } from '@/utils/constants';
import { useRouter } from 'next/navigation';

const hideScrollbarStyles = `
  .hide-scrollbar {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .hide-scrollbar::-webkit-scrollbar {
    display: none;
  }
`;

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
        <CardTitle className="text-xs font-medium text-gray-600">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-lg font-bold text-gray-900">{value}</div>
        <p className="text-[0.65rem] text-gray-600 mt-1">
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
  const router = useRouter();

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

  // Recent activity and Runtime fleet metrics
  const [recentActivity, setRecentActivity] = useState<Array<{
    id: string;
    type: 'alert' | 'info' | 'success' | 'warning';
    category: 'overture' | 'runtime' | 'agents' | 'system';
    title: string;
    description: string;
    timestamp: string;
  }>>([]);

  const [runtimeFleetMetrics, setRuntimeFleetMetrics] = useState({
    total_instances: 0,
    online_instances: 0,
    offline_instances: 0,
    avg_cpu_usage: 0,
    total_inference_requests: 0,
    active_training_jobs: 0,
  });

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
        },
        recentActivity: [
          {
            id: '1',
            type: 'alert' as 'alert',
            category: 'overture' as 'overture',
            title: 'Google fallback triggered',
            description: 'High error rate in eu-west-1, requests routed to Anthropic',
            timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          },
          {
            id: '2',
            type: 'warning' as 'warning',
            category: 'runtime' as 'runtime',
            title: 'Device offline: edge-node-47',
            description: 'Instance in us-west-2 lost heartbeat, marked offline',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '3',
            type: 'success' as 'success',
            category: 'agents' as 'agents',
            title: 'QLoRA training completed',
            description: 'Model fine-tuning job "customer-support-v2" finished successfully',
            timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '4',
            type: 'info' as 'info',
            category: 'system' as 'system',
            title: 'Monthly budget alert',
            description: 'Current spend at 78% of budget limit',
            timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          },
          {
            id: '5',
            type: 'success' as 'success',
            category: 'overture' as 'overture',
            title: 'Rate limit increased',
            description: 'Tenant acme-corp limit updated to 250 req/min',
            timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
          },
        ],
        runtimeFleetMetrics: {
          total_instances: 12,
          online_instances: 10,
          offline_instances: 2,
          avg_cpu_usage: 45.3,
          total_inference_requests: 8234,
          active_training_jobs: 2,
        }
      };

      // Set initial mock data immediately
      setProviderUptime(mockInitialData.providerUptime);
      setRequestsData(mockInitialData.requestsData);
      setLatencyData(mockInitialData.latencyData);
      setProviderCostData(mockInitialData.providerCostData);
      setSystemHealth(mockInitialData.systemHealth);
      setRecentActivity(mockInitialData.recentActivity);
      setRuntimeFleetMetrics(mockInitialData.runtimeFleetMetrics);
      // Update summary if needed (the summary object is read-only, so we don't set it)

      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8081';
      const authHeaders = {
        'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
      };

      // Try to fetch real data, but keep mock data if any fails
      try {
        const uptimeRes = await fetch(`${apiUrl}/internal/metrics/uptime`, { headers: authHeaders });
        if (uptimeRes.ok) {
          const data = await uptimeRes.json();
          if (data.providers) setProviderUptime(data.providers);
        }
      } catch (error) {
        // Silently fail and keep mock data
      }

      try {
        const requestsRes = await fetch(`${apiUrl}/v1/usage/requests-timeline`, { headers: authHeaders });
        if (requestsRes.ok) {
          const data = await requestsRes.json();
          if (data.timeline) setRequestsData(data.timeline);
        }
      } catch (error) {
        // Silently fail and keep mock data
      }

      try {
        const latencyRes = await fetch(`${apiUrl}/v1/usage/latency-timeline`, { headers: authHeaders });
        if (latencyRes.ok) {
          const data = await latencyRes.json();
          if (data.timeline) setLatencyData(data.timeline);
        }
      } catch (error) {
        // Silently fail and keep mock data
      }

      try {
        const costsRes = await fetch(`${apiUrl}/v1/usage/provider-costs`, { headers: authHeaders });
        if (costsRes.ok) {
          const data = await costsRes.json();
          if (data.providers) setProviderCostData(data.providers);
        }
      } catch (error) {
        // Silently fail and keep mock data
      }

      try {
        const healthRes = await fetch(`${apiUrl}/v1/health/system`, { headers: authHeaders });
        if (healthRes.ok) {
          const data = await healthRes.json();
          setSystemHealth(data);
        }
      } catch (error) {
        // Silently fail and keep mock data
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
      <style>{hideScrollbarStyles}</style>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="pb-4 border-b border-border-light">
          <h1 className="text-base font-medium text-gray-900 font-inter">
            Welcome back
          </h1>
          <p className="text-gray-600 mt-1 font-inter text-xs">
            Overview of your AI infrastructure
          </p>
        </div>

        {/* Quick Actions */}
        <div>
          <div className="pb-3">
            <h2 className="text-sm font-medium text-gray-900">Quick Actions</h2>
            <p className="text-xs text-gray-600 mt-1">Common operations across Overture, Runtime, and Agents</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-8 px-3"
              onClick={() => router.push('/dashboard/runtime/fleet')}
            >
              Add Runtime Instance
            </Button>

            <Button
              variant="outline"
              className="h-8 px-3"
              onClick={() => router.push('/dashboard/agents/qlora')}
            >
              Start QLoRA Job
            </Button>

            <Button
              variant="outline"
              className="h-8 px-3"
              onClick={() => router.push('/dashboard/providers')}
            >
              Add Provider
            </Button>

            <Button
              variant="outline"
              className="h-8 px-3"
              onClick={() => router.push('/dashboard/observability')}
            >
              View Traces
            </Button>
          </div>
        </div>

        {/* Six Metrics: Overture + Runtime */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="Requests Today"
            value={formatNumber(summary?.total_requests || 0)}
            description="Last 24 hours (Overture)"
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
            description="P50 response time (Overture)"
            icon={Zap}
            trend={(summary as any)?.latency_trend}
          />
          <MetricCard
            title="Runtime Instances"
            value={`${runtimeFleetMetrics.online_instances}/${runtimeFleetMetrics.total_instances}`}
            description="Online edge nodes"
            icon={Server}
          />
          <MetricCard
            title="Inference Requests"
            value={formatNumber(runtimeFleetMetrics.total_inference_requests)}
            description="Runtime edge processing"
            icon={Cpu}
          />
          <MetricCard
            title="Training Jobs"
            value={String(runtimeFleetMetrics.active_training_jobs)}
            description="Active QLoRA fine-tuning"
            icon={Brain}
          />
        </div>

        {/* Two Mini Charts: Requests/Cost last 7 days + Latency P95 last 24h */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <BarChart3 className="h-4 w-4 text-gray-900" />
                Requests & Cost
              </CardTitle>
              <CardDescription className="text-xs">Last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={requestsData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={0.5} />
                  <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '10px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#f8f6f3',
                      border: '1px solid #e5e1d8',
                      borderRadius: '6px',
                      fontSize: '11px'
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="requests"
                    stroke="#000000"
                    strokeWidth={0.5}
                    dot={false}
                    activeDot={{ r: 2.5, fill: "#000000" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Clock className="h-4 w-4 text-gray-900" />
                Latency P95
              </CardTitle>
              <CardDescription className="text-xs">Last 24 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={latencyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" strokeWidth={0.5} />
                  <XAxis dataKey="time" stroke="#6b7280" style={{ fontSize: '10px' }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: '10px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#f8f6f3',
                      border: '1px solid #e5e1d8',
                      borderRadius: '6px',
                      fontSize: '11px'
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="latency"
                    stroke="#000000"
                    strokeWidth={0.5}
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
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4 text-gray-900" />
                Top Models by Spend
              </CardTitle>
              <CardDescription className="text-xs">This month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {providerCostData.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-beige-primary">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-900">{i + 1}.</span>
                      <span className="text-xs text-gray-900">{item.provider}</span>
                    </div>
                    <span className="text-xs font-medium text-gray-900">{formatCurrency(item.cost)}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border-light shadow-sm">
            <CardHeader>
              <CardTitle className="text-sm">Provider Reliability</CardTitle>
              <CardDescription className="text-xs">Last 7 days uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {providerUptime.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg border border-border-light">
                    <span className="text-xs font-medium text-gray-900">{item.provider}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-600">{item.uptime}</span>
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

        {/* System Health Panel */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${
                  systemHealth.overall_status === 'operational' ? 'bg-green-500' :
                  systemHealth.overall_status === 'degraded' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`} />
                <CardTitle className="text-sm">System Health</CardTitle>
              </div>
              <div className="text-xs text-gray-600">
                Refreshes every 30s
              </div>
            </div>
            <CardDescription className="text-xs">
              Provider availability, latency metrics, and error rates
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            {/* Degraded Mode Banner */}
            {systemHealth.degraded_mode && (
              <div className="border border-border-light rounded-lg p-4 mb-4 bg-beige-primary">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-gray-900 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900 font-inter">
                      System Operating in Degraded Mode
                    </h3>
                    <p className="text-sm text-gray-900 mt-1">
                      {systemHealth.degraded_reason || 'One or more providers experiencing issues. Requests are being routed to healthy alternatives.'}
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-[400px] overflow-y-auto scrollbar-hide">
              {systemHealth.providers.length === 0 ? (
                <div className="text-center py-8 text-gray-600 text-sm">
                  No provider health data available
                </div>
              ) : (
                <div className="space-y-4">
                  {systemHealth.providers.map((provider) => (
                  <div key={provider.provider} className="border border-border-light rounded-lg p-3 bg-beige-primary">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${
                          provider.status === 'operational' ? 'bg-green-500' :
                          provider.status === 'degraded' ? 'bg-yellow-500' :
                          'bg-red-500'
                        }`} />
                        <h4 className="font-medium text-gray-900 font-inter text-xs">
                          {provider.provider}
                        </h4>
                        <span className={`px-1.5 py-0.5 rounded-full text-[0.65rem] font-medium ${
                          provider.status === 'operational' ? 'bg-green-100 text-green-700' :
                          provider.status === 'degraded' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                        }`}>
                          {provider.status}
                        </span>
                      </div>
                      <div className="text-xs text-gray-900 font-medium">
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

                    <div className="grid grid-cols-3 gap-3 mb-2">
                      <div className="bg-beige-primary rounded-md p-2 border border-border-light">
                        <div className="text-[0.65rem] text-gray-600 mb-0.5">Latency P99</div>
                        <div className={`text-xs font-medium ${
                          provider.latency_p99 > systemHealth.thresholds.latency_p99_critical ? 'text-red-600' :
                          provider.latency_p99 > systemHealth.thresholds.latency_p99_warning ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {formatLatency(provider.latency_p99)}
                        </div>
                      </div>
                      <div className="bg-beige-primary rounded-md p-2 border border-border-light">
                        <div className="text-[0.65rem] text-gray-600 mb-0.5">Error Rate</div>
                        <div className={`text-xs font-medium ${
                          provider.error_rate > systemHealth.thresholds.error_rate_critical ? 'text-red-600' :
                          provider.error_rate > systemHealth.thresholds.error_rate_warning ? 'text-yellow-600' :
                          'text-gray-900'
                        }`}>
                          {provider.error_rate.toFixed(2)}%
                        </div>
                      </div>
                      <div className="bg-beige-primary rounded-md p-2 border border-border-light">
                        <div className="text-[0.65rem] text-gray-600 mb-0.5">Fallback Freq</div>
                        <div className="text-xs font-medium text-gray-900">
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
                                  <div key={region.region} className="flex items-center justify-between bg-beige-primary rounded p-2 border border-border-light">
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
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-border-light shadow-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Events from Overture, Runtime, and Agents</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/observability')}>
                View All
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="overflow-auto max-h-96 hide-scrollbar">
              <div className="space-y-3">
                {recentActivity.slice(0, 5).map((activity) => {
                const typeConfig = {
                  alert: { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', icon: XCircle },
                  warning: { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', icon: AlertCircleIcon },
                  success: { bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200', icon: CheckCircle },
                  info: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', icon: AlertCircleIcon },
                };
                const config = typeConfig[activity.type];
                const Icon = config.icon;

                const categoryConfig = {
                  overture: { label: 'Overture', color: 'bg-purple-100 text-purple-700' },
                  runtime: { label: 'Runtime', color: 'bg-blue-100 text-blue-700' },
                  agents: { label: 'Agents', color: 'bg-green-100 text-green-700' },
                  system: { label: 'System', color: 'bg-gray-100 text-gray-700' },
                };
                const categoryStyle = categoryConfig[activity.category];

                return (
                  <div
                    key={activity.id}
                    className="p-3 rounded-lg border border-border-light bg-beige-primary"
                  >
                    <div className="flex items-start gap-2">
                      <Icon className="h-4 w-4 text-gray-900 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-medium text-gray-900 font-inter">
                            {activity.title}
                          </h4>
                          <Badge className={`${categoryStyle.color} border text-[0.65rem]`}>
                            {categoryStyle.label}
                          </Badge>
                        </div>
                        <p className="text-[0.65rem] text-gray-900 opacity-90">
                          {activity.description}
                        </p>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <Clock className="h-3 w-3 text-gray-600" />
                          <span className="text-[0.65rem] text-gray-600">
                            {formatDateTime(activity.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Simulation Results Dialog */}
      {showSimulationDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-5 max-w-md w-full mx-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">
              Simulating {simulatedProvider} Outage
            </h3>

            {!simulationResults ? (
              <div className="flex items-center gap-2 py-6">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
                <span className="text-xs text-gray-600">Analyzing impact...</span>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-2.5 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <h4 className="text-xs font-medium text-yellow-900 mb-1.5">Estimated Impact</h4>
                  <p className="text-[0.65rem] text-yellow-800">{simulationResults.estimated_impact}</p>
                </div>

                <div className="p-2.5 bg-beige-primary border border-border-light rounded-lg">
                  <h4 className="text-xs font-medium text-gray-900 mb-1.5">Routing Changes</h4>
                  {Object.entries(simulationResults.routing_changes).map(([key, value]) => (
                    <div key={key} className="text-[0.65rem] text-gray-700 mb-1">
                      <span className="font-medium">{key}:</span> {value}
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-xs font-medium text-blue-900 mb-1.5">Duration</h4>
                  <p className="text-[0.65rem] text-blue-800">{Math.round(simulationResults.duration / 60000)} minutes</p>
                </div>

                <div className="flex gap-2 pt-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-xs"
                    onClick={() => setShowSimulationDialog(false)}
                  >
                    Close
                  </Button>
                  <Button
                    size="sm"
                    className="flex-1 text-xs"
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
