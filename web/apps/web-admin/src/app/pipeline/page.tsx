'use client'

import { useState, useEffect, useCallback } from 'react'
import { 
  Play, 
  Pause, 
  Square, 
  Activity, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  XCircle,
  Settings,
  BarChart3,
  TrendingUp,
  Database,
  Cpu,
  Zap,
  RefreshCw,
  Terminal,
  PlayCircle,
  Layers
} from 'lucide-react'
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell
} from 'recharts'
import { 
  mlPipelineApi, 
  MLPipelineStatus, 
  WebSocketClient 
} from '@/lib/api'

interface PipelineMetrics {
  timestamp: string
  accuracy: number
  loss: number
  throughput: number
  memory_usage: number
  cpu_usage: number
}

interface PipelineStage {
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  duration: number
  progress: number
}

export default function MLPipelineMonitor() {
  const [pipelines, setPipelines] = useState<MLPipelineStatus[]>([])
  const [selectedPipeline, setSelectedPipeline] = useState<MLPipelineStatus | null>(null)
  const [metrics, setMetrics] = useState<PipelineMetrics[]>([])
  const [stages, setStages] = useState<PipelineStage[]>([])
  const [logs, setLogs] = useState<string[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [wsClient, setWsClient] = useState<WebSocketClient | null>(null)

  // Load pipeline data
  const loadPipelines = useCallback(async () => {
    try {
      setIsRefreshing(true)
      const pipelinesData = await mlPipelineApi.getActivePipelines()
      setPipelines(pipelinesData)
      
      if (!selectedPipeline && pipelinesData.length > 0) {
        setSelectedPipeline(pipelinesData[0])
      }
    } catch (error) {
      console.error('Failed to load pipelines:', error)
      // Fallback mock data
      const mockPipelines: MLPipelineStatus[] = [
        {
          pipeline_id: 'pipe_001',
          status: 'running',
          progress: 67,
          stage: 'Training Neural Network',
          metrics: {
            accuracy: 0.892,
            loss: 0.234,
            learning_rate: 0.001
          },
          logs: [
            'Starting training process...',
            'Epoch 1/100 - Loss: 0.456, Accuracy: 0.823',
            'Epoch 2/100 - Loss: 0.389, Accuracy: 0.851',
            'Epoch 3/100 - Loss: 0.234, Accuracy: 0.892'
          ]
        },
        {
          pipeline_id: 'pipe_002',
          status: 'completed',
          progress: 100,
          stage: 'Model Evaluation',
          metrics: {
            accuracy: 0.945,
            loss: 0.123,
            f1_score: 0.923
          },
          logs: []
        },
        {
          pipeline_id: 'pipe_003',
          status: 'failed',
          progress: 23,
          stage: 'Data Preprocessing',
          metrics: {},
          logs: [
            'Loading dataset...',
            'Error: Invalid data format in column "amount"'
          ]
        }
      ]
      setPipelines(mockPipelines)
      if (!selectedPipeline) {
        setSelectedPipeline(mockPipelines[0])
      }
    } finally {
      setIsRefreshing(false)
    }
  }, [selectedPipeline])

  // Generate mock metrics data
  useEffect(() => {
    const generateMetrics = () => {
      const now = new Date()
      const data: PipelineMetrics[] = []
      
      for (let i = 29; i >= 0; i--) {
        const timestamp = new Date(now.getTime() - i * 60 * 1000)
        data.push({
          timestamp: timestamp.toISOString().substring(11, 19),
          accuracy: 0.7 + Math.random() * 0.25,
          loss: 0.5 - Math.random() * 0.3,
          throughput: 800 + Math.random() * 400,
          memory_usage: 60 + Math.random() * 30,
          cpu_usage: 40 + Math.random() * 50
        })
      }
      
      setMetrics(data)
    }

    const generateStages = () => {
      setStages([
        { name: 'Data Loading', status: 'completed', duration: 45, progress: 100 },
        { name: 'Data Preprocessing', status: 'completed', duration: 120, progress: 100 },
        { name: 'Feature Engineering', status: 'completed', duration: 89, progress: 100 },
        { name: 'Model Training', status: 'running', duration: 340, progress: 67 },
        { name: 'Model Validation', status: 'pending', duration: 0, progress: 0 },
        { name: 'Model Deployment', status: 'pending', duration: 0, progress: 0 }
      ])
    }

    generateMetrics()
    generateStages()
    
    const interval = setInterval(() => {
      generateMetrics()
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Initialize WebSocket
  useEffect(() => {
    const client = new WebSocketClient()
    
    client.connect((data) => {
      if (data.type === 'pipeline_metrics' && selectedPipeline) {
        setMetrics(prev => [...prev.slice(-29), {
          timestamp: new Date().toISOString().substring(11, 19),
          accuracy: data.accuracy || 0.8,
          loss: data.loss || 0.2,
          throughput: data.throughput || 1000,
          memory_usage: data.memory_usage || 70,
          cpu_usage: data.cpu_usage || 60
        }])
      }
      
      if (data.type === 'pipeline_logs' && selectedPipeline) {
        setLogs(prev => [...prev, data.message])
      }
    })

    setWsClient(client)
    return () => client.disconnect()
  }, [selectedPipeline])

  useEffect(() => {
    loadPipelines()
    const interval = setInterval(loadPipelines, 30000)
    return () => clearInterval(interval)
  }, [loadPipelines])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
      case 'completed': return <CheckCircle className="w-4 h-4 text-green-400" />
      case 'failed': return <XCircle className="w-4 h-4 text-red-400" />
      case 'pending': return <Clock className="w-4 h-4 text-gray-400" />
      default: return <Clock className="w-4 h-4 text-gray-400" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-900/30 border-blue-500 text-blue-400'
      case 'completed': return 'bg-green-900/30 border-green-500 text-green-400'
      case 'failed': return 'bg-red-900/30 border-red-500 text-red-400'
      case 'pending': return 'bg-gray-900/30 border-gray-500 text-gray-400'
      default: return 'bg-gray-900/30 border-gray-500 text-gray-400'
    }
  }

  const COLORS = ['#468BE6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">ML Pipeline Monitor</h1>
              <p className="text-gray-400 mt-1">Real-time monitoring of machine learning workflows</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => loadPipelines()}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Pipeline List */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Active Pipelines</h2>
              <div className="space-y-3">
                {pipelines.map((pipeline) => (
                  <div
                    key={pipeline.pipeline_id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-900/50 ${
                      selectedPipeline?.pipeline_id === pipeline.pipeline_id
                        ? 'bg-[#468BE6]/10 border-[#468BE6]'
                        : 'bg-[#0f0f0f] border-gray-800'
                    }`}
                    onClick={() => setSelectedPipeline(pipeline)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-white text-sm font-medium">
                        {pipeline.pipeline_id.slice(0, 8)}...
                      </span>
                      {getStatusIcon(pipeline.status)}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {pipeline.stage}
                    </div>
                    {pipeline.status === 'running' && (
                      <div className="w-full bg-gray-800 rounded-full h-1.5">
                        <div 
                          className="bg-[#468BE6] h-1.5 rounded-full transition-all duration-300"
                          style={{ width: `${pipeline.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pipeline Stages */}
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 mt-6">
              <h3 className="text-lg font-semibold text-white mb-4">Pipeline Stages</h3>
              <div className="space-y-3">
                {stages.map((stage, index) => (
                  <div key={index} className="flex items-center justify-between p-2 rounded-lg bg-[#0f0f0f]">
                    <div className="flex items-center space-x-3">
                      {getStatusIcon(stage.status)}
                      <div>
                        <p className="text-sm text-white">{stage.name}</p>
                        {stage.duration > 0 && (
                          <p className="text-xs text-gray-400">{stage.duration}s</p>
                        )}
                      </div>
                    </div>
                    {stage.status === 'running' && (
                      <div className="w-16 bg-gray-800 rounded-full h-1.5">
                        <div 
                          className="bg-blue-400 h-1.5 rounded-full"
                          style={{ width: `${stage.progress}%` }}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {selectedPipeline && (
              <div className="space-y-6">
                {/* Pipeline Status Card */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        Pipeline {selectedPipeline.pipeline_id}
                      </h2>
                      <p className="text-gray-400">{selectedPipeline.stage}</p>
                    </div>
                    <div className={`px-4 py-2 rounded-lg border ${getStatusColor(selectedPipeline.status)}`}>
                      <div className="flex items-center space-x-2">
                        {getStatusIcon(selectedPipeline.status)}
                        <span className="text-sm font-medium capitalize">{selectedPipeline.status}</span>
                      </div>
                    </div>
                  </div>

                  {/* Metrics Grid */}
                  {selectedPipeline.metrics && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm">Accuracy</p>
                            <p className="text-2xl font-bold text-green-400">
                              {((selectedPipeline.metrics.accuracy || 0) * 100).toFixed(1)}%
                            </p>
                          </div>
                          <TrendingUp className="w-8 h-8 text-green-400" />
                        </div>
                      </div>
                      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm">Loss</p>
                            <p className="text-2xl font-bold text-blue-400">
                              {(selectedPipeline.metrics.loss || 0).toFixed(3)}
                            </p>
                          </div>
                          <BarChart3 className="w-8 h-8 text-blue-400" />
                        </div>
                      </div>
                      <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-gray-400 text-sm">Progress</p>
                            <p className="text-2xl font-bold text-yellow-400">
                              {selectedPipeline.progress}%
                            </p>
                          </div>
                          <Activity className="w-8 h-8 text-yellow-400" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progress Bar */}
                  {selectedPipeline.status === 'running' && (
                    <div className="w-full bg-gray-800 rounded-full h-3 mb-6">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${selectedPipeline.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Real-time Metrics Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Accuracy & Loss Chart */}
                  <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Training Metrics</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F3F4F6'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="accuracy" 
                          stroke="#10B981" 
                          strokeWidth={2}
                          dot={false}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="loss" 
                          stroke="#EF4444" 
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Resource Usage */}
                  <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                    <h3 className="text-lg font-semibold text-white mb-4">Resource Usage</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={metrics}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis dataKey="timestamp" stroke="#9CA3AF" fontSize={12} />
                        <YAxis stroke="#9CA3AF" fontSize={12} />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1F2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px',
                            color: '#F3F4F6'
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="cpu_usage" 
                          stackId="1"
                          stroke="#8B5CF6" 
                          fill="#8B5CF6" 
                          fillOpacity={0.6}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="memory_usage" 
                          stackId="1"
                          stroke="#F59E0B" 
                          fill="#F59E0B" 
                          fillOpacity={0.6}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Pipeline Logs */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl">
                  <div className="p-6 border-b border-gray-800">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold text-white">Pipeline Logs</h3>
                      <Terminal className="w-5 h-5 text-gray-400" />
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
                      {selectedPipeline.logs && selectedPipeline.logs.length > 0 ? (
                        selectedPipeline.logs.map((log, index) => (
                          <div key={index} className="mb-1 text-gray-300">
                            <span className="text-gray-500">[{new Date().toISOString().substring(11, 19)}]</span> {log}
                          </div>
                        ))
                      ) : (
                        <div className="text-gray-500 italic">No logs available</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}