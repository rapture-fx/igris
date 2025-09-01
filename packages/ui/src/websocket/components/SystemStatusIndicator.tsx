import React, { useMemo } from 'react'
import { Server, Cpu, HardDrive, Zap, Thermometer, Activity, AlertTriangle, CheckCircle } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'
import { SystemStatus } from '@schlep-engine/types'
import { useSystemStatus } from '../hooks'
import { cn } from '../../styles/utils'

export interface SystemStatusIndicatorProps {
  showDetails?: boolean
  showHistory?: boolean
  compact?: boolean
  className?: string
}

export function SystemStatusIndicator({ 
  showDetails = true,
  showHistory = false,
  compact = false,
  className 
}: SystemStatusIndicatorProps) {
  const { systemStatus, statusHistory, resources, services, activeJobs, queueStatus, isConnected } = useSystemStatus()

  const systemHealth = useMemo(() => {
    if (!systemStatus) return { overall: 'unknown', score: 0 }

    const resourceScore = resources ? (
      (100 - resources.cpu.usage) * 0.3 +
      (100 - resources.memory.usage) * 0.3 +
      (resources.gpu ? (100 - resources.gpu.usage) * 0.2 : 20) +
      (100 - resources.disk.usage) * 0.2
    ) / 100 : 0.5

    const serviceScore = services.length > 0 
      ? services.filter(s => s.status === 'healthy').length / services.length 
      : 1

    const queueScore = queueStatus 
      ? Math.max(0, 1 - (queueStatus.failed / Math.max(1, queueStatus.pending + queueStatus.processing + queueStatus.failed)))
      : 1

    const overallScore = (resourceScore * 0.5 + serviceScore * 0.3 + queueScore * 0.2)

    let overall: 'healthy' | 'warning' | 'critical' | 'unknown'
    if (overallScore > 0.8) overall = 'healthy'
    else if (overallScore > 0.6) overall = 'warning'
    else overall = 'critical'

    return { overall, score: overallScore * 100 }
  }, [systemStatus, resources, services, queueStatus])

  const chartData = useMemo(() => {
    return statusHistory.slice(-20).map((status, index) => ({
      time: index,
      cpu: status.resources.cpu.usage,
      memory: status.resources.memory.usage,
      gpu: status.resources.gpu?.usage || 0,
      disk: status.resources.disk.usage
    }))
  }, [statusHistory])

  const ResourceCard = ({ 
    title, 
    usage, 
    total, 
    unit = '%',
    icon: Icon,
    temperature 
  }: {
    title: string
    usage: number
    total?: number
    unit?: string
    icon: React.ComponentType<any>
    temperature?: number
  }) => {
    const getUsageColor = (usage: number) => {
      if (usage > 90) return 'text-red-600'
      if (usage > 75) return 'text-yellow-600'
      return 'text-green-600'
    }

    const getBarColor = (usage: number) => {
      if (usage > 90) return 'bg-red-500'
      if (usage > 75) return 'bg-yellow-500'
      return 'bg-green-500'
    }

    return (
      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Icon className="h-4 w-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">{title}</span>
          </div>
          {temperature && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Thermometer className="h-3 w-3" />
              <span>{temperature}°C</span>
            </div>
          )}
        </div>
        
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className={cn("text-2xl font-bold", getUsageColor(usage))}>
              {usage.toFixed(1)}{unit}
            </span>
            {total && (
              <span className="text-sm text-gray-500">
                / {total.toFixed(1)} {unit === '%' ? 'GB' : unit}
              </span>
            )}
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className={cn("h-2 rounded-full transition-all duration-300", getBarColor(usage))}
              style={{ width: `${Math.min(100, usage)}%` }}
            />
          </div>
        </div>
      </div>
    )
  }

  if (!systemStatus && !isConnected) {
    return (
      <div className={cn("p-6 text-center text-gray-500 bg-gray-50 rounded-lg border", className)}>
        <Server className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>System status unavailable</p>
        <p className="text-sm">Not connected to monitoring service</p>
      </div>
    )
  }

  if (compact) {
    return (
      <div className={cn("flex items-center space-x-2", className)}>
        <div className={cn(
          "w-3 h-3 rounded-full",
          systemHealth.overall === 'healthy' && "bg-green-500",
          systemHealth.overall === 'warning' && "bg-yellow-500",
          systemHealth.overall === 'critical' && "bg-red-500",
          systemHealth.overall === 'unknown' && "bg-gray-400"
        )} />
        <span className="text-sm font-medium text-gray-700">
          System {systemHealth.overall}
        </span>
        {systemHealth.score > 0 && (
          <span className="text-xs text-gray-500">
            ({systemHealth.score.toFixed(0)}%)
          </span>
        )}
      </div>
    )
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={cn(
            "p-2 rounded-lg",
            systemHealth.overall === 'healthy' && "bg-green-100",
            systemHealth.overall === 'warning' && "bg-yellow-100",
            systemHealth.overall === 'critical' && "bg-red-100",
            systemHealth.overall === 'unknown' && "bg-gray-100"
          )}>
            <Server className={cn(
              "h-6 w-6",
              systemHealth.overall === 'healthy' && "text-green-600",
              systemHealth.overall === 'warning' && "text-yellow-600",
              systemHealth.overall === 'critical' && "text-red-600",
              systemHealth.overall === 'unknown' && "text-gray-500"
            )} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">System Status</h2>
            <p className="text-sm text-gray-600">
              Overall health: {systemHealth.overall} ({systemHealth.score.toFixed(0)}%)
            </p>
          </div>
        </div>
        
        <div className={cn(
          "flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium",
          isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        )}>
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-green-500" : "bg-red-500"
          )} />
          <span>{isConnected ? 'Live' : 'Offline'}</span>
        </div>
      </div>

      {/* Resource Usage */}
      {showDetails && resources && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">Resource Usage</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <ResourceCard
              title="CPU"
              usage={resources.cpu.usage}
              icon={Cpu}
              temperature={resources.cpu.temperature}
            />
            
            <ResourceCard
              title="Memory"
              usage={resources.memory.usage}
              total={resources.memory.total / (1024 * 1024 * 1024)} // Convert to GB
              icon={HardDrive}
            />
            
            {resources.gpu && (
              <ResourceCard
                title="GPU"
                usage={resources.gpu.usage}
                icon={Zap}
                temperature={resources.gpu.temperature}
              />
            )}
            
            <ResourceCard
              title="Disk"
              usage={resources.disk.usage}
              total={resources.disk.total / (1024 * 1024 * 1024)} // Convert to GB
              icon={HardDrive}
            />
          </div>
        </div>
      )}

      {/* Historical Chart */}
      {showHistory && chartData.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Resource History</h3>
          
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip 
                formatter={(value, name) => [`${Number(value).toFixed(1)}%`, name]}
              />
              <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU" />
              <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} dot={false} name="Memory" />
              {chartData.some(d => d.gpu > 0) && (
                <Line type="monotone" dataKey="gpu" stroke="#8b5cf6" strokeWidth={2} dot={false} name="GPU" />
              )}
              <Line type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={2} dot={false} name="Disk" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Services Status */}
      {showDetails && services.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Health</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  {service.status === 'healthy' ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <div className="font-medium text-gray-900">{service.name}</div>
                    {service.responseTime && (
                      <div className="text-xs text-gray-500">
                        {service.responseTime}ms response
                      </div>
                    )}
                  </div>
                </div>
                
                <div className={cn(
                  "px-2 py-1 rounded text-xs font-medium",
                  service.status === 'healthy' && "bg-green-100 text-green-800",
                  service.status === 'degraded' && "bg-yellow-100 text-yellow-800",
                  service.status === 'unhealthy' && "bg-red-100 text-red-800"
                )}>
                  {service.status}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Jobs Summary */}
      {showDetails && activeJobs && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Operations</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {activeJobs.training || 0}
              </div>
              <div className="text-sm text-gray-600">Training</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {activeJobs.inference || 0}
              </div>
              <div className="text-sm text-gray-600">Inference</div>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {activeJobs.dataProcessing || 0}
              </div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-600">
                {activeJobs.total || 0}
              </div>
              <div className="text-sm text-gray-600">Total</div>
            </div>
          </div>
        </div>
      )}

      {/* Queue Status */}
      {showDetails && queueStatus && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Queue Status</h3>
          
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {queueStatus.pending}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {queueStatus.processing}
              </div>
              <div className="text-sm text-gray-600">Processing</div>
            </div>
            
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {queueStatus.failed}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Compact system indicator for headers/navigation
export function SystemStatusBadge({ className }: { className?: string }) {
  const { systemStatus, isConnected } = useSystemStatus()

  const getHealthColor = () => {
    if (!isConnected) return 'bg-gray-500'
    if (!systemStatus) return 'bg-yellow-500'

    const cpuHigh = systemStatus.resources.cpu.usage > 80
    const memoryHigh = systemStatus.resources.memory.usage > 80
    const hasUnhealthyServices = systemStatus.services.some(s => s.status === 'unhealthy')
    const hasFailedJobs = systemStatus.queueStatus.failed > 5

    if (hasUnhealthyServices || hasFailedJobs) return 'bg-red-500'
    if (cpuHigh || memoryHigh) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  const getStatusText = () => {
    if (!isConnected) return 'Offline'
    if (!systemStatus) return 'Loading'

    const unhealthyServices = systemStatus.services.filter(s => s.status === 'unhealthy').length
    if (unhealthyServices > 0) return `${unhealthyServices} service issues`

    if (systemStatus.queueStatus.failed > 5) return `${systemStatus.queueStatus.failed} failed jobs`

    const highUsage = []
    if (systemStatus.resources.cpu.usage > 80) highUsage.push('CPU')
    if (systemStatus.resources.memory.usage > 80) highUsage.push('Memory')
    if (systemStatus.resources.gpu?.usage && systemStatus.resources.gpu.usage > 80) highUsage.push('GPU')

    if (highUsage.length > 0) return `High ${highUsage.join(', ')} usage`

    return 'All systems operational'
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <div className={cn("w-2 h-2 rounded-full", getHealthColor())} />
      <span className="text-sm text-gray-600">{getStatusText()}</span>
    </div>
  )
}

// Real-time resource utilization chart
export function ResourceUtilizationChart({ height = 200 }: { height?: number }) {
  const { statusHistory } = useSystemStatus()

  const chartData = useMemo(() => {
    return statusHistory.slice(-30).map((status, index) => ({
      time: new Date(status.timestamp).toLocaleTimeString(),
      cpu: status.resources.cpu.usage,
      memory: status.resources.memory.usage,
      gpu: status.resources.gpu?.usage || 0,
      disk: status.resources.disk.usage
    }))
  }, [statusHistory])

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500">
        <Activity className="h-8 w-8 opacity-50" />
        <span className="ml-2">Waiting for system data...</span>
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData}>
        <XAxis dataKey="time" />
        <YAxis domain={[0, 100]} />
        <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`]} />
        
        <Line type="monotone" dataKey="cpu" stroke="#3b82f6" strokeWidth={2} dot={false} name="CPU" />
        <Line type="monotone" dataKey="memory" stroke="#10b981" strokeWidth={2} dot={false} name="Memory" />
        {chartData.some(d => d.gpu > 0) && (
          <Line type="monotone" dataKey="gpu" stroke="#8b5cf6" strokeWidth={2} dot={false} name="GPU" />
        )}
        <Line type="monotone" dataKey="disk" stroke="#f59e0b" strokeWidth={2} dot={false} name="Disk" />
      </LineChart>
    </ResponsiveContainer>
  )
}