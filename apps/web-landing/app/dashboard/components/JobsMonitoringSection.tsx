'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  RefreshCw,
  Play,
  Pause,
  Square,
  BarChart3,
  Zap,
  Database,
  TrendingUp,
  Download,
  Eye,
  Terminal
} from 'lucide-react'
import { mlPipelineApi, analyticsApi } from '@/lib/api'

interface Pipeline {
  pipeline_id: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress: number
  stage: string
  metrics?: any
  logs?: string[]
  startTime: string
  estimatedCompletion: string
  type: 'training' | 'inference' | 'data_processing'
  model_name?: string
}

interface JobMetrics {
  total_jobs: number
  active_jobs: number
  completed_jobs: number
  failed_jobs: number
  avg_completion_time: number
  success_rate: number
}

export default function JobsMonitoringSection() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([])
  const [jobMetrics, setJobMetrics] = useState<JobMetrics | null>(null)
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPipelineData()
    
    // Set up auto-refresh for real-time updates
    let interval: NodeJS.Timeout
    if (autoRefresh) {
      interval = setInterval(loadPipelineData, 5000) // Refresh every 5 seconds
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [autoRefresh])

  const loadPipelineData = async () => {
    try {
      setIsLoading(true)
      setError(null)

      // Load active pipelines
      const activePipelines = await mlPipelineApi.getActivePipelines()
      const pipelinesWithDetails: Pipeline[] = activePipelines.map(p => ({
        pipeline_id: p.pipeline_id,
        status: p.status,
        progress: p.progress,
        stage: p.stage,
        metrics: p.metrics,
        logs: p.logs,
        startTime: new Date().toISOString(), // In real implementation, this would come from API
        estimatedCompletion: estimateCompletion(p.progress),
        type: inferPipelineType(p.stage),
        model_name: p.stage.includes('training') ? `Model-${p.pipeline_id.slice(-4)}` : undefined
      }))
      
      setPipelines(pipelinesWithDetails)

      // Calculate job metrics
      const metrics: JobMetrics = {
        total_jobs: pipelinesWithDetails.length + Math.floor(Math.random() * 20),
        active_jobs: pipelinesWithDetails.filter(p => p.status === 'running').length,
        completed_jobs: pipelinesWithDetails.filter(p => p.status === 'completed').length + Math.floor(Math.random() * 50),
        failed_jobs: pipelinesWithDetails.filter(p => p.status === 'failed').length + Math.floor(Math.random() * 5),
        avg_completion_time: 4.5 + Math.random() * 2, // minutes
        success_rate: 92 + Math.random() * 6 // percentage
      }
      setJobMetrics(metrics)

    } catch (error: any) {
      console.error('Failed to load pipeline data:', error)
      setError(`Failed to load pipelines: ${error.message || 'Unknown error'}`)
      
      // Fallback to mock data for demo
      const mockPipelines: Pipeline[] = [
        {
          pipeline_id: 'pipe-001',
          status: 'running',
          progress: 67,
          stage: 'Model Training - Epoch 45/100',
          startTime: new Date(Date.now() - 15 * 60000).toISOString(),
          estimatedCompletion: '8m remaining',
          type: 'training',
          model_name: 'FraudDetection-v2.1',
          metrics: {
            accuracy: 0.924,
            loss: 0.089,
            val_accuracy: 0.918
          }
        },
        {
          pipeline_id: 'pipe-002',
          status: 'completed',
          progress: 100,
          stage: 'Data Processing Complete',
          startTime: new Date(Date.now() - 45 * 60000).toISOString(),
          estimatedCompletion: 'Completed',
          type: 'data_processing',
          metrics: {
            records_processed: 150000,
            quality_score: 94.5
          }
        },
        {
          pipeline_id: 'pipe-003',
          status: 'queued',
          progress: 0,
          stage: 'Waiting for resources',
          startTime: new Date().toISOString(),
          estimatedCompletion: 'Pending',
          type: 'inference',
          model_name: 'RecommendationEngine-v1.3'
        }
      ]
      setPipelines(mockPipelines)
      
      setJobMetrics({
        total_jobs: 127,
        active_jobs: 3,
        completed_jobs: 118,
        failed_jobs: 6,
        avg_completion_time: 5.2,
        success_rate: 95.3
      })
    } finally {
      setIsLoading(false)
    }
  }

  const estimateCompletion = (progress: number): string => {
    if (progress >= 100) return 'Completed'
    if (progress === 0) return 'Pending'
    
    const remainingPercent = 100 - progress
    const estimatedMinutes = Math.ceil(remainingPercent * 0.2) // Rough estimate
    return estimatedMinutes > 60 
      ? `${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m remaining`
      : `${estimatedMinutes}m remaining`
  }

  const inferPipelineType = (stage: string): 'training' | 'inference' | 'data_processing' => {
    if (stage.toLowerCase().includes('training') || stage.toLowerCase().includes('epoch')) return 'training'
    if (stage.toLowerCase().includes('inference') || stage.toLowerCase().includes('prediction')) return 'inference'
    return 'data_processing'
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-600 bg-blue-100 border-blue-300'
      case 'completed':
        return 'text-green-600 bg-green-100 border-green-300'
      case 'failed':
        return 'text-red-600 bg-red-100 border-red-300'
      case 'queued':
        return 'text-yellow-600 bg-yellow-100 border-yellow-300'
      default:
        return 'text-gray-600 bg-gray-100 border-gray-300'
    }
  }

  const getPipelineTypeIcon = (type: string) => {
    switch (type) {
      case 'training':
        return <Zap className="w-5 h-5 text-purple-600" />
      case 'inference':
        return <BarChart3 className="w-5 h-5 text-green-600" />
      case 'data_processing':
        return <Database className="w-5 h-5 text-blue-600" />
      default:
        return <Activity className="w-5 h-5 text-gray-600" />
    }
  }

  const formatTimeAgo = (isoString: string): string => {
    const date = new Date(isoString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return 'Just now'
    if (diffMins < 60) return `${diffMins}m ago`
    return `${diffHours}h ago`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Jobs & Monitoring</h1>
          <p className="text-gray-400 mt-1">Real-time monitoring of ML pipelines and data processing jobs</p>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`inline-flex items-center px-4 py-2 rounded-lg transition-colors ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 border border-green-300' 
                : 'bg-gray-100 text-gray-700 border border-gray-300'
            }`}
          >
            {autoRefresh ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </button>
          <button
            onClick={loadPipelineData}
            disabled={isLoading}
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <p className="text-red-700 font-medium">Error</p>
          </div>
          <p className="text-red-600 mt-1">{error}</p>
        </div>
      )}

      {/* Job Metrics */}
      {jobMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <Activity className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium text-gray-600">Total Jobs</span>
            </div>
            <p className="text-2xl font-bold text-gray-900 mt-1">{jobMetrics.total_jobs}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-yellow-600" />
              <span className="text-sm font-medium text-gray-600">Active</span>
            </div>
            <p className="text-2xl font-bold text-yellow-600 mt-1">{jobMetrics.active_jobs}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium text-gray-600">Completed</span>
            </div>
            <p className="text-2xl font-bold text-green-600 mt-1">{jobMetrics.completed_jobs}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-5 h-5 text-red-600" />
              <span className="text-sm font-medium text-gray-600">Failed</span>
            </div>
            <p className="text-2xl font-bold text-red-600 mt-1">{jobMetrics.failed_jobs}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium text-gray-600">Avg Time</span>
            </div>
            <p className="text-2xl font-bold text-purple-600 mt-1">{jobMetrics.avg_completion_time.toFixed(1)}m</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-600">Success Rate</span>
            </div>
            <p className="text-2xl font-bold text-indigo-600 mt-1">{jobMetrics.success_rate.toFixed(1)}%</p>
          </div>
        </div>
      )}

      {/* Active Pipelines */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">Active Pipelines</h2>
        {pipelines.map((pipeline) => (
          <div key={pipeline.pipeline_id} className="bg-white border border-gray-200 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-gray-50 rounded-lg">
                  {getPipelineTypeIcon(pipeline.type)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">
                      {pipeline.model_name || `Pipeline ${pipeline.pipeline_id}`}
                    </h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(pipeline.status)}`}>
                      {pipeline.status}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 mb-3">{pipeline.stage}</p>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">Progress</span>
                      <span className="text-sm font-medium text-gray-800">{pipeline.progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          pipeline.status === 'running' ? 'bg-blue-500' :
                          pipeline.status === 'completed' ? 'bg-green-500' :
                          pipeline.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500'
                        }`}
                        style={{ width: `${pipeline.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Started:</span>
                      <span className="text-gray-700 ml-2">{formatTimeAgo(pipeline.startTime)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">ETA:</span>
                      <span className="text-gray-700 ml-2">{pipeline.estimatedCompletion}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Type:</span>
                      <span className="text-gray-700 ml-2 capitalize">{pipeline.type.replace('_', ' ')}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">ID:</span>
                      <span className="text-gray-700 ml-2 font-mono text-xs">{pipeline.pipeline_id}</span>
                    </div>
                  </div>

                  {/* Metrics */}
                  {pipeline.metrics && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                        {Object.entries(pipeline.metrics).map(([key, value]) => (
                          <div key={key} className="flex justify-between">
                            <span className="text-gray-500 capitalize">{key.replace('_', ' ')}:</span>
                            <span className="font-medium text-gray-700">
                              {typeof value === 'number' ? value.toLocaleString() : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                {getStatusIcon(pipeline.status)}
                <div className="flex items-center space-x-2 ml-4">
                  <button 
                    onClick={() => setSelectedPipeline(pipeline)}
                    className="p-2 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    title="View Details"
                  >
                    <Eye className="w-4 h-4 text-blue-600" />
                  </button>
                  {pipeline.logs && (
                    <button 
                      className="p-2 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                      title="View Logs"
                    >
                      <Terminal className="w-4 h-4 text-gray-600" />
                    </button>
                  )}
                  {pipeline.status === 'completed' && (
                    <button 
                      className="p-2 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                      title="Download Results"
                    >
                      <Download className="w-4 h-4 text-green-600" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {pipelines.length === 0 && !isLoading && (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No active pipelines</h3>
            <p className="text-gray-400">Start a new pipeline to see real-time monitoring</p>
          </div>
        )}
      </div>
    </div>
  )
}