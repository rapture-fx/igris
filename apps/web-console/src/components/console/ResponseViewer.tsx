'use client'

import React, { useState, useEffect } from 'react'
import { 
  Copy, 
  Download, 
  Search, 
  Filter,
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Clock,
  Zap,
  Eye,
  EyeOff,
  Code2,
  Terminal,
  FileJson,
  FileText,
  Image as ImageIcon,
  Table,
  BarChart3,
  RefreshCw,
  Share,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Info
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'

interface ResponseData {
  status: number
  statusText: string
  data: any
  headers: Record<string, string>
  duration: number
  size: number
  timestamp: string
  url: string
  method: string
}

interface ResponseError {
  message: string
  code?: string
  details?: any
  stack?: string
}

interface ResponseViewerProps {
  response?: ResponseData
  error?: ResponseError
  loading?: boolean
  darkMode?: boolean
  onRetry?: () => void
}

type ViewMode = 'pretty' | 'raw' | 'preview' | 'headers' | 'performance'

export function ResponseViewer({ 
  response, 
  error, 
  loading = false, 
  darkMode = false,
  onRetry 
}: ResponseViewerProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('pretty')
  const [searchQuery, setSearchQuery] = useState('')
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const [showMetadata, setShowMetadata] = useState(true)

  useEffect(() => {
    if (response) {
      // Auto-detect best view mode
      if (typeof response.data === 'object' && response.data !== null) {
        setViewMode('pretty')
      } else if (typeof response.data === 'string') {
        try {
          JSON.parse(response.data)
          setViewMode('pretty')
        } catch {
          setViewMode('raw')
        }
      }
    }
  }, [response])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadResponse = () => {
    if (!response) return
    
    const blob = new Blob([JSON.stringify(response.data, null, 2)], {
      type: 'application/json'
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `response_${new Date().getTime()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const getStatusColor = (status: number) => {
    if (status >= 200 && status < 300) return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
    if (status >= 300 && status < 400) return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
    if (status >= 400 && status < 500) return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
    if (status >= 500) return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
    return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const renderJsonTree = (obj: any, path: string = '', level: number = 0): React.ReactNode => {
    if (obj === null) {
      return <span className="text-gray-500 dark:text-gray-400">null</span>
    }
    
    if (typeof obj !== 'object') {
      const className = 
        typeof obj === 'string' ? 'text-green-600 dark:text-green-400' :
        typeof obj === 'number' ? 'text-blue-600 dark:text-blue-400' :
        typeof obj === 'boolean' ? 'text-purple-600 dark:text-purple-400' :
        'text-gray-600 dark:text-gray-400'
      
      return (
        <span className={className}>
          {typeof obj === 'string' ? `"${obj}"` : String(obj)}
        </span>
      )
    }

    const isArray = Array.isArray(obj)
    const entries = isArray ? obj.map((item, i) => [i, item]) : Object.entries(obj)
    const isCollapsed = collapsed.has(path)
    
    if (entries.length === 0) {
      return (
        <span className="text-gray-500 dark:text-gray-400">
          {isArray ? '[]' : '{}'}
        </span>
      )
    }

    return (
      <div>
        <button
          onClick={() => {
            const newCollapsed = new Set(collapsed)
            if (isCollapsed) {
              newCollapsed.delete(path)
            } else {
              newCollapsed.add(path)
            }
            setCollapsed(newCollapsed)
          }}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4 mr-1" />
          ) : (
            <ChevronDown className="w-4 h-4 mr-1" />
          )}
          <span>{isArray ? '[' : '{'}</span>
          {isCollapsed && (
            <span className="text-gray-500 dark:text-gray-400 ml-2">
              {entries.length} item{entries.length !== 1 ? 's' : ''}
            </span>
          )}
        </button>
        
        {!isCollapsed && (
          <div className="ml-6 border-l border-gray-200 dark:border-gray-700 pl-4 mt-1">
            {entries.map(([key, value], index) => (
              <div key={key} className="py-1">
                <div className="flex items-start">
                  <span className="text-purple-600 dark:text-purple-400 mr-2">
                    {isArray ? key : `"${key}"`}:
                  </span>
                  <div className="flex-1">
                    {renderJsonTree(value, `${path}.${key}`, level + 1)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        <span className="text-gray-600 dark:text-gray-400">
          {isArray ? ']' : '}'}
        </span>
      </div>
    )
  }

  const responseText = response && typeof response.data === 'string' ? response.data : response ? JSON.stringify(response.data, null, 2) : ''

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">Executing request...</p>
          </div>
        </div>
      )
    }

    if (error) {
      return (
        <div className="flex-1 p-6">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <XCircle className="w-6 h-6 text-red-600 dark:text-red-400" />
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-300">
                Request Failed
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Error Message</h4>
                <p className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded font-mono text-sm">
                  {error.message}
                </p>
              </div>
              
              {error.code && (
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Error Code</h4>
                  <code className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded block">
                    {error.code}
                  </code>
                </div>
              )}
              
              {error.details && (
                <div>
                  <h4 className="font-medium text-red-700 dark:text-red-300 mb-2">Details</h4>
                  <pre className="text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-3 rounded text-sm overflow-x-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            {onRetry && (
              <div className="mt-6">
                <button
                  onClick={onRetry}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Request</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )
    }

    if (!response) {
      return (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Terminal className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              No Response Yet
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Send a request to see the response here
            </p>
          </div>
        </div>
      )
    }

    switch (viewMode) {
      case 'pretty':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <div className="space-y-4">
              {typeof response.data === 'object' && response.data !== null ? (
                <div className="font-mono text-sm">
                  {renderJsonTree(response.data)}
                </div>
              ) : (
                <SyntaxHighlighter
                  language="json"
                  style={darkMode ? oneDark : oneLight}
                  customStyle={{
                    background: 'transparent',
                    padding: 0,
                    fontSize: '0.875rem'
                  }}
                >
                  {responseText}
                </SyntaxHighlighter>
              )}
            </div>
          </div>
        )

      case 'raw':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <pre className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all font-mono">
              {responseText}
            </pre>
          </div>
        )

      case 'headers':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <div className="space-y-3">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex">
                  <div className="w-1/3 font-medium text-gray-700 dark:text-gray-300 pr-4">
                    {key}:
                  </div>
                  <div className="flex-1 text-gray-900 dark:text-gray-100 font-mono text-sm">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )

      case 'performance':
        return (
          <div className="flex-1 p-6 overflow-auto">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    <h4 className="font-medium text-blue-800 dark:text-blue-300">Response Time</h4>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatDuration(response.duration)}
                  </div>
                </div>

                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <BarChart3 className="w-5 h-5 text-green-600 dark:text-green-400" />
                    <h4 className="font-medium text-green-800 dark:text-green-300">Response Size</h4>
                  </div>
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatBytes(response.size)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-800 dark:text-gray-200 mb-3">Request Details</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Method:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">{response.method}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">URL:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono truncate">{response.url}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Timestamp:</span>
                    <span className="text-gray-900 dark:text-gray-100 font-mono">
                      {new Date(response.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return <div>Unknown view mode</div>
    }
  }

  return (
    <div className="w-96 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Response
          </h2>
          <div className="flex items-center space-x-1">
            {response && (
              <>
                <button
                  onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded"
                  title="Copy response"
                >
                  {copied ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
                <button
                  onClick={downloadResponse}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded"
                  title="Download response"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowMetadata(!showMetadata)}
                  className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded"
                  title="Toggle metadata"
                >
                  {showMetadata ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Status and Metadata */}
        {response && showMetadata && (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <span className={`px-3 py-1 text-sm font-medium rounded ${getStatusColor(response.status)}`}>
                {response.status} {response.statusText}
              </span>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatDuration(response.duration)}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                {formatBytes(response.size)}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                <div className="text-gray-600 dark:text-gray-400">Response Time</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatDuration(response.duration)}
                </div>
              </div>
              <div className="bg-gray-50 dark:bg-gray-700 p-2 rounded">
                <div className="text-gray-600 dark:text-gray-400">Size</div>
                <div className="font-medium text-gray-900 dark:text-white">
                  {formatBytes(response.size)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode Tabs */}
        {response && (
          <div className="flex space-x-1 mt-3 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
            {[
              { key: 'pretty', icon: <Code2 className="w-3 h-3" />, label: 'Pretty' },
              { key: 'raw', icon: <FileText className="w-3 h-3" />, label: 'Raw' },
              { key: 'headers', icon: <Info className="w-3 h-3" />, label: 'Headers' },
              { key: 'performance', icon: <Zap className="w-3 h-3" />, label: 'Performance' }
            ].map(({ key, icon, label }) => (
              <button
                key={key}
                onClick={() => setViewMode(key as ViewMode)}
                className={`flex items-center space-x-1 px-2 py-1 text-xs font-medium rounded transition-colors ${
                  viewMode === key
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {icon}
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Search for large responses */}
        {response && responseText.length > 1000 && viewMode !== 'performance' && (
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search response..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
          </div>
        )}
      </div>

      {/* Content */}
      {renderContent()}

      {/* Footer */}
      {response && (
        <div className="border-t border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-700/50">
          <div className="text-xs text-gray-600 dark:text-gray-400 text-center">
            {typeof response.data === 'object' && response.data !== null
              ? `${Object.keys(response.data).length} properties`
              : `${responseText.length} characters`
            } • {new Date(response.timestamp).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  )
}