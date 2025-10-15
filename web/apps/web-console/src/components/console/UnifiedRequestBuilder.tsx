'use client'

import React, { useState, useEffect } from 'react'
import { 
  Send,
  Code2,
  Copy,
  Settings,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Info,
  AlertCircle,
  CheckCircle,
  Zap,
  Clock
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
  schema?: any
  examples?: any[]
}

interface UnifiedRequestBuilderProps {
  endpoint?: APIEndpoint
  selectedIndustry: Industry | 'all'
  onSendRequest: (config: any) => Promise<any>
  loading: boolean
  onShowCodeGenerator: () => void
  onOpenEndpointsModal?: () => void
}

interface HeaderItem {
  key: string
  value: string
  enabled: boolean
}

export function UnifiedRequestBuilder({
  endpoint,
  selectedIndustry,
  onSendRequest,
  loading,
  onShowCodeGenerator,
  onOpenEndpointsModal
}: UnifiedRequestBuilderProps) {
  const [url, setUrl] = useState('')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'>('GET')
  const [headers, setHeaders] = useState<HeaderItem[]>([
    { key: 'Content-Type', value: 'application/json', enabled: true },
    { key: 'Accept', value: 'application/json', enabled: true }
  ])
  const [body, setBody] = useState('')
  const [showHeaders, setShowHeaders] = useState(false)
  const [bodyFormat, setBodyFormat] = useState<'json' | 'raw' | 'form'>('json')
  const [timeout, setTimeout] = useState(30000)

  // Keyboard shortcut handler
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (onOpenEndpointsModal) {
          onOpenEndpointsModal()
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [onOpenEndpointsModal])

  // Auto-populate when endpoint changes
  useEffect(() => {
    if (endpoint) {
      setMethod(endpoint.method)
      const baseUrl = getBaseUrlForIndustry(endpoint.industry)
      setUrl(`${baseUrl}${endpoint.path}`)
      
      // Set example body based on endpoint
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        setBody(getExampleBody(endpoint))
      } else {
        setBody('')
      }
    }
  }, [endpoint])

  const getBaseUrlForIndustry = (industry: Industry): string => {
    const baseUrls = {
      ai: 'https://api.schlep-engine.com',
      manufacturing: 'https://manufacturing.schlep-engine.com',
      ecommerce: 'https://ecommerce.schlep-engine.com',
      fintech: 'https://fintech.schlep-engine.com'
    }
    return baseUrls[industry] || 'https://api.schlep-engine.com'
  }

  const getExampleBody = (endpoint: APIEndpoint): string => {
    // Industry-specific example bodies
    const examples = {
      ai: {
        'custom-training': JSON.stringify({
          model_type: 'classification',
          dataset_id: 'dataset_123',
          hyperparameters: {
            learning_rate: 0.001,
            batch_size: 32,
            epochs: 100
          },
          features: ['feature1', 'feature2', 'feature3'],
          target: 'label'
        }, null, 2),
        'model-inference': JSON.stringify({
          model_id: 'model_456',
          input_data: [
            { feature1: 0.5, feature2: 1.2, feature3: -0.8 },
            { feature1: -0.3, feature2: 0.9, feature3: 1.1 }
          ],
          return_probabilities: true
        }, null, 2)
      },
      manufacturing: {
        'predictive-maintenance': JSON.stringify({
          equipment_id: 'PUMP_001',
          sensor_data: {
            temperature: 75.5,
            vibration: 0.003,
            pressure: 145.2,
            runtime_hours: 8760
          },
          maintenance_history: [
            { date: '2024-01-15', type: 'routine', duration: 2 }
          ]
        }, null, 2),
        'quality-inspection': JSON.stringify({
          product_id: 'PROD_789',
          image_data: 'base64_encoded_image_data_here',
          inspection_parameters: {
            defect_types: ['scratch', 'dent', 'discoloration'],
            sensitivity: 0.85,
            confidence_threshold: 0.9
          }
        }, null, 2)
      },
      ecommerce: {
        'product-recommendations': JSON.stringify({
          user_id: 'user_123',
          context: {
            current_category: 'electronics',
            price_range: [100, 500],
            viewing_history: ['product_456', 'product_789']
          },
          recommendation_count: 10,
          include_metadata: true
        }, null, 2),
        'demand-forecasting': JSON.stringify({
          product_ids: ['PROD_001', 'PROD_002'],
          forecast_horizon: 30,
          historical_data: {
            sales: [150, 200, 180, 220, 190],
            dates: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-01-04', '2024-01-05']
          },
          external_factors: {
            seasonality: true,
            promotions: false
          }
        }, null, 2)
      },
      fintech: {
        'fraud-detection': JSON.stringify({
          transaction: {
            amount: 1500.00,
            currency: 'USD',
            merchant_id: 'MERCH_456',
            payment_method: 'credit_card',
            card_last_four: '1234'
          },
          user_context: {
            user_id: 'user_789',
            location: { lat: 40.7128, lng: -74.0060 },
            device_fingerprint: 'device_abc123',
            session_duration: 300
          }
        }, null, 2),
        'credit-scoring': JSON.stringify({
          applicant: {
            age: 35,
            annual_income: 75000,
            employment_years: 5,
            credit_history_length: 10
          },
          financial_data: {
            existing_debt: 15000,
            monthly_expenses: 3500,
            savings_balance: 25000,
            credit_utilization: 0.3
          }
        }, null, 2)
      }
    }

    return examples[endpoint.industry]?.[endpoint.id] || JSON.stringify({
      data: 'example_value',
      parameters: {
        setting1: true,
        setting2: 'default'
      }
    }, null, 2)
  }

  const addHeader = () => {
    setHeaders([...headers, { key: '', value: '', enabled: true }])
  }

  const removeHeader = (index: number) => {
    setHeaders(headers.filter((_, i) => i !== index))
  }

  const updateHeader = (index: number, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    const updatedHeaders = [...headers]
    updatedHeaders[index] = { ...updatedHeaders[index], [field]: value }
    setHeaders(updatedHeaders)
  }

  const handleSend = async () => {
    if (!url) return

    const enabledHeaders = headers
      .filter(h => h.enabled && h.key)
      .reduce((acc, h) => ({ ...acc, [h.key]: h.value }), {})

    const requestConfig = {
      method,
      url,
      headers: enabledHeaders,
      data: body || undefined,
      timeout
    }

    await onSendRequest(requestConfig)
  }

  const formatBody = () => {
    if (bodyFormat === 'json' && body) {
      try {
        const parsed = JSON.parse(body)
        setBody(JSON.stringify(parsed, null, 2))
      } catch (e) {
        // Invalid JSON, leave as is
      }
    }
  }

  const validateJson = (): { isValid: boolean; error?: string } => {
    if (!body || bodyFormat !== 'json') return { isValid: true }
    
    try {
      JSON.parse(body)
      return { isValid: true }
    } catch (e) {
      return { isValid: false, error: e instanceof Error ? e.message : 'Invalid JSON' }
    }
  }

  const jsonValidation = validateJson()

  if (!endpoint) {
    return (
      <div className="h-full flex items-center justify-center dark:bg-gray-900" style={{
        backgroundColor: '#f6f6f4',
        backgroundImage: `repeating-linear-gradient(
          45deg,
          transparent,
          transparent 2px,
          rgba(0,0,0,0.02) 2px,
          rgba(0,0,0,0.02) 4px
        )`,
        paddingBottom: '80px'
      }}>
        <div className="max-w-md px-8">
          <h2 className="text-sm font-normal text-gray-900 dark:text-gray-100 mb-3 text-left font-mono">
            Welcome to your console
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-2 leading-relaxed text-left font-mono">
            Start exploring by sending your first request. Use the sidebar to select an endpoint, build your query, and view the response instantly.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mb-6 text-left font-mono">
            Your API requests will appear here once you've run them.
          </p>
          <div className="flex justify-start">
            <button
              onClick={onOpenEndpointsModal}
              className="px-2 py-1 text-sm font-normal rounded-md transition-all flex items-center space-x-1"
              style={{
                backgroundColor: '#e9eef9',
                color: '#114dcd',
                boxShadow: '0 2px 8px rgba(17, 77, 205, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(17, 77, 205, 0.2), 0 2px 4px rgba(0, 0, 0, 0.12)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(17, 77, 205, 0.15), 0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
            >
              <span className="text-base font-normal" style={{ color: '#114dcd' }}>⌘</span>
              <span className="text-base font-normal" style={{ color: '#114dcd' }}>K</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col dark:bg-gray-900" style={{backgroundColor: '#f6f6f4'}}>
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  method === 'PUT' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                }`}>
                  {method}
                </span>
                <span className={`px-2 py-1 text-xs font-medium rounded ${
                  endpoint.industry === 'ai' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                  endpoint.industry === 'manufacturing' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                  endpoint.industry === 'ecommerce' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {endpoint.industry.toUpperCase()}
                </span>
                {endpoint.beta && (
                  <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                    BETA
                  </span>
                )}
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {endpoint.name}
              </h2>
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              {endpoint.description}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={onShowCodeGenerator}
              className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
            >
              <Code2 className="w-4 h-4" />
              <span className="text-sm font-medium">Code</span>
            </button>
          </div>
        </div>
      </div>

      {/* Request Configuration */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 space-y-6">
          {/* URL and Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Request URL
            </label>
            <div className="flex space-x-2">
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as any)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
              </select>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter API endpoint URL"
              />
            </div>
          </div>

          {/* Headers */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Headers
              </label>
              <button
                onClick={() => setShowHeaders(!showHeaders)}
                className="flex items-center space-x-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
              >
                {showHeaders ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showHeaders ? 'Hide' : 'Show'} Headers</span>
              </button>
            </div>
            
            {showHeaders && (
              <div className="space-y-2">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={header.enabled}
                      onChange={(e) => updateHeader(index, 'enabled', e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Header name"
                      value={header.key}
                      onChange={(e) => updateHeader(index, 'key', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="Header value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, 'value', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => removeHeader(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addHeader}
                  className="flex items-center space-x-2 px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 border border-dashed border-blue-300 dark:border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Header</span>
                </button>
              </div>
            )}
          </div>

          {/* Request Body (for POST, PUT, PATCH) */}
          {['POST', 'PUT', 'PATCH'].includes(method) && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Request Body
                </label>
                <div className="flex items-center space-x-2">
                  <select
                    value={bodyFormat}
                    onChange={(e) => setBodyFormat(e.target.value as any)}
                    className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  >
                    <option value="json">JSON</option>
                    <option value="raw">Raw</option>
                    <option value="form">Form Data</option>
                  </select>
                  {bodyFormat === 'json' && (
                    <button
                      onClick={formatBody}
                      className="px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Format
                    </button>
                  )}
                </div>
              </div>
              
              <div className="relative">
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={12}
                  className={`w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    !jsonValidation.isValid ? 'border-red-300 dark:border-red-600' : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder={`Enter ${bodyFormat.toUpperCase()} body content...`}
                />
                {!jsonValidation.isValid && (
                  <div className="mt-2 flex items-start space-x-2 text-sm text-red-600 dark:text-red-400">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{jsonValidation.error}</span>
                  </div>
                )}
                {jsonValidation.isValid && body && bodyFormat === 'json' && (
                  <div className="mt-2 flex items-center space-x-2 text-sm text-green-600 dark:text-green-400">
                    <CheckCircle className="w-4 h-4" />
                    <span>Valid JSON</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Advanced Settings */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Request Timeout (ms)
            </label>
            <input
              type="number"
              value={timeout}
              onChange={(e) => setTimeout(Number(e.target.value))}
              min={1000}
              max={300000}
              className="w-32 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Send Button */}
      <div className="p-6 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={handleSend}
          disabled={loading || !url || !jsonValidation.isValid}
          className={`w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all ${
            loading || !url || !jsonValidation.isValid
              ? 'bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
          }`}
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              <span>Sending...</span>
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              <span>Send Request</span>
            </>
          )}
        </button>
        
        {endpoint && (
          <div className="mt-3 flex items-center justify-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>Industry: {endpoint.industry}</span>
            </div>
            <div className="flex items-center space-x-1">
              <Clock className="w-3 h-3" />
              <span>Timeout: {timeout}ms</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}