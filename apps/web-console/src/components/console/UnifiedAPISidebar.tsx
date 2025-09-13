'use client'

import React, { useState, useMemo } from 'react'
import { 
  ChevronRight, 
  ChevronDown,
  Search,
  Filter,
  Star,
  Clock,
  Globe,
  Key,
  HardDrive,
  ScanText,
  CheckCircle,
  BarChart3,
  Brain,
  Database,
  FileText,
  Bot,
  GitBranch,
  Zap,
  Shield,
  Cpu,
  Factory,
  ShoppingCart,
  Building2,
  Layers,
  Target,
  TrendingUp,
  AlertTriangle,
  Network,
  Camera,
  Gauge,
  Package,
  CreditCard,
  UserCheck,
  FileCheck,
  Microscope
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

interface APICategory {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  industry: Industry[]
  endpoints: APIEndpoint[]
  expanded?: boolean
}

interface UnifiedAPISidebarProps {
  selectedIndustry: Industry | 'all'
  searchQuery: string
  onSearchChange: (query: string) => void
  onEndpointSelect: (endpoint: APIEndpoint) => void
  selectedEndpoint?: APIEndpoint
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function UnifiedAPISidebar({ 
  selectedIndustry,
  searchQuery,
  onSearchChange,
  onEndpointSelect, 
  selectedEndpoint, 
  collapsed = false, 
  onToggleCollapse 
}: UnifiedAPISidebarProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['core-apis']) // Expand core APIs by default
  )
  const [showFavorites, setShowFavorites] = useState(false)

  // SCHLEP-ENGINE: API-FIRST ML DATA PREPARATION PLATFORM
  // Vision: "Messy data to ML-ready in API calls"
  const apiCategories: APICategory[] = [
    {
      id: 'ml-preparation',
      name: 'ML Data Preparation',
      icon: <Cpu className="w-4 h-4" />,
      description: 'Core ML preparation pipeline: Upload messy data → Get ML-ready datasets for TensorFlow, PyTorch, scikit-learn',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'create-ml-pipeline',
          name: 'Create ML Pipeline',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines',
          description: 'Upload dataset and create automated ML preparation pipeline with quality controls',
          industry: 'ai',
          tags: ['upload', 'ml-ready', 'pipeline']
        },
        {
          id: 'execute-ml-pipeline',
          name: 'Execute ML Pipeline',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines/{pipeline_id}/execute',
          description: 'Execute complete data prep workflow: profiling → cleaning → transformation → ML export',
          industry: 'ai',
          tags: ['execution', 'processing', 'ml-ready']
        },
        {
          id: 'list-ml-pipelines',
          name: 'List ML Pipelines',
          method: 'GET',
          path: '/api/v1/ml-preparation/pipelines',
          description: 'List ML preparation pipelines with quality scores and ML-ready status',
          industry: 'ai',
          tags: ['list', 'status', 'quality']
        },
        {
          id: 'get-ml-pipeline',
          name: 'Get ML Pipeline Details',
          method: 'GET',
          path: '/api/v1/ml-preparation/pipelines/{pipeline_id}',
          description: 'Get detailed ML pipeline info including quality score and framework readiness',
          industry: 'ai',
          tags: ['details', 'quality', 'ml-ready']
        },
        {
          id: 'quality-assessment',
          name: 'Quality Assessment',
          method: 'GET',
          path: '/api/v1/ml-preparation/pipelines/{pipeline_id}/quality',
          description: 'Get detailed quality assessment: completeness, validity, consistency scores',
          industry: 'ai',
          tags: ['quality', 'assessment', 'scores']
        },
        {
          id: 'export-framework',
          name: 'Export to ML Framework',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines/{pipeline_id}/export/{framework_type}',
          description: 'Export ML-ready data to specific framework (TensorFlow, PyTorch, scikit-learn, etc.)',
          industry: 'ai',
          tags: ['export', 'framework', 'ml-ready']
        },
        {
          id: 'supported-frameworks',
          name: 'Supported ML Frameworks',
          method: 'GET',
          path: '/api/v1/ml-preparation/frameworks',
          description: 'List all supported ML frameworks: TensorFlow, PyTorch, Hugging Face, XGBoost, LightGBM',
          industry: 'ai',
          tags: ['frameworks', 'support', 'formats']
        },
        {
          id: 'pipeline-steps',
          name: 'Pipeline Execution Steps',
          method: 'GET',
          path: '/api/v1/ml-preparation/pipelines/{pipeline_id}/steps',
          description: 'Get detailed step-by-step execution info with quality improvements',
          industry: 'ai',
          tags: ['steps', 'execution', 'details']
        },
        {
          id: 'manufacturing-pipeline',
          name: 'Manufacturing IoT Pipeline',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines',
          description: 'Process manufacturing IoT data for production analytics and equipment monitoring',
          industry: 'manufacturing',
          tags: ['iot', 'manufacturing', 'analytics']
        },
        {
          id: 'ecommerce-pipeline',
          name: 'E-commerce Data Pipeline',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines',
          description: 'Process customer and transaction data for e-commerce business intelligence',
          industry: 'ecommerce',
          tags: ['customer', 'transactions', 'business-intelligence']
        },
        {
          id: 'fintech-pipeline',
          name: 'FinTech Risk Pipeline',
          method: 'POST',
          path: '/api/v1/ml-preparation/pipelines',
          description: 'Process financial data for risk assessment and compliance reporting',
          industry: 'fintech',
          tags: ['risk', 'compliance', 'financial']
        }
      ]
    },
    {
      id: 'data-quality',
      name: 'Data Quality Assessment',
      icon: <CheckCircle className="w-4 h-4" />,
      description: 'Comprehensive data quality analysis: duplicates, missing values, outliers, bias detection',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'assess-quality',
          name: 'Assess Data Quality',
          method: 'POST',
          path: '/api/v1/data-quality/assess',
          description: 'Upload file and get comprehensive quality assessment with recommendations',
          industry: 'ai',
          tags: ['upload', 'quality', 'assessment']
        },
        {
          id: 'auto-clean',
          name: 'Auto Clean Data',
          method: 'POST',
          path: '/api/v1/data-quality/clean/auto',
          description: 'Automatically clean data: remove duplicates, handle missing values, detect outliers',
          industry: 'ai',
          tags: ['upload', 'cleaning', 'auto']
        },
        {
          id: 'feature-engineering',
          name: 'Feature Engineering',
          method: 'POST',
          path: '/api/v1/data-quality/feature-engineering',
          description: 'Advanced feature engineering and transformation for ML readiness',
          industry: 'ai',
          tags: ['upload', 'features', 'engineering']
        },
        {
          id: 'manufacturing-quality',
          name: 'Manufacturing Quality Check',
          method: 'POST',
          path: '/api/v1/data-quality/assess',
          description: 'Quality assessment for manufacturing IoT sensor data and production metrics',
          industry: 'manufacturing',
          tags: ['iot', 'sensors', 'quality']
        },
        {
          id: 'ecommerce-quality',
          name: 'E-commerce Data Quality',
          method: 'POST',
          path: '/api/v1/data-quality/assess',
          description: 'Quality assessment for customer data, transactions, and product catalogs',
          industry: 'ecommerce',
          tags: ['customer', 'transactions', 'quality']
        },
        {
          id: 'fintech-quality',
          name: 'Financial Data Quality',
          method: 'POST',
          path: '/api/v1/data-quality/assess',
          description: 'Quality assessment for financial data with compliance and risk validation',
          industry: 'fintech',
          tags: ['financial', 'compliance', 'quality']
        },
        {
          id: 'list-assessments',
          name: 'List Quality Assessments',
          method: 'GET',
          path: '/api/v1/data-quality/assessments',
          description: 'List previous data quality assessments with scores and recommendations',
          industry: 'ai',
          tags: ['list', 'history', 'quality']
        },
        {
          id: 'download-processed',
          name: 'Download Processed Data',
          method: 'GET',
          path: '/api/v1/data-quality/download/{processing_id}',
          description: 'Download cleaned, processed, ML-ready dataset',
          industry: 'ai',
          tags: ['download', 'processed', 'ml-ready']
        }
      ]
    },
    {
      id: 'data-pipeline',
      name: 'Data Pipeline & Investigations',
      icon: <Database className="w-4 h-4" />,
      description: 'Core data processing pipeline: Upload → Process → Results → Insights',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'upload-data',
          name: 'Upload Data File',
          method: 'POST',
          path: '/api/v1/data/upload',
          description: 'Upload data file and create investigation. Supports CSV, JSON, Excel, Parquet, TXT',
          industry: 'ai',
          tags: ['upload', 'investigation', 'data']
        },
        {
          id: 'upload-manufacturing-data',
          name: 'Upload Manufacturing Data',
          method: 'POST',
          path: '/api/v1/data/upload',
          description: 'Upload IoT sensor data, production logs, and equipment metrics for analysis',
          industry: 'manufacturing',
          tags: ['upload', 'iot', 'manufacturing']
        },
        {
          id: 'upload-ecommerce-data',
          name: 'Upload E-commerce Data',
          method: 'POST',
          path: '/api/v1/data/upload',
          description: 'Upload customer data, transaction logs, and product catalogs',
          industry: 'ecommerce',
          tags: ['upload', 'customer', 'transactions']
        },
        {
          id: 'upload-financial-data',
          name: 'Upload Financial Data',
          method: 'POST',
          path: '/api/v1/data/upload',
          description: 'Upload financial transaction data, compliance reports, and risk assessments',
          industry: 'fintech',
          tags: ['upload', 'financial', 'compliance']
        },
        {
          id: 'list-investigations',
          name: 'List Investigations',
          method: 'GET',
          path: '/api/v1/data/investigations',
          description: 'List all data investigations with status, progress, and quality scores',
          industry: 'ai',
          tags: ['list', 'investigations', 'status']
        },
        {
          id: 'get-investigation',
          name: 'Get Investigation Results',
          method: 'GET',
          path: '/api/v1/data/investigations/{investigation_id}',
          description: 'Get detailed results: insights, patterns, anomalies, recommendations',
          industry: 'ai',
          tags: ['results', 'insights', 'investigation']
        },
        {
          id: 'reprocess-investigation',
          name: 'Reprocess Investigation',
          method: 'POST',
          path: '/api/v1/data/investigations/{investigation_id}/reprocess',
          description: 'Reprocess investigation with new options for different ML frameworks',
          industry: 'ai',
          tags: ['reprocess', 'investigation', 'options']
        },
        {
          id: 'manufacturing-insights',
          name: 'Manufacturing Insights',
          method: 'GET',
          path: '/api/v1/data/quick-insights/{investigation_id}',
          description: 'Real-time production insights, equipment health, and efficiency metrics',
          industry: 'manufacturing',
          tags: ['manufacturing', 'insights', 'efficiency']
        },
        {
          id: 'ecommerce-insights',
          name: 'E-commerce Insights',
          method: 'GET',
          path: '/api/v1/data/quick-insights/{investigation_id}',
          description: 'Customer behavior insights, sales patterns, and conversion analytics',
          industry: 'ecommerce',
          tags: ['ecommerce', 'insights', 'conversion']
        },
        {
          id: 'fintech-insights',
          name: 'Financial Insights',
          method: 'GET',
          path: '/api/v1/data/quick-insights/{investigation_id}',
          description: 'Risk analysis, fraud detection, and compliance monitoring insights',
          industry: 'fintech',
          tags: ['fintech', 'risk', 'fraud']
        },
        {
          id: 'delete-investigation',
          name: 'Delete Investigation',
          method: 'DELETE',
          path: '/api/v1/data/investigations/{investigation_id}',
          description: 'Delete investigation and associated processed files',
          industry: 'ai',
          tags: ['delete', 'cleanup', 'investigation']
        },
        {
          id: 'pipeline-stats',
          name: 'Pipeline Statistics',
          method: 'GET',
          path: '/api/v1/data/pipelines/stats',
          description: 'Get pipeline stats: active, completed, failed processing jobs',
          industry: 'ai',
          tags: ['stats', 'monitoring', 'pipeline']
        },
        {
          id: 'quick-insights',
          name: 'Quick Insights',
          method: 'GET',
          path: '/api/v1/data/quick-insights/{investigation_id}',
          description: 'Get real-time insights for dashboard updates and progress tracking',
          industry: 'ai',
          tags: ['insights', 'realtime', 'dashboard']
        }
      ]
    },
    {
      id: 'advanced-ml',
      name: 'Advanced ML & AI',
      icon: <Brain className="w-4 h-4" />,
      description: 'Enterprise-grade ML model training, prediction, and anomaly detection capabilities',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'train-model',
          name: 'Train ML Model',
          method: 'POST',
          path: '/api/v1/ml/train-model',
          description: 'Train custom ML models with advanced algorithms',
          industry: 'ai',
          tags: ['ml', 'training', 'models']
        },
        {
          id: 'manufacturing-anomaly-detection',
          name: 'Manufacturing Anomaly Detection',
          method: 'POST',
          path: '/api/v1/ml/detect-anomalies',
          description: 'Detect equipment anomalies and production irregularities in real-time',
          industry: 'manufacturing',
          tags: ['manufacturing', 'anomalies', 'equipment']
        },
        {
          id: 'ecommerce-predictions',
          name: 'E-commerce Predictions',
          method: 'POST',
          path: '/api/v1/ml/predict',
          description: 'Predict customer behavior, demand forecasting, and personalization',
          industry: 'ecommerce',
          tags: ['ecommerce', 'prediction', 'customers']
        },
        {
          id: 'fraud-detection',
          name: 'Fraud Detection Model',
          method: 'POST',
          path: '/api/v1/ml/detect-anomalies',
          description: 'Real-time fraud detection and risk assessment for financial transactions',
          industry: 'fintech',
          tags: ['fintech', 'fraud', 'risk']
        },
        {
          id: 'model-stats',
          name: 'Model Statistics',
          method: 'GET',
          path: '/api/v1/ml/models/stats',
          description: 'Get comprehensive ML model performance statistics',
          industry: 'ai',
          tags: ['ml', 'statistics', 'performance']
        },
        {
          id: 'list-models',
          name: 'List ML Models',
          method: 'GET',
          path: '/api/v1/ml/models',
          description: 'List all trained ML models with metadata',
          industry: 'ai',
          tags: ['ml', 'models', 'list']
        },
        {
          id: 'predict',
          name: 'Make Predictions',
          method: 'POST',
          path: '/api/v1/ml/predict',
          description: 'Generate predictions using trained ML models',
          industry: 'ai',
          tags: ['ml', 'prediction', 'inference']
        },
        {
          id: 'detect-anomalies',
          name: 'Anomaly Detection',
          method: 'POST',
          path: '/api/v1/ml/detect-anomalies',
          description: 'Advanced anomaly detection using multiple algorithms',
          industry: 'ai',
          tags: ['ml', 'anomalies', 'detection']
        },
        {
          id: 'model-insights',
          name: 'Model Insights',
          method: 'GET',
          path: '/api/v1/ml/insights/{model_name}',
          description: 'Get detailed insights and explanations for ML models',
          industry: 'ai',
          tags: ['ml', 'insights', 'explainability']
        },
        {
          id: 'model-status',
          name: 'Model Status',
          method: 'GET',
          path: '/api/v1/ml/model-status/{model_name}',
          description: 'Check training status and health of ML models',
          industry: 'ai',
          tags: ['ml', 'status', 'monitoring']
        }
      ]
    },
    {
      id: 'unified-pipeline',
      name: 'Unified Processing Pipeline',
      icon: <Layers className="w-4 h-4" />,
      description: 'Advanced pipeline system supporting files, databases, APIs, and cloud storage with real-time progress',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'create-pipeline',
          name: 'Create Pipeline',
          method: 'POST',
          path: '/api/v1/pipelines/create',
          description: 'Create comprehensive pipeline for any data source with AI analysis and ML preparation',
          industry: 'ai',
          tags: ['pipeline', 'create', 'multi-source']
        },
        {
          id: 'upload-and-create',
          name: 'Upload File & Create Pipeline',
          method: 'POST',
          path: '/api/v1/pipelines/upload-and-create',
          description: 'Upload file and immediately create processing pipeline (multipart/form-data)',
          industry: 'ai',
          tags: ['upload', 'pipeline', 'multipart']
        },
        {
          id: 'execute-pipeline',
          name: 'Execute Pipeline',
          method: 'POST',
          path: '/api/v1/pipelines/{pipeline_id}/execute',
          description: 'Execute pipeline in background or synchronously with webhook notifications',
          industry: 'ai',
          tags: ['execute', 'background', 'webhooks']
        },
        {
          id: 'pipeline-status',
          name: 'Get Pipeline Status',
          method: 'GET',
          path: '/api/v1/pipelines/{pipeline_id}/status',
          description: 'Real-time pipeline status with progress, quality scores, and framework exports',
          industry: 'ai',
          tags: ['status', 'progress', 'real-time']
        },
        {
          id: 'list-pipelines',
          name: 'List Pipelines',
          method: 'GET',
          path: '/api/v1/pipelines/list',
          description: 'List pipelines with filtering by workspace, status, and pagination',
          industry: 'ai',
          tags: ['list', 'filter', 'pagination']
        },
        {
          id: 'cancel-pipeline',
          name: 'Cancel Pipeline',
          method: 'DELETE',
          path: '/api/v1/pipelines/{pipeline_id}',
          description: 'Cancel running pipeline and clean up resources',
          industry: 'ai',
          tags: ['cancel', 'cleanup', 'resources']
        },
        {
          id: 'bulk-create',
          name: 'Bulk Create Pipelines',
          method: 'POST',
          path: '/api/v1/pipelines/bulk/create',
          description: 'Create up to 100 pipelines at once for batch processing',
          industry: 'ai',
          tags: ['bulk', 'batch', 'create']
        },
        {
          id: 'pipeline-metrics',
          name: 'Pipeline Metrics',
          method: 'GET',
          path: '/api/v1/pipelines/metrics',
          description: 'Performance metrics and statistics for pipeline system',
          industry: 'ai',
          tags: ['metrics', 'performance', 'stats']
        },
        {
          id: 'stream-progress',
          name: 'Stream Progress',
          method: 'GET',
          path: '/api/v1/pipelines/{pipeline_id}/progress-stream',
          description: 'Real-time progress updates via Server-Sent Events (SSE)',
          industry: 'ai',
          tags: ['stream', 'sse', 'real-time']
        }
      ]
    },
    {
      id: 'streaming-data',
      name: 'Streaming Data Processing',
      icon: <Zap className="w-4 h-4" />,
      description: 'Advanced streaming system for large datasets with memory optimization and real-time WebSocket updates',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'stream-upload',
          name: 'Initiate Streaming Upload',
          method: 'POST',
          path: '/api/v1/data-streaming/stream/upload',
          description: 'Start streaming processing of large files (up to 10GB) with real-time progress',
          industry: 'ai',
          tags: ['stream', 'upload', 'large-files']
        },
        {
          id: 'stream-progress-ws',
          name: 'WebSocket Progress Updates',
          method: 'GET',
          path: '/ws/stream/progress/{job_id}',
          description: 'Real-time progress updates via WebSocket for streaming jobs',
          industry: 'ai',
          tags: ['websocket', 'progress', 'real-time']
        },
        {
          id: 'stream-status',
          name: 'Get Streaming Status',
          method: 'GET',
          path: '/api/v1/data-streaming/stream/status/{job_id}',
          description: 'Current status of streaming job with chunk progress and insights',
          industry: 'ai',
          tags: ['status', 'streaming', 'chunks']
        },
        {
          id: 'stream-results',
          name: 'Get Streaming Results',
          method: 'GET',
          path: '/api/v1/data-streaming/stream/results/{job_id}',
          description: 'Retrieve chunk-specific or consolidated streaming results',
          industry: 'ai',
          tags: ['results', 'chunks', 'consolidated']
        }
      ]
    },
    {
      id: 'integrations',
      name: 'Data Integrations',
      icon: <Network className="w-4 h-4" />,
      description: 'Database, cloud storage, API, and real-time streaming integrations',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'connect-database',
          name: 'Database Connection',
          method: 'POST',
          path: '/api/v1/integrations/database/connect',
          description: 'Connect to PostgreSQL, MySQL, MongoDB databases',
          industry: 'ai',
          tags: ['database', 'integration', 'connection']
        },
        {
          id: 'cloud-storage-connect',
          name: 'Cloud Storage Connection',
          method: 'POST',
          path: '/api/v1/integrations/storage/connect',
          description: 'Connect to AWS S3, GCS, Azure Blob storage',
          industry: 'ai',
          tags: ['storage', 'cloud', 'integration']
        },
        {
          id: 'webhook-setup',
          name: 'Webhook Setup',
          method: 'POST',
          path: '/api/v1/integrations/webhooks/setup',
          description: 'Setup webhooks for real-time data ingestion',
          industry: 'ai',
          tags: ['webhook', 'realtime', 'ingestion']
        }
      ]
    },
    {
      id: 'enterprise',
      name: 'Enterprise Features',
      icon: <Building2 className="w-4 h-4" />,
      description: 'Multi-tenancy, RBAC, API management, custom branding, and enterprise billing',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'create-organization',
          name: 'Create Organization',
          method: 'POST',
          path: '/api/v1/enterprise/organizations',
          description: 'Create multi-tenant organization with custom settings',
          industry: 'ai',
          tags: ['organization', 'multitenancy', 'enterprise']
        },
        {
          id: 'manage-api-keys',
          name: 'API Key Management',
          method: 'POST',
          path: '/api/v1/enterprise/api-keys',
          description: 'Generate and manage enterprise API keys with permissions',
          industry: 'ai',
          tags: ['api-keys', 'security', 'permissions']
        },
        {
          id: 'custom-branding',
          name: 'Custom Branding',
          method: 'PUT',
          path: '/api/v1/enterprise/organizations/{org_id}/branding',
          description: 'Apply custom branding, logos, and themes',
          industry: 'ai',
          tags: ['branding', 'customization', 'whitelabel']
        }
      ]
    },
    {
      id: 'analytics',
      name: 'Analytics & Monitoring',
      icon: <BarChart3 className="w-4 h-4" />,
      description: 'Time savings analytics, team productivity, system monitoring, and webhook management',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'time-savings',
          name: 'Time Savings Analytics',
          method: 'GET',
          path: '/api/v1/analytics/time-savings',
          description: 'Track automation time savings and productivity gains across teams',
          industry: 'ai',
          tags: ['analytics', 'time-savings', 'productivity']
        },
        {
          id: 'team-productivity',
          name: 'Team Productivity',
          method: 'GET',
          path: '/api/v1/analytics/team-productivity',
          description: 'Team performance metrics, bottlenecks, and efficiency scores',
          industry: 'ai',
          tags: ['team', 'productivity', 'performance']
        },
        {
          id: 'dashboard-summary',
          name: 'Dashboard Summary',
          method: 'GET',
          path: '/api/v1/analytics/dashboard-summary',
          description: 'Comprehensive dashboard summary for team leads with key metrics',
          industry: 'ai',
          tags: ['dashboard', 'summary', 'overview']
        },
        {
          id: 'system-status',
          name: 'System Status',
          method: 'GET',
          path: '/api/v1/analytics/system-status',
          description: 'Real-time system health and performance metrics for DevOps',
          industry: 'ai',
          tags: ['monitoring', 'system', 'devops']
        },
        {
          id: 'health-check',
          name: 'Health Check',
          method: 'GET',
          path: '/api/v1/analytics/health',
          description: 'Basic health check endpoint for load balancers and monitoring',
          industry: 'ai',
          tags: ['health', 'monitoring', 'uptime']
        },
        {
          id: 'create-webhook',
          name: 'Create Webhook',
          method: 'POST',
          path: '/api/v1/analytics/webhooks',
          description: 'Configure webhook notifications for pipeline events and integrations',
          industry: 'ai',
          tags: ['webhook', 'notifications', 'integrations']
        },
        {
          id: 'list-webhooks',
          name: 'List Webhooks',
          method: 'GET',
          path: '/api/v1/analytics/webhooks',
          description: 'Get all configured webhooks for user or workspace',
          industry: 'ai',
          tags: ['webhook', 'list', 'configuration']
        },
        {
          id: 'test-webhook',
          name: 'Test Webhook',
          method: 'POST',
          path: '/api/v1/analytics/webhooks/{webhook_id}/test',
          description: 'Send test notification to verify webhook configuration',
          industry: 'ai',
          tags: ['webhook', 'test', 'validation']
        }
      ]
    },
    {
      id: 'performance-monitoring',
      name: 'Performance Monitoring',
      icon: <Gauge className="w-4 h-4" />,
      description: 'Real-time system metrics, database performance, and application monitoring',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'metrics-snapshot',
          name: 'Performance Snapshot',
          method: 'GET',
          path: '/api/v1/monitoring/metrics/snapshot',
          description: 'Complete performance snapshot: system, database, and application metrics',
          industry: 'ai',
          tags: ['metrics', 'performance', 'snapshot']
        },
        {
          id: 'metrics-history',
          name: 'Metrics History',
          method: 'GET',
          path: '/api/v1/monitoring/metrics/history',
          description: 'Historical metrics data with configurable time range',
          industry: 'ai',
          tags: ['metrics', 'history', 'trends']
        },
        {
          id: 'stream-metrics',
          name: 'Stream Metrics',
          method: 'GET',
          path: '/api/v1/monitoring/metrics/stream',
          description: 'Real-time metrics via Server-Sent Events (SSE)',
          industry: 'ai',
          tags: ['metrics', 'stream', 'real-time']
        },
        {
          id: 'detailed-health',
          name: 'Detailed Health',
          method: 'GET',
          path: '/api/v1/monitoring/health/detailed',
          description: 'Detailed health assessment with component status and recommendations',
          industry: 'ai',
          tags: ['health', 'detailed', 'assessment']
        },
        {
          id: 'export-metrics',
          name: 'Export Metrics',
          method: 'GET',
          path: '/api/v1/monitoring/metrics/export',
          description: 'Export metrics data in JSON or CSV format for external analysis',
          industry: 'ai',
          tags: ['export', 'metrics', 'analysis']
        }
      ]
    },
    {
      id: 'semantic-insights',
      name: 'Semantic Insights',
      icon: <Brain className="w-4 h-4" />,
      description: 'Natural language to SQL queries and business intelligence',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'ask-question',
          name: 'Ask Business Question',
          method: 'POST',
          path: '/api/v1/semantic-insights/ask',
          description: 'Ask natural language questions about your business data',
          industry: 'ai',
          tags: ['nlp', 'sql', 'business-intelligence']
        }
      ]
    },
    {
      id: 'security',
      name: 'Security & Compliance',
      icon: <Shield className="w-4 h-4" />,
      description: 'Security administration, compliance, MFA, and audit logging',
      industry: ['ai', 'manufacturing', 'ecommerce', 'fintech'],
      endpoints: [
        {
          id: 'security-status',
          name: 'Security Status',
          method: 'GET',
          path: '/api/v1/security-admin/status',
          description: 'Get comprehensive security status and recommendations',
          industry: 'fintech',
          tags: ['security', 'compliance', 'status']
        },
        {
          id: 'enable-mfa',
          name: 'Enable MFA',
          method: 'POST',
          path: '/api/v1/security/mfa/enable',
          description: 'Enable multi-factor authentication for users',
          industry: 'fintech',
          tags: ['mfa', 'security', 'authentication']
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

  const filteredCategories = useMemo(() => {
    return apiCategories
      .filter(category => {
        // Filter by industry if not 'all'
        if (selectedIndustry !== 'all') {
          return category.industry.includes(selectedIndustry)
        }
        return true
      })
      .map(category => ({
        ...category,
        endpoints: category.endpoints.filter(endpoint => {
          // Filter by search query
          const matchesSearch = !searchQuery || 
            endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
          
          // Filter by industry if not 'all'
          const matchesIndustry = selectedIndustry === 'all' || endpoint.industry === selectedIndustry
          
          return matchesSearch && matchesIndustry
        })
      }))
      .filter(category => category.endpoints.length > 0 || searchQuery === '')
  }, [selectedIndustry, searchQuery, apiCategories])

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

  const getIndustryColor = (industry: Industry) => {
    switch (industry) {
      case 'ai': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
      case 'manufacturing': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
      case 'ecommerce': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'fintech': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const totalEndpoints = filteredCategories.reduce((sum, cat) => sum + cat.endpoints.length, 0)

  if (collapsed) {
    return (
      <div className="w-16 border-r border-gray-200 dark:border-gray-700 flex flex-col items-center py-4 space-y-4" style={{backgroundColor: '#f5f4f2'}}>
        <button
          onClick={onToggleCollapse}
          className="p-2 text-gray-600 dark:text-gray-400 transition-colors"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
        {filteredCategories.slice(0, 4).map((category) => (
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
    <div className="w-96 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full" style={{backgroundColor: '#f5f4f2'}}>
      {/* Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">APIs</h2>
            <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
              {totalEndpoints} endpoints
            </span>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <ChevronDown className="w-4 h-4 rotate-90 text-gray-400" />
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search APIs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Industry Filter Info */}
        {selectedIndustry !== 'all' && (
          <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <div className="flex items-center space-x-2">
              <Filter className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                Filtered by: {selectedIndustry.charAt(0).toUpperCase() + selectedIndustry.slice(1)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {filteredCategories.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 mb-2">
              <Search className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-gray-600 dark:text-gray-400">
              No APIs found matching your criteria
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCategories.map((category) => (
              <div key={category.id} className="relative">
                {/* Category Header */}
                <button
                  onClick={() => toggleCategory(category.id)}
                  className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors rounded-lg hover:bg-white/50 dark:hover:bg-gray-700/50"
                >
                  {expandedCategories.has(category.id) ? (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  )}
                  <div className="flex items-center space-x-2">
                    {category.icon}
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                        {category.name}
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {category.endpoints.length} endpoints
                      </p>
                    </div>
                  </div>
                </button>

                {/* Category Endpoints */}
                {expandedCategories.has(category.id) && (
                  <div className="ml-4 mt-2 space-y-1">
                    {category.endpoints.map((endpoint) => (
                      <button
                        key={endpoint.id}
                        onClick={() => onEndpointSelect(endpoint)}
                        className={`w-full text-left p-3 transition-colors rounded-lg border ${
                          selectedEndpoint?.id === endpoint.id
                            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                            : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                              {endpoint.method}
                            </span>
                            {selectedIndustry === 'all' && (
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${getIndustryColor(endpoint.industry)}`}>
                                {endpoint.industry.toUpperCase()}
                              </span>
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
                        <code className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400">
                          {endpoint.path}
                        </code>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}