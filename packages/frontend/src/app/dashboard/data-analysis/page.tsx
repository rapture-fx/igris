'use client'

import { useState, useEffect } from 'react'
import { 
  Upload, 
  Database, 
  BarChart3, 
  AlertTriangle,
  CheckCircle2,
  FileText,
  TrendingUp,
  Hash,
  Calendar,
  Type,
  RefreshCw,
  Download,
  Eye
} from 'lucide-react'
import { FileUpload } from '@/components/upload/FileUpload'

interface DataColumn {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean' | 'email' | 'phone' | 'url'
  confidence: number
  nullCount: number
  uniqueCount: number
  sampleValues: string[]
  suggestedTransformations: string[]
}

interface DatasetAnalysis {
  id: string
  name: string
  rowCount: number
  columnCount: number
  fileSize: number
  qualityScore: number
  uploadedAt: string
  columns: DataColumn[]
  anomalies: number
  duplicates: number
  completeness: number
}

export default function DataAnalysisPage() {
  const [datasets, setDatasets] = useState<DatasetAnalysis[]>([])
  const [selectedDataset, setSelectedDataset] = useState<DatasetAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)

  useEffect(() => {
    // Load mock data
    setDatasets([
      {
        id: 'ds_001',
        name: 'Customer Database',
        rowCount: 15420,
        columnCount: 8,
        fileSize: 2400000,
        qualityScore: 94,
        uploadedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        anomalies: 12,
        duplicates: 45,
        completeness: 96,
        columns: [
          {
            name: 'customer_id',
            type: 'number',
            confidence: 99,
            nullCount: 0,
            uniqueCount: 15420,
            sampleValues: ['1001', '1002', '1003'],
            suggestedTransformations: ['Use as primary key']
          },
          {
            name: 'email',
            type: 'email',
            confidence: 97,
            nullCount: 23,
            uniqueCount: 15397,
            sampleValues: ['john@email.com', 'mary@company.org'],
            suggestedTransformations: ['Validate format', 'Extract domain']
          },
          {
            name: 'created_date',
            type: 'date',
            confidence: 95,
            nullCount: 5,
            uniqueCount: 1240,
            sampleValues: ['2024-01-15', '2024-02-03'],
            suggestedTransformations: ['Parse to datetime', 'Calculate age']
          }
        ]
      }
    ])
    setLoading(false)
  }, [])

  const handleFileUpload = async (investigationId: string) => {
    setAnalyzing(true)
    // Simulate analysis
    setTimeout(() => setAnalyzing(false), 3000)
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'number': return <Hash className="w-4 h-4" />
      case 'date': return <Calendar className="w-4 h-4" />
      case 'email': return <Type className="w-4 h-4" />
      default: return <Type className="w-4 h-4" />
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'number': return 'bg-blue-100 text-blue-800'
      case 'date': return 'bg-green-100 text-green-800'
      case 'email': return 'bg-purple-100 text-purple-800'
      case 'string': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center space-x-2">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span>Loading data analysis...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Data Analysis</h1>
            <p className="text-gray-600 mt-2">Upload datasets and get automatic data type detection, quality analysis, and transformation suggestions</p>
          </div>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload New Dataset</h2>
          <FileUpload 
            onUploadComplete={handleFileUpload}
          />
        </div>

        {/* Datasets Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Dataset List */}
          <div className="lg:col-span-1">
            <h2 className="text-xl font-semibold mb-4">Your Datasets</h2>
            <div className="space-y-4">
              {datasets.map((dataset) => (
                <div
                  key={dataset.id}
                  onClick={() => setSelectedDataset(dataset)}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedDataset?.id === dataset.id 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{dataset.name}</h3>
                      <div className="text-sm text-gray-500 mt-1">
                        {dataset.rowCount.toLocaleString()} rows • {dataset.columnCount} columns
                      </div>
                      <div className="flex items-center mt-2">
                        <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          dataset.qualityScore >= 90 ? 'bg-green-100 text-green-800' :
                          dataset.qualityScore >= 80 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {dataset.qualityScore >= 90 ? <CheckCircle2 className="w-3 h-3 mr-1" /> :
                           <AlertTriangle className="w-3 h-3 mr-1" />}
                          {dataset.qualityScore}% Quality
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              {datasets.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Database className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                  <p>No datasets uploaded yet</p>
                  <p className="text-sm">Upload your first dataset to get started</p>
                </div>
              )}
            </div>
          </div>

          {/* Dataset Analysis */}
          <div className="lg:col-span-2">
            {selectedDataset ? (
              <div>
                <h2 className="text-xl font-semibold mb-4">Analysis: {selectedDataset.name}</h2>
                
                {/* Overview Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-white p-4 rounded-lg border">
                    <BarChart3 className="w-5 h-5 text-blue-500 mb-2" />
                    <p className="text-sm text-gray-500">Rows</p>
                    <p className="text-lg font-semibold">{selectedDataset.rowCount.toLocaleString()}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <Database className="w-5 h-5 text-green-500 mb-2" />
                    <p className="text-sm text-gray-500">Columns</p>
                    <p className="text-lg font-semibold">{selectedDataset.columnCount}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <AlertTriangle className="w-5 h-5 text-orange-500 mb-2" />
                    <p className="text-sm text-gray-500">Anomalies</p>
                    <p className="text-lg font-semibold">{selectedDataset.anomalies}</p>
                  </div>
                  <div className="bg-white p-4 rounded-lg border">
                    <CheckCircle2 className="w-5 h-5 text-purple-500 mb-2" />
                    <p className="text-sm text-gray-500">Quality</p>
                    <p className="text-lg font-semibold">{selectedDataset.qualityScore}%</p>
                  </div>
                </div>

                {/* Column Analysis */}
                <div className="bg-white rounded-lg border">
                  <div className="p-4 border-b">
                    <h3 className="text-lg font-medium">Column Analysis</h3>
                    <p className="text-sm text-gray-500">Automatic data type detection and suggestions</p>
                  </div>
                  <div className="p-4 space-y-4">
                    {selectedDataset.columns.map((column, index) => (
                      <div key={index} className="border rounded-lg p-4">
                        <div className="flex items-center mb-3">
                          {getTypeIcon(column.type)}
                          <h4 className="font-medium ml-2">{column.name}</h4>
                          <span className={`ml-3 px-2 py-1 rounded-full text-xs ${getTypeColor(column.type)}`}>
                            {column.type.toUpperCase()}
                          </span>
                          <span className="ml-2 text-sm text-gray-500">
                            {column.confidence}% confidence
                          </span>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 mb-3 text-sm">
                          <div>
                            <span className="text-gray-500">Null values: </span>
                            <span className="font-medium">{column.nullCount}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Unique: </span>
                            <span className="font-medium">{column.uniqueCount}</span>
                          </div>
                        </div>
                        
                        <div className="mb-3">
                          <span className="text-sm text-gray-500">Sample: </span>
                          <span className="text-sm">{column.sampleValues.join(', ')}</span>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-500 mb-2">Suggested transformations:</p>
                          <div className="flex flex-wrap gap-2">
                            {column.suggestedTransformations.map((suggestion, idx) => (
                              <span key={idx} className="px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                                {suggestion}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg border p-8 text-center">
                <Eye className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium mb-2">Select a Dataset</h3>
                <p className="text-gray-500">Choose a dataset to view its analysis</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
} 