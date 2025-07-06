'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useDashboardData } from '@/hooks/useDashboardData'
import { FileUpload } from '@/components/upload/FileUpload'
import { 
  Plus, 
  Upload, 
  RefreshCw, 
  AlertTriangle, 
  Clock, 
  Database, 
  TrendingUp, 
  CheckCircle2, 
  Target,
  Gauge,
  BarChart3,
  Activity,
  ArrowUpRight,
  Sparkles,
  Zap,
  Shield,
  Users,
  FileText,
  Settings,
  ChevronRight
} from 'lucide-react'

// NOTE: This refactoring focuses on adopting the new data fetching hooks.
// The `recommendations` and `predictive-alerts` sections have been removed
// as they are not currently provided by `useDashboardData`. They can be
// re-integrated when corresponding hooks are available.

// Add a type for the job object to improve safety
interface ActiveJob {
  job_id: string;
  investigation_name: string;
  status: string;
  progress_percentage: number | null;
  estimated_completion: string | null;
}

export default function DashboardPage() {
  const [showUpload, setShowUpload] = useState(false)
  const { 
    stats, 
    recentActivity, 
    dataQuality,
    activeJobs,
    isLoading, 
    isError, 
    refetchAll 
  } = useDashboardData()

  const formatNumber = (num: number) => {
    if (!num) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(num)
  }

  const getTimeAgo = (timestamp: string) => {
    const diff = Date.now() - new Date(timestamp).getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)
    
    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Unable to load dashboard</h3>
          <p className="text-gray-600 mb-4">There was an error loading your dashboard data.</p>
          <button
            onClick={refetchAll}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Empty state for new users
  if (!stats.data || stats.data.data_sources === 0) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Upload className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-3">
            Welcome to Schlep-engine
          </h1>
          <p className="text-gray-600 mb-8">
            Upload your first dataset to start transforming messy data into ML-ready insights
          </p>
          
          <div className="space-y-3">
            <button
              onClick={() => setShowUpload(true)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium py-3 px-6 rounded-xl transition-all transform hover:scale-105 flex items-center justify-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Upload Your First File</span>
            </button>
            
            <Link href="/dashboard/data-sources" className="block">
              <button className="w-full border border-gray-300 hover:border-gray-400 text-gray-700 font-medium py-3 px-6 rounded-xl transition-colors">
                Browse Sample Data
              </button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // Main Dashboard
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Your data intelligence overview</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Data
        </button>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Time Saved Weekly</p>
              <p className="text-3xl font-bold">{stats.data?.time_savings?.hours_saved_weekly || 0}h</p>
              <p className="text-emerald-100 text-xs mt-1">
                {formatCurrency(stats.data?.time_savings?.cost_savings_monthly / 4 || 0)} value
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <Clock className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Quality Score</p>
              <p className="text-3xl font-bold text-gray-900">{stats.data?.quality_score}%</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +{stats.data?.quality_insights?.trends?.weekly_improvement || 2.3}% this week
              </p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(stats.data?.total_records)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.data?.time_savings?.issues_auto_fixed || 0} issues auto-fixed
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Data Sources</p>
              <p className="text-3xl font-bold text-gray-900">{stats.data?.data_sources}</p>
              <p className="text-xs text-gray-500 mt-1">
                in {stats.data?.project_count || 1} projects
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Data Quality */}
        <div className="lg:col-span-2 space-y-6">
          {/* Data Quality Insights */}
          {dataQuality.data && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Target className="w-5 h-5 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Data Quality Insights</h2>
                    <p className="text-sm text-gray-600">Real-time quality monitoring</p>
                  </div>
                </div>
                <Link href="/dashboard/data-analysis">
                  <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    View Details
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </Link>
              </div>

              {/* Quality Score Gauge */}
              <div className="text-center mb-6">
                <div className="relative inline-block">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                    <div className="w-20 h-20 bg-white rounded-full flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold text-gray-900">{dataQuality.data.overall_score}%</span>
                      <span className="text-xs text-gray-500">Overall</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-emerald-50 rounded-xl">
                  <p className="text-2xl font-bold text-emerald-600">{dataQuality.data.excellent_count}</p>
                  <p className="text-sm text-emerald-700 font-medium">Excellent</p>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-xl">
                  <p className="text-2xl font-bold text-blue-600">{dataQuality.data.good_count}</p>
                  <p className="text-sm text-blue-700 font-medium">Good</p>
                </div>
                <div className="text-center p-4 bg-amber-50 rounded-xl">
                  <p className="text-2xl font-bold text-amber-600">{dataQuality.data.fair_count}</p>
                  <p className="text-sm text-amber-700 font-medium">Fair</p>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-xl">
                  <p className="text-2xl font-bold text-red-600">{dataQuality.data.poor_count}</p>
                  <p className="text-sm text-red-700 font-medium">Poor</p>
                </div>
              </div>
            </div>
          )}

          {/* Active Jobs */}
          {activeJobs.data && activeJobs.data.length > 0 && (
            <div className="bg-white rounded-2xl p-6 border border-gray-100">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Activity className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Active Jobs</h2>
                    <p className="text-sm text-gray-600">{activeJobs.data.length} jobs running</p>
                  </div>
                </div>
                <Link href="/dashboard/jobs">
                  <button className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700">
                    View All
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </button>
                </Link>
              </div>

              <div className="space-y-4">
                {activeJobs.data.slice(0, 3).map((job: any) => (
                  <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                        <Zap className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{job.name}</h3>
                        <p className="text-sm text-gray-600">{job.status}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{job.progress}%</div>
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
                          style={{ width: `${job.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Column - Recent Activity */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <div className="flex items-center space-x-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Recent Activity</h2>
                <p className="text-sm text-gray-600">Latest updates</p>
              </div>
            </div>
            
            <div className="space-y-4">
              {recentActivity.data?.slice(0, 5).map((activity: any) => (
                <div key={activity.id} className="flex space-x-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900">{activity.title}</p>
                    <p className="text-xs text-gray-600 mt-1">{activity.description}</p>
                    <p className="text-xs text-gray-500 mt-2">{getTimeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl p-6 border border-gray-100">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Link href="/dashboard/data-sources">
                <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3">
                    <Database className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Data Sources</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </Link>
              <Link href="/dashboard/anomalies">
                <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3">
                    <Shield className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Anomaly Detection</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </Link>
              <Link href="/dashboard/settings">
                <button className="w-full flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                  <div className="flex items-center space-x-3">
                    <Settings className="w-5 h-5 text-gray-600" />
                    <span className="font-medium text-gray-900">Settings</span>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* File Upload Modal */}
      {showUpload && (
        <FileUpload 
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false)
            refetchAll()
          }}
        />
      )}
    </div>
  )
}