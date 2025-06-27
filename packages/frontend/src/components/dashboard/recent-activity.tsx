'use client'

import { useState, useEffect } from 'react'
import { FileText, Clock, CheckCircle2, AlertCircle, Upload, Brain, BarChart3, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  status: string
  timestamp: string
  user_email?: string
}

interface RecentActivityProps {
  limit?: number
  className?: string
}

export function RecentActivity({ limit = 10, className = '' }: RecentActivityProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRecentActivity()
  }, [limit])

  const fetchRecentActivity = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch(`/api/proxy/dashboard/activity?limit=${limit}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setActivities(data)
      } else {
        // Fallback to empty array
        setActivities([])
      }
    } catch (error) {
      console.error('Failed to fetch recent activity:', error)
      setActivities([])
    } finally {
      setLoading(false)
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file_upload':
        return <Upload className="w-5 h-5 text-blue-500" />
      case 'data_analysis':
        return <BarChart3 className="w-5 h-5 text-green-500" />
      case 'ai_processing':
        return <Brain className="w-5 h-5 text-purple-500" />
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <FileText className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-50 border-green-200'
      case 'processing':
        return 'bg-blue-50 border-blue-200'
      case 'failed':
        return 'bg-red-50 border-red-200'
      default:
        return 'bg-gray-50 border-gray-200'
    }
  }

  const formatTimeAgo = (timestamp: string) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60))

    if (diffInMinutes < 1) return 'Just now'
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`
    return `${Math.floor(diffInMinutes / 1440)}d ago`
  }

  if (loading) {
    return (
      <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-start space-x-3">
                <div className="w-5 h-5 bg-gray-200 rounded"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
          <Link 
            href="/dashboard/data-sources" 
            className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            View All
            <ArrowUpRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>
      
      <div className="p-6">
        {activities.length > 0 ? (
          <div className="space-y-4">
            {activities.map((activity) => (
              <div 
                key={activity.id} 
                className={`p-4 border rounded-lg transition-all hover:shadow-sm ${getStatusColor(activity.status)}`}
              >
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {activity.title}
                      </h4>
                      {getStatusIcon(activity.status)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">
                      {activity.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(activity.timestamp)}
                      </span>
                      {activity.user_email && (
                        <span className="text-xs text-gray-500">
                          by {activity.user_email}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No Recent Activity</h4>
            <p className="text-gray-600 mb-4">Upload your first dataset to get started</p>
            <Link
              href="/dashboard/data-sources"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload Dataset
            </Link>
          </div>
        )}
      </div>
    </div>
  )
} 