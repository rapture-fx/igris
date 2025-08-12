'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, 
  Database, 
  FileText, 
  CheckCircle, 
  AlertTriangle, 
  Clock, 
  Trash2,
  Download,
  Eye,
  Filter,
  Search,
  RefreshCw,
  BarChart3
} from 'lucide-react'

interface Dataset {
  id: string
  name: string
  size: string
  rows: number
  columns: number
  status: 'processing' | 'ready' | 'error' | 'validating'
  uploadedAt: string
  format: string
  qualityScore: number
}

export default function DataProcessingSection() {
  const [datasets, setDatasets] = useState<Dataset[]>([])
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    // Mock data
    setDatasets([
      {
        id: '1',
        name: 'customer_transactions.csv',
        size: '2.3 GB',
        rows: 150000,
        columns: 12,
        status: 'ready',
        uploadedAt: '2 hours ago',
        format: 'CSV',
        qualityScore: 94.5
      },
      {
        id: '2',
        name: 'product_catalog.json',
        size: '45.2 MB',
        rows: 8500,
        columns: 18,
        status: 'processing',
        uploadedAt: '30 minutes ago',
        format: 'JSON',
        qualityScore: 0
      },
      {
        id: '3',
        name: 'user_behavior_logs.parquet',
        size: '1.8 GB',
        rows: 2300000,
        columns: 8,
        status: 'ready',
        uploadedAt: '1 day ago',
        format: 'Parquet',
        qualityScore: 87.2
      },
      {
        id: '4',
        name: 'inventory_data.xlsx',
        size: '125 MB',
        rows: 45000,
        columns: 15,
        status: 'error',
        uploadedAt: '3 hours ago',
        format: 'Excel',
        qualityScore: 0
      }
    ])
  }, [])

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ready':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'processing':
        return <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
      case 'error':
        return <AlertTriangle className="w-4 h-4 text-red-500" />
      case 'validating':
        return <RefreshCw className="w-4 h-4 text-yellow-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'text-green-400 bg-green-900/20 border-green-700'
      case 'processing':
        return 'text-blue-400 bg-blue-900/20 border-blue-700'
      case 'error':
        return 'text-red-400 bg-red-900/20 border-red-700'
      case 'validating':
        return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      default:
        return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    setUploadProgress(0)

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setIsUploading(false)
          // Add new dataset to list
          const newDataset: Dataset = {
            id: Date.now().toString(),
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            rows: Math.floor(Math.random() * 100000) + 10000,
            columns: Math.floor(Math.random() * 20) + 5,
            status: 'processing',
            uploadedAt: 'Just now',
            format: file.name.split('.').pop()?.toUpperCase() || 'Unknown',
            qualityScore: 0
          }
          setDatasets(prev => [newDataset, ...prev])
          return 100
        }
        return prev + Math.random() * 15
      })
    }, 200)
  }

  const filteredDatasets = datasets.filter(dataset =>
    dataset.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Data Processing</h1>
          <p className="text-gray-400 mt-1">Upload, validate, and manage your datasets</p>
        </div>
        <div className="flex items-center space-x-4">
          <label className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors cursor-pointer">
            <Upload className="w-4 h-4 mr-2" />
            Upload Dataset
            <input
              type="file"
              className="hidden"
              accept=".csv,.json,.parquet,.xlsx,.xls"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>

      {/* Upload Progress */}
      {isUploading && (
        <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Uploading Dataset</h3>
            <span className="text-sm text-gray-400">{Math.round(uploadProgress)}%</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2">
            <div
              className="bg-[#468BE6] h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
        <div className="flex items-center space-x-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search datasets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#468BE6]"
            />
          </div>
          <button className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </button>
        </div>
      </div>

      {/* Datasets Grid */}
      <div className="space-y-6">
        {filteredDatasets.map((dataset) => (
          <div key={dataset.id} className="bg-[#161616] border border-gray-800 rounded-xl p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="p-3 bg-[#0f0f0f] border border-gray-800 rounded-lg">
                  <Database className="w-6 h-6 text-[#468BE6]" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-white">{dataset.name}</h3>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(dataset.status)}`}>
                      {dataset.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-400">Size:</span>
                      <span className="text-white ml-2">{dataset.size}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Rows:</span>
                      <span className="text-white ml-2">{dataset.rows.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Columns:</span>
                      <span className="text-white ml-2">{dataset.columns}</span>
                    </div>
                    <div>
                      <span className="text-gray-400">Format:</span>
                      <span className="text-white ml-2">{dataset.format}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mt-3">
                    <span className="text-xs text-gray-400">Uploaded {dataset.uploadedAt}</span>
                    {dataset.qualityScore > 0 && (
                      <span className="text-xs text-green-400">
                        Quality Score: {dataset.qualityScore}%
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                {getStatusIcon(dataset.status)}
                <div className="flex items-center space-x-2 ml-4">
                  {dataset.status === 'ready' && (
                    <>
                      <button className="p-2 bg-[#0f0f0f] border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors">
                        <Eye className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 bg-[#0f0f0f] border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors">
                        <Download className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 bg-[#0f0f0f] border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                      </button>
                    </>
                  )}
                  <button className="p-2 bg-[#0f0f0f] border border-red-700 rounded-lg hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredDatasets.length === 0 && (
        <div className="text-center py-12">
          <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No datasets found</h3>
          <p className="text-gray-400">Upload your first dataset to get started</p>
        </div>
      )}
    </div>
  )
}