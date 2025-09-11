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
  History,
  Key,
  HardDrive,
  ScanText,
  CheckCircle,
  BarChart3,
  Users
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
    new Set(['authentication', 'storage', 'data-quality', 'advanced-ml'])
  )
  const [showFavorites, setShowFavorites] = useState(false)
  const [recentEndpoints] = useState<string[]>(['login', 'upload-file', 'quality-assessment', 'custom-training'])

  const apiCategories: APICategory[] = [
    {
      id: 'authentication',
      name: 'Authentication & Users',
      icon: <Key className="w-4 h-4" />,
      description: 'User management, API keys, and authentication services',
      endpoints: [
        {
          id: 'login',
          name: 'User Login',
          method: 'POST',
          path: '/api/v1/auth/login',
          description: 'Authenticate user and get access token',
          favorite: true
        },
        {
          id: 'register',
          name: 'User Registration',
          method: 'POST',
          path: '/api/v1/auth/register',
          description: 'Register new user account'
        },
        {
          id: 'api-keys',
          name: 'Manage API Keys',
          method: 'GET',
          path: '/api/v1/auth/api-keys',
          description: 'List and manage API keys'
        },
        {
          id: 'user-profile',
          name: 'User Profile',
          method: 'GET',
          path: '/api/v1/users/profile',
          description: 'Get current user profile information'
        },
        {
          id: 'update-profile',
          name: 'Update Profile',
          method: 'PUT',
          path: '/api/v1/users/profile',
          description: 'Update user profile settings'
        }
      ]
    },
    {
      id: 'storage',
      name: 'Storage & File Management',
      icon: <HardDrive className="w-4 h-4" />,
      description: 'Data storage, file management, and model artifact storage',
      endpoints: [
        {
          id: 'upload-file',
          name: 'Upload File',
          method: 'POST',
          path: '/api/v1/storage/upload',
          description: 'Upload files and datasets to storage',
          favorite: true
        },
        {
          id: 'list-files',
          name: 'List Files',
          method: 'GET',
          path: '/api/v1/storage/files',
          description: 'List stored files and datasets'
        },
        {
          id: 'download-file',
          name: 'Download File',
          method: 'GET',
          path: '/api/v1/storage/files/{id}/download',
          description: 'Download stored files and datasets'
        },
        {
          id: 'delete-file',
          name: 'Delete File',
          method: 'DELETE',
          path: '/api/v1/storage/files/{id}',
          description: 'Delete files from storage'
        },
        {
          id: 'storage-usage',
          name: 'Storage Usage',
          method: 'GET',
          path: '/api/v1/storage/usage',
          description: 'Get storage usage statistics'
        }
      ]
    },
    {
      id: 'document-extraction',
      name: 'Document Extraction',
      icon: <ScanText className="w-4 h-4" />,
      description: 'Extract and process data from documents and PDFs',
      endpoints: [
        {
          id: 'extract-pdf',
          name: 'Extract PDF Data',
          method: 'POST',
          path: '/api/v1/extract/pdf',
          description: 'Extract structured data from PDF documents',
          favorite: true
        },
        {
          id: 'extract-text',
          name: 'Extract Text',
          method: 'POST',
          path: '/api/v1/extract/text',
          description: 'Extract plain text from various document formats'
        },
        {
          id: 'extract-tables',
          name: 'Extract Tables',
          method: 'POST',
          path: '/api/v1/extract/tables',
          description: 'Extract tabular data from documents'
        },
        {
          id: 'extract-metadata',
          name: 'Extract Metadata',
          method: 'POST',
          path: '/api/v1/extract/metadata',
          description: 'Extract document metadata and properties'
        },
        {
          id: 'batch-extraction',
          name: 'Batch Extraction',
          method: 'POST',
          path: '/api/v1/extract/batch',
          description: 'Process multiple documents in batch'
        }
      ]
    },
    {
      id: 'data-quality',
      name: 'Data Quality & Preparation',
      icon: <CheckCircle className="w-4 h-4" />,
      description: 'Data validation, cleaning, and quality assessment',
      endpoints: [
        {
          id: 'quality-assessment',
          name: 'Quality Assessment',
          method: 'POST',
          path: '/api/v1/quality/assess',
          description: 'Comprehensive data quality analysis',
          favorite: true
        },
        {
          id: 'data-cleaning',
          name: 'Data Cleaning',
          method: 'POST',
          path: '/api/v1/quality/clean',
          description: 'Automated data cleaning and preparation'
        },
        {
          id: 'schema-validation',
          name: 'Schema Validation',
          method: 'POST',
          path: '/api/v1/quality/validate-schema',
          description: 'Validate data against expected schema'
        },
        {
          id: 'anomaly-detection',
          name: 'Anomaly Detection',
          method: 'POST',
          path: '/api/v1/quality/anomalies',
          description: 'Detect anomalies and outliers in data'
        },
        {
          id: 'data-profiling',
          name: 'Data Profiling',
          method: 'POST',
          path: '/api/v1/quality/profile',
          description: 'Generate comprehensive data profiles'
        }
      ]
    },
    {
      id: 'advanced-ml',
      name: 'Advanced ML',
      icon: <Brain className="w-4 h-4" />,
      description: 'Custom model training and advanced machine learning',
      endpoints: [
        {
          id: 'custom-training',
          name: 'Custom Model Training',
          method: 'POST',
          path: '/api/v1/advanced-ml/train',
          description: 'Train custom ML models with your data',
          favorite: true
        },
        {
          id: 'model-evaluation',
          name: 'Model Evaluation',
          method: 'POST',
          path: '/api/v1/advanced-ml/evaluate',
          description: 'Evaluate model performance and metrics'
        },
        {
          id: 'feature-engineering',
          name: 'Feature Engineering',
          method: 'POST',
          path: '/api/v1/advanced-ml/features',
          description: 'Automated feature engineering and selection'
        },
        {
          id: 'model-comparison',
          name: 'Model Comparison',
          method: 'POST',
          path: '/api/v1/advanced-ml/compare',
          description: 'Compare multiple models statistically'
        },
        {
          id: 'ensemble-methods',
          name: 'Ensemble Methods',
          method: 'POST',
          path: '/api/v1/advanced-ml/ensemble',
          description: 'Create ensemble models for better performance'
        }
      ]
    },
    {
      id: 'analytics-monitoring',
      name: 'Analytics & Monitoring',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Usage analytics, performance monitoring, and insights',
      endpoints: [
        {
          id: 'usage-analytics',
          name: 'Usage Analytics',
          method: 'GET',
          path: '/api/v1/analytics/usage',
          description: 'Get detailed API usage analytics',
          favorite: true
        },
        {
          id: 'performance-metrics',
          name: 'Performance Metrics',
          method: 'GET',
          path: '/api/v1/analytics/performance',
          description: 'Monitor API performance and response times'
        },
        {
          id: 'error-tracking',
          name: 'Error Tracking',
          method: 'GET',
          path: '/api/v1/analytics/errors',
          description: 'Track and analyze API errors'
        },
        {
          id: 'custom-dashboards',
          name: 'Custom Dashboards',
          method: 'POST',
          path: '/api/v1/analytics/dashboards',
          description: 'Create custom analytics dashboards'
        },
        {
          id: 'alerts-notifications',
          name: 'Alerts & Notifications',
          method: 'POST',
          path: '/api/v1/analytics/alerts',
          description: 'Set up monitoring alerts and notifications'
        }
      ]
    },
    {
      id: 'data-ingestion',
      name: 'Data Ingestion & ETL',
      icon: <Database className="w-4 h-4" />,
      description: 'High-volume data processing and transformation pipelines',
      endpoints: [
        {
          id: 'batch-upload',
          name: 'Batch Data Upload',
          method: 'POST',
          path: '/api/v1/data/batch/upload',
          description: 'Upload large datasets for batch processing',
          favorite: true
        },
        {
          id: 'streaming-ingest',
          name: 'Real-time Ingestion',
          method: 'POST',
          path: '/api/v1/data/stream/ingest',
          description: 'Set up real-time data streaming pipelines'
        },
        {
          id: 'data-transform',
          name: 'Data Transformation',
          method: 'POST',
          path: '/api/v1/data/transform',
          description: 'Apply transformations and feature engineering'
        },
        {
          id: 'pipeline-status',
          name: 'Pipeline Status',
          method: 'GET',
          path: '/api/v1/data/pipeline/{id}/status',
          description: 'Monitor data processing pipeline status'
        },
        {
          id: 'data-validation',
          name: 'Data Validation',
          method: 'POST',
          path: '/api/v1/data/validate',
          description: 'Validate data quality and schema compliance'
        }
      ]
    },
    {
      id: 'labeling-annotation',
      name: 'Data Labeling & Annotation',
      icon: <FileText className="w-4 h-4" />,
      description: 'Automated and human-assisted data labeling services',
      endpoints: [
        {
          id: 'auto-label',
          name: 'Auto-Labeling',
          method: 'POST',
          path: '/api/v1/labeling/auto-label',
          description: 'Automatically label data using ML models'
        },
        {
          id: 'human-annotation',
          name: 'Human Annotation',
          method: 'POST',
          path: '/api/v1/labeling/human-annotation',
          description: 'Create human annotation projects'
        },
        {
          id: 'label-quality',
          name: 'Label Quality Check',
          method: 'GET',
          path: '/api/v1/labeling/{id}/quality',
          description: 'Assess annotation quality and consistency'
        },
        {
          id: 'annotation-export',
          name: 'Export Annotations',
          method: 'GET',
          path: '/api/v1/labeling/{id}/export',
          description: 'Export labeled data in various formats'
        }
      ]
    },
    {
      id: 'training-infrastructure',
      name: 'Training Infrastructure',
      icon: <Bot className="w-4 h-4" />,
      description: 'Scalable ML training on distributed compute clusters',
      endpoints: [
        {
          id: 'training-job',
          name: 'Create Training Job',
          method: 'POST',
          path: '/api/v1/training/jobs/create',
          description: 'Launch distributed training jobs'
        },
        {
          id: 'gpu-cluster',
          name: 'GPU Cluster Status',
          method: 'GET',
          path: '/api/v1/training/cluster/status',
          description: 'Monitor GPU cluster availability and usage'
        },
        {
          id: 'hyperparameter-tuning',
          name: 'Hyperparameter Tuning',
          method: 'POST',
          path: '/api/v1/training/hyperparameter-tuning',
          description: 'Automated hyperparameter optimization'
        },
        {
          id: 'training-metrics',
          name: 'Training Metrics',
          method: 'GET',
          path: '/api/v1/training/jobs/{id}/metrics',
          description: 'Real-time training progress and metrics'
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