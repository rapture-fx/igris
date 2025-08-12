'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  PlayCircle,
  PauseCircle,
  Square,
  RefreshCw,
  Filter,
  Search,
  Calendar,
  BarChart3,
  FileText,
  Zap,
  Database,
  Upload,
  Download,
  Settings,
  Eye,
  TrendingUp
} from 'lucide-react'

interface Job {
  id: string
  name: string
  type: 'data_processing' | 'ml_training' | 'pipeline' | 'export' | 'validation'
  status: 'running' | 'completed' | 'failed' | 'queued' | 'cancelled'
  progress: number
  startTime: string
  endTime?: string
  duration: string
  resources: {
    cpu: number
    memory: number
    storage: number
  }
  logs: string[]
  metrics: {
    recordsProcessed: number
    errorCount: number
    throughput: number
  }
}

interface JobMetrics {
  totalJobs: number
  runningJobs: number
  completedJobs: number
  failedJobs: number
  averageDuration: string
  successRate: number
}

export default function JobsMonitoring() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [metrics, setMetrics] = useState<JobMetrics | null>(null)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    // Mock data
    const mockJobs: Job[] = [
      {
        id: '1',
        name: 'Customer Data Processing Pipeline',
        type: 'pipeline',
        status: 'running',
        progress: 68,
        startTime: '2024-01-15T10:30:00Z',
        duration: '2m 34s',
        resources: { cpu: 45, memory: 2.1, storage: 0.8 },
        logs: [
          'Starting data ingestion...',
          'Validating schema...',
          'Processing 150,000 records...',
          'Data cleaning in progress...'
        ],
        metrics: { recordsProcessed: 102000, errorCount: 23, throughput: 1200 }
      },
      {
        id: '2',
        name: 'ML Model Training - XGBoost',
        type: 'ml_training',
        status: 'completed',
        progress: 100,
        startTime: '2024-01-15T09:15:00Z',
        endTime: '2024-01-15T10:45:00Z',
        duration: '1h 30m',
        resources: { cpu: 85, memory: 8.2, storage: 2.1 },
        logs: [
          'Model training started',
          'Epoch 1/100 completed',
          'Validation accuracy: 94.2%',
          'Training completed successfully'
        ],
        metrics: { recordsProcessed: 50000, errorCount: 0, throughput: 500 }
      },
      {
        id: '3',
        name: 'Data Export to S3',
        type: 'export',
        status: 'failed',
        progress: 45,
        startTime: '2024-01-15T11:00:00Z',
        endTime: '2024-01-15T11:15:00Z',
        duration: '15m',
        resources: { cpu: 25, memory: 1.5, storage: 5.2 },
        logs: [
          'Starting S3 export...',
          'Authentication successful',
          'Error: Network timeout',
          'Export failed'
        ],
        metrics: { recordsProcessed: 25000, errorCount: 1, throughput: 800 }
      },
      {
        id: '4',
        name: 'Schema Validation',
        type: 'validation',
        status: 'queued',
        progress: 0,
        startTime: '2024-01-15T12:00:00Z',
        duration: '0s',
        resources: { cpu: 0, memory: 0, storage: 0 },
        logs: ['Job queued for execution'],
        metrics: { recordsProcessed: 0, errorCount: 0, throughput: 0 }
      },
      {
        id: '5',
        name: 'Batch Data Processing',
        type: 'data_processing',
        status: 'completed',
        progress: 100,
        startTime: '2024-01-15T08:00:00Z',
        endTime: '2024-01-15T08:45:00Z',
        duration: '45m',
        resources: { cpu: 65, memory: 4.1, storage: 1.2 },
        logs: [
          'Processing batch file...',
          'Data transformation completed',
          'Quality checks passed',
          'Job completed successfully'
        ],
        metrics: { recordsProcessed: 75000, errorCount: 5, throughput: 1667 }
      }
    ]

    const mockMetrics: JobMetrics = {
      totalJobs: 47,
      runningJobs: 3,
      completedJobs: 38,
      failedJobs: 6,
      averageDuration: '25m 30s',
      successRate: 86.4
    }

    setJobs(mockJobs)
    setMetrics(mockMetrics)
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
      case 'cancelled':
        return <Square className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-blue-400 bg-blue-900/20 border-blue-700'
      case 'completed':
        return 'text-green-400 bg-green-900/20 border-green-700'
      case 'failed':
        return 'text-red-400 bg-red-900/20 border-red-700'
      case 'queued':
        return 'text-gray-400 bg-gray-900/20 border-gray-700'
      case 'cancelled':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'data_processing':
        return <Database className="w-4 h-4 text-blue-400" />
      case 'ml_training':
        return <Zap className="w-4 h-4 text-purple-400" />
      case 'pipeline':
        return <Activity className="w-4 h-4 text-green-400" />
      case 'export':
        return <Upload className="w-4 h-4 text-yellow-400" />
      case 'validation':
        return <CheckCircle className="w-4 h-4 text-orange-400" />
      default:
        return <Settings className="w-4 h-4 text-gray-400" />
    }
  }

  const filteredJobs = jobs.filter(job => {
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesType = typeFilter === 'all' || job.type === typeFilter
    const matchesSearch = job.name.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesType && matchesSearch
  })

  const formatTimeAgo = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ago`
    }
    return `${minutes}m ago`
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Jobs & Monitoring</h1>
              <p className="text-gray-400 mt-1">Monitor and manage your data processing jobs</p>
            </div>
            <div className="flex items-center space-x-4">
              <button className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors">
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Metrics Cards */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-6 mb-8">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Total Jobs</div>
              <div className="text-2xl font-bold text-white">{metrics.totalJobs}</div>
            </div>
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Running</div>
              <div className="text-2xl font-bold text-blue-400">{metrics.runningJobs}</div>
            </div>
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Completed</div>
              <div className="text-2xl font-bold text-green-400">{metrics.completedJobs}</div>
            </div>
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Failed</div>
              <div className="text-2xl font-bold text-red-400">{metrics.failedJobs}</div>
            </div>
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Avg Duration</div>
              <div className="text-2xl font-bold text-white">{metrics.averageDuration}</div>
            </div>
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-4">
              <div className="text-gray-400 text-sm mb-1">Success Rate</div>
              <div className="text-2xl font-bold text-green-400">{metrics.successRate}%</div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Jobs List */}
          <div className="lg:col-span-2">
            {/* Filters */}
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 mb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search jobs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#468BE6]"
                  />
                </div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#468BE6]"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="queued">Queued</option>
                </select>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="bg-[#0f0f0f] border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-[#468BE6]"
                >
                  <option value="all">All Types</option>
                  <option value="data_processing">Data Processing</option>
                  <option value="ml_training">ML Training</option>
                  <option value="pipeline">Pipeline</option>
                  <option value="export">Export</option>
                  <option value="validation">Validation</option>
                </select>
              </div>
            </div>

            {/* Jobs List */}
            <div className="space-y-4">
              {filteredJobs.map((job) => (
                <div
                  key={job.id}
                  className={`bg-[#161616] border rounded-xl p-6 cursor-pointer transition-all hover:border-[#468BE6]/50 ${
                    selectedJob?.id === job.id ? 'border-[#468BE6] ring-1 ring-[#468BE6]/50' : 'border-gray-800'
                  }`}
                  onClick={() => setSelectedJob(job)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-start space-x-4">
                      <div className="p-2 bg-[#0f0f0f] border border-gray-800 rounded-lg">
                        {getTypeIcon(job.type)}
                      </div>
                      <div>
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-lg font-semibold text-white">{job.name}</h3>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(job.status)}`}>
                            {job.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-400">
                          <span>Started {formatTimeAgo(job.startTime)}</span>
                          <span>Duration: {job.duration}</span>
                          <span>Records: {job.metrics.recordsProcessed.toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(job.status)}
                    </div>
                  </div>

                  {job.status === 'running' && (
                    <div className="mb-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Progress</span>
                        <span className="text-white">{job.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-[#468BE6] h-2 rounded-full transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">CPU:</span>
                      <span className="text-white ml-2">{job.resources.cpu}%</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Memory:</span>
                      <span className="text-white ml-2">{job.resources.memory}GB</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Errors:</span>
                      <span className={`ml-2 ${job.metrics.errorCount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                        {job.metrics.errorCount}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Job Details Panel */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-white mb-4">
                {selectedJob ? 'Job Details' : 'Select a Job'}
              </h3>
              
              {selectedJob ? (
                <div className="space-y-6">
                  {/* Job Info */}
                  <div>
                    <h4 className="text-white font-medium mb-2">{selectedJob.name}</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Type:</span>
                        <span className="text-white capitalize">{selectedJob.type.replace('_', ' ')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Status:</span>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(selectedJob.status)}`}>
                          {selectedJob.status}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Duration:</span>
                        <span className="text-white">{selectedJob.duration}</span>
                      </div>
                    </div>
                  </div>

                  {/* Resource Usage */}
                  <div>
                    <h5 className="text-white font-medium mb-3">Resource Usage</h5>
                    <div className="space-y-3">
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">CPU</span>
                          <span className="text-white">{selectedJob.resources.cpu}%</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${selectedJob.resources.cpu}%` }}
                          ></div>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-gray-400">Memory</span>
                          <span className="text-white">{selectedJob.resources.memory}GB</span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full"
                            style={{ width: `${Math.min(selectedJob.resources.memory * 10, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Recent Logs */}
                  <div>
                    <h5 className="text-white font-medium mb-3">Recent Logs</h5>
                    <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                      {selectedJob.logs.map((log, index) => (
                        <div key={index} className="text-xs text-gray-300 mb-1 font-mono">
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-2">
                    <button className="w-full inline-flex items-center justify-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors">
                      <Eye className="w-4 h-4 mr-2" />
                      View Full Logs
                    </button>
                    {selectedJob.status === 'running' && (
                      <button className="w-full inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                        <Square className="w-4 h-4 mr-2" />
                        Stop Job
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400">Select a job to view its details and logs</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}