'use client'

import { useQuery } from '@tanstack/react-query'
import { Database, Cloud, Globe, FileText, MoreVertical } from 'lucide-react'
import { dataSourcesApi } from '@/lib/api/data-sources'
import { cn, getStatusColor } from '@/lib/utils'

const getSourceIcon = (type: string) => {
  switch (type) {
    case 'database':
      return Database
    case 'cloud_storage':
      return Cloud
    case 'api':
      return Globe
    case 'file':
      return FileText
    default:
      return Database
  }
}

export function DataSourcesList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['data-sources'],
    queryFn: () => dataSourcesApi.getAll(1, 20)
  })

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="animate-pulse bg-gray-200 h-48 rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-2">Failed to load data sources</div>
        <button className="text-blue-600 hover:text-blue-700">
          Try again
        </button>
      </div>
    )
  }

  const dataSources = data?.data?.data || []

  if (dataSources.length === 0) {
    return (
      <div className="text-center py-12">
        <Database className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-semibold text-gray-900">No data sources</h3>
        <p className="mt-1 text-sm text-gray-500">
          Get started by connecting your first data source.
        </p>
        <div className="mt-6">
          <button className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            <Database className="w-4 h-4 mr-2" />
            Add Data Source
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {dataSources.map((source: any) => {
        const IconComponent = getSourceIcon(source.type)
        
        return (
          <div
            key={source.id}
            className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{source.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{source.type.replace('_', ' ')}</p>
                </div>
              </div>
              <button className="p-1 hover:bg-gray-100 rounded">
                <MoreVertical className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                <span className={cn('status-indicator', getStatusColor(source.status))}>
                  {source.status.charAt(0).toUpperCase() + source.status.slice(1)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Last Sync</span>
                <span className="text-sm text-gray-900">
                  {source.lastSyncAt ? new Date(source.lastSyncAt).toLocaleDateString() : 'Never'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Created</span>
                <span className="text-sm text-gray-900">
                  {new Date(source.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex space-x-2">
                <button className="flex-1 px-3 py-2 text-sm bg-blue-50 text-blue-700 rounded hover:bg-blue-100 transition-colors">
                  View Details
                </button>
                <button className="flex-1 px-3 py-2 text-sm bg-gray-50 text-gray-700 rounded hover:bg-gray-100 transition-colors">
                  Sync Now
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
} 