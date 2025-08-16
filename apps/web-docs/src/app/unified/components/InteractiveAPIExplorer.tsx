'use client'

import { useState } from 'react'
import { 
  PlayIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface APIEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  title: string
  description: string
  parameters: {
    name: string
    type: string
    required: boolean
    description: string
    defaultValue?: string
  }[]
}

const apiEndpoints: APIEndpoint[] = [
  {
    id: 'upload',
    method: 'POST',
    path: '/v1/upload',
    title: 'Upload Dataset',
    description: 'Upload a dataset file for processing',
    parameters: [
      {
        name: 'file',
        type: 'file',
        required: true,
        description: 'Dataset file (CSV, JSON, Excel)'
      },
      {
        name: 'auto_profile',
        type: 'boolean',
        required: false,
        description: 'Automatically generate data profile',
        defaultValue: 'true'
      },
      {
        name: 'delimiter',
        type: 'string',
        required: false,
        description: 'CSV delimiter character',
        defaultValue: ','
      }
    ]
  },
  {
    id: 'profile',
    method: 'POST',
    path: '/v1/profile',
    title: 'Generate Profile',
    description: 'Generate intelligent data profile for uploaded dataset',
    parameters: [
      {
        name: 'job_id',
        type: 'string',
        required: true,
        description: 'Job ID from upload endpoint'
      },
      {
        name: 'include_statistics',
        type: 'boolean',
        required: false,
        description: 'Include statistical analysis',
        defaultValue: 'true'
      },
      {
        name: 'detect_anomalies',
        type: 'boolean',
        required: false,
        description: 'Detect data anomalies',
        defaultValue: 'true'
      }
    ]
  },
  {
    id: 'process',
    method: 'POST',
    path: '/v1/process',
    title: 'Process Dataset',
    description: 'Apply AI-powered transformations to clean and prepare data',
    parameters: [
      {
        name: 'job_id',
        type: 'string',
        required: true,
        description: 'Job ID from upload endpoint'
      },
      {
        name: 'auto_clean',
        type: 'boolean',
        required: false,
        description: 'Apply automatic data cleaning',
        defaultValue: 'true'
      },
      {
        name: 'ml_ready',
        type: 'boolean',
        required: false,
        description: 'Prepare data for ML frameworks',
        defaultValue: 'true'
      },
      {
        name: 'remove_outliers',
        type: 'boolean',
        required: false,
        description: 'Remove statistical outliers',
        defaultValue: 'false'
      }
    ]
  }
]

export function InteractiveAPIExplorer() {
  const [selectedEndpoint, setSelectedEndpoint] = useState(apiEndpoints[0])
  const [parameters, setParameters] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copiedCode, setCopiedCode] = useState(false)

  const updateParameter = (name: string, value: string) => {
    setParameters(prev => ({ ...prev, [name]: value }))
  }

  const generateCurlCommand = () => {
    const baseUrl = 'https://api.schlep-engine.com'
    const endpoint = selectedEndpoint
    
    let command = `curl -X ${endpoint.method} "${baseUrl}${endpoint.path}" \\\n`
    command += `  -H "Authorization: Bearer your_api_key" \\\n`
    
    if (endpoint.method === 'POST') {
      command += `  -H "Content-Type: application/json" \\\n`
      
      const bodyParams = endpoint.parameters.filter(p => p.type !== 'file')
      if (bodyParams.length > 0) {
        const body: Record<string, any> = {}
        bodyParams.forEach(param => {
          const value = parameters[param.name] || param.defaultValue
          if (value) {
            body[param.name] = param.type === 'boolean' ? value === 'true' : value
          }
        })
        command += `  -d '${JSON.stringify(body, null, 2)}'`
      }
      
      const fileParams = endpoint.parameters.filter(p => p.type === 'file')
      if (fileParams.length > 0) {
        command = command.replace('-H "Content-Type: application/json"', '-H "Content-Type: multipart/form-data"')
        command += `  -F "file=@your_dataset.csv"`
      }
    }
    
    return command
  }

  const handleTryEndpoint = async () => {
    setIsLoading(true)
    setError(null)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      if (selectedEndpoint.id === 'upload') {
        setResponse(JSON.stringify({
          job_id: "job_" + Math.random().toString(36).substr(2, 9),
          status: "processing",
          estimated_time: "2-5 minutes",
          file_info: {
            filename: "dataset.csv",
            size_bytes: 1048576,
            rows_detected: 10000
          }
        }, null, 2))
      } else if (selectedEndpoint.id === 'profile') {
        setResponse(JSON.stringify({
          job_id: "job_" + Math.random().toString(36).substr(2, 9),
          profile: {
            total_rows: 10000,
            total_columns: 15,
            quality_score: 0.87,
            missing_values: 245,
            duplicate_rows: 12,
            data_types: {
              numeric: 8,
              categorical: 5,
              datetime: 2
            }
          },
          recommendations: [
            "Remove duplicate rows",
            "Handle missing values in 'age' column",
            "Normalize date formats"
          ]
        }, null, 2))
      } else {
        setResponse(JSON.stringify({
          job_id: "job_" + Math.random().toString(36).substr(2, 9),
          status: "completed",
          processing_time: "3.2 minutes",
          transformations_applied: [
            "Removed 12 duplicate rows",
            "Filled missing values using median imputation",
            "Normalized numeric columns",
            "One-hot encoded categorical variables"
          ],
          output_info: {
            rows: 9988,
            columns: 23,
            ml_ready: true
          }
        }, null, 2))
      }
    }, 1500)
  }

  const copyCode = () => {
    navigator.clipboard.writeText(generateCurlCommand())
    setCopiedCode(true)
    setTimeout(() => setCopiedCode(false), 2000)
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Interactive API Explorer</h1>
        <p className="text-xl text-gray-600">
          Try out our API endpoints directly from the documentation. Select an endpoint, 
          configure parameters, and see live responses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Panel - Endpoint Selection & Configuration */}
        <div className="space-y-6">
          {/* Endpoint Selection */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Endpoint</h3>
            <div className="space-y-2">
              {apiEndpoints.map((endpoint) => (
                <button
                  key={endpoint.id}
                  onClick={() => {
                    setSelectedEndpoint(endpoint)
                    setParameters({})
                    setResponse(null)
                    setError(null)
                  }}
                  className={clsx(
                    "w-full text-left p-4 border rounded-lg transition-colors",
                    selectedEndpoint.id === endpoint.id
                      ? "border-blue-500 bg-blue-50 text-blue-900"
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className={clsx(
                      'px-2 py-1 text-xs font-medium rounded',
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    )}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-sm">{endpoint.path}</code>
                  </div>
                  <h4 className="font-medium text-gray-900">{endpoint.title}</h4>
                  <p className="text-sm text-gray-600 mt-1">{endpoint.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Parameters */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Parameters</h3>
            <div className="space-y-4">
              {selectedEndpoint.parameters.map((param) => (
                <div key={param.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="font-medium text-gray-900">{param.name}</label>
                    <span className="text-xs text-gray-500">({param.type})</span>
                    {param.required && (
                      <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">
                        required
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{param.description}</p>
                  
                  {param.type === 'file' ? (
                    <div className="text-sm text-gray-500 bg-gray-50 p-3 rounded">
                      <InformationCircleIcon className="h-4 w-4 inline mr-1" />
                      File upload simulation - your_dataset.csv
                    </div>
                  ) : param.type === 'boolean' ? (
                    <select
                      value={parameters[param.name] || param.defaultValue || 'true'}
                      onChange={(e) => updateParameter(param.name, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="true">true</option>
                      <option value="false">false</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={parameters[param.name] || param.defaultValue || ''}
                      onChange={(e) => updateParameter(param.name, e.target.value)}
                      className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      placeholder={param.defaultValue || `Enter ${param.name}`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Try Button */}
          <button
            onClick={handleTryEndpoint}
            disabled={isLoading}
            className={clsx(
              "w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors",
              isLoading
                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            )}
          >
            <PlayIcon className="h-5 w-5" />
            {isLoading ? 'Processing...' : 'Try Endpoint'}
          </button>
        </div>

        {/* Right Panel - Code & Response */}
        <div className="space-y-6">
          {/* Generated Code */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Generated Request</h3>
              <button
                onClick={copyCode}
                className="flex items-center gap-2 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-md transition-colors"
              >
                {copiedCode ? <CheckIcon className="h-4 w-4" /> : <ClipboardDocumentIcon className="h-4 w-4" />}
                {copiedCode ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
              <pre className="text-sm text-gray-100">
                <code>{generateCurlCommand()}</code>
              </pre>
            </div>
          </div>

          {/* Response */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Response</h3>
            <div className="border border-gray-200 rounded-lg min-h-[300px]">
              {isLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-3 text-gray-600">Making request...</span>
                </div>
              ) : error ? (
                <div className="p-4 text-red-600 bg-red-50 rounded-lg">
                  <ExclamationTriangleIcon className="h-5 w-5 inline mr-2" />
                  {error}
                </div>
              ) : response ? (
                <div className="p-4">
                  <div className="mb-2 text-sm text-green-600 font-medium">✓ 200 OK</div>
                  <pre className="text-sm text-gray-800 overflow-x-auto">
                    <code>{response}</code>
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 text-gray-500">
                  Click "Try Endpoint" to see the response
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}