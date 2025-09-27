'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Alert,
  AlertDescription,
  AlertTitle
} from '@/components/ui/alert'
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Clock,
  Database,
  Network,
  Server,
  Zap,
  Download,
  RefreshCw
} from 'lucide-react'

interface MetricsDashboardProps {
  customerId: string
  apiKey: string
}

interface DashboardData {
  customer_id: string
  plan_tier: string
  time_range: {
    start: string
    end: string
    duration: string
  }
  overall_health: string
  sla: {
    services: Record<string, any>
    active_alerts: any[]
    recent_metrics: any[]
  }
  streaming: {
    active_connections: number
    max_connections: number
    connections: any[]
    daily_usage: any
    limits: any
  }
  ml: {
    active_jobs: number
    allowed_frameworks: string[]
    daily_usage: any
    current_limits: any
    feature_access: any
    recent_activity: any[]
  }
  performance_summary: any
  usage_trends: any
  quota_utilization: any
}

interface LiveMetrics {
  timestamp: string
  customer_id: string
  current_api_rate: number
  active_connections: number
  cpu_usage: number
  memory_usage: number
  recent_errors: number
  health_status: string
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8']

const MetricsDashboard: React.FC<MetricsDashboardProps> = ({ customerId, apiKey }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null)
  const [liveMetrics, setLiveMetrics] = useState<LiveMetrics | null>(null)
  const [timeRange, setTimeRange] = useState('1h')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRealTimeEnabled, setIsRealTimeEnabled] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    fetchDashboardData()
  }, [customerId, timeRange])

  useEffect(() => {
    if (isRealTimeEnabled) {
      connectWebSocket()
    } else {
      disconnectWebSocket()
    }

    return () => disconnectWebSocket()
  }, [isRealTimeEnabled, customerId])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await fetch(
        `/api/v1/metrics/dashboard/${customerId}?time_range=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      setDashboardData(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const connectWebSocket = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const wsUrl = `${protocol}//${window.location.host}/api/v1/metrics/live/${customerId}`

    wsRef.current = new WebSocket(wsUrl)

    wsRef.current.onopen = () => {
      console.log('WebSocket connected')
    }

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        setLiveMetrics(data)
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err)
      }
    }

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error)
    }

    wsRef.current.onclose = () => {
      console.log('WebSocket disconnected')
      // Attempt to reconnect after 5 seconds
      if (isRealTimeEnabled) {
        setTimeout(connectWebSocket, 5000)
      }
    }
  }

  const disconnectWebSocket = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
  }

  const exportMetrics = async (format: 'json' | 'csv') => {
    try {
      const response = await fetch(
        `/api/v1/metrics/export/${customerId}?format=${format}&time_range=${timeRange}`,
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      )

      if (!response.ok) {
        throw new Error(`Export failed: ${response.status}`)
      }

      const data = await response.json()

      // Download the file
      const blob = new Blob([format === 'csv' ? data.csv_data : JSON.stringify(data, null, 2)], {
        type: format === 'csv' ? 'text/csv' : 'application/json'
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `metrics-${customerId}-${new Date().toISOString().split('T')[0]}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed')
    }
  }

  const getHealthBadgeColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-500'
      case 'warning': return 'bg-yellow-500'
      case 'critical': return 'bg-orange-500'
      case 'breach': return 'bg-red-500'
      default: return 'bg-gray-500'
    }
  }

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />
      case 'warning': return <AlertTriangle className="h-4 w-4" />
      case 'critical':
      case 'breach': return <AlertTriangle className="h-4 w-4" />
      default: return <Activity className="h-4 w-4" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    )
  }

  if (error) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    )
  }

  if (!dashboardData) {
    return <div>No data available</div>
  }

  // Prepare chart data
  const responseTimeData = dashboardData.sla.recent_metrics
    .filter(m => m.metric === 'response_time_p95')
    .map(m => ({
      time: new Date(m.timestamp).toLocaleTimeString(),
      value: m.value
    }))

  const quotaData = Object.entries(dashboardData.quota_utilization).map(([key, value]: [string, any]) => ({
    name: key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
    used: value.used || value.used_gb || 0,
    limit: value.limit || value.limit_gb || 0,
    percentage: value.percentage
  }))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Metrics Dashboard</h1>
          <p className="text-gray-600">
            Customer: {customerId} | Plan: {dashboardData.plan_tier}
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last Hour</SelectItem>
              <SelectItem value="6h">Last 6 Hours</SelectItem>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant={isRealTimeEnabled ? "default" : "outline"}
            onClick={() => setIsRealTimeEnabled(!isRealTimeEnabled)}
          >
            <Activity className="h-4 w-4 mr-2" />
            Real-time
          </Button>

          <Button variant="outline" onClick={() => exportMetrics('json')}>
            <Download className="h-4 w-4 mr-2" />
            Export JSON
          </Button>

          <Button variant="outline" onClick={() => exportMetrics('csv')}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>

          <Button variant="outline" onClick={fetchDashboardData}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            {getHealthIcon(dashboardData.overall_health)}
            <span className="ml-2">Overall Health</span>
            <Badge className={`ml-auto ${getHealthBadgeColor(dashboardData.overall_health)} text-white`}>
              {dashboardData.overall_health.toUpperCase()}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {dashboardData.sla.active_alerts.length > 0 && (
            <Alert className="mb-4">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Active Alerts ({dashboardData.sla.active_alerts.length})</AlertTitle>
              <AlertDescription>
                {dashboardData.sla.active_alerts.slice(0, 3).map((alert, idx) => (
                  <div key={idx} className="text-sm">
                    {alert.title} - {alert.severity}
                  </div>
                ))}
              </AlertDescription>
            </Alert>
          )}

          {liveMetrics && isRealTimeEnabled && (
            <div className="grid grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">API Rate:</span>
                <span className="ml-2 font-semibold">{liveMetrics.current_api_rate} req/min</span>
              </div>
              <div>
                <span className="text-gray-600">Active Connections:</span>
                <span className="ml-2 font-semibold">{liveMetrics.active_connections}</span>
              </div>
              <div>
                <span className="text-gray-600">CPU:</span>
                <span className="ml-2 font-semibold">{liveMetrics.cpu_usage}%</span>
              </div>
              <div>
                <span className="text-gray-600">Memory:</span>
                <span className="ml-2 font-semibold">{liveMetrics.memory_usage}%</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="h-4 w-4 mr-2" />
              Response Time
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.performance_summary.avg_response_time}s
            </div>
            <div className="text-sm text-gray-600">
              P95: {dashboardData.performance_summary.p95_response_time}s
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Activity className="h-4 w-4 mr-2" />
              Uptime
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.performance_summary.uptime_percentage}%
            </div>
            <div className="text-sm text-gray-600">
              {dashboardData.performance_summary.total_requests.toLocaleString()} requests
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Network className="h-4 w-4 mr-2" />
              Streaming
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.streaming.active_connections}/{dashboardData.streaming.max_connections}
            </div>
            <div className="text-sm text-gray-600">Active connections</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Zap className="h-4 w-4 mr-2" />
              ML Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {dashboardData.ml.active_jobs}
            </div>
            <div className="text-sm text-gray-600">
              {dashboardData.ml.daily_usage?.training_jobs || 0} today
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Response Time Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Response Time Trend</CardTitle>
            <CardDescription>95th percentile response time over time</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#8884d8"
                  strokeWidth={2}
                  name="Response Time (s)"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quota Utilization Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Quota Utilization</CardTitle>
            <CardDescription>Current usage vs limits</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={quotaData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="percentage" fill="#8884d8" name="Usage %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent ML Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dashboardData.ml.recent_activity.slice(0, 5).map((activity, idx) => (
              <div key={idx} className="flex items-center justify-between text-sm border-b pb-2">
                <div>
                  <span className="font-semibold">{activity.framework}</span> - {activity.operation}
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={activity.success ? "default" : "destructive"}>
                    {activity.success ? "Success" : "Failed"}
                  </Badge>
                  <span className="text-gray-600">
                    {new Date(activity.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default MetricsDashboard