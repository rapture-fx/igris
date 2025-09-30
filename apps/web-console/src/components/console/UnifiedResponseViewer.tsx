'use client'

import React, { useState } from 'react'
import { 
  CheckCircle,
  AlertCircle,
  Copy,
  Code2,
  Clock,
  Zap,
  Database,
  Activity,
  Download,
  Eye,
  EyeOff,
  RotateCcw,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

export type Industry = 'ai' | 'manufacturing' | 'ecommerce' | 'fintech'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
  industry: Industry
  tags: string[]
}

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
  rateLimitRemaining?: number
  rateLimitReset?: string
}

interface UnifiedResponseViewerProps {
  response?: ResponseData
  error?: any
  loading: boolean
  endpoint?: APIEndpoint
  onShowCodeGenerator: () => void
}

export function UnifiedResponseViewer({ 
  response, 
  error, 
  loading, 
  endpoint,
  onShowCodeGenerator
}: UnifiedResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<'response' | 'headers' | 'metadata'>('response')
  const [showRawJson, setShowRawJson] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['main']))

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections)
    if (newExpanded.has(section)) {
      newExpanded.delete(section)
    } else {
      newExpanded.add(section)
    }
    setExpandedSections(newExpanded)
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      // You could add a toast notification here
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (ms: number): string => {
    if (ms < 1000) return `${ms.toFixed(0)}ms`
    return `${(ms / 1000).toFixed(2)}s`
  }

  const getStatusColor = (status?: number) => {
    if (!status) return 'text-gray-500'
    if (status >= 200 && status < 300) return 'text-green-600 dark:text-green-400'
    if (status >= 300 && status < 400) return 'text-yellow-600 dark:text-yellow-400'
    if (status >= 400) return 'text-red-600 dark:text-red-400'
    return 'text-gray-500'
  }

  const renderJsonData = (data: any, level = 0): React.ReactNode => {
    if (data === null) return <span className="text-gray-500">null</span>
    if (typeof data === 'string') return <span className="text-green-600 dark:text-green-400">"{data}"</span>
    if (typeof data === 'number') return <span className="text-blue-600 dark:text-blue-400">{data}</span>
    if (typeof data === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{data.toString()}</span>
    
    if (Array.isArray(data)) {
      return (
        <div className="ml-4">
          <span className="text-gray-500">[</span>
          {data.map((item, index) => (
            <div key={index} className="ml-4">
              {renderJsonData(item, level + 1)}
              {index < data.length - 1 && <span className="text-gray-500">,</span>}
            </div>
          ))}
          <span className="text-gray-500">]</span>
        </div>
      )
    }
    
    if (typeof data === 'object') {
      const entries = Object.entries(data)
      return (
        <div className="ml-4">
          <span className="text-gray-500">{'{'}</span>
          {entries.map(([key, value], index) => (
            <div key={key} className="ml-4 flex">
              <span className="text-blue-700 dark:text-blue-300">"{key}"</span>
              <span className="text-gray-500 mx-2">:</span>
              <div className="flex-1">
                {renderJsonData(value, level + 1)}
                {index < entries.length - 1 && <span className="text-gray-500">,</span>}
              </div>
            </div>
          ))}
          <span className="text-gray-500">{'}'}</span>
        </div>
      )
    }
    
    return <span>{String(data)}</span>
  }

  const renderIndustrySpecificInsights = (data: any, industry: Industry) => {
    if (!data || typeof data !== 'object') return null

    switch (industry) {
      case 'ai':
        return (
          <div className="space-y-3">
            {data.model_accuracy && (
              <div className="flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300">Model Accuracy</span>
                <span className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {(data.model_accuracy * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.confidence_score && (
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Confidence</span>
                <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {(data.confidence_score * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.predictions && Array.isArray(data.predictions) && (
              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Predictions</h4>
                <div className="space-y-1">
                  {data.predictions.slice(0, 3).map((pred: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">{pred.class}</span>
                      <span className="font-medium">{(pred.probability * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )
      
      case 'manufacturing':
        return (
          <div className="space-y-3">
            {data.efficiency && (
              <div className="flex items-center justify-between p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <span className="text-sm font-medium text-orange-700 dark:text-orange-300">Efficiency</span>
                <span className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {(data.efficiency * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.maintenance_score && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Maintenance Score</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {data.maintenance_score}/10
                </span>
              </div>
            )}
            {data.equipment_status && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Status: </span>
                <span className="text-green-600 dark:text-green-400 capitalize">{data.equipment_status}</span>
              </div>
            )}
          </div>
        )
      
      case 'ecommerce':
        return (
          <div className="space-y-3">
            {data.conversion_probability && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Conversion Rate</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {(data.conversion_probability * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.recommended_products && Array.isArray(data.recommended_products) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2">
                  Recommendations ({data.recommended_products.length})
                </h4>
                <div className="text-xs text-blue-600 dark:text-blue-400">
                  {data.recommended_products.join(', ')}
                </div>
              </div>
            )}
            {data.price_optimization && (
              <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-yellow-700 dark:text-yellow-300 mb-1">Price Optimization</h4>
                <div className="text-sm text-yellow-600 dark:text-yellow-400">
                  Suggested: ${data.price_optimization.suggested_price} 
                  (+{(data.price_optimization.expected_lift * 100).toFixed(1)}% lift)
                </div>
              </div>
            )}
          </div>
        )
      
      case 'fintech':
        return (
          <div className="space-y-3">
            {data.fraud_score !== undefined && (
              <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-sm font-medium text-red-700 dark:text-red-300">Fraud Score</span>
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  {(data.fraud_score * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {data.risk_category && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Risk Category: </span>
                <span className="text-blue-600 dark:text-blue-400 capitalize">{data.risk_category}</span>
              </div>
            )}
            {data.credit_score && (
              <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Credit Score</span>
                <span className="text-lg font-bold text-green-600 dark:text-green-400">
                  {data.credit_score}
                </span>
              </div>
            )}
            {data.compliance_status && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                <span className="text-sm font-medium text-green-700 dark:text-green-300">Compliance: </span>
                <span className="text-green-600 dark:text-green-400 capitalize">{data.compliance_status}</span>
              </div>
            )}
          </div>
        )
      
      default:
        return null
    }
  }

  if (loading) {
    return (
      <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-center" style={{backgroundColor: '#f7f7f3'}}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Sending request...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 dark:bg-gray-900" style={{backgroundColor: '#f7f7f3'}}>
        <div className="h-full flex flex-col">
          {/* Error Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3 mb-4">
              <AlertCircle className="w-6 h-6 text-red-500" />
              <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">Request Failed</h3>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="font-medium text-red-800 dark:text-red-200 mb-2">{error.code}</h4>
              <p className="text-red-700 dark:text-red-300">{error.message}</p>
              {error.details && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400">Error Details</summary>
                  <pre className="mt-2 text-xs text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30 p-2 rounded overflow-auto">
                    {JSON.stringify(error.details, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 dark:bg-gray-900 flex items-center justify-center" style={{backgroundColor: '#f7f7f3'}}>
        <div className="text-center">

          <p className="text-xs text-gray-500 dark:text-gray-400 font-mono">
            Send a request to view the response.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-1/2 border-l border-gray-200 dark:border-gray-700 dark:bg-gray-900 flex flex-col" style={{backgroundColor: '#f7f7f3'}}>
      {/* Response Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <CheckCircle className="w-6 h-6 text-green-500" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Response</h3>
            <span className={`px-2 py-1 text-xs font-medium rounded ${getStatusColor(response.status)} bg-opacity-10`}>
              {response.status} {response.statusText}
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={onShowCodeGenerator}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded border border-gray-300 dark:border-gray-600"
            >
              <Code2 className="w-3 h-3" />
              <span>Generate Code</span>
            </button>
            <button
              onClick={() => copyToClipboard(JSON.stringify(response.data, null, 2))}
              className="flex items-center space-x-1 px-2 py-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded border border-gray-300 dark:border-gray-600"
            >
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </button>
          </div>
        </div>
        
        {/* Response Metrics */}
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Time:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatDuration(response.duration)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Database className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Size:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {formatBytes(response.size)}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-gray-400" />
            <span className="text-gray-600 dark:text-gray-400">Rate Limit:</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {response.rateLimitRemaining || 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-6 px-6">
          {[
            { id: 'response', label: 'Response', icon: Activity },
            { id: 'headers', label: 'Headers', icon: Database },
            { id: 'metadata', label: 'Metadata', icon: Eye }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id as any)}
              className={`flex items-center space-x-2 py-3 px-1 border-b-2 transition-colors ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'response' && (
          <div className="p-6 space-y-6">
            {/* Industry-Specific Insights */}
            {endpoint && response.data && (
              <div>
                <button
                  onClick={() => toggleSection('insights')}
                  className="flex items-center space-x-2 mb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {expandedSections.has('insights') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>{endpoint.industry.toUpperCase()} Insights</span>
                </button>
                {expandedSections.has('insights') && (
                  <div className="ml-6">
                    {renderIndustrySpecificInsights(response.data, endpoint.industry)}
                  </div>
                )}
              </div>
            )}

            {/* Raw Response Data */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <button
                  onClick={() => toggleSection('main')}
                  className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {expandedSections.has('main') ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                  <span>Response Data</span>
                </button>
                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="flex items-center space-x-1 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                >
                  {showRawJson ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  <span>{showRawJson ? 'Formatted' : 'Raw JSON'}</span>
                </button>
              </div>
              
              {expandedSections.has('main') && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 font-mono text-sm overflow-auto">
                  {showRawJson ? (
                    <pre className="text-gray-800 dark:text-gray-200">
                      {JSON.stringify(response.data, null, 2)}
                    </pre>
                  ) : (
                    <div className="text-gray-800 dark:text-gray-200">
                      {renderJsonData(response.data)}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'headers' && (
          <div className="p-6">
            <div className="space-y-2">
              {Object.entries(response.headers).map(([key, value]) => (
                <div key={key} className="flex items-start space-x-4 py-2 border-b border-gray-100 dark:border-gray-700">
                  <div className="font-medium text-gray-700 dark:text-gray-300 min-w-0 flex-1">
                    {key}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 min-w-0 flex-1 break-all">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Request URL</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400 break-all">{response.url}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Method</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{response.method}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
                  <p className={`text-sm font-medium ${getStatusColor(response.status)}`}>
                    {response.status} {response.statusText}
                  </p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Timestamp</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {new Date(response.timestamp).toLocaleString()}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Duration</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatDuration(response.duration)}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Response Size</label>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{formatBytes(response.size)}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}