'use client'

import { useState, useEffect } from 'react'
import { FileText, Database, Clock, CheckCircle2, AlertCircle, Eye, Download, Trash2, RefreshCw } from 'lucide-react'
import Link from 'next/link'

interface Investigation {
  id: string
  name: string
  description?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  progress_percentage: number
  quality_score?: number
  total_records?: number
  file_size_bytes?: number
  created_at: string
  updated_at: string
  data_source_config?: {
    filename?: string
    file_type?: string
  }
}

export function DataSourcesList() {
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'processing' | 'completed' | 'failed'>('all')

  useEffect(() => {
    fetchInvestigations()
  }, [])

  const fetchInvestigations = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/proxy/data/investigations', {
        headers: { 'Authorization': `Bearer ${token}` }
      })

      if (response.ok) {
        const data = await response.json()
        setInvestigations(data)
      }
    } catch (error) {
      console.error('Failed to fetch investigations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />
      case 'processing':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />
      default:
        return <Clock className="w-5 h-5 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'processing':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown'
    const mb = bytes / (1024 * 1024)
    return `${mb.toFixed(1)} MB`
  }

  const formatNumber = (num?: number) => {
    if (!num) return '0'
    return num.toLocaleString()
  }

  const filteredInvestigations = investigations.filter(inv => {
    if (filter === 'all') return true
    return inv.status === filter
  })

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Your Data Sources</h3>
          <button
            onClick={fetchInvestigations}
            className="inline-flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex space-x-1 bg-gray-100 rounded-lg p-1">
          {[
            { key: 'all', label: 'All', count: investigations.length },
            { key: 'processing', label: 'Processing', count: investigations.filter(i => i.status === 'processing').length },
            { key: 'completed', label: 'Completed', count: investigations.filter(i => i.status === 'completed').length },
            { key: 'failed', label: 'Failed', count: investigations.filter(i => i.status === 'failed').length }
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as any)}
              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                filter === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      <div className="p-6">
        {filteredInvestigations.length === 0 ? (
          <div className="text-center py-8">
            <Database className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">
              {filter === 'all' ? 'No data sources yet' : `No ${filter} investigations`}
            </h4>
            <p className="text-gray-600">
              {filter === 'all' 
                ? 'Upload your first dataset to get started with AI-powered analysis'
                : `No investigations with ${filter} status found`
              }
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredInvestigations.map((investigation) => (
              <div
                key={investigation.id}
                className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(investigation.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <h4 className="text-base font-medium text-gray-900 truncate">
                          {investigation.name}
                        </h4>
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investigation.status)}`}>
                          {investigation.status}
                        </span>
                      </div>
                      
                      {investigation.description && (
                        <p className="text-sm text-gray-600 mb-2">{investigation.description}</p>
                      )}
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span>
                          {investigation.data_source_config?.filename || 'Unknown file'}
                        </span>
                        <span>•</span>
                        <span>{formatFileSize(investigation.file_size_bytes)}</span>
                        <span>•</span>
                        <span>{formatNumber(investigation.total_records)} records</span>
                        {investigation.quality_score && (
                          <>
                            <span>•</span>
                            <span className="font-medium text-green-600">
                              Quality: {Math.round(investigation.quality_score * 100)}%
                            </span>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Created {new Date(investigation.created_at).toLocaleDateString()}</span>
                        <span>Updated {new Date(investigation.updated_at).toLocaleDateString()}</span>
                      </div>

                      {investigation.status === 'processing' && (
                        <div className="mt-3">
                          <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                            <span>Processing Progress</span>
                            <span>{Math.round(investigation.progress_percentage)}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${investigation.progress_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-2 ml-4">
                    {investigation.status === 'completed' && (
                      <Link
                        href={`/dashboard/data-sources?investigation=${investigation.id}`}
                        className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </Link>
                    )}
                    <button
                      className="p-2 text-gray-400 hover:text-green-600 transition-colors"
                      title="Download"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 