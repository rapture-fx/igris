'use client'

import { useState } from 'react'
import { 
  Upload, 
  Database, 
  BarChart3,
  Sparkles,
  Plus,
  RefreshCw,
  Clock,
  CheckCircle2,
  TrendingUp,
  X,
  DollarSign,
  Zap,
  AlertTriangle,
  Target,
  Brain,
  Shield,
  Gauge,
  TrendingDown
} from 'lucide-react'
import Link from 'next/link'
import { FileUpload } from '@/components/upload/FileUpload'
import { useDashboardData } from '@/hooks/useDashboardData'

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading your data intelligence...</span>
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2 text-red-500">
          <AlertTriangle className="w-5 h-5" />
          <span>Error loading dashboard data. Please try again later.</span>
        </div>
      </div>
    )
  }

  // Empty state for new users
  if (!stats.data || stats.data.data_sources === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex items-center justify-center min-h-screen p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Upload className="w-8 h-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-3">
              Welcome to Pollarbase
            </h1>
            <p className="text-gray-600 mb-8">
              Upload your first dataset to start handling the data schlep
            </p>
            
            <div className="space-y-4">
            <button
                onClick={() => setShowUpload(true)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors flex items-center justify-center space-x-2"
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

        {showUpload && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold">Upload Dataset</h2>
                <button
                  onClick={() => setShowUpload(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              <FileUpload 
                onUploadComplete={() => {
                  setShowUpload(false)
                  refetchAll()
                }}
              />
            </div>
          </div>
        )}
      </div>
    )
  }

  // Production Dashboard with all phases
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with Time Saved Highlight */}
        <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <div className="flex items-center space-x-4 mt-2">
              <p className="text-gray-600">Your data intelligence overview</p>
              {stats.data?.time_savings && (
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  🕒 {stats.data.time_savings.hours_saved_weekly}h saved this week
            </div>
              )}
            </div>
          </div>
          <button
            onClick={() => setShowUpload(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Add Data</span>
          </button>
        </div>

        {/* Hero Metrics - Time Savings Focus */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-r from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-green-100 text-sm font-medium">Time Saved Weekly</p>
                <p className="text-3xl font-bold">{stats.data?.time_savings?.hours_saved_weekly || 0}h</p>
                <p className="text-green-100 text-xs mt-1">
                  {formatCurrency(stats.data?.time_savings?.cost_savings_monthly / 4 || 0)} value
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-200" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quality Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.data?.quality_score}%</p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats.data?.quality_insights?.trends?.weekly_improvement || 2.3}% this week
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.data?.total_records)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.data?.time_savings?.issues_auto_fixed || 0} issues auto-fixed
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.data?.data_sources}</p>
                <p className="text-xs text-gray-500 mt-1">
                  in {stats.data?.project_count || 1} projects
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column - Data Quality & Active Jobs */}
          <div className="lg:col-span-2 space-y-6">

            {/* Data Quality Insights */}
            {dataQuality.data && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Target className="w-6 h-6 text-indigo-500" />
                    <h2 className="text-lg font-bold text-gray-800">Data Quality Insights</h2>
                  </div>
                  <Link href="/dashboard/data-analysis">
                    <span className="text-sm font-medium text-blue-600 hover:underline">View Details</span>
                  </Link>
                </div>
                {/* Quality Score Gauge */}
                <div className="text-center mb-4">
                  <div className="relative inline-block">
                    <Gauge className="w-24 h-24 text-gray-200" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-3xl font-bold text-gray-900">{dataQuality.data.overall_score}%</span>
                      <span className="text-sm text-gray-500">Overall Score</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-green-600">{dataQuality.data.excellent_count}</p>
                    <p className="text-sm text-gray-500">Excellent</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-blue-500">{dataQuality.data.good_count}</p>
                    <p className="text-sm text-gray-500">Good</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-500">{dataQuality.data.fair_count}</p>
                    <p className="text-sm text-gray-500">Fair</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">{dataQuality.data.poor_count}</p>
                    <p className="text-sm text-gray-500">Poor</p>
                  </div>
                </div>
              </div>
            )}
            
            {/* Active Jobs */}
            {activeJobs.data && activeJobs.data.length > 0 && (
              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <div className="flex items-center space-x-3 mb-4">
                  <Zap className="w-6 h-6 text-yellow-500" />
                  <h2 className="text-lg font-bold text-gray-800">Active Jobs</h2>
                </div>
                <ul className="space-y-4">
                  {activeJobs.data.map((job: ActiveJob) => (
                    <li key={job.job_id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-800">{job.investigation_name}</p>
                        <p className="text-sm text-gray-500">{job.status}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-blue-600">{(job.progress_percentage || 0).toFixed(0)}%</p>
                        <p className="text-xs text-gray-400">
                          ETA: {job.estimated_completion ? getTimeAgo(job.estimated_completion) : 'Calculating...'}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Side Column - Recent Activity */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-3 mb-4">
              <BarChart3 className="w-6 h-6 text-blue-500" />
              <h2 className="text-lg font-bold text-gray-800">Recent Activity</h2>
            </div>
            
            <ul className="space-y-4">
              {recentActivity.data?.map((activity: any) => (
                <li key={activity.id} className="flex space-x-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium text-sm text-gray-800">{activity.title}</p>
                    <p className="text-xs text-gray-500">{activity.description}</p>
                    <p className="text-xs text-gray-400 mt-1">{getTimeAgo(activity.timestamp)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}