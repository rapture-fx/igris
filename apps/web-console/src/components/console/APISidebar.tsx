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
  Key,
  HardDrive,
  ScanText,
  CheckCircle,
  BarChart3,
  Users,
  Bell,
  Moon,
  HelpCircle
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
    new Set()
  )
  const [showFavorites, setShowFavorites] = useState(false)

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

  return (
    <div className="flex h-screen">
      {/* Left Column - Category Icons */}
      <div className="flex flex-col w-16 border-r border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
        {/* Logo at top */}
        <div className="pt-4 pb-6 px-2">
          <a href="/" className="block">
            <img
              src="/Docs Schlep-engne.svg?t=1725657600000"
              alt="Schlep Engine"
              className="h-8 w-auto cursor-pointer mx-auto"
            />
          </a>
        </div>

        {/* Category Icons */}
        <div className="flex-1 flex flex-col items-center space-y-2 overflow-y-auto scrollbar-thin">
          {apiCategories.map((category) => (
            <button
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className={`p-3 rounded-lg transition-all duration-150 group relative ${
                expandedCategories.has(category.id)
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:bg-gray-200'
              }`}
              title={category.name}
            >
              {category.icon}
              {/* Tooltip */}
              <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10">
                {category.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Right Column - Navigation Content */}
      <div className="flex flex-col w-80 h-screen bg-white border-r border-gray-300">
        <div className="flex-1 flex flex-col overflow-y-auto scrollbar-thin">
          {/* Search Bar */}
          <div className="px-4 pt-6 pb-4 border-b border-gray-200">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search APIs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Content */}
          <nav className="px-4 py-4 space-y-1">
          {filteredCategories
            .filter(category => expandedCategories.has(category.id))
            .map((category) => (
              <div key={category.id} className="mb-6">
                {/* Category Title */}
                <h3 className="text-sm font-semibold text-gray-900 mb-3 break-words">
                  {category.name}
                </h3>

                {/* Category Endpoints */}
                <div className="space-y-2">
                  {category.endpoints.map((endpoint) => (
                    <button
                      key={endpoint.id}
                      onClick={() => onEndpointSelect(endpoint)}
                      className={`w-full text-left px-3 py-2 rounded-lg transition-all duration-150 hover:bg-gray-50 ${
                        selectedEndpoint?.id === endpoint.id ? 'bg-blue-50 border-l-2 border-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${getMethodColor(endpoint.method)}`}>
                          {endpoint.method}
                        </span>

                        {endpoint.beta && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                            BETA
                          </span>
                        )}
                        {endpoint.deprecated && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                            DEPRECATED
                          </span>
                        )}
                        {endpoint.favorite && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                      <h4 className="font-medium text-gray-700 mb-1 text-sm">
                        {endpoint.name}
                      </h4>
                      <p className="text-xs text-gray-600 mb-2 line-clamp-2">
                        {endpoint.description}
                      </p>
                      <code className="text-xs text-blue-600 break-all">
                        {endpoint.path}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center justify-around">
            <button
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100 relative"
              title="Notifications"
            >
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>

            <button
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
              title="Toggle theme"
            >
              <Moon className="w-5 h-5" />
            </button>

            <button
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
              title="Help"
            >
              <HelpCircle className="w-5 h-5" />
            </button>

            <button
              className="p-2 text-gray-600 hover:text-gray-900 transition-colors rounded-lg hover:bg-gray-100"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}