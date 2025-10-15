import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Info,
  XCircle
} from 'lucide-react'
import { Anomaly } from './types'

export const getSeverityIcon = (severity: Anomaly['severity']) => {
  switch (severity) {
    case 'critical': return <AlertTriangle className="w-4 h-4 text-red-500" />
    case 'high': return <AlertTriangle className="w-4 h-4 text-orange-500" />
    case 'medium': return <Info className="w-4 h-4 text-yellow-500" />
    case 'low': return <CheckCircle2 className="w-4 h-4 text-blue-500" />
    default: return <Info className="w-4 h-4 text-gray-500" />
  }
}

export const getSeverityColor = (severity: Anomaly['severity']) => {
  switch (severity) {
    case 'critical': return 'border-red-500/50 bg-red-50'
    case 'high': return 'border-orange-500/50 bg-orange-50'
    case 'medium': return 'border-yellow-500/50 bg-yellow-50'
    case 'low': return 'border-blue-500/50 bg-blue-50'
    default: return 'border-gray-500/50 bg-gray-50'
  }
}

export const getStatusIcon = (status: Anomaly['status']) => {
  switch (status) {
    case 'active': return <AlertTriangle className="w-4 h-4 text-red-500" />
    case 'investigating': return <Eye className="w-4 h-4 text-yellow-500" />
    case 'resolved': return <CheckCircle2 className="w-4 h-4 text-green-500" />
    case 'false_positive': return <XCircle className="w-4 h-4 text-gray-500" />
    default: return <Clock className="w-4 h-4 text-gray-500" />
  }
}

export const getStatusColor = (status: Anomaly['status']) => {
  switch (status) {
    case 'active': return 'bg-red-100 text-red-800'
    case 'investigating': return 'bg-yellow-100 text-yellow-800'
    case 'resolved': return 'bg-green-100 text-green-800'
    case 'false_positive': return 'bg-gray-100 text-gray-800'
    default: return 'bg-gray-100 text-gray-800'
  }
}

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export const formatNumber = (num: number) => {
  return num.toLocaleString()
}

export const getTimeSince = (dateString: string) => {
  const date = new Date(dateString)
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  let interval = seconds / 31536000
  if (interval > 1) return Math.floor(interval) + " years ago"
  
  interval = seconds / 2592000
  if (interval > 1) return Math.floor(interval) + " months ago"
  
  interval = seconds / 86400
  if (interval > 1) return Math.floor(interval) + " days ago"

  interval = seconds / 3600
  if (interval > 1) return Math.floor(interval) + " hours ago"

  interval = seconds / 60
  if (interval > 1) return Math.floor(interval) + " minutes ago"

  return Math.floor(seconds) + " seconds ago"
} 