'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { 
  X, 
  Search, 
  Clock, 
  Filter, 
  RefreshCw, 
  Trash2, 
  Download,
  CheckCircle,
  XCircle,
  AlertCircle,
  Play,
  Copy,
  ExternalLink
} from 'lucide-react'

interface RequestHistoryItem {
  id: string
  timestamp: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  url: string
  status?: number
  statusText?: string
  duration?: number
  size?: number
  headers: Record<string, string>
  body?: string
  response?: {
    data: any
    headers: Record<string, string>
    status: number
    statusText: string
  }
  error?: {
    message: string
    code: string
  }
}

interface RequestHistoryProps {
  isOpen: boolean
  onClose: () => void
  onReplayRequest: (item: RequestHistoryItem) => void
  requests?: RequestHistoryItem[]
}

const STATUS_COLORS = {
  success: 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400',
  error: 'text-red-600 bg-red-100 dark:bg-red-900/20 dark:text-red-400',
  pending: 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/20 dark:text-yellow-400'
}

const METHOD_COLORS = {
  'GET': 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400',
  'POST': 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400',
  'PUT': 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400',
  'DELETE': 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400',
  'PATCH': 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400',
}

export function RequestHistory({ 
  isOpen, 
  onClose, 
  onReplayRequest, 
  requests = [] 
}: RequestHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'success' | 'error' | 'pending'>('all')
  const [filterMethod, setFilterMethod] = useState<'all' | 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('all')
  const [selectedRequest, setSelectedRequest] = useState<RequestHistoryItem | null>(null)
  const [historyItems, setHistoryItems] = useState<RequestHistoryItem[]>(requests)

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen])

  useEffect(() => {
    setHistoryItems(requests)
  }, [requests])

  const loadHistory = () => {
    try {
      const saved = localStorage.getItem('api-console-request-history')
      if (saved) {
        const parsed = JSON.parse(saved)
        setHistoryItems(parsed)
      }
    } catch (error) {
      console.error('Failed to load request history:', error)
    }
  }

  const clearHistory = () => {
    if (confirm('Are you sure you want to clear all request history?')) {
      localStorage.removeItem('api-console-request-history')
      setHistoryItems([])
      setSelectedRequest(null)
    }
  }

  const exportHistory = () => {
    const dataStr = JSON.stringify(historyItems, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `api-console-history-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyRequestAsCurl = (request: RequestHistoryItem) => {
    let curl = `curl -X ${request.method}`
    
    // Add headers
    Object.entries(request.headers).forEach(([key, value]) => {
      if (key.toLowerCase() !== 'content-length') {
        curl += ` \\\n  -H "${key}: ${value}"`
      }
    })
    
    // Add body for POST/PUT/PATCH
    if (request.body && ['POST', 'PUT', 'PATCH'].includes(request.method)) {
      curl += ` \\\n  -d '${request.body}'`
    }
    
    // Add URL
    curl += ` \\\n  "${request.url}"`
    
    navigator.clipboard.writeText(curl)
  }

  const getStatusIcon = (request: RequestHistoryItem) => {
    if (request.error) {
      return <XCircle className="w-4 h-4" />
    } else if (request.status) {
      if (request.status >= 200 && request.status < 300) {
        return <CheckCircle className="w-4 h-4" />
      } else if (request.status >= 400) {
        return <XCircle className="w-4 h-4" />
      } else {
        return <AlertCircle className="w-4 h-4" />
      }
    }
    return <AlertCircle className="w-4 h-4" />
  }

  const getStatusColor = (request: RequestHistoryItem) => {
    if (request.error) return STATUS_COLORS.error
    if (request.status) {
      if (request.status >= 200 && request.status < 300) return STATUS_COLORS.success
      if (request.status >= 400) return STATUS_COLORS.error
    }
    return STATUS_COLORS.pending
  }

  const filteredRequests = useMemo(() => {
    return historyItems.filter(request => {
      // Search filter
      if (searchQuery && !request.url.toLowerCase().includes(searchQuery.toLowerCase()) && 
          !request.method.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false
      }
      
      // Status filter
      if (filterStatus !== 'all') {
        if (filterStatus === 'success' && (!request.status || request.status < 200 || request.status >= 300)) return false
        if (filterStatus === 'error' && (!request.error && (!request.status || request.status < 400))) return false
        if (filterStatus === 'pending' && (request.status || request.error)) return false
      }
      
      // Method filter
      if (filterMethod !== 'all' && request.method !== filterMethod) {
        return false
      }
      
      return true
    }).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  }, [historyItems, searchQuery, filterStatus, filterMethod])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 font-mono">
      <div className="shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden" style={{backgroundColor: '#f6f6f4'}}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl" style={{color: '#114dcd'}}>
              Request History
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredRequests.length} of {historyItems.length} requests
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportHistory}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              title="Export history"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={clearHistory}
              className="text-gray-400 hover:text-red-600 transition-colors"
              title="Clear history"
            >
              <Trash2 className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 h-[70vh]">
        {/* Main Panel */}
        <div className="flex flex-col border-r border-gray-200 dark:border-gray-700">

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex flex-col space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requests..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-2">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                  <option value="pending">Pending</option>
                </select>

                <select
                  value={filterMethod}
                  onChange={(e) => setFilterMethod(e.target.value as any)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="all">All Methods</option>
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                  <option value="PATCH">PATCH</option>
                </select>
              </div>
            </div>
          </div>

          {/* Request List */}
          <div className="flex-1 overflow-y-auto p-4" style={{ maxHeight: 'calc(70vh - 200px)' }}>
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Clock className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Request History
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {searchQuery || filterStatus !== 'all' || filterMethod !== 'all'
                    ? 'No requests match your current filters'
                    : 'Start making API requests to see your history here'
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    onClick={() => setSelectedRequest(request)}
                    className={`p-3 border cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id
                        ? 'bg-white dark:bg-white'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${METHOD_COLORS[request.method]}`}>
                          {request.method}
                        </span>
                        <code className="text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded" style={{ color: '#114dcd' }}>
                          {request.status || 'pending'}
                        </code>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(request.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white truncate mb-1">
                      {request.url}
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center space-x-3">
                        {request.duration && <span>{request.duration.toFixed(0)}ms</span>}
                        {request.size && <span>{request.size} bytes</span>}
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyRequestAsCurl(request)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy as cURL"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onReplayRequest(request)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Replay request"
                        >
                          <Play className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Details Panel */}
        {selectedRequest && (
          <div className="flex flex-col overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                Request Details
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {new Date(selectedRequest.timestamp).toLocaleString()}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Request Info */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm text-gray-700 dark:text-gray-300">Request</h4>
                  <button
                    onClick={() => copyRequestAsCurl(selectedRequest)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
                <div className="bg-white p-4 overflow-x-auto border shadow-md" style={{
                  borderColor: '#a0c0f0',
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 transparent'
                }}>
                  <style jsx>{`
                    div::-webkit-scrollbar {
                      height: 6px;
                    }
                    div::-webkit-scrollbar-track {
                      background: transparent;
                    }
                    div::-webkit-scrollbar-thumb {
                      background-color: #f6f6f4;
                      border-radius: 3px;
                    }
                    div::-webkit-scrollbar-thumb:hover {
                      background-color: #f6f6f4;
                    }
                  `}</style>
                  <pre className="text-sm text-gray-900">
                    <code dangerouslySetInnerHTML={{
                      __html: JSON.stringify({
                        method: selectedRequest.method,
                        url: selectedRequest.url,
                        headers: selectedRequest.headers,
                        ...(selectedRequest.body && { body: JSON.parse(selectedRequest.body) })
                      }, null, 2)
                        .replace(/"([^"]+)":/g, '<span style="color: #114dcd">"$1":</span>')
                        .replace(/: "([^"]+)"/g, ': <span style="color: #22c55e">"$1"</span>')
                        .replace(/: (\d+\.?\d*)/g, ': <span style="color: #f59e0b">$1</span>')
                        .replace(/: (true|false|null)/g, ': <span style="color: #ef4444">$1</span>')
                    }} />
                  </pre>
                </div>
              </div>
              
              {/* Response Info */}
              {selectedRequest.response && (
                <div>
                  <h3 className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                    Response
                  </h3>
                  <div>
                    <div className="text-sm p-4">
                      Status: {selectedRequest.response.status} {selectedRequest.response.statusText}
                    </div>
                    <div className="bg-white p-4 overflow-x-auto border shadow-md" style={{
                      borderColor: '#a0c0f0',
                      scrollbarWidth: 'thin',
                      scrollbarColor: '#cbd5e1 transparent'
                    }}>
                      <style jsx>{`
                        div::-webkit-scrollbar {
                          height: 6px;
                        }
                        div::-webkit-scrollbar-track {
                          background: transparent;
                        }
                        div::-webkit-scrollbar-thumb {
                          background-color: #f6f6f4;
                          border-radius: 3px;
                        }
                        div::-webkit-scrollbar-thumb:hover {
                          background-color: #f6f6f4;
                        }
                      `}</style>
                      <pre className="text-sm text-gray-900">
                        <code dangerouslySetInnerHTML={{
                          __html: JSON.stringify(selectedRequest.response.data, null, 2)
                            .replace(/"([^"]+)":/g, '<span style="color: #114dcd">"$1":</span>')
                            .replace(/: "([^"]+)"/g, ': <span style="color: #22c55e">"$1"</span>')
                            .replace(/: (\d+\.?\d*)/g, ': <span style="color: #f59e0b">$1</span>')
                            .replace(/: (true|false|null)/g, ': <span style="color: #ef4444">$1</span>')
                        }} />
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Error Info */}
              {selectedRequest.error && (
                <div className="flex items-center space-x-2 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded-lg">
                  <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                  <div>
                    <div className="text-sm text-red-700 dark:text-red-300 font-medium">
                      {selectedRequest.error.code}
                    </div>
                    <div className="text-xs text-red-600 dark:text-red-400">
                      {selectedRequest.error.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Replay Button */}
              <button
                onClick={() => onReplayRequest(selectedRequest)}
                className="flex items-center justify-center px-4 py-1 text-sm transition-colors border"
                style={{
                  borderColor: '#114dcd',
                  color: '#114dcd',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#114dcd';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#114dcd';
                }}
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Replay Request
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  )
}