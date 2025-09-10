'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Cpu, 
  Play, 
  Copy, 
  Download,
  Settings,
  Activity,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Loader2,
  Code,
  Terminal,
  Zap,
  GitBranch,
  Bot,
  Database,
  Network,
  Brain,
  Monitor,
  FileText,
  Bug,
  BarChart3,
  Shield,
  Clock,
  Layers,
  Users,
  Key,
  Workflow
} from 'lucide-react'
import { apiClient } from '../../src/lib/api/client'
import CodeGenerator from '../../src/components/console/CodeGenerator'

interface APITest {
  id: string
  name: string
  description: string
  endpoint: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  category: string
  sampleRequest?: any
  sampleResponse?: any
}

const AIConsoleHeader = () => {
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="flex items-center text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back to Console
            </Link>
            <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                <Cpu className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                  Enterprise AI Platform Console
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Digital Twins • Dataset Marketplace • MLOps • Real-time AI Orchestration
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>47+ Enterprise APIs Available</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

const APITestCard: React.FC<{
  test: APITest
  onTest: (test: APITest) => void
  onGenerateCode: (test: APITest) => void
  isLoading?: boolean
}> = ({ test, onTest, onGenerateCode, isLoading }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className={`px-2 py-1 text-xs font-medium rounded-full ${
              test.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400' :
              test.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400' :
              'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
            }`}>
              {test.method}
            </span>
            <code className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
              {test.endpoint}
            </code>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => onGenerateCode(test)}
            className="inline-flex items-center px-3 py-2 border border-purple-600 text-purple-600 text-sm font-medium rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
          >
            <Code className="w-4 h-4 mr-1" />
            Code
          </button>
          <button
            onClick={() => onTest(test)}
            disabled={isLoading}
            className="inline-flex items-center px-3 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <Play className="w-4 h-4 mr-1" />
            )}
            Test API
          </button>
        </div>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
        {test.name}
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mb-4">
        {test.description}
      </p>
      <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded inline-block">
        {test.category}
      </div>
    </div>
  )
}

const ResponseDisplay: React.FC<{
  response: any
  isLoading: boolean
  error?: string
}> = ({ response, isLoading, error }) => {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(response, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-center">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-300">Executing API call...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <XCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400 font-medium">API Error</span>
        </div>
        <pre className="text-red-300 text-sm overflow-x-auto">{error}</pre>
      </div>
    )
  }

  if (!response) {
    return (
      <div className="bg-gray-800 rounded-lg p-6 text-center border-2 border-dashed border-gray-600">
        <Terminal className="w-8 h-8 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-400">Click "Test API" to see the response here</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-400" />
          <span className="text-green-400 font-medium">Success</span>
        </div>
        <button
          onClick={copyToClipboard}
          className="flex items-center space-x-1 px-2 py-1 text-gray-300 hover:text-white transition-colors"
        >
          {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span className="text-sm">{copied ? 'Copied!' : 'Copy'}</span>
        </button>
      </div>
      <pre className="p-4 text-gray-100 text-sm overflow-x-auto">
        {JSON.stringify(response, null, 2)}
      </pre>
    </div>
  )
}

export default function AIConsolePage() {
  const [activeTest, setActiveTest] = useState<APITest | null>(null)
  const [response, setResponse] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | undefined>()
  const [showCodeGenerator, setShowCodeGenerator] = useState(false)
  const [codeGeneratorTest, setCodeGeneratorTest] = useState<APITest | null>(null)
  const [activeDevTool, setActiveDevTool] = useState<string | null>(null)

  const aiTests: APITest[] = [
    // Digital Twin AI Models
    {
      id: 'create-ai-twin',
      name: 'Create AI Model Digital Twin',
      description: 'Create a digital twin of your ML model with full lifecycle tracking, performance monitoring, and optimization',
      endpoint: '/api/v1/manufacturing/digital-twin/create',
      method: 'POST',
      category: 'Digital Twin AI',
      sampleRequest: {
        twin_id: "ai_model_twin_001",
        twin_name: "Fraud Detection Model Twin",
        twin_type: "AI_MODEL",
        configuration: {
          model_type: "xgboost",
          version: "2.1.0",
          performance_targets: { accuracy: 0.95, latency_ms: 50 }
        },
        iot_integration: {
          data_sources: ["real_time_transactions", "user_behavior"]
        },
        synchronization: {
          auto_sync_enabled: true,
          sync_interval_minutes: 15
        }
      }
    },
    {
      id: 'twin-analytics',
      name: 'AI Twin Performance Analytics',
      description: 'Get comprehensive analytics for your AI model twin including drift detection, performance degradation, and optimization recommendations',
      endpoint: '/api/v1/manufacturing/digital-twin/ai_model_twin_001/insights',
      method: 'GET',
      category: 'Digital Twin AI',
      sampleResponse: {
        success: true,
        performance_kpis: { accuracy: 0.94, precision: 0.92, recall: 0.96, f1_score: 0.94 },
        drift_analysis: { data_drift: 0.03, concept_drift: 0.01, drift_severity: "low" },
        predictions: [{ metric: "accuracy_7d", value: 0.93, confidence: 0.95 }],
        recommendations: ["Retrain with latest 30 days data", "Increase monitoring frequency"]
      }
    },
    {
      id: 'ai-twin-optimize',
      name: 'Optimize AI Model Parameters',
      description: 'Use digital twin optimization to find optimal hyperparameters and deployment configurations',
      endpoint: '/api/v1/manufacturing/digital-twin/ai_model_twin_001/optimize',
      method: 'POST',
      category: 'Digital Twin AI',
      sampleRequest: {
        objectives: ["maximize_accuracy", "minimize_latency"],
        constraints: { max_memory_gb: 8, max_cpu_cores: 4 }
      }
    },
    
    // Dataset Marketplace
    {
      id: 'catalog-dataset',
      name: 'Catalog Training Dataset',
      description: 'Register and catalog a new dataset in the marketplace with automatic quality assessment',
      endpoint: '/api/v1/datasets/catalog',
      method: 'POST',
      category: 'Dataset Marketplace',
      sampleRequest: {
        name: "financial_fraud_detection_v3",
        title: "Enhanced Fraud Detection Dataset",
        description: "Comprehensive dataset with 2M+ transactions for fraud detection",
        dataset_type: "structured",
        file_path: "/datasets/fraud_detection_v3.parquet",
        tags: ["fraud", "finance", "classification", "production-ready"],
        access_level: "organization",
        auto_quality_check: true
      }
    },
    {
      id: 'search-datasets',
      name: 'Search Dataset Marketplace',
      description: 'Search and discover datasets with advanced filtering and quality metrics',
      endpoint: '/api/v1/datasets/search',
      method: 'GET',
      category: 'Dataset Marketplace',
      sampleResponse: {
        success: true,
        datasets: [
          {
            id: "ds_001",
            name: "financial_fraud_detection_v3",
            quality_score: 0.95,
            size_mb: 1500,
            records: 2100000,
            tags: ["fraud", "finance"]
          }
        ]
      }
    },
    {
      id: 'dataset-quality',
      name: 'Dataset Quality Assessment',
      description: 'Get comprehensive quality analysis including completeness, consistency, and bias detection',
      endpoint: '/api/v1/datasets/ds_001/quality',
      method: 'GET',
      category: 'Dataset Marketplace',
      sampleResponse: {
        overall_score: 0.95,
        completeness: 0.98,
        consistency: 0.94,
        validity: 0.96,
        bias_analysis: { demographic_bias: 0.02, geographic_bias: 0.01 },
        recommendations: ["Review geographic distribution", "Add more diverse samples"]
      }
    },
    
    // Real-time AI Orchestration
    {
      id: 'realtime-stream-setup',
      name: 'Setup Real-time AI Stream',
      description: 'Configure real-time data streaming for AI model inference with auto-scaling',
      endpoint: '/api/v1/streaming/setup',
      method: 'POST',
      category: 'Real-time Streaming',
      sampleRequest: {
        stream_name: "fraud_detection_stream",
        model_endpoint: "fraud-detection-v2",
        batch_size: 100,
        max_latency_ms: 50,
        auto_scaling: { min_instances: 2, max_instances: 20 }
      }
    },
    {
      id: 'stream-analytics',
      name: 'Stream Processing Analytics',
      description: 'Get real-time analytics on streaming AI inference performance and throughput',
      endpoint: '/api/v1/streaming/fraud_detection_stream/metrics',
      method: 'GET',
      category: 'Real-time Streaming',
      sampleResponse: {
        throughput_per_second: 15000,
        avg_latency_ms: 35,
        error_rate_percent: 0.01,
        prediction_accuracy: 0.94,
        active_connections: 245
      }
    },
    
    // Advanced MLOps
    {
      id: 'create-experiment',
      name: 'Create ML Experiment',
      description: 'Set up a comprehensive ML experiment with version control, dataset linking, and automated tracking',
      endpoint: '/api/v1/experiments/create',
      method: 'POST',
      category: 'MLOps Platform',
      sampleRequest: {
        name: "fraud_detection_v3_experiment",
        description: "Testing new feature engineering approach",
        dataset_ids: ["ds_001", "ds_002"],
        model_config: {
          algorithm: "xgboost",
          hyperparameters: { n_estimators: 200, max_depth: 8 }
        },
        tracking: {
          metrics: ["accuracy", "precision", "recall", "auc"],
          auto_logging: true
        }
      }
    },
    {
      id: 'automated-retraining',
      name: 'Advanced Auto-Retraining Pipeline',
      description: 'Create sophisticated retraining pipeline with data drift detection, A/B testing, and gradual rollout',
      endpoint: '/api/v1/retraining/advanced-pipeline',
      method: 'POST',
      category: 'MLOps Platform',
      sampleRequest: {
        model_id: "fraud_detection_v2",
        trigger_conditions: {
          data_drift_threshold: 0.1,
          performance_drop_threshold: 0.02,
          min_samples_required: 10000
        },
        retraining_config: {
          validation_split: 0.2,
          cross_validation_folds: 5,
          hyperparameter_optimization: true
        },
        deployment_strategy: {
          rollout_type: "canary",
          canary_percentage: 10,
          success_criteria: { accuracy_improvement: 0.01 }
        }
      }
    },
    
    // Legacy Model Serving (Enhanced)
    {
      id: 'advanced-model-serving',
      name: 'Enterprise Model Deployment',
      description: 'Deploy models with advanced features: A/B testing, multi-version serving, and auto-scaling',
      endpoint: '/api/v1/serving/enterprise-deploy',
      method: 'POST',
      category: 'Enhanced Model Serving',
      sampleRequest: {
        model_name: "fraud-detection-v3",
        deployment_config: {
          versions: [{ version: "v2", traffic_percentage: 80 }, { version: "v3", traffic_percentage: 20 }],
          auto_scaling: { min_replicas: 3, max_replicas: 50, cpu_threshold: 70 },
          monitoring: {
            enable_drift_detection: true,
            performance_alerts: true,
            custom_metrics: ["business_impact", "false_positive_rate"]
          }
        }
      }
    },
    {
      id: 'model-explainability',
      name: 'Model Explainability & Insights',
      description: 'Generate comprehensive model explanations, feature importance, and bias analysis',
      endpoint: '/api/v1/serving/fraud-detection-v3/explain',
      method: 'POST',
      category: 'Enhanced Model Serving',
      sampleRequest: {
        prediction_id: "pred_123456",
        explanation_type: "comprehensive",
        include_counterfactuals: true,
        bias_analysis: true
      }
    }
  ]

  const handleTest = async (test: APITest) => {
    setActiveTest(test)
    setIsLoading(true)
    setError(undefined)
    setResponse(null)

    try {
      let result
      
      // Call actual API endpoints with sample data
      switch (test.id) {
        // Digital Twin AI APIs
        case 'create-ai-twin':
          result = await apiClient.createDigitalTwin(test.sampleRequest)
          break
        case 'twin-analytics':
          result = await apiClient.getTwinInsights('ai_model_twin_001', {
            analytics_types: 'performance,anomaly,energy',
            time_range_hours: 168,
            include_predictions: true
          })
          break
        case 'ai-twin-optimize':
          result = await apiClient.optimizeTwinParameters('ai_model_twin_001', test.sampleRequest)
          break
          
        // Dataset Marketplace APIs
        case 'catalog-dataset':
          result = await apiClient.catalogDataset(test.sampleRequest)
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
          
        // Real-time Streaming APIs
        case 'realtime-stream-setup':
          result = await apiClient.setupRealtimeStream(test.sampleRequest)
          break
        case 'stream-analytics':
          result = await apiClient.getStreamMetrics('fraud_detection_stream')
          break
          
        // Advanced MLOps APIs
        case 'create-experiment':
          result = await apiClient.createMLExperiment(test.sampleRequest)
          break
        case 'automated-retraining':
          result = await apiClient.createAdvancedRetrainingPipeline(test.sampleRequest)
          break
        case 'advanced-model-serving':
          result = await apiClient.deployEnterpriseModel(test.sampleRequest)
          break
        case 'model-explainability':
          result = await apiClient.explainModel('fraud-detection-v3', test.sampleRequest)
          break
          
        // Legacy Model Serving APIs
        case 'list-models':
          result = await apiClient.getModelsList()
          break
        case 'model-predict':
          result = await apiClient.predict('fraud-detection-v2', test.sampleRequest?.data)
          break
        case 'deploy-model':
          result = await apiClient.deployModel(test.sampleRequest)
          break
        case 'export-pytorch':
          result = await apiClient.exportFramework('inv_123', 'pytorch', test.sampleRequest)
          break
        case 'auto-label':
          result = await apiClient.autoLabel(test.sampleRequest?.data, { model_key: test.sampleRequest?.model_key })
          break
        case 'retraining-pipeline':
          result = await apiClient.createRetrainingPipeline(test.sampleRequest)
          break
        default:
          // Fallback with sample response
          result = {
            success: true,
            data: test.sampleResponse || { message: 'Enterprise API test successful', timestamp: new Date().toISOString() },
            status: 200
          }
      }

      if (result.success) {
        setResponse(result.data)
      } else {
        setError(result.error)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const handleGenerateCode = (test: APITest) => {
    setCodeGeneratorTest(test)
    setShowCodeGenerator(true)
  }

  const statsCards = [
    { 
      icon: <Cpu className="w-5 h-5" />, 
      label: "Digital Twin Models", 
      value: "23", 
      color: "text-blue-600" 
    },
    { 
      icon: <GitBranch className="w-5 h-5" />, 
      label: "Dataset Marketplace", 
      value: "847", 
      color: "text-green-600" 
    },
    { 
      icon: <Zap className="w-5 h-5" />, 
      label: "Real-time Streams", 
      value: "156", 
      color: "text-yellow-600" 
    },
    { 
      icon: <Activity className="w-5 h-5" />, 
      label: "MLOps Pipelines", 
      value: "89", 
      color: "text-purple-600" 
    }
  ]

  const devTools = [
    {
      id: 'api-documentation',
      name: 'Interactive API Documentation',
      description: 'Browse comprehensive API documentation with live examples and testing',
      icon: <FileText className="w-5 h-5" />,
      color: 'text-blue-600',
      data: {
        endpoints: 47,
        examples: 120,
        schemas: 35
      }
    },
    {
      id: 'performance-monitoring',
      name: 'Real-time Performance Monitor',
      description: 'Monitor API performance, latency, and error rates in real-time',
      icon: <Monitor className="w-5 h-5" />,
      color: 'text-green-600',
      data: {
        avg_latency: '45ms',
        success_rate: '99.8%',
        requests_per_min: '15.2k'
      }
    },
    {
      id: 'debug-console',
      name: 'Advanced Debug Console',
      description: 'Debug API calls with detailed logging, tracing, and error analysis',
      icon: <Bug className="w-5 h-5" />,
      color: 'text-orange-600',
      data: {
        debug_sessions: 12,
        active_traces: 5,
        error_logs: 3
      }
    },
    {
      id: 'analytics-dashboard',
      name: 'Usage Analytics Dashboard',
      description: 'Analyze API usage patterns, popular endpoints, and user behavior',
      icon: <BarChart3 className="w-5 h-5" />,
      color: 'text-purple-600',
      data: {
        total_calls: '2.4M',
        top_endpoint: 'predict',
        usage_trend: '+12%'
      }
    },
    {
      id: 'security-center',
      name: 'Security & Compliance Center',
      description: 'Manage API keys, audit logs, rate limiting, and security policies',
      icon: <Shield className="w-5 h-5" />,
      color: 'text-red-600',
      data: {
        active_keys: 15,
        security_score: 'A+',
        compliance: '100%'
      }
    },
    {
      id: 'deployment-pipeline',
      name: 'CI/CD Pipeline Manager',
      description: 'Manage model deployments, versioning, and automated testing pipelines',
      icon: <Workflow className="w-5 h-5" />,
      color: 'text-indigo-600',
      data: {
        active_pipelines: 8,
        deployments_today: 23,
        success_rate: '96%'
      }
    }
  ]

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <AIConsoleHeader />
      
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat, index) => (
            <div key={index} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className={stat.color}>{stat.icon}</div>
                <div>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Three Column Layout */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          {/* API Tests */}
          <div className="xl:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              Enterprise AI Platform APIs
            </h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {aiTests.map((test) => (
                <APITestCard
                  key={test.id}
                  test={test}
                  onTest={handleTest}
                  onGenerateCode={handleGenerateCode}
                  isLoading={isLoading && activeTest?.id === test.id}
                />
              ))}
            </div>
          </div>

          {/* Dev Tools & Response Panel */}
          <div className="space-y-8">
            {/* Developer Tools */}
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
                Developer Tools
              </h2>
              <div className="space-y-3">
                {devTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setActiveDevTool(activeDevTool === tool.id ? null : tool.id)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <div className={`${tool.color}`}>{tool.icon}</div>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white text-sm">
                            {tool.name}
                          </h3>
                        </div>
                      </div>
                      {activeDevTool === tool.id && (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
                      {tool.description}
                    </p>
                    <div className="grid grid-cols-1 gap-2 text-xs">
                      {Object.entries(tool.data).map(([key, value]) => (
                        <div key={key} className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400 capitalize">
                            {key.replace('_', ' ')}:
                          </span>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {value}
                          </span>
                        </div>
                      ))}
                    </div>
                    
                    {activeDevTool === tool.id && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded text-xs">
                          <div className="text-gray-700 dark:text-gray-300">
                            {tool.id === 'api-documentation' && (
                              <div>
                                <div className="font-medium mb-2">Recent Updates:</div>
                                <div className="space-y-1">
                                  <div>✓ Digital Twin APIs documented</div>
                                  <div>✓ Dataset Marketplace schemas added</div>
                                  <div>✓ Real-time streaming examples updated</div>
                                </div>
                              </div>
                            )}
                            {tool.id === 'performance-monitoring' && (
                              <div>
                                <div className="font-medium mb-2">Live Metrics:</div>
                                <div className="space-y-1">
                                  <div>🔥 CPU: 34% | Memory: 2.1GB</div>
                                  <div>📊 Active Connections: 245</div>
                                  <div>⚡ Cache Hit Rate: 94.2%</div>
                                </div>
                              </div>
                            )}
                            {tool.id === 'debug-console' && (
                              <div>
                                <div className="font-medium mb-2">Debug Status:</div>
                                <div className="space-y-1">
                                  <div>🐛 Model prediction latency spike detected</div>
                                  <div>🔍 Dataset quality check in progress</div>
                                  <div>✅ All digital twins synchronized</div>
                                </div>
                              </div>
                            )}
                            {tool.id === 'analytics-dashboard' && (
                              <div>
                                <div className="font-medium mb-2">Usage Insights:</div>
                                <div className="space-y-1">
                                  <div>📈 Peak usage: 2:00-4:00 PM</div>
                                  <div>🎯 Most used: Digital Twin APIs (45%)</div>
                                  <div>🌍 Top regions: US (60%), EU (25%)</div>
                                </div>
                              </div>
                            )}
                            {tool.id === 'security-center' && (
                              <div>
                                <div className="font-medium mb-2">Security Status:</div>
                                <div className="space-y-1">
                                  <div>🔒 Rate limiting: 1000 req/min</div>
                                  <div>🛡️ WAF: Active, 23 threats blocked</div>
                                  <div>🔑 2FA enabled for all admin accounts</div>
                                </div>
                              </div>
                            )}
                            {tool.id === 'deployment-pipeline' && (
                              <div>
                                <div className="font-medium mb-2">Pipeline Status:</div>
                                <div className="space-y-1">
                                  <div>🚀 fraud-detection-v3: Deploying (80%)</div>
                                  <div>✅ recommendation-engine: Healthy</div>
                                  <div>⏳ sentiment-analyzer: Queue (3/5)</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Response Display */}
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
                API Response
              </h2>
              <ResponseDisplay 
                response={response} 
                isLoading={isLoading} 
                error={error}
              />
              
              {activeTest && (
                <div className="mt-4 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                  <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-1 text-sm">
                    Testing: {activeTest.name}
                  </h3>
                  <p className="text-xs text-purple-700 dark:text-purple-300">
                    {activeTest.description}
                  </p>
                  {activeTest.sampleRequest && (
                    <div className="mt-2">
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Sample Request:</p>
                      <pre className="text-xs bg-purple-100 dark:bg-purple-900/40 p-2 rounded overflow-x-auto max-h-32">
                        {JSON.stringify(activeTest.sampleRequest, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Code Generator Modal */}
        {showCodeGenerator && (
          <CodeGenerator 
            test={codeGeneratorTest}
            onClose={() => {
              setShowCodeGenerator(false)
              setCodeGeneratorTest(null)
            }}
          />
        )}
      </main>
    </div>
  )
}