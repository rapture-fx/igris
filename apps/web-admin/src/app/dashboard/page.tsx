'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { 
  Activity, 
  Server, 
  Database, 
  Code2, 
  FileText, 
  Zap, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle,
  ArrowUpRight,
  Terminal,
  Workflow,
  Settings,
  Layers,
  Users,
  PlayCircle,
  PauseCircle,
  RefreshCw
} from 'lucide-react'

interface JobStatus {
  id: string
  name: string
  status: 'running' | 'completed' | 'failed' | 'queued'
  progress: number
  startTime: string
  duration: string
  endpoint: string
}

interface DataQualityMetric {
  name: string
  value: number
  threshold: number
  status: 'good' | 'warning' | 'critical'
  description: string
}

interface ApiEndpoint {
  method: string
  path: string
  status: number
  avgResponseTime: number
  requestCount: number
  lastCall: string
}

export default function DeveloperDashboard() {
  const { user, isAuthenticated } = useAuth()
  const [activeJobs, setActiveJobs] = useState<JobStatus[]>([])
  const [dataQuality, setDataQuality] = useState<DataQualityMetric[]>([])
  const [apiEndpoints, setApiEndpoints] = useState<ApiEndpoint[]>([])
  const [isRefreshing, setIsRefreshing] = useState(false)

  useEffect(() => {
    // Mock data - replace with actual API calls
    setActiveJobs([
      {
        id: '1',
        name: 'Data Preprocessing Pipeline',
        status: 'running',
        progress: 68,
        startTime: '2024-01-15T10:30:00Z',
        duration: '2m 34s',
        endpoint: '/api/v1/data/preprocess'
      },
      {
        id: '2',
        name: 'Auto-labeling Classification',
        status: 'completed',
        progress: 100,
        startTime: '2024-01-15T10:15:00Z',
        duration: '1m 45s',
        endpoint: '/api/v1/ml/auto-label'
      },
      {
        id: '3',
        name: 'Data Quality Analysis',
        status: 'queued',
        progress: 0,
        startTime: '',
        duration: '',
        endpoint: '/api/v1/data/quality'
      }
    ])

    setDataQuality([
      {
        name: 'Missing Values',
        value: 5.2,
        threshold: 10,
        status: 'good',
        description: 'Percentage of missing values across all columns'
      },
      {
        name: 'Duplicate Records',
        value: 12.8,
        threshold: 15,
        status: 'warning',
        description: 'Percentage of duplicate records detected'
      },
      {
        name: 'Data Consistency',
        value: 94.5,
        threshold: 90,
        status: 'good',
        description: 'Overall data consistency score'
      },
      {
        name: 'Schema Validation',
        value: 87.2,
        threshold: 95,
        status: 'warning',
        description: 'Percentage of records passing schema validation'
      }
    ])

    setApiEndpoints([
      {
        method: 'POST',
        path: '/api/v1/data/upload',
        status: 200,
        avgResponseTime: 245,
        requestCount: 1247,
        lastCall: '2 minutes ago'
      },
      {
        method: 'GET',
        path: '/api/v1/data/status',
        status: 200,
        avgResponseTime: 45,
        requestCount: 3892,
        lastCall: '30 seconds ago'
      },
      {
        method: 'POST',
        path: '/api/v1/ml/train',
        status: 200,
        avgResponseTime: 1240,
        requestCount: 234,
        lastCall: '5 minutes ago'
      }
    ])
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'queued':
        return <Clock className="w-4 h-4 text-gray-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getQualityStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'text-green-600 bg-green-50 border-green-200'
      case 'warning':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200'
      case 'critical':
        return 'text-red-600 bg-red-50 border-red-200'
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200'
    }
  }

  const refreshData = async () => {
    setIsRefreshing(true)
    // Simulate API call
    setTimeout(() => {
      setIsRefreshing(false)
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Developer Dashboard</h1>
              <p className="text-gray-400 mt-1">Monitor your ML data pipeline and API performance</p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={refreshData}
                disabled={isRefreshing}
                className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
                <Terminal className="w-4 h-4 mr-2" />
                API Docs
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-12 py-12">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Active Jobs</p>
                <p className="text-2xl font-bold text-white mt-1">
                  {activeJobs.filter(job => job.status === 'running').length}
                </p>
              </div>
              <Activity className="w-8 h-8 text-[#468BE6]" />
            </div>
          </div>
          
          <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">API Calls (24h)</p>
                <p className="text-2xl font-bold text-white mt-1">5,373</p>
              </div>
              <BarChart3 className="w-8 h-8 text-green-500" />
            </div>
          </div>
          
          <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Avg Response</p>
                <p className="text-2xl font-bold text-white mt-1">245ms</p>
              </div>
              <Zap className="w-8 h-8 text-yellow-500" />
            </div>
          </div>
          
          <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Data Quality</p>
                <p className="text-2xl font-bold text-white mt-1">92.3%</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Active Jobs */}
          <div className="bg-[#161616] border border-gray-800 rounded-xl">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Active Jobs</h2>
                <Workflow className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {activeJobs.map((job) => (
                  <div key={job.id} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(job.status)}
                        <div>
                          <h3 className="text-sm font-medium text-white">{job.name}</h3>
                          <p className="text-xs text-gray-400">{job.endpoint}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-400">{job.duration}</span>
                    </div>
                    {job.status === 'running' && (
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div 
                          className="bg-[#468BE6] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Data Quality Metrics */}
          <div className="bg-[#161616] border border-gray-800 rounded-xl">
            <div className="p-6 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Data Quality Metrics</h2>
                <Database className="w-5 h-5 text-gray-400" />
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dataQuality.map((metric, index) => (
                  <div key={index} className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-sm font-medium text-white">{metric.name}</h3>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getQualityStatusColor(metric.status)}`}>
                        {metric.value}%
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-2">{metric.description}</p>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div 
                        className={`h-1.5 rounded-full ${
                          metric.status === 'good' ? 'bg-green-500' : 
                          metric.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                        }`}
                        style={{ width: `${Math.min(metric.value, 100)}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* API Endpoints Performance */}
        <div className="bg-[#161616] border border-gray-800 rounded-xl">
          <div className="p-6 border-b border-gray-800">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">API Endpoints Performance</h2>
              <Code2 className="w-5 h-5 text-gray-400" />
            </div>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left border-b border-gray-800">
                    <th className="text-gray-400 text-xs font-medium uppercase tracking-wider pb-3">Endpoint</th>
                    <th className="text-gray-400 text-xs font-medium uppercase tracking-wider pb-3">Status</th>
                    <th className="text-gray-400 text-xs font-medium uppercase tracking-wider pb-3">Avg Response</th>
                    <th className="text-gray-400 text-xs font-medium uppercase tracking-wider pb-3">Requests</th>
                    <th className="text-gray-400 text-xs font-medium uppercase tracking-wider pb-3">Last Call</th>
                  </tr>
                </thead>
                <tbody className="space-y-2">
                  {apiEndpoints.map((endpoint, index) => (
                    <tr key={index} className="border-b border-gray-800/50">
                      <td className="py-3">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-1 text-xs font-mono rounded ${
                            endpoint.method === 'GET' ? 'bg-green-900 text-green-300' :
                            endpoint.method === 'POST' ? 'bg-blue-900 text-blue-300' :
                            'bg-yellow-900 text-yellow-300'
                          }`}>
                            {endpoint.method}
                          </span>
                          <span className="text-sm text-white font-mono">{endpoint.path}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          endpoint.status === 200 ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                        }`}>
                          {endpoint.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm text-gray-300">{endpoint.avgResponseTime}ms</td>
                      <td className="py-3 text-sm text-gray-300">{endpoint.requestCount.toLocaleString()}</td>
                      <td className="py-3 text-sm text-gray-400">{endpoint.lastCall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}