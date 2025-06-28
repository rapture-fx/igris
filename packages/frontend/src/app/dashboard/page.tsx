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
  RefreshCw,
  ListChecks,
  Gauge
} from 'lucide-react'
import Link from 'next/link'
import { DataQualityOverview } from '@/components/dashboard/data-quality-overview'
import { WorkflowStatus } from '@/components/dashboard/workflow-status'
import { RecentActivity } from '@/components/dashboard/recent-activity'
import { GuidedTour } from '@/components/onboarding/guided-tour'
import { useDashboardData } from '@/hooks/useAPIData'
import { DashboardCard } from '@/components/dashboard/dashboard-card'

interface DashboardStats {
  data_sources: number
  total_records: number
  quality_score: number
  active_jobs: number
  processing_jobs?: number
  completed_jobs?: number
  failed_jobs?: number
}

interface ActivityItem {
  id: string
  type: string
  title: string
  description: string
  status: string
  timestamp: string
  user?: string
}

interface ActiveJob {
  job_id: string
  investigation_name: string
  status: string
  progress_percentage: number
}

export default function DashboardPage() {
  const [showTour, setShowTour] = useState(false)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([])
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Use centralized data hook instead of manual state management
  const { 
    loading: apiLoading, 
    error: apiError, 
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

  useEffect(() => {
    // Simulate loading and set mock data
    const timer = setTimeout(() => {
      setStats({
        data_sources: 12,
        total_records: 2847392,
        quality_score: 94,
        active_jobs: 5,
        processing_jobs: 2,
        completed_jobs: 156,
        failed_jobs: 3
      })

      setRecentActivity([
        {
          id: '1',
          type: 'file_upload',
          title: 'Customer Dataset Uploaded',
          description: 'customer_data_2024.csv processed successfully (15,420 records)',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
          user: 'John Doe'
        },
        {
          id: '2',
          type: 'ai_processing',
          title: 'AI Model Training Started',
          description: 'Customer segmentation model training in progress',
          status: 'processing',
          timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          user: 'Sarah Wilson'
        },
        {
          id: '3',
          type: 'data_quality',
          title: 'Quality Check Completed',
          description: 'Data quality score improved to 94% (+2%)',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
          user: 'System'
        },
        {
          id: '4',
          type: 'integration',
          title: 'Salesforce Sync',
          description: 'Successfully synced 2,340 customer records',
          status: 'completed',
          timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
          user: 'API Connector'
        }
      ])

      setActiveJobs([
        {
          id: 'job_001',
          name: 'Customer Segmentation Model',
          type: 'ml_training',
          status: 'running',
          progress: 67,
          startedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
          estimatedCompletion: new Date(Date.now() + 1000 * 60 * 15).toISOString()
        },
        {
          id: 'job_002',
          name: 'Sales Data ETL',
          type: 'data_processing',
          status: 'running',
          progress: 23,
          startedAt: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
          estimatedCompletion: new Date(Date.now() + 1000 * 60 * 35).toISOString()
        }
      ])

      setLoading(false)
    }, 800) // Short loading time

    return () => clearTimeout(timer)
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

  // Loading state with consistent layout
  if (loading) {
    return (
      <div className="p-6 sm:p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-64 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-96 mb-8"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
              <div className="h-32 bg-gray-200 rounded-xl"></div>
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

  // Error state with consistent layout
  if (apiError) {
    return (
      <div className="p-6 sm:p-8">
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
    <div className="p-6 sm:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div>
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
        <div className="grid auto-rows-fr gap-6 sm:grid-cols-2 xl:grid-cols-4">
          <DashboardCard className="p-6">
            <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Sources</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats?.data_sources ?? '--'}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50">
                <Database className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard className="p-6">
            <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{formatNumber(stats?.total_records ?? 0)}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-50">
                <ListChecks className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard className="p-6">
            <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-sm font-medium text-gray-600">Quality Score</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats?.quality_score ? Math.round(stats.quality_score) + '%' : '--'}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-yellow-50">
                <Gauge className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
          </DashboardCard>

          <DashboardCard className="p-6">
            <div className="flex items-center justify-between h-full">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Jobs</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900">{stats?.active_jobs ?? 0}</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-50">
                <Clock className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </DashboardCard>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
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
            <RecentActivity />
          </div>

          {/* Workflow Status */}
          <div data-tour="workflow-status">
            <WorkflowStatus />
          </div>
        </div>

        {/* Guided Tour */}
        {showTour && (
          <GuidedTour
            isVisible={showTour}
            onClose={() => setShowTour(false)}
            onComplete={() => setShowTour(false)}
          />
        )}
      </div>
    </div>
  )
} 