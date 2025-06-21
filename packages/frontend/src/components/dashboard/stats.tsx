'use client'

import { Database, Brain, Workflow, AlertTriangle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { intelligenceApi } from '@/lib/api/intelligence'
import { dataSourcesApi } from '@/lib/api/data-sources'
import { workflowsApi } from '@/lib/api/workflows'

const mockStats = {
  dataSources: 12,
  totalRecords: 2847392,
  qualityScore: 87,
  activeWorkflows: 8,
  anomaliesDetected: 23,
  lastProfiledAt: '2024-01-15T10:30:00Z'
}

export function DashboardStats() {
  // In a real app, these would be separate API calls
  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000))
      return mockStats
    }
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 h-24 rounded-lg" />
        ))}
      </div>
    )
  }

  const statCards = [
    {
      name: 'Data Sources',
      value: stats?.dataSources || 0,
      icon: Database,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      name: 'Total Records',
      value: (stats?.totalRecords || 0).toLocaleString(),
      icon: Brain,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      name: 'Quality Score',
      value: `${stats?.qualityScore || 0}%`,
      icon: AlertTriangle,
      color: stats?.qualityScore && stats.qualityScore > 80 ? 'text-green-600' : 'text-yellow-600',
      bgColor: stats?.qualityScore && stats.qualityScore > 80 ? 'bg-green-100' : 'bg-yellow-100',
    },
    {
      name: 'Active Workflows',
      value: stats?.activeWorkflows || 0,
      icon: Workflow,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100',
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {statCards.map((stat) => (
        <div
          key={stat.name}
          className="relative overflow-hidden rounded-lg bg-white px-4 py-5 shadow border border-gray-200 hover:shadow-md transition-shadow"
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className={`w-8 h-8 rounded-md ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <div className="ml-5 w-0 flex-1">
              <dl>
                <dt className="text-sm font-medium text-gray-500 truncate">
                  {stat.name}
                </dt>
                <dd className="text-lg font-semibold text-gray-900">
                  {stat.value}
                </dd>
              </dl>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
} 