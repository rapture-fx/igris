'use client'

import React, { useState, useMemo } from 'react'
import { 
  ChevronRight, 
  ChevronDown,
  Cpu,
  Database,
  Brain,
  Factory,
  ShoppingCart,
  Building2,
  Zap,
  GitBranch,
  Activity,
  Bot,
  Settings,
  Monitor,
  Shield,
  FileText,
  Search,
  Star,
  StarOff,
  Key,
  HardDrive,
  ScanText,
  CheckCircle,
  BarChart3,
  Bell,
  Moon,
  HelpCircle,
  Lightbulb,
  TrendingUp,
  Globe
} from 'lucide-react'
import { useConsolePreferences } from '../../contexts/ConsolePreferencesContext'

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

interface APICategory {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  endpoints: APIEndpoint[]
  priority: number
  vertical: string
  use_cases?: string[]
}

interface EnhancedAPISidebarProps {
  onEndpointSelect: (endpoint: APIEndpoint) => void
  selectedEndpoint?: APIEndpoint
  collapsed?: boolean
  onToggleCollapse?: () => void
  onOpenSettings?: () => void
}

export function EnhancedAPISidebar({ 
  onEndpointSelect, 
  selectedEndpoint, 
  collapsed = false, 
  onToggleCollapse,
  onOpenSettings
}: EnhancedAPISidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  
  const { 
    preferences, 
    isVerticalEnabled, 
    isCategoryVisible,
    addToFavorites,
    removeFromFavorites,
    addToRecent,
    toggleCategoryCollapse,
    isHydrated
  } = useConsolePreferences()

  // Real API categories based on actual backend endpoints
  const apiCategories: APICategory[] = useMemo(() => [
    {
      id: 'data-processing',
      name: 'Data Processing',
      icon: <Database className="w-4 h-4" />,
      description: 'Core data processing and transformation services',
      priority: 1,
      vertical: 'ai',
      use_cases: ['data-preparation', 'data-quality', 'validation'],
      endpoints: [
        {
          id: 'data-investigations',
          name: 'Data Investigations',
          method: 'POST',
          path: '/api/v1/data/processing/investigations',
          description: 'Create and manage data investigation workflows',
          vertical: 'ai'
        },
        {
          id: 'data-quality',
          name: 'Data Quality Analysis',
          method: 'POST',
          path: '/api/v1/quality',
          description: 'Comprehensive data quality assessment and preparation',
          vertical: 'ai'
        },
        {
          id: 'document-extraction',
          name: 'Document Extraction',
          method: 'POST',
          path: '/api/v1/extract',
          description: 'Extract structured data from documents',
          vertical: 'ai'
        },
        {
          id: 'validation',
          name: 'Use Case Validation',
          method: 'POST',
          path: '/api/v1/validation',
          description: 'Validate data processing use cases',
          vertical: 'ai'
        }
      ]
    },
    {
      id: 'ml-pipeline',
      name: 'ML Pipeline',
      icon: <Brain className="w-4 h-4" />,
      description: 'Machine learning pipeline management',
      priority: 2,
      vertical: 'ai',
      use_cases: ['model-training', 'prediction'],
      endpoints: [
        {
          id: 'ml-create',
          name: 'Create ML Pipeline',
          method: 'POST',
          path: '/api/v1/ml/create',
          description: 'Create a new ML pipeline configuration',
          vertical: 'ai'
        },
        {
          id: 'ml-train',
          name: 'Train Pipeline',
          method: 'POST',
          path: '/api/v1/ml/train/{pipeline_id}',
          description: 'Train ML model with uploaded data',
          vertical: 'ai'
        },
        {
          id: 'ml-predict',
          name: 'Make Predictions',
          method: 'POST',
          path: '/api/v1/ml/predict',
          description: 'Generate predictions from trained models',
          vertical: 'ai'
        }
      ]
    },
    {
      id: 'advanced-ai',
      name: 'Advanced AI Services',
      icon: <Zap className="w-4 h-4" />,
      description: 'High-level AI capabilities and orchestration',
      priority: 3,
      vertical: 'ai',
      use_cases: ['analysis', 'insights'],
      endpoints: [
        {
          id: 'intelligent-analysis',
          name: 'Intelligent Analysis',
          method: 'POST',
          path: '/api/v1/ai/intelligent-analysis',
          description: 'Comprehensive AI-powered data analysis',
          vertical: 'ai'
        },
        {
          id: 'auto-insights',
          name: 'Auto Insights Generation',
          method: 'POST',
          path: '/api/v1/ai/auto-insights',
          description: 'Generate automated insights using NLP',
          vertical: 'ai'
        },
        {
          id: 'predictive-analysis',
          name: 'Predictive Analysis',
          method: 'POST',
          path: '/api/v1/ai/predictive-analysis',
          description: 'Advanced predictive analytics and forecasting',
          vertical: 'ai'
        }
      ]
    },
    {
      id: 'model-serving',
      name: 'Model Serving',
      icon: <Monitor className="w-4 h-4" />,
      description: 'Enterprise model deployment and serving',
      priority: 4,
      vertical: 'ai',
      use_cases: ['deployment', 'inference'],
      endpoints: [
        {
          id: 'model-deploy',
          name: 'Deploy Model',
          method: 'POST',
          path: '/api/v1/serving/deploy',
          description: 'Deploy ML models to production',
          vertical: 'ai'
        },
        {
          id: 'model-status',
          name: 'Model Status',
          method: 'GET',
          path: '/api/v1/serving/{model_id}/status',
          description: 'Check deployed model status',
          vertical: 'ai'
        },
        {
          id: 'platform-health',
          name: 'Platform Health',
          method: 'GET',
          path: '/api/v1/serving/platform/health',
          description: 'Model serving platform health check',
          vertical: 'ai'
        }
      ]
    },
    {
      id: 'industry-solutions',
      name: 'Industry Solutions',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Industry-specific AI solutions for different sectors',
      priority: 5,
      vertical: 'industry',
      use_cases: ['financial', 'ecommerce', 'manufacturing'],
      endpoints: [
        {
          id: 'fraud-detection',
          name: 'Fraud Detection',
          method: 'POST',
          path: '/api/v1/industry/fraud-detection',
          description: 'Financial fraud detection and analysis',
          vertical: 'financial'
        },
        {
          id: 'credit-risk',
          name: 'Credit Risk Assessment',
          method: 'POST',
          path: '/api/v1/industry/credit-risk',
          description: 'Credit risk assessment and scoring',
          vertical: 'financial'
        },
        {
          id: 'ecommerce-recommendations',
          name: 'E-commerce Recommendations',
          method: 'POST',
          path: '/api/v1/industry/ecommerce/recommendations',
          description: 'Product recommendations and demand forecasting',
          vertical: 'ecommerce'
        },
        {
          id: 'manufacturing-solutions',
          name: 'Manufacturing Solutions',
          method: 'POST',
          path: '/api/v1/industry/manufacturing/predictive-maintenance',
          description: 'Predictive maintenance and quality control',
          vertical: 'manufacturing'
        }
      ]
    },
    {
      id: 'real-time-streaming',
      name: 'Real-Time Streaming',
      icon: <Zap className="w-4 h-4" />,
      description: 'Real-time data streaming and processing',
      priority: 6,
      vertical: 'streaming',
      endpoints: [
        {
          id: 'batch-upload',
          name: 'Batch Data Upload',
          method: 'POST',
          path: '/api/v1/data/batch/upload',
          description: 'Upload large datasets for batch processing',
          vertical: 'data-processing'
        },
        {
          id: 'streaming-ingest',
          name: 'Real-time Ingestion',
          method: 'POST',
          path: '/api/v1/data/stream/ingest',
          description: 'Set up real-time data streaming pipelines',
          vertical: 'data-processing',
          related_endpoints: ['realtime-stream-setup', 'stream-analytics']
        },
        {
          id: 'data-transform',
          name: 'Data Transformation',
          method: 'POST',
          path: '/api/v1/data/transform',
          description: 'Apply transformations and feature engineering',
          vertical: 'data-processing',
          related_endpoints: ['feature-engineering', 'quality-assessment']
        }
      ]
    },
    {
      id: 'document-extraction',
      name: '📄 Document Processing',
      icon: <ScanText className="w-4 h-4" />,
      description: 'Extract and process data from documents',
      priority: 2,
      vertical: 'document-extraction',
      endpoints: [
        {
          id: 'extract-pdf',
          name: 'Extract PDF Data',
          method: 'POST',
          path: '/api/v1/extract/pdf',
          description: 'Extract structured data from PDF documents',
          vertical: 'document-extraction',
          related_endpoints: ['quality-assessment', 'custom-training']
        },
        {
          id: 'extract-tables',
          name: 'Extract Tables',
          method: 'POST',
          path: '/api/v1/extract/tables',
          description: 'Extract tabular data from documents',
          vertical: 'document-extraction'
        },
        {
          id: 'batch-extraction',
          name: 'Batch Processing',
          method: 'POST',
          path: '/api/v1/extract/batch',
          description: 'Process multiple documents in batch',
          vertical: 'document-extraction',
          related_endpoints: ['batch-upload', 'data-transform']
        }
      ]
    },
    {
      id: 'analytics-monitoring',
      name: '📈 Analytics & Insights',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Usage analytics and performance monitoring',
      priority: 3,
      vertical: 'analytics',
      endpoints: [
        {
          id: 'usage-analytics',
          name: 'Usage Analytics',
          method: 'GET',
          path: '/api/v1/analytics/usage',
          description: 'Detailed API usage analytics and insights',
          vertical: 'analytics'
        },
        {
          id: 'performance-metrics',
          name: 'Performance Metrics',
          method: 'GET',
          path: '/api/v1/analytics/performance',
          description: 'Monitor API performance and response times',
          vertical: 'analytics'
        },
        {
          id: 'custom-dashboards',
          name: 'Custom Dashboards',
          method: 'POST',
          path: '/api/v1/analytics/dashboards',
          description: 'Create custom analytics dashboards',
          vertical: 'analytics',
          beta: true
        }
      ]
    },
    {
      id: 'authentication',
      name: '🔐 Authentication',
      icon: <Key className="w-4 h-4" />,
      description: 'User management and API security',
      priority: 1,
      vertical: 'ai', // Core feature
      endpoints: [
        {
          id: 'login',
          name: 'User Login',
          method: 'POST',
          path: '/api/v1/auth/login',
          description: 'Authenticate user and get access token',
          vertical: 'ai'
        },
        {
          id: 'api-keys',
          name: 'Manage API Keys',
          method: 'GET',
          path: '/api/v1/auth/api-keys',
          description: 'List and manage API keys',
          vertical: 'ai'
        }
      ]
    }
  ], [])

  // Filter categories and endpoints based on preferences
  const visibleCategories = useMemo(() => {
    return apiCategories
      .filter(category => isCategoryVisible(category.id))
      .map(category => ({
        ...category,
        endpoints: category.endpoints.filter(endpoint => {
          // Filter based on preferences
          if (endpoint.beta && !preferences.show_beta_endpoints) return false
          if (endpoint.deprecated && !preferences.show_deprecated_endpoints) return false
          
          // Search filter
          if (searchQuery) {
            const searchLower = searchQuery.toLowerCase()
            return (
              endpoint.name.toLowerCase().includes(searchLower) ||
              endpoint.description.toLowerCase().includes(searchLower) ||
              endpoint.path.toLowerCase().includes(searchLower)
            )
          }
          
          return true
        })
      }))
      .filter(category => category.endpoints.length > 0 || searchQuery === '')
      .sort((a, b) => a.priority - b.priority)
  }, [apiCategories, preferences, searchQuery, isCategoryVisible])

  // Get cross-vertical suggestions for selected endpoint
  const getSuggestions = (endpoint: APIEndpoint) => {
    if (!preferences.show_cross_vertical_suggestions || !endpoint.related_endpoints) {
      return []
    }
    
    const suggestions: APIEndpoint[] = []
    visibleCategories.forEach(category => {
      category.endpoints.forEach(ep => {
        if (endpoint.related_endpoints?.includes(ep.id) && ep.id !== endpoint.id) {
          suggestions.push(ep)
        }
      })
    })
    
    return suggestions.slice(0, 3) // Limit to 3 suggestions
  }

  const handleEndpointSelect = (endpoint: APIEndpoint) => {
    addToRecent(endpoint.id)
    onEndpointSelect(endpoint)
    setShowSuggestions(false)
  }

  const isFavorite = (endpointId: string) => {
    return preferences.favorite_endpoints.includes(endpointId)
  }

  const toggleFavorite = (endpointId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (isFavorite(endpointId)) {
      removeFromFavorites(endpointId)
    } else {
      addToFavorites(endpointId)
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      case 'POST': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'PUT': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
      case 'DELETE': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'PATCH': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  if (collapsed) {
    return (
      <div className="w-16 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 space-y-4" style={{backgroundColor: '#f5f4f2'}}>
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {visibleCategories.slice(0, 4).map((category) => (
          <div
            key={category.id}
            className="p-2 text-gray-600 dark:text-gray-400 transition-colors cursor-pointer"
            title={category.name}
          >
            {category.icon}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full pl-2" style={{backgroundColor: '#f5f4f2'}}>
      {/* Header */}
      <div className="p-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              AI Console
            </span>
            {isHydrated && preferences.interface_mode === 'advanced' && (
              <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 rounded">
                Advanced
              </span>
            )}
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ChevronDown className="w-4 h-4 rotate-90 text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative mb-2 w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search APIs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Interface Mode Indicator */}
        {isHydrated && preferences.enabled_verticals.length > 3 && (
          <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center space-x-2">
              <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span className="text-xs text-blue-700 dark:text-blue-300">
                Cross-vertical mode active
              </span>
            </div>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
              Showing {preferences.enabled_verticals.length} API categories
            </p>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {/* Favorites Section - only render after hydration */}
        {isHydrated && preferences.favorite_endpoints.length > 0 && (
          <div className="px-1 py-2 border-b border-gray-200 dark:border-gray-700">
            <h3 className="px-2 text-xs font-medium text-gray-500 dark:text-gray-500 mb-2">
              ⭐ Favorites
            </h3>
            <div className="space-y-1">
              {visibleCategories.flatMap(cat => cat.endpoints)
                .filter(endpoint => isFavorite(endpoint.id))
                .slice(0, 5)
                .map(endpoint => (
                  <button
                    key={`fav-${endpoint.id}`}
                    onClick={() => handleEndpointSelect(endpoint)}
                    className="w-full text-left px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                  >
                    <div className="flex items-center space-x-2">
                      <span className={`px-1 py-0.5 text-[8px] font-medium rounded ${getMethodColor(endpoint.method)}`}>
                        {endpoint.method}
                      </span>
                      <span className="truncate">{endpoint.name}</span>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* API Categories */}
        <div className="px-1 py-2 space-y-1">
          {visibleCategories.map((category) => {
            const isExpanded = !preferences.collapsed_categories.includes(category.id)
            
            return (
              <div key={category.id} className="relative">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategoryCollapse(category.id)}
                  className="w-full px-2 py-2 text-left flex items-center gap-1 transition-colors rounded-t-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="flex items-center space-x-2">
                    <div className="text-gray-600 dark:text-gray-400">
                      {category.icon}
                    </div>
                    <h3 className="font-normal text-gray-500 dark:text-gray-500 text-sm">
                      {category.name}
                    </h3>
                    <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                      {category.endpoints.length}
                    </span>
                  </div>
                </button>

                {/* Git Branch Line */}
                {isExpanded && (
                  <div className="absolute left-6 top-10 bottom-0 w-px bg-gray-300 dark:bg-gray-600 z-10"></div>
                )}

                {/* Category Endpoints */}
                {isExpanded && (
                  <div>
                    {category.endpoints.map((endpoint) => {
                      const isSelected = selectedEndpoint?.id === endpoint.id
                      const suggestions = getSuggestions(endpoint)

                      return (
                        <div key={endpoint.id}>
                          <button
                            onClick={() => handleEndpointSelect(endpoint)}
                            className={`w-full text-left pl-12 pr-2 py-2 transition-colors relative ${
                              isSelected ? 'bg-blue-50 dark:bg-blue-900/10' : 'hover:bg-gray-50 dark:hover:bg-gray-800'
                            }`}
                          >
                            {/* Branch connector */}
                            <div className="absolute left-6 top-0 w-4 h-4 border-l border-b border-gray-300 dark:border-gray-600 rounded-bl-md"></div>
                            
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`px-1 py-0.5 text-[8px] font-medium rounded ${getMethodColor(endpoint.method)}`}>
                                  {endpoint.method}
                                </span>
                                
                                {endpoint.beta && (
                                  <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                    BETA
                                  </span>
                                )}
                                
                                {isHydrated && (
                                  <button
                                    onClick={(e) => toggleFavorite(endpoint.id, e)}
                                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                                  >
                                    {isFavorite(endpoint.id) ? (
                                      <Star className="w-3 h-3 text-yellow-500 fill-current" />
                                    ) : (
                                      <StarOff className="w-3 h-3 text-gray-400" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                            
                            <h4 className="font-medium text-gray-500 dark:text-gray-500 mb-1 text-xs">
                              {endpoint.name}
                            </h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                              {endpoint.description}
                            </p>
                            <code className="text-xs px-2 py-1 rounded" style={{ color: '#114dcd' }}>
                              {endpoint.path}
                            </code>
                          </button>

                          {/* Cross-vertical suggestions */}
                          {isSelected && suggestions.length > 0 && preferences.show_cross_vertical_suggestions && (
                            <div className="ml-12 mr-2 mb-2 p-2 bg-amber-50 dark:bg-amber-900/10 rounded-lg border border-amber-200 dark:border-amber-800">
                              <div className="flex items-center space-x-2 mb-2">
                                <TrendingUp className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
                                  Related APIs
                                </span>
                              </div>
                              {suggestions.map(suggestion => (
                                <button
                                  key={`suggestion-${suggestion.id}`}
                                  onClick={() => handleEndpointSelect(suggestion)}
                                  className="block w-full text-left text-xs text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 mb-1"
                                >
                                  → {suggestion.name}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <button
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 relative"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full"></span>
          </button>

          <button
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Toggle theme"
          >
            <Moon className="w-4 h-4" />
          </button>

          <button
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Help"
          >
            <HelpCircle className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenSettings}
            className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            title="Console Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}