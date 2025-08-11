'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  RefreshCw, 
  Play, 
  Pause, 
  Square, 
  ZapIcon,
  Database,
  BarChart3,
  FileText,
  Brain,
  Upload,
  Download,
  Settings,
  Eye,
  Filter,
  Search,
  Calendar,
  User,
  Users,
  TrendingUp,
  TrendingDown,
  Cpu,
  MemoryStick,
  HardDrive,
  Network,
  Wifi,
  WifiOff,
  Signal,
  Gauge,
  Timer,
  Zap,
  Layers,
  GitBranch,
  Target,
  Sparkles,
  AlertCircle,
  Info,
  ExternalLink,
  Maximize2,
  Minimize2,
  MoreVertical,
  Bell,
  BellOff
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Switch } from '@/components/ui/switch'
import { cn, formatNumber, getTimeAgo, formatBytes } from '@/lib/utils'

// Processing job types and interfaces
interface ProcessingJob {
  id: string
  name: string
  type: 'data_processing' | 'ml_training' | 'analysis' | 'export' | 'import' | 'transformation'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'paused' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  progress: number
  stage: string
  created_at: string
  started_at?: string
  completed_at?: string
  estimated_completion?: string
  duration?: number
  user: {
    id: string
    name: string
    email: string
  }
  resource_usage: {
    cpu: number
    memory: number
    storage: number
    network: number
  }
  stats: {
    records_processed: number
    total_records: number
    errors: number
    warnings: number
  }
  logs: LogEntry[]
  dependencies?: string[]
  output?: {
    size: number
    format: string
    location: string
  }
}

interface LogEntry {
  id: string
  timestamp: string
  level: 'info' | 'warning' | 'error' | 'debug'
  message: string
  details?: any
}

interface SystemMetrics {
  cpu_usage: number
  memory_usage: number
  disk_usage: number
  network_in: number
  network_out: number
  active_connections: number
  queue_size: number
  avg_response_time: number
  error_rate: number
  uptime: number
}

// Mock data
const mockJobs: ProcessingJob[] = [
  {
    id: '1',
    name: 'Customer Data Analysis',
    type: 'data_processing',
    status: 'running',
    priority: 'high',
    progress: 68,
    stage: 'Feature Engineering',
    created_at: '2024-01-15T10:00:00Z',
    started_at: '2024-01-15T10:02:00Z',
    estimated_completion: '2024-01-15T11:30:00Z',
    user: {
      id: '1',
      name: 'Alice Johnson',
      email: 'alice@company.com'
    },
    resource_usage: {
      cpu: 85,
      memory: 72,
      storage: 45,
      network: 23
    },
    stats: {
      records_processed: 680000,
      total_records: 1000000,
      errors: 12,
      warnings: 45
    },
    logs: [
      {
        id: '1',
        timestamp: '2024-01-15T10:45:00Z',
        level: 'info',
        message: 'Processing batch 68/100',
        details: { batch_size: 10000, processing_time: '2.3s' }
      },
      {
        id: '2',
        timestamp: '2024-01-15T10:44:30Z',
        level: 'warning',
        message: 'High memory usage detected',
        details: { memory_usage: '7.2GB', threshold: '8GB' }
      }
    ]
  },
  {
    id: '2',
    name: 'ML Model Training',
    type: 'ml_training',
    status: 'running',
    priority: 'critical',
    progress: 34,
    stage: 'Epoch 34/100',
    created_at: '2024-01-15T08:30:00Z',
    started_at: '2024-01-15T08:31:00Z',
    estimated_completion: '2024-01-15T14:00:00Z',
    user: {
      id: '2',
      name: 'Bob Smith',
      email: 'bob@company.com'
    },
    resource_usage: {
      cpu: 95,
      memory: 88,
      storage: 67,
      network: 12
    },
    stats: {
      records_processed: 340000,
      total_records: 1000000,
      errors: 0,
      warnings: 8
    },
    logs: [
      {
        id: '3',
        timestamp: '2024-01-15T10:46:00Z',
        level: 'info',
        message: 'Validation accuracy: 0.924',
        details: { epoch: 34, loss: 0.156, accuracy: 0.924 }
      }
    ]
  }
]

const mockSystemMetrics: SystemMetrics = {
  cpu_usage: 67,
  memory_usage: 74,
  disk_usage: 45,
  network_in: 125.6,
  network_out: 89.3,
  active_connections: 1247,
  queue_size: 23,
  avg_response_time: 145,
  error_rate: 0.02,
  uptime: 2847635
}

const jobTypeConfig = {
  data_processing: { label: 'Data Processing', icon: Database, color: 'text-blue-600 bg-blue-100' },
  ml_training: { label: 'ML Training', icon: Brain, color: 'text-purple-600 bg-purple-100' },
  analysis: { label: 'Analysis', icon: BarChart3, color: 'text-green-600 bg-green-100' },
  export: { label: 'Export', icon: Download, color: 'text-orange-600 bg-orange-100' },
  import: { label: 'Import', icon: Upload, color: 'text-cyan-600 bg-cyan-100' },
  transformation: { label: 'Transformation', icon: Zap, color: 'text-yellow-600 bg-yellow-100' }
}

const statusConfig = {
  queued: { label: 'Queued', color: 'bg-gray-100 text-gray-800', icon: Clock },
  running: { label: 'Running', color: 'bg-blue-100 text-blue-800', icon: Activity },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircle2 },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800', icon: AlertTriangle },
  paused: { label: 'Paused', color: 'bg-yellow-100 text-yellow-800', icon: Pause },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-800', icon: Square }
}

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-800' },
  medium: { label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-800' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-800' }
}

interface JobCardProps {
  job: ProcessingJob
  onPause: (jobId: string) => void
  onResume: (jobId: string) => void
  onCancel: (jobId: string) => void
  onView: (job: ProcessingJob) => void
}

function JobCard({ job, onPause, onResume, onCancel, onView }: JobCardProps) {
  const typeInfo = jobTypeConfig[job.type]
  const statusInfo = statusConfig[job.status]
  const priorityInfo = priorityConfig[job.priority]

  const estimatedTimeRemaining = job.estimated_completion && job.status === 'running' 
    ? Math.max(0, new Date(job.estimated_completion).getTime() - new Date().getTime())
    : null

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 border-gray-200/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <typeInfo.icon className="w-5 h-5 text-gray-600" />
              <CardTitle className="text-lg font-semibold text-gray-900 line-clamp-1">
                {job.name}
              </CardTitle>
              <Badge variant="outline" className={cn("text-xs", priorityInfo.color)}>
                {priorityInfo.label}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className={cn("text-xs", statusInfo.color)}>
                <statusInfo.icon className="w-3 h-3 mr-1" />
                {statusInfo.label}
              </Badge>
              <Badge variant="outline" className={cn("text-xs", typeInfo.color)}>
                {typeInfo.label}
              </Badge>
            </div>
          </div>
          <div className="flex items-center gap-1 ml-2">
            {job.status === 'running' && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onPause(job.id)}
              >
                <Pause className="w-4 h-4" />
              </Button>
            )}
            {job.status === 'paused' && (
              <Button
                variant="ghost"
                size="sm"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => onResume(job.id)}
              >
                <Play className="w-4 h-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => onView(job)}
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">{job.stage}</span>
            <span className="text-sm font-medium text-gray-900">
              {job.progress}%
            </span>
          </div>
          <Progress value={job.progress} className="h-2" />
          {/* {estimatedTimeRemaining && (
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>
                {formatNumber(job.stats.records_processed)} / {formatNumber(job.stats.total_records)} records
              </span>
              <span>
                ~{formatDuration(estimatedTimeRemaining)} remaining
              </span>
            </div>
          )} */}
        </div>

        {/* Resource Usage */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">CPU</span>
              <span className="text-xs font-medium">{job.resource_usage.cpu}%</span>
            </div>
            <Progress value={job.resource_usage.cpu} className="h-1" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">Memory</span>
              <span className="text-xs font-medium">{job.resource_usage.memory}%</span>
            </div>
            <Progress value={job.resource_usage.memory} className="h-1" />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-gray-100">
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              {job.stats.errors}
            </div>
            <div className="text-xs text-red-600">Errors</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              {job.stats.warnings}
            </div>
            <div className="text-xs text-yellow-600">Warnings</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-900">
              {/* {job.duration ? formatDuration(job.duration) : 'Running'} */}
              Running
            </div>
            <div className="text-xs text-gray-600">Duration</div>
          </div>
        </div>

        {/* User and Time */}
        <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <User className="w-3 h-3" />
            <span>{job.user.name}</span>
          </div>
          <span>Started {getTimeAgo(job.started_at || job.created_at)}</span>
        </div>
      </CardContent>
    </Card>
  )
}

function SystemOverview({ metrics }: { metrics: SystemMetrics }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">CPU Usage</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.cpu_usage}%</p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Cpu className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <Progress value={metrics.cpu_usage} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Memory</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.memory_usage}%</p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <MemoryStick className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <Progress value={metrics.memory_usage} className="mt-2" />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Queue Size</p>
              <p className="text-2xl font-bold text-gray-900">{metrics.queue_size}</p>
            </div>
            <div className="p-2 bg-purple-100 rounded-lg">
              <Layers className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Error Rate</p>
              <p className="text-2xl font-bold text-gray-900">{(metrics.error_rate * 100).toFixed(2)}%</p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertTriangle className="w-6 h-6 text-red-600" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface RealtimeStatusProps {
  autoRefresh?: boolean
  refreshInterval?: number
}

export function RealtimeProcessingStatus({ autoRefresh = true, refreshInterval = 5000 }: RealtimeStatusProps) {
  const [jobs, setJobs] = useState<ProcessingJob[]>(mockJobs)
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics>(mockSystemMetrics)
  const [filteredJobs, setFilteredJobs] = useState<ProcessingJob[]>(mockJobs)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [sortBy, setSortBy] = useState('created')
  const [isConnected, setIsConnected] = useState(true)
  const [selectedJob, setSelectedJob] = useState<ProcessingJob | null>(null)
  const [notifications, setNotifications] = useState(true)
  
  const wsRef = useRef<WebSocket | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // Simulate real-time updates
  useEffect(() => {
    if (!autoRefresh) return

    const updateJobs = () => {
      setJobs(prevJobs => 
        prevJobs.map(job => {
          if (job.status === 'running') {
            // Simulate progress
            const newProgress = Math.min(100, job.progress + Math.random() * 5)
            const newResourceUsage = {
              cpu: Math.max(0, Math.min(100, job.resource_usage.cpu + (Math.random() - 0.5) * 10)),
              memory: Math.max(0, Math.min(100, job.resource_usage.memory + (Math.random() - 0.5) * 5)),
              storage: job.resource_usage.storage,
              network: Math.max(0, Math.min(100, job.resource_usage.network + (Math.random() - 0.5) * 20))
            }
            
            return {
              ...job,
              progress: newProgress,
              resource_usage: newResourceUsage,
              stats: {
                ...job.stats,
                records_processed: Math.floor((newProgress / 100) * job.stats.total_records)
              },
              status: newProgress >= 100 ? 'completed' : job.status
            }
          }
          return job
        })
      )

      // Update system metrics
      setSystemMetrics(prev => ({
        ...prev,
        cpu_usage: Math.max(0, Math.min(100, prev.cpu_usage + (Math.random() - 0.5) * 5)),
        memory_usage: Math.max(0, Math.min(100, prev.memory_usage + (Math.random() - 0.5) * 3)),
        network_in: Math.max(0, prev.network_in + (Math.random() - 0.5) * 20),
        network_out: Math.max(0, prev.network_out + (Math.random() - 0.5) * 15),
        active_connections: Math.max(0, prev.active_connections + Math.floor((Math.random() - 0.5) * 10))
      }))
    }

    intervalRef.current = setInterval(updateJobs, refreshInterval)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [autoRefresh, refreshInterval])

  // Filter and sort jobs
  useEffect(() => {
    let filtered = jobs

    if (searchTerm) {
      filtered = filtered.filter(job =>
        job.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.user.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(job => job.status === statusFilter)
    }

    if (typeFilter !== 'all') {
      filtered = filtered.filter(job => job.type === typeFilter)
    }

    if (priorityFilter !== 'all') {
      filtered = filtered.filter(job => job.priority === priorityFilter)
    }

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'progress':
          return b.progress - a.progress
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

    setFilteredJobs(filtered)
  }, [jobs, searchTerm, statusFilter, typeFilter, priorityFilter, sortBy])

  const handlePauseJob = (jobId: string) => {
    setJobs(jobs.map(job => 
      job.id === jobId ? { ...job, status: 'paused' as const } : job
    ))
  }

  const handleResumeJob = (jobId: string) => {
    setJobs(jobs.map(job => 
      job.id === jobId ? { ...job, status: 'running' as const } : job
    ))
  }

  const handleCancelJob = (jobId: string) => {
    setJobs(jobs.map(job => 
      job.id === jobId ? { ...job, status: 'cancelled' as const } : job
    ))
  }

  const handleViewJob = (job: ProcessingJob) => {
    setSelectedJob(job)
  }

  const activeJobs = jobs.filter(job => job.status === 'running').length
  const queuedJobs = jobs.filter(job => job.status === 'queued').length
  const completedJobs = jobs.filter(job => job.status === 'completed').length
  const failedJobs = jobs.filter(job => job.status === 'failed').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Real-time Processing Status</h1>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-gray-600">Live monitoring of data processing jobs</p>
            <div className="flex items-center gap-1">
              {isConnected ? (
                <>
                  <Signal className="w-4 h-4 text-green-600" />
                  <span className="text-xs text-green-600 font-medium">Connected</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-red-600" />
                  <span className="text-xs text-red-600 font-medium">Disconnected</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch
              checked={notifications}
              onCheckedChange={setNotifications}
              id="notifications"
            />
            <label htmlFor="notifications" className="text-sm text-gray-600">
              Notifications
            </label>
          </div>
          <Button variant="outline" size="sm">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
          <Button variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Activity className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-2xl font-bold text-gray-900">{activeJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Queued</p>
                <p className="text-2xl font-bold text-gray-900">{queuedJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle2 className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{completedJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-gray-900">{failedJobs}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* System Overview */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
        <SystemOverview metrics={systemMetrics} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="jobs" className="space-y-6">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="jobs">Processing Jobs</TabsTrigger>
          <TabsTrigger value="queue">Job Queue</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="logs">System Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="jobs" className="space-y-6">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search jobs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="running">Running</SelectItem>
                  <SelectItem value="queued">Queued</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
                </SelectContent>
              </Select>

              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="data_processing">Data Processing</SelectItem>
                  <SelectItem value="ml_training">ML Training</SelectItem>
                  <SelectItem value="analysis">Analysis</SelectItem>
                  <SelectItem value="export">Export</SelectItem>
                  <SelectItem value="import">Import</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">Created</SelectItem>
                  <SelectItem value="progress">Progress</SelectItem>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="name">Name</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Jobs Grid */}
          {filteredJobs.length > 0 ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {filteredJobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                  onPause={handlePauseJob}
                  onResume={handleResumeJob}
                  onCancel={handleCancelJob}
                  onView={handleViewJob}
                />
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No jobs found</h3>
              <p className="text-gray-600">
                {searchTerm || statusFilter !== 'all' || typeFilter !== 'all'
                  ? 'Try adjusting your filters to see more jobs.'
                  : 'No processing jobs are currently running.'}
              </p>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="queue">
          <Card>
            <CardHeader>
              <CardTitle>Job Queue</CardTitle>
              <CardDescription>
                Pending jobs waiting to be processed
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Queue management interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Job History</CardTitle>
              <CardDescription>
                Historical view of completed and failed jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">History interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>System Logs</CardTitle>
              <CardDescription>
                Real-time system and application logs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">Logs interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
} 