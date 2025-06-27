'use client'

import { useState, useEffect } from 'react'
import { 
  Database, 
  TrendingUp, 
  Activity, 
  FileText, 
  AlertCircle, 
  CheckCircle2,
  Clock,
  Upload,
  BarChart3,
  Settings,
  HelpCircle,
  Sparkles,
  RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { DataQualityOverview } from '@/components/dashboard/data-quality-overview'
import { WorkflowStatus } from '@/components/dashboard/workflow-status'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { useDashboardData } from '@/hooks/useAPIData'

interface DashboardStats {
  data_sources: number
  total_records: number
  quality_score: number
  active_jobs: number
}

interface RecentActivity {
  id: string
  type: string
  title: string
  description: string
  status: string
  timestamp: string
}

interface ActiveJob {
  job_id: string
  investigation_name: string
  status: string
  progress_percentage: number
}

export default function DashboardPage() {
  const [showTour, setShowTour] = useState(false)

  // Use centralized data hook instead of manual state management
  const { 
    stats, 
    recentActivity, 
    activeJobs, 
    loading, 
    error, 
    refetchAll 
  } = useDashboardData()

  useEffect(() => {
    // Check if user needs onboarding
    const hasSeenTour = localStorage.getItem('pollarbase-tour-completed')
    const hasData = localStorage.getItem('pollarbase-has-data')
    
    if (!hasSeenTour && !hasData) {
      setShowTour(true)
    }
  }, [])

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toString()
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case 'processing': return <Clock className="w-4 h-4 text-blue-500" />
      case 'failed': return <AlertCircle className="w-4 h-4 text-red-500" />
      default: return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'file_upload': return '📁'
      case 'data_analysis': return '🔍'
      case 'ai_processing': return '🤖'
      default: return '⚡'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-xl"></div>
              ))}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="h-96 bg-gray-200 rounded-xl"></div>
              <div className="h-96 bg-gray-200 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">Failed to load dashboard data</span>
            </div>
            <button
              onClick={refetchAll}
              className="mt-4 px-4 py-2 bg-red-100 text-red-700 rounded-md hover:bg-red-200 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
              <p className="mt-2 text-gray-600">
                Welcome to your Pollarbase AI Data Intelligence Platform
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={refetchAll}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Refresh</span>
              </button>
              <button
                onClick={() => setShowTour(true)}
                className="inline-flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <HelpCircle className="w-4 h-4" />
                <span>Take Tour</span>
              </button>
              {(!stats || stats.data_sources === 0) && (
                <Link
                  href="/dashboard/data-sources"
                  className="inline-flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                  data-tour="upload-cta"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload First Dataset</span>
                  <Sparkles className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Sources</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.data_sources || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Total uploaded</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{formatNumber(stats?.total_records || 0)}</p>
                <p className="text-sm text-gray-500 mt-1">Processed</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quality Score</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{Math.round(stats?.quality_score || 0)}%</p>
                <p className="text-sm text-gray-500 mt-1">Average quality</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{stats?.active_jobs || 0}</p>
                <p className="text-sm text-gray-500 mt-1">Processing now</p>
              </div>
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <Activity className="h-6 w-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Data Quality Overview */}
          <div className="lg:col-span-2">
            <DataQualityOverview />
          </div>

          {/* Quick Actions */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" data-tour="quick-actions">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-3">
                <Link
                  href="/dashboard/data-sources"
                  className="flex items-center p-3 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Upload className="w-4 h-4 mr-3 text-blue-500" />
                  Upload New Dataset
                </Link>
                <Link
                  href="/dashboard/api-keys"
                  className="flex items-center p-3 text-sm text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Settings className="w-4 h-4 mr-3 text-gray-500" />
                  Manage API Keys
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Activity */}
          <div data-tour="recent-activity">
            <RecentActivity activities={recentActivity} />
          </div>

          {/* Workflow Status */}
          <div data-tour="workflow-status">
            <WorkflowStatus jobs={activeJobs} />
          </div>
        </div>

        {/* Guided Tour */}
        {showTour && (
          <GuidedTour
            isOpen={showTour}
            onClose={() => setShowTour(false)}
          />
        )}
      </div>
    </div>
  )
} 