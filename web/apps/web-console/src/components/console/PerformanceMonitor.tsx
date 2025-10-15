'use client'

import React, { useState, useEffect, useRef } from 'react'
import { 
  Activity, 
  Zap, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  BarChart3,
  Monitor,
  Wifi,
  WifiOff,
  Gauge,
  Timer,
  Target,
  Flame
} from 'lucide-react'
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'

interface PerformanceMetrics {
  timestamp: string
  responseTime: number
  throughput: number
  errorRate: number
  activeConnections: number
  cpuUsage: number
  memoryUsage: number
  requestsPerSecond: number
  p95ResponseTime: number
  p99ResponseTime: number
}

interface EndpointMetrics {
  endpoint: string
  method: string
  totalRequests: number
  averageResponseTime: number
  errorRate: number
  lastRequested: string
  status: 'healthy' | 'warning' | 'critical'
}

interface AlertRule {
  id: string
  name: string
  metric: string
  operator: '>' | '<' | '=' | '>=' | '<='
  threshold: number
  enabled: boolean
  triggered: boolean
  lastTriggered?: string
}

export function PerformanceMonitor() {
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([])
  const [endpointMetrics, setEndpointMetrics] = useState<EndpointMetrics[]>([])
  const [alerts, setAlerts] = useState<AlertRule[]>([])
  const [isConnected, setIsConnected] = useState(false)
  const [selectedTimeRange, setSelectedTimeRange] = useState<'1h' | '6h' | '24h' | '7d'>('1h')
  const [autoRefresh, setAutoRefresh] = useState(true)
  const intervalRef = useRef<NodeJS.Timeout>()

  // Simulate real-time data
  useEffect(() => {
    const generateMockData = (): PerformanceMetrics => {
      const now = new Date()
      const baseResponseTime = 45 + Math.random() * 30
      const spike = Math.random() > 0.95 ? Math.random() * 200 : 0
      
      return {
        timestamp: now.toISOString(),
        responseTime: baseResponseTime + spike,
        throughput: 1200 + Math.random() * 400,
        errorRate: Math.random() * 2 + (spike > 0 ? Math.random() * 5 : 0),
        activeConnections: 150 + Math.random() * 100,
        cpuUsage: 35 + Math.random() * 30 + (spike > 0 ? Math.random() * 20 : 0),
        memoryUsage: 60 + Math.random() * 20,
        requestsPerSecond: 15 + Math.random() * 10,
        p95ResponseTime: baseResponseTime * 1.5 + spike,
        p99ResponseTime: baseResponseTime * 2 + spike
      }
    }

    const generateEndpointMetrics = (): EndpointMetrics[] => [
      {
        endpoint: '/api/v1/manufacturing/digital-twin/create',
        method: 'POST',
        totalRequests: 1250,
        averageResponseTime: 85,
        errorRate: 0.8,
        lastRequested: '2 minutes ago',
        status: 'healthy'
      },
      {
        endpoint: '/api/v1/datasets/search',
        method: 'GET',
        totalRequests: 3400,
        averageResponseTime: 35,
        errorRate: 0.2,
        lastRequested: '30 seconds ago',
        status: 'healthy'
      },
      {
        endpoint: '/api/v1/experiments/create',
        method: 'POST',
        totalRequests: 890,
        averageResponseTime: 120,
        errorRate: 2.1,
        lastRequested: '5 minutes ago',
        status: 'warning'
      },
      {
        endpoint: '/api/v1/streaming/setup',
        method: 'POST',
        totalRequests: 450,
        averageResponseTime: 250,
        errorRate: 5.2,
        lastRequested: '1 minute ago',
        status: 'critical'
      }
    ]

    const generateAlerts = (): AlertRule[] => [
      {
        id: '1',
        name: 'High Response Time',
        metric: 'responseTime',
        operator: '>',
        threshold: 200,
        enabled: true,
        triggered: false
      },
      {
        id: '2',
        name: 'High Error Rate',
        metric: 'errorRate',
        operator: '>',
        threshold: 5,
        enabled: true,
        triggered: false
      },
      {
        id: '3',
        name: 'High CPU Usage',
        metric: 'cpuUsage',
        operator: '>',
        threshold: 80,
        enabled: true,
        triggered: false
      },
      {
        id: '4',
        name: 'Low Throughput',
        metric: 'throughput',
        operator: '<',
        threshold: 800,
        enabled: false,
        triggered: false
      }
    ]

    // Initialize data
    const initialData = Array.from({ length: 60 }, (_, i) => {
      const timestamp = new Date()
      timestamp.setMinutes(timestamp.getMinutes() - (59 - i))
      return {
        ...generateMockData(),
        timestamp: timestamp.toISOString()
      }
    })

    setMetrics(initialData)
    setEndpointMetrics(generateEndpointMetrics())
    setAlerts(generateAlerts())
    setIsConnected(true)

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        const newMetric = generateMockData()
        
        setMetrics(prev => {
          const updated = [...prev.slice(1), newMetric]
          
          // Check alerts
          setAlerts(prevAlerts => 
            prevAlerts.map(alert => {
              if (!alert.enabled) return alert
              
              const metricValue = newMetric[alert.metric as keyof PerformanceMetrics] as number
              const shouldTrigger = checkAlertCondition(metricValue, alert.operator, alert.threshold)
              
              if (shouldTrigger && !alert.triggered) {
                return {
                  ...alert,
                  triggered: true,
                  lastTriggered: new Date().toISOString()
                }
              } else if (!shouldTrigger && alert.triggered) {
                return { ...alert, triggered: false }
              }
              
              return alert
            })
          )
          
          return updated
        })

        // Occasionally update endpoint metrics
        if (Math.random() > 0.8) {
          setEndpointMetrics(generateEndpointMetrics())
        }
      }, 2000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh])

  const checkAlertCondition = (value: number, operator: string, threshold: number): boolean => {
    switch (operator) {
      case '>': return value > threshold
      case '<': return value < threshold
      case '>=': return value >= threshold
      case '<=': return value <= threshold
      case '=': return value === threshold
      default: return false
    }
  }

  const getCurrentMetrics = () => {
    if (metrics.length === 0) return null
    return metrics[metrics.length - 1]
  }

  const getStatusColor = (status: EndpointMetrics['status']) => {
    switch (status) {
      case 'healthy': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'warning': return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
      case 'critical': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const activeAlerts = alerts.filter(alert => alert.triggered)
  const currentMetric = getCurrentMetrics()

  const errorDistribution = [
    { name: '2xx Success', value: 85, color: '#10B981' },
    { name: '4xx Client Error', value: 10, color: '#F59E0B' },
    { name: '5xx Server Error', value: 5, color: '#EF4444' }
  ]

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Monitor className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                Performance Monitor
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time API performance and health monitoring
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Connection Status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isConnected 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {isConnected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
              <span>{isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>

            {/* Time Range Selector */}
            <select
              value={selectedTimeRange}
              onChange={(e) => setSelectedTimeRange(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
            </select>

            {/* Auto Refresh Toggle */}
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center space-x-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                autoRefresh
                  ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                  : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
              }`}
            >
              <Activity className={`w-4 h-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              <span>Auto Refresh</span>
            </button>
          </div>
        </div>

        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <span className="text-red-800 dark:text-red-300 font-medium">
                {activeAlerts.length} Active Alert{activeAlerts.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {activeAlerts.map(alert => (
                <div key={alert.id} className="text-sm text-red-700 dark:text-red-400">
                  {alert.name}: {alert.metric} {alert.operator} {alert.threshold}
                  {alert.lastTriggered && (
                    <span className="text-red-600 dark:text-red-500 ml-2">
                      (triggered {new Date(alert.lastTriggered).toLocaleTimeString()})
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Metrics Overview */}
      <div className="p-6 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {currentMetric && [
            {
              label: 'Response Time',
              value: `${currentMetric.responseTime.toFixed(0)}ms`,
              icon: Clock,
              trend: 'stable',
              color: currentMetric.responseTime > 100 ? 'red' : 'green'
            },
            {
              label: 'Throughput',
              value: `${currentMetric.throughput.toFixed(0)}/min`,
              icon: Zap,
              trend: 'up',
              color: 'blue'
            },
            {
              label: 'Error Rate',
              value: `${currentMetric.errorRate.toFixed(1)}%`,
              icon: AlertTriangle,
              trend: 'down',
              color: currentMetric.errorRate > 5 ? 'red' : 'green'
            },
            {
              label: 'Active Connections',
              value: currentMetric.activeConnections.toFixed(0),
              icon: Wifi,
              trend: 'stable',
              color: 'purple'
            },
            {
              label: 'CPU Usage',
              value: `${currentMetric.cpuUsage.toFixed(1)}%`,
              icon: Gauge,
              trend: 'stable',
              color: currentMetric.cpuUsage > 80 ? 'red' : 'green'
            },
            {
              label: 'Requests/sec',
              value: currentMetric.requestsPerSecond.toFixed(1),
              icon: Target,
              trend: 'up',
              color: 'green'
            }
          ].map(({ label, value, icon: Icon, color }, index) => (
            <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${
                  color === 'red' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                  color === 'green' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' :
                  color === 'blue' ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' :
                  color === 'purple' ? 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400' :
                  'bg-gray-100 text-gray-600 dark:bg-gray-600 dark:text-gray-400'
                }`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {value}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">
                    {label}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Response Time Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Response Time Trends
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    stroke="#6B7280"
                  />
                  <YAxis stroke="#6B7280" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                    formatter={(value: number) => [`${value.toFixed(0)}ms`, 'Response Time']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="responseTime" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="p95ResponseTime" 
                    stroke="#F59E0B" 
                    strokeWidth={1}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Throughput Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Throughput & Error Rate
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="timestamp" 
                    tickFormatter={(value) => new Date(value).toLocaleTimeString()}
                    stroke="#6B7280"
                  />
                  <YAxis yAxisId="left" stroke="#6B7280" />
                  <YAxis yAxisId="right" orientation="right" stroke="#EF4444" />
                  <Tooltip 
                    labelFormatter={(value) => new Date(value).toLocaleString()}
                  />
                  <Area 
                    yAxisId="left"
                    type="monotone" 
                    dataKey="throughput" 
                    stackId="1"
                    stroke="#10B981" 
                    fill="#10B981" 
                    fillOpacity={0.3}
                  />
                  <Line 
                    yAxisId="right"
                    type="monotone" 
                    dataKey="errorRate" 
                    stroke="#EF4444" 
                    strokeWidth={2}
                    dot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Endpoint Performance */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Endpoint Performance
            </h3>
            <div className="space-y-4">
              {endpointMetrics.map((endpoint, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                        endpoint.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                      }`}>
                        {endpoint.method}
                      </span>
                      <span className="font-mono text-sm text-gray-900 dark:text-white">
                        {endpoint.endpoint}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(endpoint.status)}`}>
                        {endpoint.status}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                      Last requested: {endpoint.lastRequested}
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {endpoint.totalRequests.toLocaleString()} requests
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      {endpoint.averageResponseTime}ms avg • {endpoint.errorRate}% errors
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Status Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Response Status Distribution
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {errorDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value}%`} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-4 space-y-2">
              {errorDistribution.map((entry, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: entry.color }}
                    />
                    <span className="text-gray-700 dark:text-gray-300">{entry.name}</span>
                  </div>
                  <span className="text-gray-900 dark:text-white font-medium">{entry.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}