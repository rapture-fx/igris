'use client'

import { useDashboardStats, useRecentActivity, useActiveJobs } from '@/hooks/useDashboardData'
import Link from 'next/link'

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading, isError: statsError } = useDashboardStats()
  const { data: activity, isLoading: activityLoading } = useRecentActivity(5)
  const { data: activeJobs, isLoading: jobsLoading } = useActiveJobs()

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M'
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K'
    }
    return num.toString()
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your Pollarbase API Platform
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Data Sources</h3>
          {statsLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-16 mt-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24 mt-2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-blue-600">{stats?.data_sources || 0}</p>
              <p className="text-sm text-gray-500">Total uploaded</p>
            </>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Total Records</h3>
          {statsLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-20 mt-2"></div>
              <div className="h-4 bg-gray-200 rounded w-24 mt-2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-green-600">{formatNumber(stats?.total_records || 0)}</p>
              <p className="text-sm text-gray-500">Processed</p>
            </>
          )}
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Quality Score</h3>
          {statsLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-16 mt-2"></div>
              <div className="h-4 bg-gray-200 rounded w-20 mt-2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-purple-600">{Math.round(stats?.quality_score || 0)}%</p>
              <p className="text-sm text-gray-500">Average</p>
            </>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Active Jobs</h3>
          {jobsLoading ? (
            <div className="animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-12 mt-2"></div>
              <div className="h-4 bg-gray-200 rounded w-16 mt-2"></div>
            </div>
          ) : (
            <>
              <p className="text-3xl font-bold text-orange-600">{activeJobs?.length || 0}</p>
              <p className="text-sm text-gray-500">Running</p>
            </>
          )}
        </div>
      </div>

      {/* Recent Activity & Quick Actions Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div className="p-6">
            {activityLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse flex space-x-3">
                    <div className="w-8 h-8 bg-gray-200 rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                      <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activity && activity.length > 0 ? (
              <div className="space-y-3">
                {activity.slice(0, 5).map((item: any, index: number) => (
                  <div key={item.id || index} className="flex items-start space-x-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm ${
                      item.status === 'success' ? 'bg-green-500' : 
                      item.status === 'error' ? 'bg-red-500' : 'bg-blue-500'
                    }`}>
                      {item.type === 'file_upload' ? '📁' : 
                       item.type === 'data_analysis' ? '🔍' : '⚡'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.title}</p>
                      <p className="text-sm text-gray-500">{item.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(item.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No recent activity</p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              <Link 
                href="/dashboard/data-sources"
                className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 mx-auto mb-2 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600">📊</span>
                </div>
                <h4 className="font-medium">Upload Data</h4>
                <p className="text-sm text-gray-500">Process new files</p>
              </Link>
              
              <Link 
                href="/dashboard/api-keys"
                className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 mx-auto mb-2 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600">🔑</span>
                </div>
                <h4 className="font-medium">API Keys</h4>
                <p className="text-sm text-gray-500">Manage access</p>
              </Link>
              
              <Link 
                href="/dashboard/usage"
                className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="w-8 h-8 mx-auto mb-2 bg-purple-100 rounded-lg flex items-center justify-center">
                  <span className="text-purple-600">📈</span>
                </div>
                <h4 className="font-medium">Usage</h4>
                <p className="text-sm text-gray-500">View metrics</p>
              </Link>
              
              <a 
                href="/docs"
                className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <div className="w-8 h-8 mx-auto mb-2 bg-orange-100 rounded-lg flex items-center justify-center">
                  <span className="text-orange-600">📚</span>
                </div>
                <h4 className="font-medium">API Docs</h4>
                <p className="text-sm text-gray-500">Integration guide</p>
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Active Jobs (if any) */}
      {activeJobs && activeJobs.length > 0 && (
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Active Jobs</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {activeJobs.map((job: any) => (
                <div key={job.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{job.name}</h4>
                    <p className="text-sm text-gray-500">Status: {job.status}</p>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="w-32 bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                        style={{ width: `${job.progress}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900">{job.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 