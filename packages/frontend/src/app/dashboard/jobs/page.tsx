'use client'

import { useState, useEffect } from 'react'
import { 
  Activity, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  MoreVertical,
  Filter,
  Search,
  Calendar,
  BarChart3,
  TrendingUp,
  Database,
  Zap,
  FileText,
  Settings,
  Eye,
  Download,
  Upload,
  ArrowUpRight,
  ChevronRight,
  Timer,
  Users,
  Cpu,
  HardDrive,
  Network
} from 'lucide-react'

interface Job {
  id: string
  name: string
  type: 'data_processing' | 'analysis' | 'export' | 'import' | 'transformation'
  status: 'running' | 'completed' | 'failed' | 'queued' | 'paused'
  progress: number
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  duration?: number
  records_processed?: number
  total_records?: number
  error_message?: string
  priority: 'low' | 'medium' | 'high'
  user: string
  resource_usage?: {
    cpu: number
    memory: number
    storage: number
  }
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [sortBy, setSortBy] = useState('recent')

  // Mock data for demonstration
  const mockJobs: Job[] = [
    {
      id: '1',
      name: 'Customer Data Analysis',
      type: 'analysis',
      status: 'running',
      progress: 65,
      created_at: '2024-01-15T10:30:00Z',
      started_at: '2024-01-15T10:32:00Z',
      estimated_completion: '2024-01-15T11:15:00Z',
      records_processed: 65000,
      total_records: 100000,
      priority: 'high',
      user: 'John Doe',
      resource_usage: { cpu: 45, memory: 32, storage: 15 }
    },
    {
      id: '2',
      name: 'Sales Data Export',
      type: 'export',
      status: 'completed',
      progress: 100,
      created_at: '2024-01-15T09:00:00Z',
      started_at: '2024-01-15T09:02:00Z',
      completed_at: '2024-01-15T09:45:00Z',
      duration: 43,
      records_processed: 50000,
      total_records: 50000,
      priority: 'medium',
      user: 'Jane Smith'
    },
    {
      id: '3',
      name: 'Data Quality Check',
      type: 'data_processing',
      status: 'queued',
      progress: 0,
      created_at: '2024-01-15T11:00:00Z',
      priority: 'low',
      user: 'Mike Johnson'
    },
    {
      id: '4',
      name: 'Product Catalog Import',
      type: 'import',
      status: 'failed',
      progress: 23,
      created_at: '2024-01-15T08:30:00Z',
      started_at: '2024-01-15T08:32:00Z',
      error_message: 'Invalid file format detected',
      records_processed: 2300,
      total_records: 10000,
      priority: 'high',
      user: 'Sarah Wilson'
    },
    {
      id: '5',
      name: 'Weekly Report Generation',
      type: 'transformation',
      status: 'paused',
      progress: 40,
      created_at: '2024-01-15T07:00:00Z',
      started_at: '2024-01-15T07:05:00Z',
      records_processed: 20000,
      total_records: 50000,
      priority: 'medium',
      user: 'Tom Brown'
    }
  ]

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true)
      try {
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        setJobs(mockJobs)
      } catch (error) {
        console.error('Error fetching jobs:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchJobs()
    
    // Set up auto-refresh for running jobs
    const interval = setInterval(fetchJobs, 30000) // Refresh every 30 seconds
    return () => clearInterval(interval)
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'queued': return <Clock className="w-4 h-4 text-yellow-500" />
      case 'paused': return <Pause className="w-4 h-4 text-gray-500" />
      default: return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'bg-blue-100 text-blue-800'
      case 'completed': return 'bg-green-100 text-green-800'
      case 'failed': return 'bg-red-100 text-red-800'
      case 'queued': return 'bg-yellow-100 text-yellow-800'
      case 'paused': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'data_processing': return <Database className="w-5 h-5 text-blue-600" />
      case 'analysis': return <BarChart3 className="w-5 h-5 text-purple-600" />
      case 'export': return <Download className="w-5 h-5 text-green-600" />
      case 'import': return <Upload className="w-5 h-5 text-orange-600" />
      case 'transformation': return <Zap className="w-5 h-5 text-yellow-600" />
      default: return <FileText className="w-5 h-5 text-gray-600" />
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-800'
      case 'medium': return 'bg-yellow-100 text-yellow-800'
      case 'low': return 'bg-green-100 text-green-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const getTimeRemaining = (estimatedCompletion: string) => {
    const now = new Date()
    const completion = new Date(estimatedCompletion)
    const diff = completion.getTime() - now.getTime()
    
    if (diff <= 0) return 'Completing...'
    
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    
    if (hours > 0) return `~${hours}h ${minutes % 60}m remaining`
    return `~${minutes}m remaining`
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter
    const matchesType = typeFilter === 'all' || job.type === typeFilter
    return matchesSearch && matchesStatus && matchesType
  })

  const sortedJobs = [...filteredJobs].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'status': return a.status.localeCompare(b.status)
      case 'priority': 
        const priorityOrder = { high: 3, medium: 2, low: 1 }
        return priorityOrder[b.priority] - priorityOrder[a.priority]
      case 'recent':
      default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
  })

  const stats = {
    total: jobs.length,
    running: jobs.filter(j => j.status === 'running').length,
    completed: jobs.filter(j => j.status === 'completed').length,
    failed: jobs.filter(j => j.status === 'failed').length,
    queued: jobs.filter(j => j.status === 'queued').length
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading jobs...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Processing Jobs</h1>
          <p className="text-gray-600 mt-1">Monitor and manage your data processing tasks</p>
        </div>
        <div className="flex items-center space-x-3">
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </button>
          <button className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105">
            <Activity className="w-4 h-4 mr-2" />
            New Job
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Jobs</p>
              <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-xs text-gray-500 mt-1">all time</p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Running</p>
              <p className="text-3xl font-bold text-blue-600">{stats.running}</p>
              <p className="text-xs text-gray-500 mt-1">currently active</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <RefreshCw className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-3xl font-bold text-green-600">{stats.completed}</p>
              <p className="text-xs text-gray-500 mt-1">today</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Queued</p>
              <p className="text-3xl font-bold text-yellow-600">{stats.queued}</p>
              <p className="text-xs text-gray-500 mt-1">waiting to start</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-3xl font-bold text-red-600">{stats.failed}</p>
              <p className="text-xs text-gray-500 mt-1">need attention</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="running">Running</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="queued">Queued</option>
              <option value="paused">Paused</option>
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="data_processing">Data Processing</option>
              <option value="analysis">Analysis</option>
              <option value="export">Export</option>
              <option value="import">Import</option>
              <option value="transformation">Transformation</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name</option>
              <option value="status">Status</option>
              <option value="priority">Priority</option>
            </select>
          </div>
        </div>
      </div>

      {/* Jobs List */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Jobs ({sortedJobs.length})</h3>
        </div>
        
        {sortedJobs.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
            <p className="text-gray-600">
              {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'No processing jobs have been created yet.'
              }
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {sortedJobs.map((job) => (
              <div key={job.id} className="px-6 py-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center flex-shrink-0">
                      {getTypeIcon(job.type)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-semibold text-gray-900">{job.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(job.status)}`}>
                          {job.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(job.priority)}`}>
                          {job.priority} priority
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-6 text-sm text-gray-600 mb-3">
                        <span className="flex items-center">
                          <Users className="w-4 h-4 mr-1" />
                          {job.user}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-4 h-4 mr-1" />
                          {formatDate(job.created_at)}
                        </span>
                        <span className="capitalize">{job.type.replace('_', ' ')}</span>
                        {job.total_records && (
                          <span>{formatNumber(job.total_records)} records</span>
                        )}
                      </div>

                      {/* Progress Bar for Running Jobs */}
                      {(job.status === 'running' || job.status === 'paused') && (
                        <div className="mb-3">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Progress</span>
                            <span className="font-medium text-gray-900">{job.progress}%</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                              style={{ width: `${job.progress}%` }}
                            />
                          </div>
                          {job.records_processed && job.total_records && (
                            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
                              <span>{formatNumber(job.records_processed)} / {formatNumber(job.total_records)} records</span>
                              {job.estimated_completion && (
                                <span>{getTimeRemaining(job.estimated_completion)}</span>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Resource Usage for Running Jobs */}
                      {job.resource_usage && job.status === 'running' && (
                        <div className="flex items-center space-x-6 text-xs text-gray-600">
                          <span className="flex items-center">
                            <Cpu className="w-3 h-3 mr-1" />
                            CPU: {job.resource_usage.cpu}%
                          </span>
                          <span className="flex items-center">
                            <HardDrive className="w-3 h-3 mr-1" />
                            Memory: {job.resource_usage.memory}%
                          </span>
                          <span className="flex items-center">
                            <Network className="w-3 h-3 mr-1" />
                            Storage: {job.resource_usage.storage}%
                          </span>
                        </div>
                      )}

                      {/* Error Message for Failed Jobs */}
                      {job.status === 'failed' && job.error_message && (
                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-sm text-red-800">{job.error_message}</p>
                        </div>
                      )}

                      {/* Completion Info */}
                      {job.status === 'completed' && job.duration && (
                        <div className="flex items-center space-x-4 text-sm text-gray-600">
                          <span className="flex items-center">
                            <Timer className="w-4 h-4 mr-1" />
                            Completed in {formatDuration(job.duration)}
                          </span>
                          {job.records_processed && (
                            <span>{formatNumber(job.records_processed)} records processed</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    {getStatusIcon(job.status)}
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Eye className="w-4 h-4 text-gray-600" />
                    </button>
                    {job.status === 'running' && (
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Pause className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                    {(job.status === 'paused' || job.status === 'failed') && (
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Play className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                    {job.status === 'completed' && (
                      <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                        <Download className="w-4 h-4 text-gray-600" />
                      </button>
                    )}
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <MoreVertical className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
