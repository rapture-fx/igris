import React, { useState, useMemo } from 'react'
import { Activity, Brain, Upload, FileText, Zap, Play, Pause, Square, Eye, Filter } from 'lucide-react'
import * as Tabs from '@radix-ui/react-tabs'
import * as Select from '@radix-ui/react-select'
import { 
  useMLTraining, 
  useRLOptimization, 
  useBatchPrediction, 
  useDataUpload, 
  useDocumentProcessing,
  useSystemStatus,
  useConnectionStatus
} from '../hooks'
import { ProgressTracker } from './ProgressTracker'
import { cn } from '../../styles/utils'

export interface LiveJobMonitorProps {
  activeJobs?: {
    training?: string[]
    rl?: string[]
    prediction?: string[]
    upload?: string[]
    processing?: string[]
  }
  showControls?: boolean
  autoRefresh?: boolean
  className?: string
}

export function LiveJobMonitor({ 
  activeJobs = {},
  showControls = true,
  autoRefresh = true,
  className 
}: LiveJobMonitorProps) {
  const { systemStatus, activeJobs: systemActiveJobs, isConnected } = useSystemStatus()
  const { connection } = useConnectionStatus()
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'progress' | 'status' | 'name'>('progress')

  // Combine active jobs from props and system status
  const allActiveJobs = useMemo(() => ({
    training: [...(activeJobs.training || []), ...(systemActiveJobs?.training ? Array.from({length: systemActiveJobs.training}, (_, i) => `training_${i}`) : [])],
    rl: [...(activeJobs.rl || [])],
    prediction: [...(activeJobs.prediction || [])],
    upload: [...(activeJobs.upload || [])],
    processing: [...(activeJobs.processing || [])]
  }), [activeJobs, systemActiveJobs])

  const getJobIcon = (type: string) => {
    switch (type) {
      case 'training': return <Brain className="h-4 w-4 text-blue-500" />
      case 'rl': return <Zap className="h-4 w-4 text-purple-500" />
      case 'prediction': return <Activity className="h-4 w-4 text-green-500" />
      case 'upload': return <Upload className="h-4 w-4 text-orange-500" />
      case 'processing': return <FileText className="h-4 w-4 text-indigo-500" />
      default: return <Activity className="h-4 w-4 text-gray-500" />
    }
  }

  const JobCard = ({ jobId, type }: { jobId: string; type: string }) => (
    <div className="bg-white rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          {getJobIcon(type)}
          <div>
            <div className="font-medium text-gray-900">
              {type.charAt(0).toUpperCase() + type.slice(1)} Job
            </div>
            <div className="text-sm text-gray-500 font-mono">
              {jobId}
            </div>
          </div>
        </div>
        
        {showControls && (
          <div className="flex items-center space-x-1">
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <Eye className="h-4 w-4 text-gray-500" />
            </button>
            <button className="p-1 hover:bg-gray-100 rounded transition-colors">
              <Pause className="h-4 w-4 text-gray-500" />
            </button>
          </div>
        )}
      </div>
      
      <ProgressTracker
        config={{
          operationId: jobId,
          operationType: type as any,
          autoComplete: true
        }}
        showDetails={false}
        showStatus={true}
        size="sm"
      />
    </div>
  )

  const JobList = ({ jobs, type }: { jobs: string[]; type: string }) => {
    const filteredJobs = filterType === 'all' || filterType === type ? jobs : []
    
    if (filteredJobs.length === 0) {
      return (
        <div className="text-center py-8 text-gray-500">
          <Activity className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No {type} jobs active</p>
        </div>
      )
    }

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredJobs.map((jobId) => (
          <JobCard key={jobId} jobId={jobId} type={type} />
        ))}
      </div>
    )
  }

  const totalJobs = Object.values(allActiveJobs).flat().length

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Activity className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Live Job Monitor</h2>
            <p className="text-sm text-gray-600">
              {totalJobs} active job{totalJobs !== 1 ? 's' : ''} running
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={cn(
            "flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-medium",
            isConnected ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          )}>
            <div className={cn(
              "w-2 h-2 rounded-full",
              isConnected ? "bg-green-500" : "bg-red-500"
            )} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
            {connection.latency && (
              <span className="text-gray-500">({connection.latency}ms)</span>
            )}
          </div>
          
          {/* Filters */}
          <div className="flex items-center space-x-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select.Root value={filterType} onValueChange={setFilterType}>
              <Select.Trigger className="flex items-center space-x-2 px-3 py-2 bg-white border rounded-lg">
                <Select.Value />
              </Select.Trigger>
              <Select.Content>
                <Select.Item value="all">All Jobs</Select.Item>
                <Select.Item value="training">Training</Select.Item>
                <Select.Item value="rl">RL Sessions</Select.Item>
                <Select.Item value="prediction">Predictions</Select.Item>
                <Select.Item value="upload">Uploads</Select.Item>
                <Select.Item value="processing">Processing</Select.Item>
              </Select.Content>
            </Select.Root>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-blue-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-blue-600">
            {allActiveJobs.training.length}
          </div>
          <div className="text-sm text-gray-600">Training</div>
        </div>
        
        <div className="bg-purple-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {allActiveJobs.rl.length}
          </div>
          <div className="text-sm text-gray-600">RL Sessions</div>
        </div>
        
        <div className="bg-green-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-green-600">
            {allActiveJobs.prediction.length}
          </div>
          <div className="text-sm text-gray-600">Predictions</div>
        </div>
        
        <div className="bg-orange-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-orange-600">
            {allActiveJobs.upload.length}
          </div>
          <div className="text-sm text-gray-600">Uploads</div>
        </div>
        
        <div className="bg-indigo-50 rounded-lg p-4 text-center">
          <div className="text-2xl font-bold text-indigo-600">
            {allActiveJobs.processing.length}
          </div>
          <div className="text-sm text-gray-600">Processing</div>
        </div>
      </div>

      {/* Job Tabs */}
      <Tabs.Root value={filterType} onValueChange={setFilterType} className="space-y-4">
        <Tabs.List className="flex flex-wrap gap-1 bg-gray-100 p-1 rounded-lg">
          <Tabs.Trigger
            value="all"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            All ({totalJobs})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="training"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Training ({allActiveJobs.training.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="rl"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            RL ({allActiveJobs.rl.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="prediction"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Prediction ({allActiveJobs.prediction.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="upload"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Upload ({allActiveJobs.upload.length})
          </Tabs.Trigger>
          <Tabs.Trigger
            value="processing"
            className="px-3 py-2 text-sm font-medium rounded-md transition-colors data-[state=active]:bg-white data-[state=active]:text-gray-900 text-gray-600 hover:text-gray-900"
          >
            Processing ({allActiveJobs.processing.length})
          </Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="all" className="space-y-4">
          {totalJobs === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Activity className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No Active Jobs</h3>
              <p>All systems are idle. Start a new job to see real-time monitoring.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(allActiveJobs).map(([type, jobs]) => 
                jobs.length > 0 && (
                  <div key={type} className="space-y-4">
                    <h3 className="text-md font-semibold text-gray-900 flex items-center space-x-2">
                      {getJobIcon(type)}
                      <span>{type.charAt(0).toUpperCase() + type.slice(1)} Jobs</span>
                      <span className="text-sm font-normal text-gray-500">({jobs.length})</span>
                    </h3>
                    <JobList jobs={jobs} type={type} />
                  </div>
                )
              )}
            </div>
          )}
        </Tabs.Content>

        {Object.entries(allActiveJobs).map(([type, jobs]) => (
          <Tabs.Content key={type} value={type} className="space-y-4">
            <JobList jobs={jobs} type={type} />
          </Tabs.Content>
        ))}
      </Tabs.Root>

      {/* System Overview */}
      {systemStatus && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">System Overview</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="text-sm text-gray-600">CPU Usage</div>
              <div className="text-2xl font-bold text-gray-900">
                {systemStatus.resources.cpu.usage.toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                  style={{ width: `${systemStatus.resources.cpu.usage}%` }}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Memory Usage</div>
              <div className="text-2xl font-bold text-gray-900">
                {systemStatus.resources.memory.usage.toFixed(1)}%
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="h-2 bg-green-500 rounded-full transition-all duration-300"
                  style={{ width: `${systemStatus.resources.memory.usage}%` }}
                />
              </div>
            </div>
            
            {systemStatus.resources.gpu && (
              <div className="space-y-2">
                <div className="text-sm text-gray-600">GPU Usage</div>
                <div className="text-2xl font-bold text-gray-900">
                  {systemStatus.resources.gpu.usage.toFixed(1)}%
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 bg-purple-500 rounded-full transition-all duration-300"
                    style={{ width: `${systemStatus.resources.gpu.usage}%` }}
                  />
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Queue Status</div>
              <div className="text-sm">
                <div className="flex justify-between">
                  <span>Pending:</span>
                  <span className="font-semibold">{systemStatus.queueStatus.pending}</span>
                </div>
                <div className="flex justify-between">
                  <span>Processing:</span>
                  <span className="font-semibold">{systemStatus.queueStatus.processing}</span>
                </div>
                <div className="flex justify-between">
                  <span>Failed:</span>
                  <span className="font-semibold text-red-600">{systemStatus.queueStatus.failed}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Services Status */}
      {systemStatus?.services && systemStatus.services.length > 0 && (
        <div className="bg-white rounded-lg border p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Health</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {systemStatus.services.map((service) => (
              <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium text-gray-900">{service.name}</div>
                  <div className="text-xs text-gray-500">
                    Last check: {new Date(service.lastCheck).toLocaleTimeString()}
                  </div>
                  {service.responseTime && (
                    <div className="text-xs text-gray-500">
                      Response: {service.responseTime}ms
                    </div>
                  )}
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
    </div>
  )
}

// Specialized job monitoring components
export function TrainingJobMonitor({ modelIds }: { modelIds: string[] }) {
  return (
    <div className="space-y-4">
      {modelIds.map(modelId => {
        const ModelCard = () => {
          const { trainingData, isTraining, isCompleted } = useMLTraining(modelId)
          
          return (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Brain className="h-5 w-5 text-blue-500" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {trainingData?.modelName || modelId}
                    </div>
                    <div className="text-sm text-gray-500">
                      Epoch {trainingData?.epoch || 0} / {trainingData?.totalEpochs || 0}
                    </div>
                  </div>
                </div>
                
                <div className={cn(
                  "w-3 h-3 rounded-full",
                  isTraining && "bg-blue-500 animate-pulse",
                  isCompleted && "bg-green-500",
                  !isTraining && !isCompleted && "bg-gray-300"
                )} />
              </div>
              
              <ProgressTracker
                config={{
                  operationId: modelId,
                  operationType: 'training'
                }}
                showDetails={true}
                size="sm"
              />
            </div>
          )
        }

        return <ModelCard key={modelId} />
      })}
    </div>
  )
}

export function RLSessionMonitor({ sessionIds }: { sessionIds: string[] }) {
  return (
    <div className="space-y-4">
      {sessionIds.map(sessionId => {
        const SessionCard = () => {
          const { rlData, currentReward, isTraining, isCompleted } = useRLOptimization(sessionId)
          
          return (
            <div className="bg-white rounded-lg border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <Zap className="h-5 w-5 text-purple-500" />
                  <div>
                    <div className="font-medium text-gray-900">
                      {rlData?.algorithmName || sessionId}
                    </div>
                    <div className="text-sm text-gray-500">
                      Episode {rlData?.episode || 0} / {rlData?.totalEpisodes || 0}
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold text-purple-600">
                    {currentReward?.toFixed(2) || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500">Current Reward</div>
                </div>
              </div>
              
              <ProgressTracker
                config={{
                  operationId: sessionId,
                  operationType: 'rl'
                }}
                showDetails={true}
                size="sm"
              />
            </div>
          )
        }

        return <SessionCard key={sessionId} />
      })}
    </div>
  )
}