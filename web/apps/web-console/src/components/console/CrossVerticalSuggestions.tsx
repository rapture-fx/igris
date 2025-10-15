'use client'

import React from 'react'
import { Lightbulb, ArrowRight, Zap, TrendingUp } from 'lucide-react'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  vertical: string
  use_case?: string
}

interface CrossVerticalSuggestionsProps {
  selectedEndpoint?: APIEndpoint
  onEndpointSelect: (endpoint: APIEndpoint) => void
  className?: string
}

export function CrossVerticalSuggestions({ 
  selectedEndpoint, 
  onEndpointSelect,
  className = ""
}: CrossVerticalSuggestionsProps) {
  if (!selectedEndpoint) return null

  // Define cross-vertical suggestions based on use cases
  const getSuggestionsForEndpoint = (endpoint: APIEndpoint): Array<{
    endpoint: APIEndpoint
    reason: string
    use_case: string
  }> => {
    const suggestions: Array<{
      endpoint: APIEndpoint
      reason: string
      use_case: string
    }> = []

    // AI Model Training → Related workflows
    if (endpoint.id === 'custom-training') {
      suggestions.push(
        {
          endpoint: {
            id: 'extract-pdf',
            name: 'Extract PDF Data',
            method: 'POST',
            path: '/api/v1/extract/pdf',
            description: 'Extract training data from PDF documents',
            vertical: 'document-extraction'
          },
          reason: 'Extract training data from documents',
          use_case: 'data-preparation'
        },
        {
          endpoint: {
            id: 'quality-assessment',
            name: 'Data Quality Assessment',
            method: 'POST',
            path: '/api/v1/quality/assess',
            description: 'Validate data quality before training',
            vertical: 'data-processing'
          },
          reason: 'Ensure high-quality training data',
          use_case: 'data-validation'
        },
        {
          endpoint: {
            id: 'predictive-maintenance',
            name: 'Predictive Maintenance',
            method: 'POST',
            path: '/api/v1/industry/manufacturing/predictive-maintenance',
            description: 'Apply your trained model to manufacturing',
            vertical: 'manufacturing'
          },
          reason: 'Apply trained models to real-world problems',
          use_case: 'model-application'
        }
      )
    }

    // Document Extraction → ML Training
    if (endpoint.id === 'extract-pdf') {
      suggestions.push(
        {
          endpoint: {
            id: 'custom-training',
            name: 'Custom Model Training',
            method: 'POST',
            path: '/api/v1/advanced-ml/train',
            description: 'Train models with extracted data',
            vertical: 'ai'
          },
          reason: 'Train AI models with extracted data',
          use_case: 'ml-training'
        },
        {
          endpoint: {
            id: 'data-transform',
            name: 'Data Transformation',
            method: 'POST',
            path: '/api/v1/data/transform',
            description: 'Clean and prepare extracted data',
            vertical: 'data-processing'
          },
          reason: 'Process extracted data for analysis',
          use_case: 'data-preparation'
        }
      )
    }

    // Manufacturing AI → Supporting APIs
    if (endpoint.id === 'predictive-maintenance') {
      suggestions.push(
        {
          endpoint: {
            id: 'realtime-stream-setup',
            name: 'Real-time Data Streaming',
            method: 'POST',
            path: '/api/v1/streaming/setup',
            description: 'Stream sensor data for real-time predictions',
            vertical: 'data-processing'
          },
          reason: 'Stream IoT sensor data for real-time analysis',
          use_case: 'real-time-processing'
        },
        {
          endpoint: {
            id: 'usage-analytics',
            name: 'Usage Analytics',
            method: 'GET',
            path: '/api/v1/analytics/usage',
            description: 'Monitor maintenance prediction accuracy',
            vertical: 'analytics'
          },
          reason: 'Track prediction performance and accuracy',
          use_case: 'monitoring'
        }
      )
    }

    // E-commerce → Cross-vertical opportunities
    if (endpoint.id === 'product-recommendations') {
      suggestions.push(
        {
          endpoint: {
            id: 'demand-forecasting',
            name: 'Demand Forecasting',
            method: 'POST',
            path: '/api/v1/industry/ecommerce/demand-forecast',
            description: 'Predict demand for recommended products',
            vertical: 'ecommerce'
          },
          reason: 'Optimize inventory for recommended products',
          use_case: 'inventory-optimization'
        },
        {
          endpoint: {
            id: 'stream-analytics',
            name: 'Real-time Analytics',
            method: 'GET',
            path: '/api/v1/streaming/metrics',
            description: 'Track recommendation performance in real-time',
            vertical: 'analytics'
          },
          reason: 'Monitor recommendation click-through rates',
          use_case: 'performance-tracking'
        }
      )
    }

    return suggestions.slice(0, 3) // Limit to 3 suggestions
  }

  const suggestions = getSuggestionsForEndpoint(selectedEndpoint)

  if (suggestions.length === 0) return null

  const getUseCaseIcon = (use_case: string) => {
    switch (use_case) {
      case 'data-preparation': return <Zap className="w-3 h-3" />
      case 'ml-training': return <TrendingUp className="w-3 h-3" />
      case 'real-time-processing': return <ArrowRight className="w-3 h-3" />
      default: return <Lightbulb className="w-3 h-3" />
    }
  }

  const getUseCaseColor = (use_case: string) => {
    switch (use_case) {
      case 'data-preparation': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400'
      case 'ml-training': return 'text-green-600 bg-green-100 dark:bg-green-900/20 dark:text-green-400'
      case 'real-time-processing': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400'
      case 'monitoring': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/20 dark:text-orange-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  return (
    <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/10 dark:to-indigo-900/10 rounded-lg border border-blue-200 dark:border-blue-800 p-4 ${className}`}>
      <div className="flex items-center space-x-2 mb-3">
        <div className="p-1 bg-blue-100 dark:bg-blue-900/20 rounded">
          <Lightbulb className="w-4 h-4 text-blue-600 dark:text-blue-400" />
        </div>
        <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Suggested Next Steps
        </h3>
      </div>
      
      <p className="text-xs text-blue-700 dark:text-blue-300 mb-4">
        Complete your workflow with these related APIs from other verticals:
      </p>

      <div className="space-y-3">
        {suggestions.map((suggestion, index) => (
          <div key={suggestion.endpoint.id} className="group">
            <button
              onClick={() => onEndpointSelect(suggestion.endpoint)}
              className="w-full text-left p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-md transition-all duration-200"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {suggestion.endpoint.method}
                  </span>
                  <span className={`px-2 py-0.5 text-[10px] font-medium rounded ${getUseCaseColor(suggestion.use_case)}`}>
                    <span className="flex items-center space-x-1">
                      {getUseCaseIcon(suggestion.use_case)}
                      <span className="capitalize">{suggestion.use_case.replace('-', ' ')}</span>
                    </span>
                  </span>
                </div>
                <ArrowRight className="w-3 h-3 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              
              <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                {suggestion.endpoint.name}
              </h4>
              
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {suggestion.reason}
              </p>
              
              <div className="flex items-center justify-between">
                <code className="text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
                  {suggestion.endpoint.path}
                </code>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 capitalize">
                  {suggestion.endpoint.vertical}
                </span>
              </div>
            </button>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-800">
        <p className="text-[10px] text-blue-600 dark:text-blue-400">
          💡 These suggestions help you build complete AI workflows across different domains
        </p>
      </div>
    </div>
  )
}