'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileUpload } from '@/components/upload/FileUpload'
import { DataProcessingOverview } from '@/components/dashboard/data-processing-overview'
import { DataQualityCharts } from '@/components/dashboard/data-quality-charts'
import { Upload, Plus, Database, FileText, TrendingUp, Eye, Download, RefreshCw } from 'lucide-react'
import { DataSourcesHeader } from '@/components/data-sources/data-sources-header'
import { DataSourcesList } from '@/components/data-sources/data-sources-list'
import DataIntegrationDashboard from '@/components/integration/data-integration-dashboard'

interface Investigation {
  id: string
  name: string
  description?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  progress_percentage: number
  quality_score?: number
  created_at: string
  updated_at: string
}

export default function DataSourcesPage() {
  const [showUpload, setShowUpload] = useState(false)
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedInvestigation, setSelectedInvestigation] = useState<string | null>(null)
  const searchParams = useSearchParams()

  useEffect(() => {
    fetchInvestigations()
    
    // Check if we should highlight a specific investigation
    const investigationId = searchParams.get('investigation')
    if (investigationId) {
      setSelectedInvestigation(investigationId)
    }
  }, [searchParams])

  const fetchInvestigations = async () => {
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/proxy/data/investigations', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
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

  const handleUploadComplete = (investigationId: string) => {
    fetchInvestigations()
    setShowUpload(false)
    setSelectedInvestigation(investigationId)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <Database className="w-4 h-4" />
      case 'running':
        return <RefreshCw className="w-4 h-4 animate-spin" />
      case 'failed':
        return <Upload className="w-4 h-4" />
      default:
        return <FileText className="w-4 h-4" />
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Sources</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage and process your data sources
          </p>
        </div>
        <div className="animate-pulse space-y-4">
          <div className="h-64 bg-gray-200 rounded-lg"></div>
          <div className="h-48 bg-gray-200 rounded-lg"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <DataSourcesHeader />
      </div>

      {/* Upload Section */}
      <div className="mb-8" data-tour="upload-area">
        <FileUpload />
      </div>

      {/* Data Sources List */}
      <div className="mb-8">
        <DataSourcesList />
      </div>

      {/* Data Integration Dashboard */}
      <div>
        <DataIntegrationDashboard />
      </div>

      {/* Data Processing Overview */}
      {investigations.length > 0 && (
        <DataProcessingOverview />
      )}

      {/* Selected Investigation Details */}
      {selectedInvestigation && (
        <DataQualityCharts investigationId={selectedInvestigation} />
      )}

      {/* Investigation List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Your Investigations</h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Database className="w-4 h-4" />
              {investigations.length} {investigations.length === 1 ? 'investigation' : 'investigations'}
            </div>
          </div>
        </div>

        {investigations.length === 0 ? (
          <div className="p-6">
            <div className="text-center py-12">
              <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                <Upload className="w-12 h-12 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No investigations yet</h3>
              <p className="text-gray-500 mb-6 max-w-sm mx-auto">
                Upload your first data file to start analyzing with AI-powered intelligence. 
                Get insights, quality scores, and recommendations instantly.
              </p>
              <button
                onClick={() => setShowUpload(true)}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Upload Your First Dataset
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {investigations.map((investigation) => (
              <div 
                key={investigation.id} 
                className={`p-6 hover:bg-gray-50 transition-colors ${
                  selectedInvestigation === investigation.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <div className="flex-shrink-0">
                      {getStatusIcon(investigation.status)}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h4 className="text-base font-medium text-gray-900 truncate">
                        {investigation.name}
                      </h4>
                      {investigation.description && (
                        <p className="text-sm text-gray-600 truncate">
                          {investigation.description}
                        </p>
                      )}
                      <div className="flex items-center mt-1 space-x-4 text-xs text-gray-500">
                        <span>Created {new Date(investigation.created_at).toLocaleDateString()}</span>
                        <span>•</span>
                        <span>Updated {new Date(investigation.updated_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    {/* Progress */}
                    {investigation.status === 'running' && (
                      <div className="flex items-center space-x-2">
                        <div className="w-24 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${investigation.progress_percentage}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-600 min-w-0">
                          {Math.round(investigation.progress_percentage)}%
                        </span>
                      </div>
                    )}

                    {/* Quality Score */}
                    {investigation.quality_score !== null && investigation.quality_score !== undefined && (
                      <div className="flex items-center space-x-1">
                        <TrendingUp className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-700">
                          {Math.round(investigation.quality_score * 100)}%
                        </span>
                      </div>
                    )}

                    {/* Status Badge */}
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(investigation.status)}`}>
                      {investigation.status}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedInvestigation(investigation.id)}
                        className="text-blue-600 hover:text-blue-700 p-1"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      
                      {investigation.status === 'completed' && (
                        <button
                          className="text-green-600 hover:text-green-700 p-1"
                          title="Download Results"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Stats */}
      {investigations.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Total Investigations</p>
                <p className="text-2xl font-bold text-gray-900">{investigations.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <RefreshCw className="w-8 h-8 text-orange-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Processing</p>
                <p className="text-2xl font-bold text-gray-900">
                  {investigations.filter(i => i.status === 'running').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <Database className="w-8 h-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">
                  {investigations.filter(i => i.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center">
              <TrendingUp className="w-8 h-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Quality</p>
                <p className="text-2xl font-bold text-gray-900">
                  {investigations.filter(i => i.quality_score).length > 0 
                    ? Math.round(
                        investigations
                          .filter(i => i.quality_score)
                          .reduce((sum, i) => sum + (i.quality_score || 0), 0) /
                        investigations.filter(i => i.quality_score).length * 100
                      )
                    : 0}%
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 