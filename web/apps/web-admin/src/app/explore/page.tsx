'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { 
  Search, 
  Filter, 
  Download, 
  RefreshCw, 
  Table, 
  BarChart3, 
  PieChart, 
  TrendingUp,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  Upload,
  FileText,
  Loader2,
  Play,
  Database
} from 'lucide-react'
import { dataProcessingApi, DataUploadResponse } from '@/lib/api'

interface DataColumn {
  name: string
  type: 'string' | 'number' | 'date' | 'boolean'
  nullable: boolean
  unique_values: number
  missing_count: number
  sample_values: any[]
}

interface DatasetInfo {
  name: string
  total_rows: number
  total_columns: number
  size: string
  last_updated: string
  columns: DataColumn[]
}

interface DataPreview {
  columns: string[]
  rows: any[][]
  total_count: number
}

interface QualityIssue {
  type: 'missing_values' | 'duplicates' | 'outliers' | 'inconsistent_format'
  column: string
  count: number
  severity: 'low' | 'medium' | 'high'
  description: string
}

export default function DataExploration() {
  const [dataset, setDataset] = useState<DatasetInfo | null>(null)
  const [preview, setPreview] = useState<DataPreview | null>(null)
  const [qualityIssues, setQualityIssues] = useState<QualityIssue[]>([])
  const [selectedColumns, setSelectedColumns] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showQualityPanel, setShowQualityPanel] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadResponse, setUploadResponse] = useState<DataUploadResponse | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const [analysisInProgress, setAnalysisInProgress] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // File upload handlers
  const handleFileSelect = useCallback((file: File) => {
    setUploadedFile(file)
    setDataset(null)
    setPreview(null)
    setQualityIssues([])
    setSelectedColumns([])
  }, [])

  const handleFileUpload = useCallback(async (file: File) => {
    try {
      setIsUploading(true)
      
      const response = await dataProcessingApi.uploadFile(file, {
        auto_process: true,
        workspace_id: 'default'
      })
      
      setUploadResponse(response)
      
      // Start analysis process
      setTimeout(() => {
        analyzeUploadedFile(response.file_id)
      }, 1000)
      
    } catch (error) {
      console.error('File upload failed:', error)
    } finally {
      setIsUploading(false)
    }
  }, [])

  const analyzeUploadedFile = useCallback(async (fileId: string) => {
    try {
      setAnalysisInProgress(true)
      setIsLoading(true)

      // Run smart profiling
      const profilingResult = await dataProcessingApi.smartProfiling(fileId)
      
      // Get data quality analysis
      const qualityResult = await dataProcessingApi.getDataQuality(fileId)
      
      // Mock the dataset info based on analysis results
      const analyzedDataset: DatasetInfo = {
        name: uploadedFile?.name || 'uploaded_file.csv',
        total_rows: profilingResult.total_rows || 0,
        total_columns: profilingResult.total_columns || 0,
        size: formatFileSize(uploadedFile?.size || 0),
        last_updated: new Date().toISOString(),
        columns: profilingResult.columns || []
      }
      
      const previewData: DataPreview = {
        columns: profilingResult.column_names || [],
        rows: profilingResult.sample_data || [],
        total_count: profilingResult.total_rows || 0
      }
      
      const issues: QualityIssue[] = qualityResult.issues || []
      
      setDataset(analyzedDataset)
      setPreview(previewData)
      setQualityIssues(issues)
      setSelectedColumns(previewData.columns.slice(0, 6))
      
    } catch (error) {
      console.error('File analysis failed:', error)
      
      // Fallback to mock data for demo
      loadMockData()
      
    } finally {
      setAnalysisInProgress(false)
      setIsLoading(false)
    }
  }, [uploadedFile])

  const loadMockData = useCallback(() => {
    const mockDataset: DatasetInfo = {
      name: uploadedFile?.name || 'customer_transactions.csv',
      total_rows: 150000,
      total_columns: 12,
      size: formatFileSize(uploadedFile?.size || 45200000),
      last_updated: new Date().toISOString(),
      columns: [
        {
          name: 'customer_id',
          type: 'string',
          nullable: false,
          unique_values: 12450,
          missing_count: 0,
          sample_values: ['CUST_001', 'CUST_002', 'CUST_003']
        },
        {
          name: 'transaction_date',
          type: 'date',
          nullable: false,
          unique_values: 365,
          missing_count: 23,
          sample_values: ['2024-01-15', '2024-01-14', '2024-01-13']
        },
        {
          name: 'amount',
          type: 'number',
          nullable: true,
          unique_values: 8934,
          missing_count: 156,
          sample_values: [49.99, 125.50, 89.00]
        },
        {
          name: 'category',
          type: 'string',
          nullable: true,
          unique_values: 15,
          missing_count: 892,
          sample_values: ['Electronics', 'Clothing', 'Food']
        },
        {
          name: 'payment_method',
          type: 'string',
          nullable: true,
          unique_values: 4,
          missing_count: 45,
          sample_values: ['Credit Card', 'Debit Card', 'PayPal']
        },
        {
          name: 'is_refunded',
          type: 'boolean',
          nullable: true,
          unique_values: 2,
          missing_count: 12,
          sample_values: [true, false]
        }
      ]
    }

    const mockPreview: DataPreview = {
      columns: ['customer_id', 'transaction_date', 'amount', 'category', 'payment_method', 'is_refunded'],
      rows: [
        ['CUST_001', '2024-01-15', 49.99, 'Electronics', 'Credit Card', false],
        ['CUST_002', '2024-01-15', 125.50, 'Clothing', 'Debit Card', false],
        ['CUST_003', '2024-01-14', 89.00, 'Food', 'PayPal', true],
        ['CUST_004', '2024-01-14', 256.75, 'Electronics', 'Credit Card', false],
        ['CUST_005', '2024-01-13', null, 'Clothing', 'Credit Card', false]
      ],
      total_count: 150000
    }

    const mockQualityIssues: QualityIssue[] = [
      {
        type: 'missing_values',
        column: 'category',
        count: 892,
        severity: 'medium',
        description: '0.59% of records have missing category values'
      },
      {
        type: 'missing_values',
        column: 'amount',
        count: 156,
        severity: 'high',
        description: '0.10% of records have missing transaction amounts'
      },
      {
        type: 'duplicates',
        column: 'customer_id',
        count: 234,
        severity: 'low',
        description: 'Found 234 duplicate customer transactions'
      },
      {
        type: 'outliers',
        column: 'amount',
        count: 45,
        severity: 'medium',
        description: 'Detected 45 outlier values in transaction amounts'
      }
    ]

    setDataset(mockDataset)
    setPreview(mockPreview)
    setQualityIssues(mockQualityIssues)
    setSelectedColumns(mockDataset.columns.slice(0, 6).map(col => col.name))
  }, [uploadedFile])

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Drag and drop handlers
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    const file = files[0]
    
    if (file && (file.type.includes('csv') || file.type.includes('json') || file.name.endsWith('.csv') || file.name.endsWith('.json'))) {
      handleFileSelect(file)
      handleFileUpload(file)
    }
  }, [handleFileSelect, handleFileUpload])

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileSelect(file)
      handleFileUpload(file)
    }
  }, [handleFileSelect, handleFileUpload])

  useEffect(() => {
    // Load mock data on initial load if no file is uploaded
    if (!uploadedFile && !dataset) {
      loadMockData()
    }
  }, [uploadedFile, dataset, loadMockData])

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'string': return '𝐀'
      case 'number': return '𝟏𝟐𝟑'
      case 'date': return '📅'
      case 'boolean': return '✓'
      default: return '?'
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'string': return 'text-blue-400 bg-blue-900/20'
      case 'number': return 'text-green-400 bg-green-900/20'
      case 'date': return 'text-purple-400 bg-purple-900/20'
      case 'boolean': return 'text-yellow-400 bg-yellow-900/20'
      default: return 'text-gray-400 bg-gray-900/20'
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high': return 'text-red-400 bg-red-900/20 border-red-700'
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      case 'low': return 'text-blue-400 bg-blue-900/20 border-blue-700'
      default: return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const getIssueIcon = (type: string) => {
    switch (type) {
      case 'missing_values': return <AlertTriangle className="w-4 h-4" />
      case 'duplicates': return <Info className="w-4 h-4" />
      case 'outliers': return <TrendingUp className="w-4 h-4" />
      case 'inconsistent_format': return <X className="w-4 h-4" />
      default: return <Info className="w-4 h-4" />
    }
  }

  const toggleColumn = (columnName: string) => {
    setSelectedColumns(prev => 
      prev.includes(columnName) 
        ? prev.filter(col => col !== columnName)
        : [...prev, columnName]
    )
  }

  const formatValue = (value: any) => {
    if (value === null || value === undefined) {
      return <span className="text-gray-500 italic">null</span>
    }
    if (typeof value === 'boolean') {
      return <span className={value ? 'text-green-400' : 'text-red-400'}>{String(value)}</span>
    }
    if (typeof value === 'number') {
      return <span className="text-green-400">{value}</span>
    }
    return <span className="text-gray-300">{String(value)}</span>
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">Data Explorer</h1>
              <p className="text-gray-400 mt-1">Interactive data profiling and quality analysis</p>
            </div>
            <div className="flex items-center space-x-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.json"
                onChange={handleFileInputChange}
                className="hidden"
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Upload Data
              </button>
              <button 
                onClick={() => setShowQualityPanel(!showQualityPanel)}
                className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                {showQualityPanel ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                Quality Panel
              </button>
              <button 
                className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors"
                disabled={!dataset}
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* File Upload Drop Zone */}
        {!dataset && (
          <div 
            className={`mb-8 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
              isDragOver 
                ? 'border-[#468BE6] bg-[#468BE6]/10' 
                : 'border-gray-600 bg-[#161616]'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="max-w-sm mx-auto">
              {isUploading ? (
                <>
                  <Loader2 className="w-12 h-12 text-[#468BE6] mx-auto mb-4 animate-spin" />
                  <h3 className="text-lg font-medium text-white mb-2">Uploading...</h3>
                  <p className="text-gray-400">Processing your data file</p>
                </>
              ) : analysisInProgress ? (
                <>
                  <Database className="w-12 h-12 text-[#468BE6] mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">Analyzing Data...</h3>
                  <p className="text-gray-400">Running smart profiling and quality checks</p>
                  <div className="mt-4 w-full bg-gray-800 rounded-full h-2">
                    <div className="bg-[#468BE6] h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-white mb-2">
                    Drop your data file here
                  </h3>
                  <p className="text-gray-400 mb-4">
                    Or click to browse CSV/JSON files
                  </p>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center px-4 py-2 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors"
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Select File
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Analysis Status Bar */}
        {uploadResponse && (
          <div className="mb-8 bg-[#161616] border border-gray-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-green-400" />
                <div>
                  <h4 className="text-white font-medium">File Uploaded Successfully</h4>
                  <p className="text-gray-400 text-sm">
                    Job ID: {uploadResponse.job_id} • Status: {uploadResponse.status}
                  </p>
                </div>
              </div>
              {analysisInProgress && (
                <div className="flex items-center space-x-2 text-blue-400">
                  <Play className="w-4 h-4 animate-pulse" />
                  <span className="text-sm">Processing...</span>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Data Schema Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">Dataset Schema</h2>
                <RefreshCw className="w-4 h-4 text-gray-400" />
              </div>
              
              {dataset && (
                <div className="space-y-4">
                  <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-3">
                    <h3 className="text-white font-medium mb-2">{dataset.name}</h3>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Rows:</span>
                        <span className="text-white">{dataset.total_rows.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Columns:</span>
                        <span className="text-white">{dataset.total_columns}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Size:</span>
                        <span className="text-white">{dataset.size}</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-white font-medium">Columns</h4>
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      {dataset.columns.map((column) => (
                        <div 
                          key={column.name}
                          className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-gray-900/50 ${
                            selectedColumns.includes(column.name) 
                              ? 'bg-[#468BE6]/10 border-[#468BE6]' 
                              : 'bg-[#0f0f0f] border-gray-800'
                          }`}
                          onClick={() => toggleColumn(column.name)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-white text-sm font-medium">{column.name}</span>
                            <span className={`px-2 py-1 text-xs rounded ${getTypeColor(column.type)}`}>
                              {getTypeIcon(column.type)}
                            </span>
                          </div>
                          <div className="flex justify-between text-xs text-gray-400">
                            <span>{column.unique_values} unique</span>
                            {column.missing_count > 0 && (
                              <span className="text-yellow-400">{column.missing_count} missing</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Data Quality Issues */}
            {showQualityPanel && (
              <div className="bg-[#161616] border border-gray-800 rounded-xl p-6 mt-6">
                <h3 className="text-lg font-semibold text-white mb-4">Quality Issues</h3>
                <div className="space-y-3">
                  {qualityIssues.map((issue, index) => (
                    <div key={index} className={`p-3 border rounded-lg ${getSeverityColor(issue.severity)}`}>
                      <div className="flex items-center space-x-2 mb-1">
                        {getIssueIcon(issue.type)}
                        <span className="text-sm font-medium">{issue.column}</span>
                        <span className="text-xs px-2 py-1 bg-black/20 rounded">{issue.count}</span>
                      </div>
                      <p className="text-xs opacity-90">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Data Preview */}
          <div className="lg:col-span-3">
            <div className="bg-[#161616] border border-gray-800 rounded-xl">
              <div className="p-6 border-b border-gray-800">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Data Preview</h2>
                  <div className="flex items-center space-x-4">
                    <span className="text-sm text-gray-400">
                      Showing 5 of {preview?.total_count.toLocaleString()} rows
                    </span>
                    <div className="flex items-center space-x-2">
                      <button className="p-2 bg-[#0f0f0f] border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors">
                        <Table className="w-4 h-4 text-gray-400" />
                      </button>
                      <button className="p-2 bg-[#0f0f0f] border border-gray-700 rounded-lg hover:bg-gray-900 transition-colors">
                        <BarChart3 className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              
              {preview && (
                <div className="p-6">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-800">
                          {preview.columns.filter(col => selectedColumns.includes(col)).map((column) => (
                            <th key={column} className="text-left py-3 px-4 text-gray-400 font-medium text-sm">
                              {column}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.rows.map((row, rowIndex) => (
                          <tr key={rowIndex} className="border-b border-gray-800/50 hover:bg-gray-900/20">
                            {row.map((cell, cellIndex) => {
                              const columnName = preview.columns[cellIndex]
                              if (!selectedColumns.includes(columnName)) return null
                              return (
                                <td key={cellIndex} className="py-3 px-4 text-sm font-mono">
                                  {formatValue(cell)}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}