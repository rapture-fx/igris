'use client'

import { useState, useEffect } from 'react'
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

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [recentActivity, setRecentActivity] = useState<any[]>([])
  const [recommendations, setRecommendations] = useState<any[]>([])
  const [alerts, setAlerts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)

  // Fetch live data from API with enhanced endpoints
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activityRes, recommendationsRes, alertsRes] = await Promise.all([
          fetch('/api/proxy/dashboard/stats'),
          fetch('/api/proxy/dashboard/activity'),
          fetch('/api/proxy/recommendations'),
          fetch('/api/proxy/predictive-alerts')
        ])
        
        const statsData = await statsRes.json()
        const activityData = await activityRes.json()
        const recommendationsData = await recommendationsRes.json()
        const alertsData = await alertsRes.json()
        
        // Defensive programming with proper error handling
        setStats(statsData?.data || statsData || {})
        
        const activityArray = activityData?.data || activityData || []
        setRecentActivity(Array.isArray(activityArray) ? activityArray : [])
        
        const recommendationsArray = recommendationsData?.data || recommendationsData || []
        setRecommendations(Array.isArray(recommendationsArray) ? recommendationsArray : [])
        
        const alertsArray = alertsData?.data || alertsData || []
        setAlerts(Array.isArray(alertsArray) ? alertsArray : [])
      } catch (error) {
        console.error('Error fetching dashboard data:', error)
        // Ensure arrays remain arrays even on API failure
        setStats({})
        if (!Array.isArray(recentActivity)) setRecentActivity([])
        if (!Array.isArray(recommendations)) setRecommendations([])
        if (!Array.isArray(alerts)) setAlerts([])
      } finally {
        setLoading(false)
      }
    }

    fetchData()
    
    // Refresh every 10 seconds
    const interval = setInterval(fetchData, 10000)
    return () => clearInterval(interval)
  }, [])

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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading your data intelligence...</span>
        </div>
      </div>
    )
  }

  // Empty state for new users
  if (!stats || stats.data_sources === 0) {
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
                  window.location.reload()
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
              {stats.time_savings && (
                <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
                  🕒 {stats.time_savings.hours_saved_weekly}h saved this week
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
                <p className="text-3xl font-bold">{stats.time_savings?.hours_saved_weekly || 0}h</p>
                <p className="text-green-100 text-xs mt-1">
                  {formatCurrency(stats.time_savings?.cost_savings_monthly / 4 || 0)} value
                </p>
              </div>
              <Clock className="w-8 h-8 text-green-200" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Quality Score</p>
                <p className="text-2xl font-bold text-gray-900">{stats.quality_score}%</p>
                <p className="text-xs text-green-600 mt-1">
                  +{stats.quality_insights?.trends?.weekly_improvement || 2.3}% this week
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Records</p>
                <p className="text-2xl font-bold text-gray-900">{formatNumber(stats.total_records)}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.time_savings?.issues_auto_fixed || 0} issues auto-fixed
                </p>
              </div>
              <Database className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Data Sources</p>
                <p className="text-2xl font-bold text-gray-900">{stats.data_sources}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {stats.active_jobs} processing
                </p>
              </div>
              <Sparkles className="w-8 h-8 text-orange-500" />
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column - Recent Activity */}
          <div className="lg:col-span-5 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <Link href="/dashboard/data-sources" className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                View all →
              </Link>
            </div>
            
            <div className="space-y-4">
              {recentActivity.length > 0 ? (
                recentActivity.slice(0, 4).map((activity) => (
                  <div key={activity.id} className="flex items-start space-x-3 p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      {activity.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <Clock className="w-5 h-5 text-blue-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-sm text-gray-600 truncate">{activity.description}</p>
                      <p className="text-xs text-gray-500 mt-1">{getTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8">
                  <Clock className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No recent activity</p>
                </div>
              )}
            </div>
          </div>

          {/* Center Column - Smart Recommendations */}
          <div className="lg:col-span-4 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center space-x-2 mb-6">
              <Brain className="w-5 h-5 text-purple-600" />
              <h2 className="text-lg font-semibold text-gray-900">Smart Recommendations</h2>
            </div>
            
            <div className="space-y-4">
              {recommendations.slice(0, 3).map((rec) => (
                <div key={rec.id} className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">{rec.title}</h3>
                    <span className={`px-2 py-1 text-xs rounded-full ${
                      rec.priority === 'high' ? 'bg-red-100 text-red-800' :
                      rec.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-green-100 text-green-800'
                    }`}>
                      {rec.priority}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-green-600">⏱️ Saves {rec.estimated_time_saved}</span>
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {rec.action} →
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right Column - System Health & Alerts */}
          <div className="lg:col-span-3 space-y-6">
            {/* System Health */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2 mb-4">
                <Gauge className="w-5 h-5 text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">System Health</h2>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className="flex items-center text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                    {stats.system_health?.status || 'Healthy'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Processing Speed</span>
                  <span className="text-sm text-gray-900">{stats.system_health?.processing_speed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Storage Used</span>
                  <span className="text-sm text-gray-900">{stats.system_health?.storage_used_percentage}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Uptime</span>
                  <span className="text-sm text-gray-900">{stats.system_health?.uptime_percentage}%</span>
                </div>
              </div>
            </div>

            {/* Predictive Alerts */}
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <div className="flex items-center space-x-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-600" />
                <h2 className="text-lg font-semibold text-gray-900">Alerts</h2>
              </div>
              
              <div className="space-y-3">
                {alerts.slice(0, 3).map((alert) => (
                  <div key={alert.id} className={`p-3 rounded-lg border ${
                    alert.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                    alert.severity === 'critical' ? 'border-red-200 bg-red-50' :
                    'border-blue-200 bg-blue-50'
                  }`}>
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-medium text-gray-900">{alert.title}</h3>
                      <span className="text-xs text-gray-500">{alert.confidence}%</span>
                    </div>
                    <p className="text-xs text-gray-600 mb-2">{alert.description}</p>
                    <button className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                      {alert.suggested_action} →
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Bar */}
        <div className="mt-8 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/data-sources" className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors">
              <Database className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Data Sources</span>
            </Link>
            
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-colors"
            >
              <Upload className="w-5 h-5 text-green-600" />
              <span className="text-sm font-medium">Upload Data</span>
            </button>
            
            <Link href="/dashboard/api-keys" className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-colors">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <span className="text-sm font-medium">API Keys</span>
            </Link>
            
            <Link href="/dashboard/usage" className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-colors">
              <BarChart3 className="w-5 h-5 text-orange-600" />
              <span className="text-sm font-medium">Usage Stats</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Upload New Dataset</h2>
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
                window.location.reload()
              }}
            />
          </div>
        </div>
      )}
    </div>
  )
} 