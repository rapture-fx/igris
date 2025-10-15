/**
 * Comprehensive Monitoring Dashboard Components
 * ===========================================
 * 
 * Real-time system observability dashboard with:
 * - System health and metrics visualization
 * - Performance monitoring with Core Web Vitals
 * - Error tracking and alert management
 * - Business metrics and user engagement tracking
 * - Integration with backend observability stack
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  ReferenceLine
} from 'recharts';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Users, 
  Server, 
  Database, 
  Wifi, 
  Bell,
  TrendingUp,
  TrendingDown,
  Eye,
  Zap,
  Shield,
  Cpu,
  Memory,
  HardDrive,
  Network
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';

/**
 * Real-time metrics interfaces
 */
interface SystemMetrics {
  timestamp: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_connections: number;
  requests_per_minute: number;
  error_rate: number;
  average_response_time: number;
}

interface PerformanceMetrics {
  lcp: number;
  fid: number;
  cls: number;
  fcp: number;
  ttfb: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

interface ServiceHealth {
  name: string;
  status: 'up' | 'down' | 'degraded';
  response_time?: number;
  error_rate?: number;
  last_check: string;
}

interface AlertData {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: string;
  service: string;
  acknowledged: boolean;
}

interface BusinessMetrics {
  active_users: number;
  session_duration: number;
  page_views: number;
  feature_usage: Record<string, number>;
  ml_operations: {
    success_rate: number;
    total_operations: number;
    avg_duration: number;
  };
  auth_metrics: {
    login_success_rate: number;
    total_logins: number;
    oauth_usage: number;
  };
}

/**
 * Custom hooks for real-time data
 */
function useRealtimeMetrics(endpoint: string, interval: number = 5000) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const fetchData = async () => {
      try {
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result.data || result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    intervalId = setInterval(fetchData, interval);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [endpoint, interval]);

  return { data, loading, error };
}

/**
 * System Health Overview Component
 */
export const SystemHealthOverview: React.FC = () => {
  const { data: systemStatus, loading } = useRealtimeMetrics('/api/v1/monitoring/status');
  const { data: realtimeMetrics } = useRealtimeMetrics('/api/v1/monitoring/metrics/realtime');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up': 
      case 'healthy': 
        return 'text-green-500 bg-green-50';
      case 'degraded': 
        return 'text-yellow-500 bg-yellow-50';
      case 'down': 
        return 'text-red-500 bg-red-50';
      default: 
        return 'text-gray-500 bg-gray-50';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return <CheckCircle className="h-4 w-4" />;
      case 'degraded':
        return <AlertTriangle className="h-4 w-4" />;
      case 'down':
        return <XCircle className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className={`p-4 rounded-lg ${getStatusColor(systemStatus?.overall_status || 'unknown')}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Overall Status</p>
                  <p className="text-2xl font-bold capitalize">
                    {systemStatus?.overall_status || 'Unknown'}
                  </p>
                </div>
                {getStatusIcon(systemStatus?.overall_status || 'unknown')}
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-blue-50 text-blue-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Active Services</p>
                  <p className="text-2xl font-bold">
                    {Object.values(systemStatus?.services || {}).filter((s: any) => s.status === 'up').length}
                    <span className="text-sm font-normal">
                      /{Object.keys(systemStatus?.services || {}).length}
                    </span>
                  </p>
                </div>
                <Server className="h-6 w-6" />
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-purple-50 text-purple-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {realtimeMetrics?.average_response_time?.toFixed(0) || 0}
                    <span className="text-sm font-normal">ms</span>
                  </p>
                </div>
                <Zap className="h-6 w-6" />
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-orange-50 text-orange-700">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold">
                    {((realtimeMetrics?.error_rate || 0) * 100).toFixed(2)}
                    <span className="text-sm font-normal">%</span>
                  </p>
                </div>
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Status Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(systemStatus?.services || {}).map(([serviceName, service]: [string, any]) => (
              <div key={serviceName} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{serviceName}</h3>
                  <Badge className={getStatusColor(service.status)}>
                    {getStatusIcon(service.status)}
                    <span className="ml-1 capitalize">{service.status}</span>
                  </Badge>
                </div>
                {service.response_time && (
                  <p className="text-sm text-gray-600">
                    Response Time: {service.response_time}ms
                  </p>
                )}
                {service.error_rate !== undefined && (
                  <p className="text-sm text-gray-600">
                    Error Rate: {(service.error_rate * 100).toFixed(2)}%
                  </p>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  Last Check: {new Date(service.last_check).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Infrastructure Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Infrastructure Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(systemStatus?.infrastructure || {}).map(([component, status]: [string, any]) => (
              <div key={component} className="text-center p-4 border rounded-lg">
                <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full ${getStatusColor(status)}`}>
                  {getStatusIcon(status)}
                  <span className="text-sm font-medium capitalize">{status}</span>
                </div>
                <p className="text-sm font-medium mt-2 capitalize">
                  {component.replace('_', ' ')}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/**
 * Performance Metrics Dashboard
 */
export const PerformanceMetricsDashboard: React.FC = () => {
  const { data: performanceData } = useRealtimeMetrics('/api/v1/performance/metrics');
  const { data: historicalData } = useRealtimeMetrics('/api/v1/performance/metrics?period=24h');

  const webVitalsThresholds = {
    lcp: { good: 2500, poor: 4000 },
    fid: { good: 100, poor: 300 },
    cls: { good: 0.1, poor: 0.25 },
    fcp: { good: 1800, poor: 3000 },
    ttfb: { good: 800, poor: 1800 },
  };

  const getVitalRating = (metric: string, value: number) => {
    const threshold = webVitalsThresholds[metric as keyof typeof webVitalsThresholds];
    if (!threshold) return 'unknown';
    if (value <= threshold.good) return 'good';
    if (value <= threshold.poor) return 'needs-improvement';
    return 'poor';
  };

  const getVitalColor = (rating: string) => {
    switch (rating) {
      case 'good': return 'text-green-600 bg-green-50';
      case 'needs-improvement': return 'text-yellow-600 bg-yellow-50';
      case 'poor': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="space-y-6">
      {/* Core Web Vitals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Core Web Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {performanceData && Object.entries(performanceData.summary || {}).map(([metric, value]: [string, any]) => {
              const rating = getVitalRating(metric, value);
              return (
                <div key={metric} className={`p-4 rounded-lg ${getVitalColor(rating)}`}>
                  <div className="text-center">
                    <p className="text-xs font-medium uppercase tracking-wide">{metric.toUpperCase()}</p>
                    <p className="text-2xl font-bold">
                      {metric === 'cls' ? value.toFixed(3) : Math.round(value)}
                      {metric !== 'cls' && <span className="text-sm font-normal">ms</span>}
                    </p>
                    <p className="text-xs capitalize">{rating.replace('-', ' ')}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Performance Trends Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Trends (24h)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historicalData?.metrics || []}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="timestamp" 
                  tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                />
                <YAxis />
                <Tooltip 
                  labelFormatter={(value) => new Date(value).toLocaleString()}
                />
                <Line 
                  type="monotone" 
                  dataKey="average_response_time" 
                  stroke="#8884d8" 
                  name="Avg Response Time (ms)"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="error_rate" 
                  stroke="#82ca9d" 
                  name="Error Rate (%)"
                  strokeWidth={2}
                />
                <Line 
                  type="monotone" 
                  dataKey="requests_per_minute" 
                  stroke="#ffc658" 
                  name="Requests/min"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Resource Usage */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              System Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>CPU Usage</span>
                <span>{performanceData?.cpu_usage || 0}%</span>
              </div>
              <Progress value={performanceData?.cpu_usage || 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Memory Usage</span>
                <span>{performanceData?.memory_usage || 0}%</span>
              </div>
              <Progress value={performanceData?.memory_usage || 0} className="h-2" />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span>Disk Usage</span>
                <span>{performanceData?.disk_usage || 0}%</span>
              </div>
              <Progress value={performanceData?.disk_usage || 0} className="h-2" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Network & Connections
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Active Connections</span>
                <span className="text-2xl font-bold">{performanceData?.active_connections || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Requests/min</span>
                <span className="text-2xl font-bold">{performanceData?.requests_per_minute || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Avg Response Time</span>
                <span className="text-2xl font-bold">
                  {Math.round(performanceData?.average_response_time || 0)}
                  <span className="text-sm font-normal">ms</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * Alert Management Component
 */
export const AlertManagement: React.FC = () => {
  const { data: alerts, loading } = useRealtimeMetrics('/api/v1/monitoring/alerts/active');
  const [acknowledgedAlerts, setAcknowledgedAlerts] = useState<Set<string>>(new Set());

  const handleAcknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await fetch(`/api/v1/monitoring/alerts/${alertId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      setAcknowledgedAlerts(prev => new Set(prev.add(alertId)));
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  }, []);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-red-500 bg-red-50 text-red-700';
      case 'warning': return 'border-yellow-500 bg-yellow-50 text-yellow-700';
      case 'info': return 'border-blue-500 bg-blue-50 text-blue-700';
      default: return 'border-gray-500 bg-gray-50 text-gray-700';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'info': return <Eye className="h-5 w-5" />;
      default: return <Bell className="h-5 w-5" />;
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="border rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Active Alerts
          {alerts && alerts.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {alerts.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-2" />
            <p className="text-gray-600">No active alerts</p>
          </div>
        ) : (
          <div className="space-y-4">
            {alerts.map((alert: AlertData) => (
              <Alert key={alert.id} className={getSeverityColor(alert.severity)}>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">{alert.title}</h4>
                        <Badge variant="outline" className="text-xs">
                          {alert.service}
                        </Badge>
                        <Badge variant="outline" className={getSeverityColor(alert.severity)}>
                          {alert.severity.toUpperCase()}
                        </Badge>
                      </div>
                      <AlertDescription className="text-sm mb-2">
                        {alert.message}
                      </AlertDescription>
                      <p className="text-xs text-gray-500">
                        {new Date(alert.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  {!alert.acknowledged && !acknowledgedAlerts.has(alert.id) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="ml-4"
                    >
                      Acknowledge
                    </Button>
                  )}
                </div>
              </Alert>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

/**
 * Business Metrics Dashboard
 */
export const BusinessMetricsDashboard: React.FC = () => {
  const { data: businessMetrics } = useRealtimeMetrics('/api/v1/monitoring/business-metrics');

  const chartColors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c', '#8dd1e1'];

  return (
    <div className="space-y-6">
      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold">{businessMetrics?.active_users || 0}</p>
              </div>
              <Users className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Session Duration</p>
                <p className="text-2xl font-bold">
                  {Math.round((businessMetrics?.session_duration || 0) / 60)}
                  <span className="text-sm font-normal">min</span>
                </p>
              </div>
              <Clock className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Page Views</p>
                <p className="text-2xl font-bold">{businessMetrics?.page_views || 0}</p>
              </div>
              <Eye className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">ML Success Rate</p>
                <p className="text-2xl font-bold">
                  {((businessMetrics?.ml_operations?.success_rate || 0) * 100).toFixed(1)}
                  <span className="text-sm font-normal">%</span>
                </p>
              </div>
              <Zap className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Feature Usage Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Usage Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={Object.entries(businessMetrics?.feature_usage || {}).map(([name, value]) => ({
                    name,
                    value,
                  }))}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {Object.entries(businessMetrics?.feature_usage || {}).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ML Operations & Auth Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>ML/RL Operations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Operations</span>
                <span className="text-xl font-bold">
                  {businessMetrics?.ml_operations?.total_operations || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Success Rate</span>
                <span className="text-xl font-bold text-green-600">
                  {((businessMetrics?.ml_operations?.success_rate || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Avg Duration</span>
                <span className="text-xl font-bold">
                  {Math.round(businessMetrics?.ml_operations?.avg_duration || 0)}
                  <span className="text-sm font-normal">ms</span>
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Authentication Metrics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm font-medium">Total Logins</span>
                <span className="text-xl font-bold">
                  {businessMetrics?.auth_metrics?.total_logins || 0}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">Login Success Rate</span>
                <span className="text-xl font-bold text-green-600">
                  {((businessMetrics?.auth_metrics?.login_success_rate || 0) * 100).toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium">OAuth Usage</span>
                <span className="text-xl font-bold">
                  {businessMetrics?.auth_metrics?.oauth_usage || 0}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

/**
 * Main Monitoring Dashboard Component
 */
export const MonitoringDashboard: React.FC = () => {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">System Monitoring Dashboard</h1>
        <p className="text-gray-600">
          Real-time system observability and performance monitoring
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">System Overview</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="business">Business Metrics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <SystemHealthOverview />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <PerformanceMetricsDashboard />
        </TabsContent>

        <TabsContent value="alerts" className="space-y-6">
          <AlertManagement />
        </TabsContent>

        <TabsContent value="business" className="space-y-6">
          <BusinessMetricsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
};