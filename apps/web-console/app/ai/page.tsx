'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  ArrowLeft,
  Cpu,
  CheckCircle,
  Globe,
  Bookmark,
  Import,
  Lock,
  Clock,
  Settings,
  Sparkles,
  BarChart3,
  Brain
} from 'lucide-react'

// Enhanced components
import { EnhancedAPISidebar } from '../../src/components/console/EnhancedAPISidebar'
import { CrossVerticalSuggestions } from '../../src/components/console/CrossVerticalSuggestions'
import { ProgressiveDisclosurePanel, DisclosureSection, DisclosureTip } from '../../src/components/console/ProgressiveDisclosurePanel'
import { ConsoleSettings } from '../../src/components/console/ConsoleSettings'
import { ConsolePreferencesProvider, useConsolePreferences } from '../../src/contexts/ConsolePreferencesContext'
import { RequestBuilder } from '../../src/components/console/RequestBuilder'
import { ResponseViewer } from '../../src/components/console/ResponseViewer'
import { EnvironmentManager } from '../../src/components/console/EnvironmentManager'
import RequestCollections from '../../src/components/console/RequestCollections'
import OpenAPIImporter from '../../src/components/console/OpenAPIImporter'
import { AuthenticationManager } from '../../src/components/console/AuthenticationManager'
import { RequestHistory } from '../../src/components/console/RequestHistory'
import { apiClient } from '../../src/lib/api/client'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
  vertical: string
  use_case?: string
  related_endpoints?: string[]
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
}

interface HeaderProps {
  onOpenEnvironments: () => void;
  onOpenCollections: () => void;
  onOpenImporter: () => void;
  onOpenAuth: () => void;
  onOpenHistory: () => void;
  onOpenSettings: () => void;
  currentEnvironment: string;
}

function EnhancedAIConsoleHeader(props: HeaderProps) {
  const {
    onOpenEnvironments,
    onOpenCollections,
    onOpenImporter,
    onOpenAuth,
    onOpenHistory,
    onOpenSettings,
    currentEnvironment
  } = props;
  
  const { preferences, isHydrated } = useConsolePreferences();

  return (
    <div
      className="border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50"
      style={{ backgroundColor: '#f6f6f4' }}
    >
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img src="/Docs Schlep-engne.svg" alt="Schlep Engine Logo" className="w-8 h-8" />
              <div className="flex items-center space-x-2">
                <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">AI Console</h1>
                {isHydrated && preferences.interface_mode === 'advanced' && (
                  <div className="flex items-center space-x-1">
                    <Sparkles className="w-4 h-4 text-purple-500" />
                    <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400 rounded">
                      Cross-Vertical Mode
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600" />
            <Link
              href="/"
              className="flex items-center text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Console
            </Link>
          </div>
          <div className="flex items-center space-x-4">
            {isHydrated && preferences.enabled_verticals.length > 3 && (
              <div className="flex items-center space-x-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-full text-sm">
                <BarChart3 className="w-4 h-4" />
                <span>{preferences.enabled_verticals.length} Categories</span>
              </div>
            )}
            <div className="flex items-center space-x-2">
              <button
                onClick={onOpenAuth}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Authentication Manager"
              >
                <Lock className="w-4 h-4" />
                <span className="text-sm font-medium">Auth</span>
              </button>
              <button
                onClick={onOpenHistory}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Request History"
              >
                <Clock className="w-4 h-4" />
                <span className="text-sm font-medium">History</span>
              </button>
              <button
                onClick={onOpenImporter}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Import OpenAPI/Swagger Specification"
              >
                <Import className="w-4 h-4" />
                <span className="text-sm font-medium">Import API</span>
              </button>
              <button
                onClick={onOpenCollections}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Request Collections"
              >
                <Bookmark className="w-4 h-4" />
                <span className="text-sm font-medium">Collections</span>
              </button>
              <button
                onClick={onOpenEnvironments}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Environment Manager"
              >
                <Globe className="w-4 h-4" />
                <span className="text-sm font-medium">{currentEnvironment}</span>
              </button>
              <button
                onClick={onOpenSettings}
                className="flex items-center space-x-2 px-3 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600"
                title="Console Settings"
              >
                <Settings className="w-4 h-4" />
                <span className="text-sm font-medium">Settings</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIConsoleContent() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | undefined>()
  const [response, setResponse] = useState<ResponseData | undefined>()
  const [error, setError] = useState<any>()
  const [loading, setLoading] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  
  // Modal states
  const [showEnvironmentManager, setShowEnvironmentManager] = useState(false)
  const [showCollections, setShowCollections] = useState(false)
  const [showOpenAPIImporter, setShowOpenAPIImporter] = useState(false)
  const [showAuthManager, setShowAuthManager] = useState(false)
  const [showRequestHistory, setShowRequestHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  
  // Console state
  const [currentEnvironment, setCurrentEnvironment] = useState('Development')
  const [authConfigs, setAuthConfigs] = useState<any[]>([])
  const [requestHistory, setRequestHistory] = useState<any[]>([])
  const [currentRequestConfig, setCurrentRequestConfig] = useState<any>(null)
  const [liveRequestConfig, setLiveRequestConfig] = useState<any>(null)

  // Enhanced request handler with comprehensive response tracking
  const handleSendRequest = async (requestConfig: any): Promise<any> => {
    setLoading(true)
    setError(undefined)
    setResponse(undefined)

    const startTime = performance.now()
    
    try {
      // Extract components from request config
      let { method, url, headers, data, timeout } = requestConfig
      
      // Apply active authentication configs
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
      
      // Store current request config for code generation
      setCurrentRequestConfig({ method, url, headers, body: data })
      
      console.log('Sending request:', {
        method,
        url,
        headers,
        data: data ? JSON.parse(data) : undefined
      })

      // Simulate API call based on endpoint
      let result
      const endpoint = selectedEndpoint
      
      if (endpoint) {
        // Route to appropriate API method based on endpoint ID
        switch (endpoint.id) {
          // Authentication & Users
          case 'login':
            result = await apiClient.login(data ? JSON.parse(data) : {})
            break
          case 'register':
            result = await apiClient.register(data ? JSON.parse(data) : {})
            break
          case 'api-keys':
            result = await apiClient.getApiKeys()
            break
          case 'user-profile':
            result = await apiClient.getUserProfile()
            break
          case 'update-profile':
            result = await apiClient.updateUserProfile(data ? JSON.parse(data) : {})
            break
          
          // Storage & File Management
          case 'upload-file':
            result = await apiClient.uploadFile(data ? JSON.parse(data) : {})
            break
          case 'list-files':
            result = await apiClient.listFiles()
            break
          case 'download-file':
            result = await apiClient.downloadFile('file_123')
            break
          case 'delete-file':
            result = await apiClient.deleteFile('file_123')
            break
          case 'storage-usage':
            result = await apiClient.getStorageUsage()
            break
          
          // Document Extraction
          case 'extract-pdf':
            result = await apiClient.extractPdfData(data ? JSON.parse(data) : {})
            break
          case 'extract-text':
            result = await apiClient.extractText(data ? JSON.parse(data) : {})
            break
          case 'extract-tables':
            result = await apiClient.extractTables(data ? JSON.parse(data) : {})
            break
          case 'extract-metadata':
            result = await apiClient.extractMetadata(data ? JSON.parse(data) : {})
            break
          case 'batch-extraction':
            result = await apiClient.batchExtraction(data ? JSON.parse(data) : {})
            break
          
          // Data Quality & Preparation
          case 'quality-assessment':
            result = await apiClient.assessDataQuality(data ? JSON.parse(data) : {})
            break
          case 'data-cleaning':
            result = await apiClient.cleanData(data ? JSON.parse(data) : {})
            break
          case 'schema-validation':
            result = await apiClient.validateSchema(data ? JSON.parse(data) : {})
            break
          case 'anomaly-detection':
            result = await apiClient.detectAnomalies(data ? JSON.parse(data) : {})
            break
          case 'data-profiling':
            result = await apiClient.profileData(data ? JSON.parse(data) : {})
            break
          
          // Advanced ML
          case 'custom-training':
            result = await apiClient.trainCustomModel(data ? JSON.parse(data) : {})
            break
          case 'model-evaluation':
            result = await apiClient.evaluateModel(data ? JSON.parse(data) : {})
            break
          case 'feature-engineering':
            result = await apiClient.engineerFeatures(data ? JSON.parse(data) : {})
            break
          case 'model-comparison':
            result = await apiClient.compareModels(data ? JSON.parse(data) : {})
            break
          case 'ensemble-methods':
            result = await apiClient.createEnsemble(data ? JSON.parse(data) : {})
            break
          
          // Analytics & Monitoring
          case 'usage-analytics':
            result = await apiClient.getUsageAnalytics()
            break
          case 'performance-metrics':
            result = await apiClient.getPerformanceMetrics()
            break
          case 'error-tracking':
            result = await apiClient.getErrorTracking()
            break
          case 'custom-dashboards':
            result = await apiClient.createCustomDashboard(data ? JSON.parse(data) : {})
            break
          case 'alerts-notifications':
            result = await apiClient.setupAlertsNotifications(data ? JSON.parse(data) : {})
            break
          
          // Data Ingestion & ETL (existing)
          case 'batch-upload':
            result = await apiClient.batchDataUpload(data ? JSON.parse(data) : {})
            break
          case 'streaming-ingest':
            result = await apiClient.setupStreamingIngestion(data ? JSON.parse(data) : {})
            break
          case 'data-transform':
            result = await apiClient.transformData(data ? JSON.parse(data) : {})
            break
          case 'auto-label':
            result = await apiClient.autoLabelData(data ? JSON.parse(data) : {})
            break
          case 'training-job':
            result = await apiClient.createTrainingJob(data ? JSON.parse(data) : {})
            break
          case 'catalog-dataset':
            result = await apiClient.catalogDataset(data ? JSON.parse(data) : {})
            break
          case 'search-datasets':
            result = await apiClient.searchDatasets({
              query: 'fraud detection',
              tags: 'finance,classification',
              quality_min: 0.9
            })
            break
          case 'dataset-quality':
            result = await apiClient.getDatasetQuality('ds_001')
            break
          case 'realtime-stream-setup':
            result = await apiClient.setupRealtimeStream(data ? JSON.parse(data) : {})
            break
          case 'stream-analytics':
            result = await apiClient.getStreamMetrics('fraud_detection_stream')
            break
          case 'create-experiment':
            result = await apiClient.createMLExperiment(data ? JSON.parse(data) : {})
            break
          case 'automated-retraining':
            result = await apiClient.createAdvancedRetrainingPipeline(data ? JSON.parse(data) : {})
            break
          case 'advanced-model-serving':
            result = await apiClient.deployEnterpriseModel(data ? JSON.parse(data) : {})
            break
          case 'model-explainability':
            result = await apiClient.explainModel('fraud-detection-v3', data ? JSON.parse(data) : {})
            break
          default:
            // Fallback with mock response
            result = {
              success: true,
              data: {
                message: 'API Console Demo Response',
                endpoint: endpoint.name,
                timestamp: new Date().toISOString(),
                request_id: `req_${Date.now()}`,
                demo_mode: true,
                sample_data: {
                  accuracy: 0.94,
                  processing_time_ms: Math.floor(Math.random() * 100) + 20,
                  confidence: 0.95
                }
              },
              status: 200
            }
        }
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      // Simulate response data with realistic metrics
      const responseData: ResponseData = {
        status: result?.status || 200,
        statusText: result?.status === 200 ? 'OK' : 'Error',
        data: result?.data || result,
        headers: {
          'content-type': 'application/json',
          'x-response-time': `${duration.toFixed(2)}ms`,
          'x-request-id': `req_${Date.now()}`,
          'access-control-allow-origin': '*',
          'server': 'Schlep-Engine API v2.1.0',
          'cache-control': 'no-cache',
          'connection': 'keep-alive',
          ...headers
        },
        duration: duration,
        size: JSON.stringify(result?.data || result).length,
        timestamp: new Date().toISOString(),
        url: url,
        method: method
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
        response: result?.success ? {
          data: result.data,
          headers: responseData.headers,
          status: responseData.status,
          statusText: responseData.statusText
        } : undefined,
        error: result?.success ? undefined : {
          message: result?.error || 'Request failed',
          code: `HTTP_${result?.status || 500}`
        }
      }
      
      const updatedHistory = [historyItem, ...requestHistory].slice(0, 100) // Keep last 100 requests
      setRequestHistory(updatedHistory)
      localStorage.setItem('api-console-request-history', JSON.stringify(updatedHistory))

      return result

    } catch (err) {
      const endTime = performance.now()
      const duration = endTime - startTime

      console.error('Request failed:', err)
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

      // Save error to request history
      const historyItem = {
        id: `req_${Date.now()}`,
        timestamp: new Date().toISOString(),
        method: requestConfig.method,
        url: requestConfig.url,
        headers: requestConfig.headers,
        body: requestConfig.data,
        error: errorDetails
      }
      
      const updatedHistory = [historyItem, ...requestHistory].slice(0, 100)
      setRequestHistory(updatedHistory)
      localStorage.setItem('api-console-request-history', JSON.stringify(updatedHistory))
    } finally {
      setLoading(false)
    }
  }

  const handleSaveRequest = (requestConfig: any) => {
    // This will be handled by the RequestCollections component
    setShowCollections(true)
  }

  const handleLoadRequest = (savedRequest: any) => {
    // Load a saved request into the request builder
    setSelectedEndpoint({
      id: savedRequest.id,
      name: savedRequest.name,
      method: savedRequest.method,
      path: savedRequest.url,
      description: savedRequest.description || '',
      vertical: savedRequest.vertical || 'ai'
    })
    // Additional logic to populate request builder with saved data would go here
  }

  const handleSaveToCollection = (request: any) => {
    // Handle saving request from collections component
    console.log('Request saved to collection:', request)
  }

  const handleOpenAPIImport = (endpoints: any[], spec: any) => {
    // Handle importing endpoints from OpenAPI specification
    console.log('Imported endpoints from OpenAPI spec:', { endpoints, spec })
    // Here you would typically:
    // 1. Update the APISidebar with new endpoints
    // 2. Save imported endpoints to localStorage or backend
    // 3. Show success notification
    
    // For now, we'll just log the import
    alert(`Successfully imported ${endpoints.length} endpoints from ${spec.info.title}`)
  }

  const handleRetry = () => {
    if (selectedEndpoint) {
      // Retry with last configuration
      // This would need to store the last request config
      console.log('Retrying request...')
    }
  }

  const handleEnvironmentChange = (environment: any) => {
    // Handle both string and object types
    const envName = typeof environment === 'string' ? environment : environment?.name || 'Development'
    setCurrentEnvironment(envName)
    // Update API client base URL based on environment
    const envUrls: Record<string, string> = {
      'Development': 'http://localhost:3001',
      'Staging': 'https://staging-api.schlep-engine.com',
      'Production': 'https://api.schlep-engine.com'
    }
    const baseUrl = typeof environment === 'object' && environment?.baseUrl 
      ? environment.baseUrl 
      : envUrls[envName] || 'http://localhost:3001'
    // apiClient.setBaseURL(baseUrl)
  }

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault()
            if (selectedEndpoint && !loading) {
              // Trigger request
            }
            break
          case 'b':
            e.preventDefault()
            setSidebarCollapsed(!sidebarCollapsed)
            break
          case 'f':
            e.preventDefault()
            setIsFullscreen(!isFullscreen)
            break
        }
      }
    }

    window.addEventListener('keydown', handleKeyPress)
    return () => window.removeEventListener('keydown', handleKeyPress)
  }, [selectedEndpoint, loading, sidebarCollapsed, isFullscreen])

  return (
    <div className={`min-h-screen dark:bg-gray-900 ${darkMode ? 'dark' : ''}`} style={{backgroundColor: '#f6f6f4'}}>
      <EnhancedAIConsoleHeader 
        onOpenEnvironments={() => setShowEnvironmentManager(true)}
        onOpenCollections={() => setShowCollections(true)}
        onOpenImporter={() => setShowOpenAPIImporter(true)}
        onOpenAuth={() => setShowAuthManager(true)}
        onOpenHistory={() => setShowRequestHistory(true)}
        onOpenSettings={() => setShowSettings(true)}
        currentEnvironment={currentEnvironment}
      />
      
      {/* Main Layout */}
      <div className="flex h-[calc(100vh-73px)] overflow-hidden">
        {/* Enhanced Sidebar */}
        <EnhancedAPISidebar 
          onEndpointSelect={setSelectedEndpoint}
          selectedEndpoint={selectedEndpoint}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          onOpenSettings={() => setShowSettings(true)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Request Builder with Enhanced Features */}
          <div className="flex-1 min-w-0">
            <RequestBuilder 
              endpoint={selectedEndpoint}
              onSendRequest={handleSendRequest}
              loading={loading}
              onSaveRequest={handleSaveRequest}
              onRequestConfigChange={setLiveRequestConfig}
            />

            {/* Progressive Disclosure Panel - shown when no endpoint selected */}
            {!selectedEndpoint && (
              <div className="p-6">
                <div className="max-w-2xl">
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      Welcome to Enhanced AI Console
                    </h2>
                    <p className="text-gray-600 dark:text-gray-400">
                      Your unified interface for AI APIs with cross-vertical capabilities
                    </p>
                  </div>
                  
                  <ProgressiveDisclosurePanel sections={[
                    {
                      id: 'getting-started',
                      title: 'Getting Started with AI APIs',
                      description: 'Learn the basics of using the AI console',
                      level: 'beginner' as const,
                      defaultExpanded: true,
                      content: React.createElement(DisclosureSection, null,
                        React.createElement(DisclosureTip, { type: 'info' as const, children: 'Welcome to the Enhanced AI Console! This interface now supports cross-vertical API access, allowing you to build complete AI workflows that span multiple domains.' }),
                        React.createElement('div', { className: 'space-y-2 text-sm text-gray-600 dark:text-gray-400' },
                          React.createElement('p', null, '1. ', React.createElement('strong', null, 'Select an API'), ' from the sidebar to get started'),
                          React.createElement('p', null, '2. ', React.createElement('strong', null, 'Configure your request'), ' using the request builder'),
                          React.createElement('p', null, '3. ', React.createElement('strong', null, 'Send the request'), ' and view the response'),
                          React.createElement('p', null, '4. ', React.createElement('strong', null, 'Explore suggestions'), ' for related APIs from other verticals')
                        )
                      )
                    },
                    {
                      id: 'cross-vertical-features',
                      title: 'Cross-Vertical Capabilities',
                      description: 'Discover APIs from manufacturing, e-commerce, and more',
                      level: 'intermediate' as const,
                      content: React.createElement(DisclosureSection, null,
                        React.createElement(DisclosureTip, { type: 'success' as const, children: 'The enhanced console now shows you related APIs from other verticals to help you build complete solutions.' }),
                        React.createElement('div', { className: 'space-y-3' },
                          React.createElement('div', null,
                            React.createElement('h4', { className: 'font-medium text-gray-900 dark:text-white' }, 'Available Verticals:'),
                            React.createElement('ul', { className: 'text-sm text-gray-600 dark:text-gray-400 ml-4' },
                              React.createElement('li', null, '• ', React.createElement('strong', null, 'Core AI & ML'), ' - Model training, inference, MLOps'),
                              React.createElement('li', null, '• ', React.createElement('strong', null, 'Manufacturing AI'), ' - Predictive maintenance, quality control'),
                              React.createElement('li', null, '• ', React.createElement('strong', null, 'E-commerce AI'), ' - Recommendations, demand forecasting'),
                              React.createElement('li', null, '• ', React.createElement('strong', null, 'Document Processing'), ' - PDF extraction, OCR, parsing'),
                              React.createElement('li', null, '• ', React.createElement('strong', null, 'Data Processing'), ' - ETL, transformation, validation')
                            )
                          )
                        )
                      )
                    }
                  ]} />
                </div>
              </div>
            )}

            {/* Cross-Vertical Suggestions */}
            {selectedEndpoint && (
              <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                <CrossVerticalSuggestions 
                  selectedEndpoint={selectedEndpoint}
                  onEndpointSelect={setSelectedEndpoint}
                />
              </div>
            )}
          </div>

          {/* Response Viewer */}
          <ResponseViewer 
            response={response}
            error={error}
            loading={loading}
            darkMode={darkMode}
            onRetry={handleRetry}
          />
        </div>
      </div>

      {/* Console Settings Modal */}
      <ConsoleSettings 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Environment Manager Modal */}
      {showEnvironmentManager && (
        <EnvironmentManager 
          onEnvironmentChange={handleEnvironmentChange}
        />
      )}

      {/* Request Collections Modal */}
      {showCollections && (
        <RequestCollections 
          isOpen={showCollections}
          onClose={() => setShowCollections(false)}
          onLoadRequest={handleLoadRequest}
          onSaveRequest={handleSaveToCollection}
        />
      )}

      {/* OpenAPI Importer Modal */}
      {showOpenAPIImporter && (
        <OpenAPIImporter 
          isOpen={showOpenAPIImporter}
          onClose={() => setShowOpenAPIImporter(false)}
          onImport={handleOpenAPIImport}
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
            // Load request into request builder
            setSelectedEndpoint({
              id: `replay_${Date.now()}`,
              name: `${request.method} ${request.url}`,
              method: request.method as any,
              path: request.url,
              description: 'Replayed request from history',
              vertical: 'ai'
            })
            setCurrentRequestConfig(request)
            setShowRequestHistory(false)
          }}
          requests={requestHistory}
        />
      )}

    </div>
  )
}

export default function AIConsolePage() {
  return (
    <ConsolePreferencesProvider>
      <AIConsoleContent />
    </ConsolePreferencesProvider>
  )
}