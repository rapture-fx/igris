'use client'

import React, { useState } from 'react'
import { 
  ChevronRight, 
  ChevronDown,
  Cpu,
  Database,
  Brain,
  Network,
  Zap,
  GitBranch,
  Activity,
  Bot,
  Settings,
  Monitor,
  Shield,
  FileText,
  Code2,
  Search,
  Filter,
  Star,
  History
} from 'lucide-react'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
  favorite?: boolean
}

interface APICategory {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  endpoints: APIEndpoint[]
  expanded?: boolean
}

interface APISidebarProps {
  onEndpointSelect: (endpoint: APIEndpoint) => void
  selectedEndpoint?: APIEndpoint
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function APISidebar({ 
  onEndpointSelect, 
  selectedEndpoint, 
  collapsed = false, 
  onToggleCollapse 
}: APISidebarProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['digital-twin', 'mlops', 'dataset-marketplace'])
  )
  const [showFavorites, setShowFavorites] = useState(false)
  const [recentEndpoints] = useState<string[]>(['create-ai-twin', 'dataset-quality', 'realtime-stream-setup'])

  const apiCategories: APICategory[] = [
    {
      id: 'digital-twin',
      name: 'Digital Twin AI',
      icon: <Cpu className="w-4 h-4" />,
      description: 'AI model digital twins with lifecycle tracking',
      endpoints: [
        {
          id: 'create-ai-twin',
          name: 'Create AI Model Twin',
          method: 'POST',
          path: '/api/v1/manufacturing/digital-twin/create',
          description: 'Create a digital twin of your ML model',
          favorite: true
        },
        {
          id: 'twin-analytics',
          name: 'AI Twin Analytics',
          method: 'GET',
          path: '/api/v1/manufacturing/digital-twin/{id}/insights',
          description: 'Get comprehensive analytics for AI model twin'
        },
        {
          id: 'ai-twin-optimize',
          name: 'Optimize AI Parameters',
          method: 'POST',
          path: '/api/v1/manufacturing/digital-twin/{id}/optimize',
          description: 'Use digital twin optimization for hyperparameters'
        },
        {
          id: 'twin-synchronize',
          name: 'Synchronize Twin',
          method: 'PUT',
          path: '/api/v1/manufacturing/digital-twin/{id}/sync',
          description: 'Sync digital twin with real-world model'
        }
      ]
    },
    {
      id: 'dataset-marketplace',
      name: 'Dataset Marketplace',
      icon: <Database className="w-4 h-4" />,
      description: 'Dataset discovery, cataloging, and quality assessment',
      endpoints: [
        {
          id: 'catalog-dataset',
          name: 'Catalog Dataset',
          method: 'POST',
          path: '/api/v1/datasets/catalog',
          description: 'Register and catalog a new dataset'
        },
        {
          id: 'search-datasets',
          name: 'Search Datasets',
          method: 'GET',
          path: '/api/v1/datasets/search',
          description: 'Search and discover datasets with filtering'
        },
        {
          id: 'dataset-quality',
          name: 'Dataset Quality Assessment',
          method: 'GET',
          path: '/api/v1/datasets/{id}/quality',
          description: 'Get comprehensive quality analysis',
          favorite: true
        },
        {
          id: 'dataset-download',
          name: 'Download Dataset',
          method: 'GET',
          path: '/api/v1/datasets/{id}/download',
          description: 'Download dataset with authentication'
        },
        {
          id: 'dataset-lineage',
          name: 'Dataset Lineage',
          method: 'GET',
          path: '/api/v1/datasets/{id}/lineage',
          description: 'Track dataset lineage and transformations'
        }
      ]
    },
    {
      id: 'mlops',
      name: 'MLOps Platform',
      icon: <GitBranch className="w-4 h-4" />,
      description: 'End-to-end ML lifecycle management',
      endpoints: [
        {
          id: 'create-experiment',
          name: 'Create ML Experiment',
          method: 'POST',
          path: '/api/v1/experiments/create',
          description: 'Set up comprehensive ML experiment'
        },
        {
          id: 'experiment-metrics',
          name: 'Log Experiment Metrics',
          method: 'POST',
          path: '/api/v1/experiments/{id}/metrics',
          description: 'Log real-time experiment metrics'
        },
        {
          id: 'automated-retraining',
          name: 'Auto-Retraining Pipeline',
          method: 'POST',
          path: '/api/v1/retraining/advanced-pipeline',
          description: 'Create sophisticated retraining pipeline'
        },
        {
          id: 'model-comparison',
          name: 'Model Comparison',
          method: 'POST',
          path: '/api/v1/experiments/compare',
          description: 'Statistical comparison between models'
        },
        {
          id: 'experiment-insights',
          name: 'Experiment Insights',
          method: 'GET',
          path: '/api/v1/experiments/{id}/insights',
          description: 'AI-generated insights and recommendations',
          beta: true
        }
      ]
    },
    {
      id: 'realtime-streaming',
      name: 'Real-time Streaming',
      icon: <Zap className="w-4 h-4" />,
      description: 'Real-time AI inference and streaming',
      endpoints: [
        {
          id: 'realtime-stream-setup',
          name: 'Setup AI Stream',
          method: 'POST',
          path: '/api/v1/streaming/setup',
          description: 'Configure real-time data streaming'
        },
        {
          id: 'stream-analytics',
          name: 'Stream Analytics',
          method: 'GET',
          path: '/api/v1/streaming/{id}/metrics',
          description: 'Real-time streaming analytics'
        },
        {
          id: 'stream-scaling',
          name: 'Auto-scaling Config',
          method: 'PUT',
          path: '/api/v1/streaming/{id}/scaling',
          description: 'Configure auto-scaling parameters'
        }
      ]
    },
    {
      id: 'model-serving',
      name: 'Enhanced Model Serving',
      icon: <Brain className="w-4 h-4" />,
      description: 'Enterprise model deployment and serving',
      endpoints: [
        {
          id: 'advanced-model-serving',
          name: 'Enterprise Deployment',
          method: 'POST',
          path: '/api/v1/serving/enterprise-deploy',
          description: 'Deploy models with advanced features'
        },
        {
          id: 'model-explainability',
          name: 'Model Explainability',
          method: 'POST',
          path: '/api/v1/serving/{id}/explain',
          description: 'Generate model explanations and insights'
        },
        {
          id: 'ab-testing',
          name: 'A/B Testing',
          method: 'POST',
          path: '/api/v1/serving/{id}/ab-test',
          description: 'Configure A/B testing for model versions'
        },
        {
          id: 'model-monitoring',
          name: 'Model Monitoring',
          method: 'GET',
          path: '/api/v1/serving/{id}/monitor',
          description: 'Real-time model performance monitoring'
        }
      ]
    },
    {
      id: 'security-compliance',
      name: 'Security & Compliance',
      icon: <Shield className="w-4 h-4" />,
      description: 'Security, audit, and compliance features',
      endpoints: [
        {
          id: 'audit-logs',
          name: 'Audit Logs',
          method: 'GET',
          path: '/api/v1/security/audit-logs',
          description: 'Access detailed audit logs'
        },
        {
          id: 'api-keys',
          name: 'API Key Management',
          method: 'GET',
          path: '/api/v1/security/api-keys',
          description: 'Manage API keys and permissions'
        },
        {
          id: 'compliance-report',
          name: 'Compliance Reports',
          method: 'GET',
          path: '/api/v1/security/compliance',
          description: 'Generate compliance reports'
        }
      ]
    }
  ]

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const filteredCategories = apiCategories.map(category => ({
    ...category,
    endpoints: category.endpoints.filter(endpoint =>
      endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.endpoints.length > 0 || searchQuery === '')

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
      <div className="w-16 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 space-y-4">
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {apiCategories.slice(0, 4).map((category) => (
          <div
            key={category.id}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
            title={category.name}
          >
            {category.icon}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            AI Company APIs
          </h2>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors"
          >
            <ChevronDown className="w-4 h-4 rotate-90" />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Quick Filters */}
        <div className="flex items-center space-x-2 mt-3">
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`flex items-center space-x-1 px-2 py-1 text-xs rounded-full transition-colors ${
              showFavorites 
                ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            <Star className="w-3 h-3" />
            <span>Favorites</span>
          </button>
          <button className="flex items-center space-x-1 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
            <History className="w-3 h-3" />
            <span>Recent</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Recent Endpoints */}
        {recentEndpoints.length > 0 && !searchQuery && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
              <History className="w-4 h-4 mr-2" />
              Recently Used
            </h3>
            <div className="space-y-1">
              {recentEndpoints.slice(0, 3).map((endpointId) => {
                const endpoint = apiCategories
                  .flatMap(cat => cat.endpoints)
                  .find(ep => ep.id === endpointId)
                
                if (!endpoint) return null

                return (
                  <button
                    key={endpoint.id}
                    onClick={() => onEndpointSelect(endpoint)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedEndpoint?.id === endpoint.id
                        ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">{endpoint.name}</span>
                      <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                        {endpoint.method}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* API Categories */}
        <div className="p-4 space-y-2">
          {filteredCategories.map((category) => (
            <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg">
              {/* Category Header */}
              <button
                onClick={() => toggleCategory(category.id)}
                className="w-full px-4 py-3 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors rounded-t-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="text-purple-600 dark:text-purple-400">
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {category.name}
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {category.endpoints.length} endpoints
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                    {category.endpoints.length}
                  </span>
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Category Endpoints */}
              {expandedCategories.has(category.id) && (
                <div className="border-t border-gray-200 dark:border-gray-700">
                  {category.endpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => onEndpointSelect(endpoint)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-100 dark:border-gray-600 last:border-b-0 transition-colors ${
                        selectedEndpoint?.id === endpoint.id
                          ? 'bg-purple-50 border-l-4 border-l-purple-500 dark:bg-purple-900/20'
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                            {endpoint.method}
                          </span>
                          {endpoint.favorite && (
                            <Star className="w-3 h-3 text-yellow-500 fill-current" />
                          )}
                          {endpoint.beta && (
                            <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                              BETA
                            </span>
                          )}
                          {endpoint.deprecated && (
                            <span className="px-1.5 py-0.5 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                              DEPRECATED
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-1 text-sm">
                        {endpoint.name}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                        {endpoint.description}
                      </p>
                      <code className="text-xs text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20 px-2 py-1 rounded">
                        {endpoint.path}
                      </code>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer Stats */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
        <div className="text-center">
          <div className="text-sm font-medium text-gray-900 dark:text-white">
            {apiCategories.reduce((acc, cat) => acc + cat.endpoints.length, 0)} Total Endpoints
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Across {apiCategories.length} categories
          </div>
        </div>
      </div>
    </div>
  )
}