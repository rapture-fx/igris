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
import { Job } from './types';

export const getStatusIcon = (status: Job['status']) => {
  switch (status) {
    case 'running': return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
    case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'failed': return <AlertTriangle className="w-4 h-4 text-red-500" />
    case 'queued': return <Clock className="w-4 h-4 text-yellow-500" />
    case 'paused': return <Pause className="w-4 h-4 text-gray-500" />
    default: return <Clock className="w-4 h-4 text-gray-500" />
  }
}

export const getStatusColor = (status: Job['status']) => {
  switch (status) {
    case 'running': return 'bg-blue-100 text-blue-800'
    case 'completed': return 'bg-green-100 text-green-800'
    case 'failed': return 'bg-red-100 text-red-800'
    case 'queued': return 'bg-yellow-100 text-yellow-800'
    case 'paused': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const getTypeIcon = (type: Job['type']) => {
  switch (type) {
    case 'data_processing': return <Database className="w-5 h-5 text-blue-600" />
    case 'analysis': return <BarChart3 className="w-5 h-5 text-purple-600" />
    case 'export': return <Download className="w-5 h-5 text-green-600" />
    case 'import': return <Upload className="w-5 h-5 text-orange-600" />
    case 'transformation': return <Zap className="w-5 h-5 text-yellow-600" />
    default: return <FileText className="w-5 h-5 text-gray-600" />
  }
}

export const getPriorityColor = (priority: Job['priority']) => {
  switch (priority) {
    case 'high': return 'bg-red-100 text-red-800'
    case 'medium': return 'bg-yellow-100 text-yellow-800'
    case 'low': return 'bg-green-100 text-green-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${secs}s`
  return `${secs}s`
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatNumber = (num: number | undefined) => {
  if (num === undefined) return 'N/A'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toLocaleString()
}

export const getTimeRemaining = (estimatedCompletion?: string) => {
  if (!estimatedCompletion) return null
  const now = new Date()
  const completion = new Date(estimatedCompletion)
  const diff = completion.getTime() - now.getTime()
  
  if (diff <= 0) return 'Completing...'
  
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  
  if (hours > 0) return `~${hours}h ${minutes % 60}m remaining`
  return `~${minutes}m remaining`
} 