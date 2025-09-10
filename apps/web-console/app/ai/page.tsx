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
  Bot
} from 'lucide-react'
import { apiClient } from '../../src/lib/api/client'

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
                  AI Companies Console
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Model serving, retraining, and ML framework integrations
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-full text-sm">
              <CheckCircle className="w-4 h-4" />
              <span>15 APIs Available</span>
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
  isLoading?: boolean
}> = ({ test, onTest, isLoading }) => {
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

  const aiTests: APITest[] = [
    {
      id: 'list-models',
      name: 'List Deployed Models',
      description: 'Get all currently deployed ML models with their status and metadata',
      endpoint: '/api/v1/serving/models',
      method: 'GET',
      category: 'Model Serving',
      sampleResponse: {
        success: true,
        data: [
          { id: 'model_123', name: 'fraud-detection-v2', status: 'active', accuracy: 0.94 },
          { id: 'model_124', name: 'recommendation-engine', status: 'active', accuracy: 0.87 }
        ]
      }
    },
    {
      id: 'model-predict',
      name: 'Model Prediction',
      description: 'Get real-time predictions from a deployed model',
      endpoint: '/api/v1/serving/predict/fraud-detection-v2',
      method: 'POST',
      category: 'Model Serving',
      sampleRequest: {
        data: {
          amount: 150.00,
          merchant: "Amazon",
          location: "US",
          time: "2024-01-15T14:30:00Z"
        }
      }
    },
    {
      id: 'deploy-model',
      name: 'Deploy New Model',
      description: 'Deploy a trained model to production with scaling configuration',
      endpoint: '/api/v1/serving/deploy',
      method: 'POST',
      category: 'Model Serving',
      sampleRequest: {
        model_name: "sentiment-analyzer-v3",
        model_path: "/models/sentiment-v3.pkl",
        instances: 2,
        auto_scaling: true
      }
    },
    {
      id: 'export-pytorch',
      name: 'Export to PyTorch',
      description: 'Export your data and models to PyTorch format with DataLoader',
      endpoint: '/api/v1/export/pytorch',
      method: 'POST',
      category: 'ML Framework Export',
      sampleRequest: {
        investigation_id: "inv_123",
        framework: "pytorch",
        task_type: "classification",
        batch_size: 32
      }
    },
    {
      id: 'auto-label',
      name: 'Auto-Label Data',
      description: 'Automatically label your data using few-shot learning and active learning',
      endpoint: '/api/v1/auto-label/predict',
      method: 'POST',
      category: 'Auto-Labeling',
      sampleRequest: {
        model_key: "sentiment_model_v1",
        data: [
          { text: "This product is amazing!" },
          { text: "Not satisfied with the quality." }
        ]
      }
    },
    {
      id: 'retraining-pipeline',
      name: 'Create Retraining Pipeline',
      description: 'Set up automated model retraining with drift detection',
      endpoint: '/api/v1/retraining/pipeline',
      method: 'POST',
      category: 'Automated Retraining',
      sampleRequest: {
        model_id: "fraud_detection_v2",
        schedule: "daily",
        drift_threshold: 0.1,
        min_samples: 1000
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
      
      // Simulate API call with sample data
      switch (test.id) {
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
            data: test.sampleResponse || { message: 'API test successful', timestamp: new Date().toISOString() },
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

  const statsCards = [
    { 
      icon: <Zap className="w-5 h-5" />, 
      label: "Model Endpoints", 
      value: "8", 
      color: "text-yellow-600" 
    },
    { 
      icon: <GitBranch className="w-5 h-5" />, 
      label: "ML Frameworks", 
      value: "5", 
      color: "text-green-600" 
    },
    { 
      icon: <Bot className="w-5 h-5" />, 
      label: "Auto-Label APIs", 
      value: "4", 
      color: "text-blue-600" 
    },
    { 
      icon: <Activity className="w-5 h-5" />, 
      label: "Avg Response", 
      value: "45ms", 
      color: "text-purple-600" 
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* API Tests */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              AI Company APIs
            </h2>
            <div className="space-y-4">
              {aiTests.map((test) => (
                <APITestCard
                  key={test.id}
                  test={test}
                  onTest={handleTest}
                  isLoading={isLoading && activeTest?.id === test.id}
                />
              ))}
            </div>
          </div>

          {/* Response Display */}
          <div className="lg:sticky lg:top-24">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
              API Response
            </h2>
            <ResponseDisplay 
              response={response} 
              isLoading={isLoading} 
              error={error}
            />
            
            {activeTest && (
              <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                <h3 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                  Testing: {activeTest.name}
                </h3>
                <p className="text-sm text-purple-700 dark:text-purple-300">
                  {activeTest.description}
                </p>
                {activeTest.sampleRequest && (
                  <div className="mt-3">
                    <p className="text-xs text-purple-600 dark:text-purple-400 mb-1">Sample Request:</p>
                    <pre className="text-xs bg-purple-100 dark:bg-purple-900/40 p-2 rounded overflow-x-auto">
                      {JSON.stringify(activeTest.sampleRequest, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}