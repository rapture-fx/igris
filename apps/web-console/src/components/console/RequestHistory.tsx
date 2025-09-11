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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex">
        {/* Main Panel */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                  <Clock className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Request History
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {filteredRequests.length} of {historyItems.length} requests
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={exportHistory}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Export history"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={clearHistory}
                  className="p-2 text-gray-400 hover:text-red-600 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Clear history"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
            <div className="flex items-center space-x-4">
              <div className="flex-1 relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search requests..."
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                />
              </div>
              
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="all">All Status</option>
                <option value="success">Success</option>
                <option value="error">Error</option>
                <option value="pending">Pending</option>
              </select>
              
              <select
                value={filterMethod}
                onChange={(e) => setFilterMethod(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
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

          {/* Request List */}
          <div className="flex-1 overflow-y-auto">
            {filteredRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Request History
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {searchQuery || filterStatus !== 'all' || filterMethod !== 'all' 
                    ? 'No requests match your current filters'
                    : 'Start making API requests to see your history here'
                  }
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredRequests.map((request) => (
                  <div
                    key={request.id}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors ${
                      selectedRequest?.id === request.id ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                    }`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`p-1 rounded-lg ${getStatusColor(request)}`}>
                          {getStatusIcon(request)}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className={`px-2 py-0.5 text-xs font-medium rounded ${METHOD_COLORS[request.method]}`}>
                              {request.method}
                            </span>
                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-md">
                              {request.url}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-xs text-gray-600 dark:text-gray-400 mt-1">
                            <span>{new Date(request.timestamp).toLocaleTimeString()}</span>
                            {request.status && <span>Status: {request.status}</span>}
                            {request.duration && <span>Duration: {request.duration.toFixed(0)}ms</span>}
                            {request.size && <span>Size: {request.size} bytes</span>}
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            copyRequestAsCurl(request)
                          }}
                          className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy as cURL"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onReplayRequest(request)
                          }}
                          className="p-1 text-gray-400 hover:text-purple-600 transition-colors"
                          title="Replay request"
                        >
                          <Play className="w-4 h-4" />
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
          <div className="w-96 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col">
            <div className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Request Details
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {new Date(selectedRequest.timestamp).toLocaleString()}
              </p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Request Info */}
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Request</h4>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                  <div className="flex items-center space-x-2 mb-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${METHOD_COLORS[selectedRequest.method]}`}>
                      {selectedRequest.method}
                    </span>
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-400">
                      {selectedRequest.url}
                    </span>
                  </div>
                  
                  {/* Headers */}
                  {Object.keys(selectedRequest.headers).length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Headers:</span>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 mt-1 overflow-x-auto">
                        {JSON.stringify(selectedRequest.headers, null, 2)}
                      </pre>
                    </div>
                  )}
                  
                  {/* Body */}
                  {selectedRequest.body && (
                    <div className="mt-2">
                      <span className="text-xs font-medium text-gray-700 dark:text-gray-300">Body:</span>
                      <pre className="text-xs text-gray-600 dark:text-gray-400 mt-1 overflow-x-auto">
                        {selectedRequest.body}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Response Info */}
              {selectedRequest.response && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Response</h4>
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-3 text-sm">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`p-1 rounded ${getStatusColor(selectedRequest)}`}>
                        {getStatusIcon(selectedRequest)}
                      </div>
                      <span className="font-mono text-xs">
                        {selectedRequest.response.status} {selectedRequest.response.statusText}
                      </span>
                    </div>
                    
                    <pre className="text-xs text-gray-600 dark:text-gray-400 overflow-x-auto max-h-64">
                      {JSON.stringify(selectedRequest.response.data, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {/* Error Info */}
              {selectedRequest.error && (
                <div>
                  <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Error</h4>
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-3 text-sm">
                    <div className="text-red-700 dark:text-red-300 font-medium">
                      {selectedRequest.error.code}
                    </div>
                    <div className="text-red-600 dark:text-red-400 mt-1">
                      {selectedRequest.error.message}
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Actions */}
            <div className="px-4 py-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex space-x-2">
                <button
                  onClick={() => onReplayRequest(selectedRequest)}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Replay</span>
                </button>
                <button
                  onClick={() => copyRequestAsCurl(selectedRequest)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Copy as cURL"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}