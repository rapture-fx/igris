'use client'

import { useState } from 'react'
import { PageHeader, PageHeaderActions } from '@/components/ui/page-header'
import { 
  TrendingUp, 
  Plus, 
  RefreshCw,
  Settings,
  Bell,
  Activity,
  Cpu,
  MemoryStick,
  Database,
  AlertTriangle,
  CheckCircle,
  Clock,
  Target,
  BarChart3,
  Eye,
  Download,
  Filter,
  Search,
  Calendar,
  Users,
  Zap,
  Shield,
  Server,
  Network,
  HardDrive,
  Gauge
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { cn, formatNumber, getTimeAgo } from '@/lib/utils'

interface MetricCard {
  title: string
  value: string | number
  change: string
  trend: 'up' | 'down' | 'stable'
  icon: React.ComponentType<any>
  color: string
}

interface Alert {
  id: string
  title: string
  description: string
  severity: 'critical' | 'warning' | 'info'
  timestamp: string
  source: string
  status: 'active' | 'resolved' | 'acknowledged'
}

const systemMetrics: MetricCard[] = [
  {
    title: 'CPU Usage',
    value: '67%',
    change: '+2.3%',
    trend: 'up',
    icon: Cpu,
    color: 'text-blue-600'
  },
  {
    title: 'Memory Usage',
    value: '4.2GB',
    change: '-0.8%',
    trend: 'down',
    icon: MemoryStick,
    color: 'text-green-600'
  },
  {
    title: 'Active Models',
    value: 12,
    change: '+1',
    trend: 'up',
    icon: Target,
    color: 'text-purple-600'
  },
  {
    title: 'Avg Response Time',
    value: '234ms',
    change: '-12ms',
    trend: 'down',
    icon: Clock,
    color: 'text-orange-600'
  }
]

const modelMetrics: MetricCard[] = [
  {
    title: 'Inference Rate',
    value: '1.2K/min',
    change: '+15%',
    trend: 'up',
    icon: Activity,
    color: 'text-blue-600'
  },
  {
    title: 'Model Accuracy',
    value: '94.7%',
    change: '+0.3%',
    trend: 'up',
    icon: Target,
    color: 'text-green-600'
  },
  {
    title: 'Error Rate',
    value: '0.12%',
    change: '-0.05%',
    trend: 'down',
    icon: AlertTriangle,
    color: 'text-red-600'
  },
  {
    title: 'Throughput',
    value: '850/s',
    change: '+8%',
    trend: 'up',
    icon: TrendingUp,
    color: 'text-purple-600'
  }
]

const mockAlerts: Alert[] = [
  {
    id: '1',
    title: 'High CPU Usage Detected',
    description: 'CPU usage has exceeded 80% for more than 5 minutes',
    severity: 'warning',
    timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
    source: 'System Monitor',
    status: 'active'
  },
  {
    id: '2',
    title: 'Model Accuracy Drop',
    description: 'Classification model accuracy dropped below 90%',
    severity: 'critical',
    timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    source: 'Model Monitor',
    status: 'acknowledged'
  },
  {
    id: '3',
    title: 'Database Connection Pool Full',
    description: 'Connection pool utilization at 95%',
    severity: 'warning',
    timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    source: 'Database Monitor',
    status: 'resolved'
  }
]

export default function MonitoringPage() {
  const [activeTab, setActiveTab] = useState<'system' | 'models' | 'alerts'>('system')
  const [isRefreshing, setIsRefreshing] = useState(false)

  const handleRefresh = async () => {
    setIsRefreshing(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setIsRefreshing(false)
  }

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical': return 'bg-red-50 text-red-700 border-red-200'
      case 'warning': return 'bg-yellow-50 text-yellow-700 border-yellow-200'
      case 'info': return 'bg-blue-50 text-blue-700 border-blue-200'
    }
  }

  const getStatusColor = (status: Alert['status']) => {
    switch (status) {
      case 'active': return 'bg-red-100 text-red-800'
      case 'acknowledged': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-green-100 text-green-800'
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="System Monitoring"
        description="Monitor AI models, system performance, and infrastructure health in real-time."
        breadcrumbs={[
          { label: 'Dashboard', href: '/dashboard' },
          { label: 'Monitoring' }
        ]}
        stats={[
          {
            label: 'System Health',
            value: 'Good',
            icon: CheckCircle,
            color: 'green'
          },
          {
            label: 'Active Alerts',
            value: mockAlerts.filter(a => a.status === 'active').length,
            icon: AlertTriangle,
            color: 'red'
          },
          {
            label: 'Uptime',
            value: '99.9%',
            icon: Activity,
            color: 'green'
          },
          {
            label: 'Models Running',
            value: 12,
            icon: Target,
            color: 'blue'
          }
        ]}
        actions={
          <div className="flex items-center gap-2">
            <PageHeaderActions.Refresh 
              onClick={handleRefresh}
              isLoading={isRefreshing}
              tooltip="Refresh metrics"
            />
            <PageHeaderActions.Secondary
              icon={Settings}
              onClick={() => {}}
            >
              Configure
            </PageHeaderActions.Secondary>
            <PageHeaderActions.Primary
              icon={Bell}
              onClick={() => {}}
            >
              Setup Alerts
            </PageHeaderActions.Primary>
          </div>
        }
      />

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg w-fit">
        {[
          { id: 'system', label: 'System', icon: Server },
          { id: 'models', label: 'Models', icon: Target },
          { id: 'alerts', label: 'Alerts', icon: AlertTriangle }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* System Metrics */}
      {activeTab === 'system' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {systemMetrics.map((metric) => (
              <Card key={metric.title} className="border-gray-200/60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                        <metric.icon className={cn("w-5 h-5", metric.color)} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{metric.title}</p>
                        <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      metric.trend === 'up' ? 'text-green-600 border-green-200' :
                      metric.trend === 'down' ? 'text-red-600 border-red-200' :
                      'text-gray-600 border-gray-200'
                    )}>
                      {metric.change}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* System Status Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="border-gray-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-blue-600" />
                  Infrastructure Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'API Server', status: 'healthy', uptime: '99.9%' },
                  { name: 'Database', status: 'healthy', uptime: '99.8%' },
                  { name: 'Cache Layer', status: 'healthy', uptime: '99.9%' },
                  { name: 'Message Queue', status: 'degraded', uptime: '97.2%' }
                ].map((service) => (
                  <div key={service.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-2 h-2 rounded-full",
                        service.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                      )} />
                      <span className="text-sm text-gray-900">{service.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn(
                        service.status === 'healthy' 
                          ? 'text-green-600 border-green-200 bg-green-50' 
                          : 'text-yellow-600 border-yellow-200 bg-yellow-50'
                      )}>
                        {service.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{service.uptime}</span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-gray-200/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-purple-600" />
                  Resource Usage
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { name: 'CPU', usage: 67, limit: 80 },
                  { name: 'Memory', usage: 45, limit: 80 },
                  { name: 'Disk', usage: 23, limit: 90 },
                  { name: 'Network', usage: 12, limit: 70 }
                ].map((resource) => (
                  <div key={resource.name} className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">{resource.name}</span>
                      <span className="font-medium">{resource.usage}%</span>
                    </div>
                    <Progress 
                      value={resource.usage} 
                      className={cn(
                        "h-2",
                        resource.usage > resource.limit ? 'bg-red-100' : 'bg-gray-100'
                      )}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Model Metrics */}
      {activeTab === 'models' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {modelMetrics.map((metric) => (
              <Card key={metric.title} className="border-gray-200/60">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                        <metric.icon className={cn("w-5 h-5", metric.color)} />
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">{metric.title}</p>
                        <p className="text-2xl font-bold text-gray-900">{metric.value}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      metric.trend === 'up' ? 'text-green-600 border-green-200' :
                      metric.trend === 'down' ? 'text-red-600 border-red-200' :
                      'text-gray-600 border-gray-200'
                    )}>
                      {metric.change}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Model Performance */}
          <Card className="border-gray-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-purple-600" />
                Model Performance
              </CardTitle>
              <CardDescription>
                Real-time performance metrics for deployed models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Model Performance Dashboard
                </h3>
                <p className="text-gray-600 mb-4">
                  Detailed model performance metrics and analytics coming soon.
                </p>
                <Button
                  onClick={() => {}}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Configure Monitoring
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Alerts */}
      {activeTab === 'alerts' && (
        <div className="space-y-6">
          <Card className="border-gray-200/60">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Active Alerts
              </CardTitle>
              <CardDescription>
                Monitor and manage system alerts and notifications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {mockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "p-4 rounded-lg border",
                      getSeverityColor(alert.severity)
                    )}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-semibold">{alert.title}</h4>
                          <Badge className={getStatusColor(alert.status)}>
                            {alert.status}
                          </Badge>
                        </div>
                        <p className="text-sm mb-2">{alert.description}</p>
                        <div className="flex items-center gap-4 text-xs text-gray-500">
                          <span>{alert.source}</span>
                          <span>{getTimeAgo(alert.timestamp)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm">
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
} 