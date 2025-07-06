'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { FileUpload } from '@/components/upload/FileUpload'
import { DataProcessingOverview } from '@/components/dashboard/data-processing-overview'
import { DataQualityCharts } from '@/components/dashboard/data-quality-charts'
import { 
  Plus, 
  Search, 
  Filter, 
  Database, 
  FileText, 
  Upload, 
  Download, 
  RefreshCw, 
  TrendingUp, 
  CheckCircle2, 
  AlertTriangle,
  Eye,
  Settings,
  MoreVertical,
  Calendar,
  BarChart3,
  Activity,
  Shield,
  Zap,
  Clock,
  Users,
  ArrowUpRight,
  ChevronRight,
  Grid3X3,
  List,
  Folder,
  FileSpreadsheet,
  FileJson,
  Table
} from 'lucide-react'
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
  file_type?: string
  file_size?: number
  records_count?: number
}

interface DataSource {
  id: string
  name: string
  type: 'csv' | 'json' | 'excel' | 'database' | 'api'
  status: 'active' | 'inactive' | 'error'
  records: number
  last_updated: string
  quality_score: number
  size: string
}

export default function DataSourcesPage() {
  const searchParams = useSearchParams()
  const [investigations, setInvestigations] = useState<Investigation[]>([])
  const [dataSources, setDataSources] = useState<DataSource[]>([])
  const [loading, setLoading] = useState(true)
  const [showUpload, setShowUpload] = useState(false)
  const [selectedInvestigation, setSelectedInvestigation] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [sortBy, setSortBy] = useState('recent')

  // Mock data for demonstration
  const mockDataSources: DataSource[] = [
    {
      id: '1',
      name: 'Customer Database',
      type: 'database',
      status: 'active',
      records: 125000,
      last_updated: '2024-01-15T10:30:00Z',
      quality_score: 94,
      size: '2.3 GB'
    },
    {
      id: '2',
      name: 'Sales Data Q4',
      type: 'csv',
      status: 'active',
      records: 45000,
      last_updated: '2024-01-14T15:45:00Z',
      quality_score: 87,
      size: '12.5 MB'
    },
    {
      id: '3',
      name: 'Product Catalog',
      type: 'json',
      status: 'active',
      records: 8500,
      last_updated: '2024-01-13T09:20:00Z',
      quality_score: 92,
      size: '3.2 MB'
    },
    {
      id: '4',
      name: 'Marketing Analytics',
      type: 'excel',
      status: 'inactive',
      records: 22000,
      last_updated: '2024-01-10T14:15:00Z',
      quality_score: 78,
      size: '8.7 MB'
    }
  ]

  useEffect(() => {
    // Simulate API call
    const fetchData = async () => {
      setLoading(true)
      try {
        // Mock API delay
        await new Promise(resolve => setTimeout(resolve, 1000))
        setDataSources(mockDataSources)
        setInvestigations([])
    } catch (error) {
        console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

    fetchData()
  }, [])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'csv': return <FileSpreadsheet className="w-5 h-5 text-green-600" />
      case 'json': return <FileJson className="w-5 h-5 text-blue-600" />
      case 'excel': return <Table className="w-5 h-5 text-orange-600" />
      case 'database': return <Database className="w-5 h-5 text-purple-600" />
      case 'api': return <Zap className="w-5 h-5 text-yellow-600" />
      default: return <FileText className="w-5 h-5 text-gray-600" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'inactive': return 'bg-gray-100 text-gray-800'
      case 'error': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getQualityColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 80) return 'text-blue-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
    return num.toLocaleString()
  }

  const filteredDataSources = dataSources.filter(source => {
    const matchesSearch = source.name.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesType = filterType === 'all' || source.type === filterType
    return matchesSearch && matchesType
  })

  const sortedDataSources = [...filteredDataSources].sort((a, b) => {
    switch (sortBy) {
      case 'name': return a.name.localeCompare(b.name)
      case 'quality': return b.quality_score - a.quality_score
      case 'size': return b.records - a.records
      case 'recent':
      default: return new Date(b.last_updated).getTime() - new Date(a.last_updated).getTime()
    }
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="flex items-center space-x-3">
          <RefreshCw className="w-5 h-5 animate-spin text-blue-600" />
          <span className="text-gray-600">Loading data sources...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Data Sources</h1>
          <p className="text-gray-600 mt-1">Manage and monitor your data connections</p>
        </div>
        <div className="flex items-center space-x-3">
                <button 
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Data Source
          </button>
          <button className="inline-flex items-center px-4 py-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium rounded-lg transition-colors">
            <Download className="w-4 h-4 mr-2" />
            Export
                </button>
              </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Sources</p>
              <p className="text-3xl font-bold text-gray-900">{dataSources.length}</p>
              <p className="text-xs text-gray-500 mt-1">4 types connected</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Records</p>
              <p className="text-3xl font-bold text-gray-900">{formatNumber(dataSources.reduce((sum, source) => sum + source.records, 0))}</p>
              <p className="text-xs text-emerald-600 mt-1 flex items-center">
                <TrendingUp className="w-3 h-3 mr-1" />
                +12% this month
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Quality Score</p>
              <p className="text-3xl font-bold text-gray-900">
                {Math.round(dataSources.reduce((sum, source) => sum + source.quality_score, 0) / dataSources.length)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">across all sources</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Shield className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Sources</p>
              <p className="text-3xl font-bold text-gray-900">
                {dataSources.filter(source => source.status === 'active').length}
              </p>
              <p className="text-xs text-gray-500 mt-1">currently processing</p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Activity className="w-6 h-6 text-orange-600" />
            </div>
          </div>
            </div>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-2xl p-6 border border-gray-100">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search data sources..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Types</option>
            <option value="csv">CSV Files</option>
            <option value="json">JSON Files</option>
            <option value="excel">Excel Files</option>
            <option value="database">Database</option>
              <option value="api">API</option>
            </select>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="recent">Most Recent</option>
              <option value="name">Name</option>
              <option value="quality">Quality Score</option>
              <option value="size">Record Count</option>
          </select>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-blue-100 text-blue-600' : 'text-gray-600 hover:bg-gray-100'}`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Data Sources Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedDataSources.map((source) => (
            <div key={source.id} className="bg-white rounded-2xl p-6 border border-gray-100 hover:shadow-lg transition-all duration-200 group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center group-hover:bg-gray-100 transition-colors">
                    {getTypeIcon(source.type)}
                  </div>
      <div>
                    <h3 className="font-semibold text-gray-900">{source.name}</h3>
                    <p className="text-sm text-gray-600 capitalize">{source.type}</p>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-100 rounded">
                  <MoreVertical className="w-4 h-4 text-gray-600" />
                </button>
      </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Status</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                    {source.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Records</span>
                  <span className="text-sm font-medium text-gray-900">{formatNumber(source.records)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Quality</span>
                  <span className={`text-sm font-medium ${getQualityColor(source.quality_score)}`}>
                    {source.quality_score}%
                  </span>
                </div>
          <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Size</span>
                  <span className="text-sm font-medium text-gray-900">{source.size}</span>
            </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Updated</span>
                  <span className="text-sm text-gray-600">{formatDate(source.last_updated)}</span>
          </div>
        </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between">
                  <button className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium">
                    <Eye className="w-4 h-4 mr-1" />
                    View Details
                  </button>
                  <button className="inline-flex items-center text-sm text-gray-600 hover:text-gray-700">
                    <Settings className="w-4 h-4 mr-1" />
                    Configure
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900">Data Sources</h3>
          </div>
          <div className="divide-y divide-gray-100">
            {sortedDataSources.map((source) => (
              <div key={source.id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center">
                      {getTypeIcon(source.type)}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900">{source.name}</h4>
                      <p className="text-sm text-gray-600 capitalize">{source.type} • {formatNumber(source.records)} records</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-6">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{source.quality_score}%</p>
                      <p className="text-xs text-gray-600">Quality</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{source.size}</p>
                      <p className="text-xs text-gray-600">Size</p>
                        </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(source.status)}`}>
                        {source.status}
                        </span>
                      </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">{formatDate(source.last_updated)}</p>
                      </div>
                    <div className="flex items-center space-x-2">
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Eye className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <Settings className="w-4 h-4 text-gray-600" />
                      </button>
                      <button className="p-1 hover:bg-gray-100 rounded">
                        <MoreVertical className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            </div>
          </div>
        )}

      {/* Empty State */}
      {sortedDataSources.length === 0 && (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Database className="w-8 h-8 text-gray-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No data sources found</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm || filterType !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by adding your first data source.'
            }
          </p>
          {!searchTerm && filterType === 'all' && (
            <button
              onClick={() => setShowUpload(true)}
              className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium rounded-lg transition-all transform hover:scale-105"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Data Source
            </button>
          )}
        </div>
      )}

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

      {/* File Upload Modal */}
      {showUpload && (
        <FileUpload 
          onClose={() => setShowUpload(false)}
          onUploadComplete={() => {
            setShowUpload(false)
            // Refresh data sources
          }}
        />
      )}
    </div>
  )
} 