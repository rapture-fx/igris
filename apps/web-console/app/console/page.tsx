'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  Cpu,
  Factory,
  ShoppingCart,
  Building2,
  CheckCircle,
  Globe,
  Bookmark,
  Import,
  Lock,
  Clock,
  Settings,
  Sparkles,
  BarChart3,
  Brain,
  Search,
  Copy,
  Code2,
  Zap
} from 'lucide-react'

// Enhanced components
import { UnifiedAPISidebar } from '../../src/components/console/UnifiedAPISidebar'
import { UnifiedRequestBuilder } from '../../src/components/console/UnifiedRequestBuilder'
import { UnifiedResponseViewer } from '../../src/components/console/UnifiedResponseViewer'
import { CodeSnippetGenerator } from '../../src/components/console/CodeSnippetGenerator'
import { JWTAuthManager } from '../../src/components/console/JWTAuthManager'
import { RateLimitDisplay } from '../../src/components/console/RateLimitDisplay'
import { SimpleConsoleSettings } from '../../src/components/console/SimpleConsoleSettings'
import { EnvironmentManager } from '../../src/components/console/EnvironmentManager'
import { RequestHistory } from '../../src/components/console/RequestHistory'
import { AuthenticationManager } from '../../src/components/console/AuthenticationManager'
import { APIEndpointsModal } from '../../src/components/console/APIEndpointsModal'
import WebhookTester from '../../src/components/console/WebhookTester'
import { apiCategories } from '../../src/data/apiCategories'
import { apiClient } from '../../src/lib/api/client'

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

const industryConfig = {
  ai: {
    title: 'AI Companies',
    description: 'Data processing services for AI/ML training data preparation and model support',
    icon: <Cpu className="w-5 h-5" />,
    color: '#8b5cf6', // purple
    bgColor: '#f3f4f6'
  },
  manufacturing: {
    title: 'Manufacturing',
    description: 'Data processing for IoT sensor data, production metrics, and operational intelligence',
    icon: <Factory className="w-5 h-5" />,
    color: '#f97316', // orange
    bgColor: '#f9fafb'
  },
  ecommerce: {
    title: 'E-commerce',
    description: 'Data processing for customer analytics, transaction data, and business intelligence',
    icon: <ShoppingCart className="w-5 h-5" />,
    color: '#10b981', // green
    bgColor: '#f0fdf4'
  },
  fintech: {
    title: 'FinTech',
    description: 'Data processing for financial analytics, compliance reporting, and risk assessment',
    icon: <Building2 className="w-5 h-5" />,
    color: '#3b82f6', // blue
    bgColor: '#eff6ff'
  }
}

interface ConsoleHeaderProps {
  selectedIndustry: Industry | 'all'
  onIndustryChange: (industry: Industry | 'all') => void
  onOpenEnvironments: () => void
  onOpenAuth: () => void
  currentEnvironment: string
}

function UnifiedConsoleHeader(props: ConsoleHeaderProps) {
  const {
    selectedIndustry,
    onIndustryChange,
    onOpenEnvironments,
    onOpenAuth,
    currentEnvironment
  } = props

  return (
    <div
      className="border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
      style={{ backgroundColor: '#f2f1ed' }}
    >
      <div className="py-1 pr-6" style={{paddingLeft: '10px'}}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img src="/Docs Schlep-engne.svg" alt="Schlep Engine Logo" className="w-8 h-8" />
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => window.location.href = '/'}
                className="flex items-center space-x-1 px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Back to Home"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="text-xs font-medium">Home</span>
              </button>
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-1 px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Authentication Manager"
              >
                <Lock className="w-3 h-3" />
                <span className="text-xs font-medium">Auth</span>
              </button>
              <button
                onClick={onOpenEnvironments}
                className="flex items-center space-x-1 px-2 py-1 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Environment Manager"
              >
                <Globe className="w-3 h-3" />
                <span className="text-xs font-medium">{currentEnvironment}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function UnifiedConsolePage() {
  const [selectedIndustry, setSelectedIndustry] = useState<Industry | 'all'>('all')
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | undefined>()
  const [response, setResponse] = useState<ResponseData | undefined>()
  const [error, setError] = useState<any>()
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true)
  
  // Modal states
  const [showEnvironmentManager, setShowEnvironmentManager] = useState(false)
  const [showAuthManager, setShowAuthManager] = useState(false)
  const [showRequestHistory, setShowRequestHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showCodeGenerator, setShowCodeGenerator] = useState(false)
  const [showEndpointsModal, setShowEndpointsModal] = useState(false)
  const [showWebhookTester, setShowWebhookTester] = useState(false)
  
  // Console state
  const [currentEnvironment, setCurrentEnvironment] = useState('Development')
  const [authConfigs, setAuthConfigs] = useState<any[]>([])
  const [requestHistory, setRequestHistory] = useState<any[]>([])
  const [currentRequestConfig, setCurrentRequestConfig] = useState<any>(null)
  const [jwtToken, setJwtToken] = useState<string>('')

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('')

  const handleIndustryChange = (industry: Industry | 'all') => {
    setSelectedIndustry(industry)
    setSelectedEndpoint(undefined) // Clear selected endpoint when switching industries
  }

  const handleSendRequest = async (requestConfig: any): Promise<any> => {
    setLoading(true)
    setError(undefined)
    setResponse(undefined)

    const startTime = performance.now()
    
    try {
      let { method, url, headers, data, timeout } = requestConfig
      
      // Apply JWT authentication if available
      if (jwtToken) {
        headers = { ...headers, 'Authorization': `Bearer ${jwtToken}` }
      }
      
      // Apply other auth configs
      const activeAuth = authConfigs.find(auth => auth.active)
      if (activeAuth) {
        headers = { ...headers }
        
        switch (activeAuth.type) {
          case 'api-key':
            if (activeAuth.config.headerName && activeAuth.config.value) {
              headers[activeAuth.config.headerName] = activeAuth.config.value
            }
            break
          case 'bearer-token':
            if (activeAuth.config.token) {
              headers['Authorization'] = `Bearer ${activeAuth.config.token}`
            }
            break
          case 'basic-auth':
            if (activeAuth.config.username && activeAuth.config.password) {
              const credentials = btoa(`${activeAuth.config.username}:${activeAuth.config.password}`)
              headers['Authorization'] = `Basic ${credentials}`
            }
            break
        }
      }
      
      setCurrentRequestConfig({ method, url, headers, body: data })

      // Route to appropriate API method based on endpoint
      let result = await simulateAPICall(selectedEndpoint, data ? JSON.parse(data) : {})

      const endTime = performance.now()
      const duration = endTime - startTime

      // Simulate rate limiting info
      const rateLimitRemaining = Math.floor(Math.random() * 100) + 50
      const rateLimitReset = new Date(Date.now() + 3600000).toISOString()

      const responseData: ResponseData = {
        status: result?.status || 200,
        statusText: result?.status === 200 ? 'OK' : 'Error',
        data: result?.data || result,
        headers: {
          'content-type': 'application/json',
          'x-response-time': `${duration.toFixed(2)}ms`,
          'x-request-id': `req_${Date.now()}`,
          'x-rate-limit-remaining': rateLimitRemaining.toString(),
          'x-rate-limit-reset': Math.floor(Date.now() / 1000 + 3600).toString(),
          'access-control-allow-origin': '*',
          'server': 'Schlep-Engine API v2.1.0',
          'cache-control': 'no-cache',
          'connection': 'keep-alive'
        },
        duration: duration,
        size: JSON.stringify(result?.data || result).length,
        timestamp: new Date().toISOString(),
        url: url,
        method: method,
        rateLimitRemaining,
        rateLimitReset
      }

      if (result?.success) {
        setResponse(responseData)
      } else {
        setError({
          message: result?.error || 'Request failed',
          code: `HTTP_${result?.status || 500}`,
          details: result?.data || {}
        })
      }

      // Save to request history
      const historyItem = {
        id: `req_${Date.now()}`,
        timestamp: new Date().toISOString(),
        method,
        url,
        status: responseData.status,
        statusText: responseData.statusText,
        duration: responseData.duration,
        size: responseData.size,
        headers: headers,
        body: data,
        industry: selectedEndpoint?.industry,
        endpoint: selectedEndpoint?.name
      }
      
      const updatedHistory = [historyItem, ...requestHistory].slice(0, 100)
      setRequestHistory(updatedHistory)
      localStorage.setItem('unified-console-history', JSON.stringify(updatedHistory))

      return result

    } catch (err) {
      const endTime = performance.now()
      const duration = endTime - startTime

      const errorDetails = {
        message: err instanceof Error ? err.message : 'Network error occurred',
        code: 'NETWORK_ERROR',
        details: {
          url: requestConfig.url,
          method: requestConfig.method,
          duration: duration
        }
      }
      setError(errorDetails)
    } finally {
      setLoading(false)
    }
  }

  const simulateAPICall = async (endpoint?: APIEndpoint, data?: any) => {
    if (!endpoint) return { success: false, error: 'No endpoint selected' }
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, Math.random() * 500 + 200))
    
    // Mock response based on actual API endpoints
    if (endpoint.path.includes('/data/upload')) {
      return {
        success: true,
        data: {
          investigation_id: `inv_${Date.now()}`,
          filename: data?.filename || 'sample_data.csv',
          file_size: Math.floor(Math.random() * 1000000) + 50000,
          status: 'uploaded',
          message: 'File uploaded successfully. Processing started in background.'
        },
        status: 200
      }
    }
    
    if (endpoint.path.includes('/investigations')) {
      if (endpoint.method === 'GET' && endpoint.path.includes('{investigation_id}')) {
        return {
          success: true,
          data: {
            investigation_id: data?.investigation_id || `inv_${Date.now()}`,
            status: 'completed',
            progress_percentage: 100.0,
            quality_score: 0.87,
            insights: {
              patterns: ['seasonal_trend', 'weekly_pattern', 'outlier_detection'],
              schema: { columns: 15, data_types: { numeric: 8, text: 5, date: 2 } },
              statistics: { total_records: 45230, columns: 15 }
            },
            recommendations: [
              'Consider removing outliers in column_A',
              'Apply log transformation to normalize skewed data',
              'Split date columns for better temporal analysis'
            ],
            anomalies: [
              { type: 'outlier', column: 'price', count: 23, severity: 'medium' },
              { type: 'missing_values', column: 'category', count: 156, severity: 'low' }
            ]
          },
          status: 200
        }
      }
      
      if (endpoint.method === 'GET') {
        return {
          success: true,
          data: [
            {
              id: `inv_${Date.now() - 1000}`,
              name: 'Customer Analysis Q4',
              description: 'Customer behavior analysis for Q4 2024',
              status: 'completed',
              progress_percentage: 100.0,
              quality_score: 0.92,
              created_at: new Date(Date.now() - 86400000).toISOString(),
              updated_at: new Date(Date.now() - 3600000).toISOString()
            },
            {
              id: `inv_${Date.now() - 2000}`,
              name: 'Sales Data Processing',
              description: 'Monthly sales data cleaning and analysis',
              status: 'processing',
              progress_percentage: 65.0,
              quality_score: null,
              created_at: new Date(Date.now() - 7200000).toISOString(),
              updated_at: new Date(Date.now() - 1800000).toISOString()
            }
          ],
          status: 200
        }
      }
    }
    
    if (endpoint.path.includes('/pipelines/stats')) {
      return {
        success: true,
        data: {
          active: 3,
          completed: 47,
          failed: 2
        },
        status: 200
      }
    }
    
    if (endpoint.path.includes('quick-insights')) {
      return {
        success: true,
        data: {
          status: 'completed',
          progress: 100,
          quality_score: 0.89,
          total_records: 12450,
          issues_found: 5,
          patterns_found: 8,
          last_updated: new Date().toISOString()
        },
        status: 200
      }
    }
    
    // Default response for processing jobs
    return {
      success: true,
      data: {
        message: 'Data processing operation completed successfully',
        endpoint: endpoint.name,
        processing_type: endpoint.path.includes('job') ? 'background_job' : 'data_pipeline',
        timestamp: new Date().toISOString(),
        request_id: `req_${Date.now()}`,
        status: 'success'
      },
      status: 200
    }
  }

  const generateMockData = (industry: Industry) => {
    switch (industry) {
      case 'ai':
        return {
          model_accuracy: 0.94,
          processing_time_ms: Math.floor(Math.random() * 100) + 20,
          confidence_score: 0.95,
          predictions: [
            { class: 'positive', probability: 0.85 },
            { class: 'negative', probability: 0.15 }
          ]
        }
      case 'manufacturing':
        return {
          equipment_status: 'operational',
          efficiency: 0.87,
          maintenance_score: 8.5,
          anomalies_detected: 2,
          production_rate: 145.7
        }
      case 'ecommerce':
        return {
          recommended_products: ['product_123', 'product_456', 'product_789'],
          conversion_probability: 0.23,
          demand_forecast: {
            next_week: 2500,
            confidence: 0.88
          },
          price_optimization: {
            suggested_price: 24.99,
            expected_lift: 0.12
          }
        }
      case 'fintech':
        return {
          fraud_score: 0.15,
          risk_category: 'low',
          compliance_status: 'passed',
          aml_check: {
            status: 'clear',
            last_updated: new Date().toISOString()
          },
          credit_score: 750
        }
      default:
        return {}
    }
  }

  const handleEnvironmentChange = (environment: any) => {
    const envName = typeof environment === 'string' ? environment : environment?.name || 'Development'
    setCurrentEnvironment(envName)
  }

  // Load request history on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('unified-console-history')
    if (savedHistory) {
      setRequestHistory(JSON.parse(savedHistory))
    }
  }, [])

  return (
    <div className="h-screen flex flex-col dark:bg-gray-900" style={{backgroundColor: '#f2f1ed'}}>
      <UnifiedConsoleHeader
        selectedIndustry={selectedIndustry}
        onIndustryChange={handleIndustryChange}
        onOpenEnvironments={() => setShowEnvironmentManager(true)}
        onOpenAuth={() => setShowAuthManager(true)}
        currentEnvironment={currentEnvironment}
      />

      {/* Main Layout */}
      <div className="relative flex-1 overflow-hidden">
        {/* Unified Sidebar */}
        <UnifiedAPISidebar
          selectedIndustry={selectedIndustry}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onEndpointSelect={setSelectedEndpoint}
          selectedEndpoint={selectedEndpoint}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenEndpointsModal={() => setShowEndpointsModal(true)}
          onOpenSettings={() => setShowSettings(true)}
          onOpenHistory={() => setShowRequestHistory(true)}
          onOpenWebhookTester={() => setShowWebhookTester(true)}
          onOpenSecurityConsole={() => window.open('/security', '_blank')}
          onOpenTestCollection={() => window.open('/collections', '_blank')}
        />

        {/* Main Content Area */}
        <div className="flex overflow-hidden h-full" style={{marginLeft: '176px'}}>
          {/* Request Builder */}
          <div className="flex-1 min-w-0" style={{paddingLeft: '4px'}}>
            <UnifiedRequestBuilder
              endpoint={selectedEndpoint}
              selectedIndustry={selectedIndustry}
              onSendRequest={handleSendRequest}
              loading={loading}
              onShowCodeGenerator={() => setShowCodeGenerator(true)}
            />
          </div>

          {/* Response Viewer */}
          <UnifiedResponseViewer 
            response={response}
            error={error}
            loading={loading}
            endpoint={selectedEndpoint}
            onShowCodeGenerator={() => setShowCodeGenerator(true)}
          />
        </div>
      </div>


      {/* Code Snippet Generator Modal */}
      {showCodeGenerator && currentRequestConfig && (
        <CodeSnippetGenerator 
          isOpen={showCodeGenerator}
          onClose={() => setShowCodeGenerator(false)}
          requestConfig={currentRequestConfig}
          response={response}
        />
      )}

      {/* Console Settings Modal */}
      <SimpleConsoleSettings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Environment Manager Modal */}
      {showEnvironmentManager && (
        <EnvironmentManager 
          onEnvironmentChange={handleEnvironmentChange}
        />
      )}

      {/* Authentication Manager Modal */}
      {showAuthManager && (
        <AuthenticationManager 
          isOpen={showAuthManager}
          onClose={() => setShowAuthManager(false)}
          onAuthChange={setAuthConfigs}
          currentAuth={authConfigs}
        />
      )}

      {/* Request History Modal */}
      {showRequestHistory && (
        <RequestHistory
          isOpen={showRequestHistory}
          onClose={() => setShowRequestHistory(false)}
          onReplayRequest={(request) => {
            setSelectedEndpoint({
              id: `replay_${Date.now()}`,
              name: `${request.method} ${request.url}`,
              method: request.method as any,
              path: request.url,
              description: 'Replayed request from history',
              industry: request.industry || 'ai',
              tags: ['replayed']
            })
            setCurrentRequestConfig(request)
            setShowRequestHistory(false)
          }}
          requests={requestHistory}
        />
      )}

      {/* API Endpoints Modal */}
      {showEndpointsModal && (
        <APIEndpointsModal
          isOpen={showEndpointsModal}
          onClose={() => setShowEndpointsModal(false)}
          categories={apiCategories}
          selectedIndustry={selectedIndustry}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onEndpointSelect={setSelectedEndpoint}
          selectedEndpoint={selectedEndpoint}
        />
      )}

      {/* Webhook Tester Modal */}
      <WebhookTester
        isOpen={showWebhookTester}
        onClose={() => setShowWebhookTester(false)}
      />
    </div>
  )
}