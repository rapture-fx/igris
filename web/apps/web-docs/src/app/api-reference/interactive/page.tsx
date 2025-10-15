'use client'

import React, { useState } from 'react'
import { CodeBracketIcon, PlayIcon, ClipboardIcon, CheckIcon } from '@heroicons/react/24/outline'

interface EndpointConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  parameters: Parameter[]
  requestBody?: RequestBodySchema
  responses: ResponseSchema[]
}

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  example?: string
}

interface RequestBodySchema {
  type: 'json' | 'form-data'
  properties: {
    [key: string]: {
      type: string
      required: boolean
      description: string
      example?: any
    }
  }
}

interface ResponseSchema {
  status: number
  description: string
  example: any
}

const API_ENDPOINTS: EndpointConfig[] = [
  {
    method: 'GET',
    path: '/api/v1/health',
    description: 'Check API health status',
    parameters: [
      {
        name: 'X-API-Key',
        type: 'header',
        required: true,
        description: 'Your API key for authentication',
        example: 'sk_live_abc123...'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'API is healthy',
        example: {
          success: true,
          data: {
            status: 'healthy',
            timestamp: '2024-01-15T10:30:00Z',
            version: '2.0.0',
            environment: 'production'
          },
          message: 'API is operational',
          timestamp: '2024-01-15T10:30:00Z'
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/v1/data/upload',
    description: 'Upload a dataset for processing',
    parameters: [
      {
        name: 'X-API-Key',
        type: 'header',
        required: true,
        description: 'Your API key for authentication',
        example: 'sk_live_abc123...'
      }
    ],
    requestBody: {
      type: 'form-data',
      properties: {
        file: {
          type: 'file',
          required: true,
          description: 'Dataset file (CSV, JSON, Excel, Parquet)',
          example: 'data.csv'
        },
        name: {
          type: 'string',
          required: true,
          description: 'Display name for the dataset',
          example: 'Customer Data Q4 2023'
        },
        description: {
          type: 'string',
          required: false,
          description: 'Optional description of the dataset',
          example: 'Customer transaction data for Q4 analysis'
        },
        tags: {
          type: 'string',
          required: false,
          description: 'Comma-separated tags',
          example: 'customers,transactions,q4'
        }
      }
    },
    responses: [
      {
        status: 200,
        description: 'Upload successful',
        example: {
          success: true,
          data: {
            investigation_id: 'inv_abc123',
            file_info: {
              filename: 'data.csv',
              size: 1024000,
              rows: 10000,
              columns: 15,
              format: 'csv'
            },
            upload_url: 'https://storage.schlep-engine.com/uploads/inv_abc123.csv'
          },
          message: 'File uploaded successfully',
          timestamp: '2024-01-15T10:30:00Z'
        }
      },
      {
        status: 400,
        description: 'Invalid file format or size',
        example: {
          success: false,
          error: {
            code: 'INVALID_FILE_FORMAT',
            message: 'Unsupported file type. Supported formats: CSV, JSON, Excel, Parquet',
            details: {
              received_format: 'txt',
              supported_formats: ['csv', 'json', 'xlsx', 'parquet']
            }
          },
          timestamp: '2024-01-15T10:30:00Z'
        }
      }
    ]
  },
  {
    method: 'POST',
    path: '/api/v1/data/processing/clean',
    description: 'Clean and process uploaded data',
    parameters: [
      {
        name: 'X-API-Key',
        type: 'header',
        required: true,
        description: 'Your API key for authentication',
        example: 'sk_live_abc123...'
      }
    ],
    requestBody: {
      type: 'json',
      properties: {
        investigation_id: {
          type: 'string',
          required: true,
          description: 'ID of the uploaded dataset',
          example: 'inv_abc123'
        },
        options: {
          type: 'object',
          required: false,
          description: 'Processing options',
          example: {
            auto_clean: true,
            remove_duplicates: true,
            handle_missing: 'auto',
            detect_outliers: true,
            normalize_text: false
          }
        }
      }
    },
    responses: [
      {
        status: 200,
        description: 'Processing started',
        example: {
          success: true,
          data: {
            job_id: 'job_xyz789',
            status: 'processing',
            estimated_completion: '2024-01-15T10:35:00Z',
            operations: [
              'duplicate_removal',
              'missing_value_imputation',
              'outlier_detection'
            ]
          },
          message: 'Data processing started successfully',
          timestamp: '2024-01-15T10:30:00Z'
        }
      }
    ]
  },
  {
    method: 'GET',
    path: '/api/v1/data/profile/{investigation_id}',
    description: 'Get data profile and quality analysis',
    parameters: [
      {
        name: 'X-API-Key',
        type: 'header',
        required: true,
        description: 'Your API key for authentication',
        example: 'sk_live_abc123...'
      },
      {
        name: 'investigation_id',
        type: 'path',
        required: true,
        description: 'ID of the dataset to profile',
        example: 'inv_abc123'
      }
    ],
    responses: [
      {
        status: 200,
        description: 'Data profile generated',
        example: {
          success: true,
          data: {
            summary: {
              total_rows: 10000,
              total_columns: 15,
              missing_values: 245,
              duplicate_rows: 12,
              data_quality_score: 0.92
            },
            columns: [
              {
                name: 'email',
                type: 'string',
                missing_count: 5,
                unique_count: 9995,
                quality_issues: ['format_inconsistency']
              },
              {
                name: 'age',
                type: 'integer',
                missing_count: 0,
                min_value: 18,
                max_value: 85,
                mean: 42.5
              }
            ]
          },
          message: 'Data profile completed',
          timestamp: '2024-01-15T10:30:00Z'
        }
      }
    ]
  }
]

export default function InteractiveApiPage() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<EndpointConfig>(API_ENDPOINTS[0])
  const [apiKey, setApiKey] = useState('')
  const [requestData, setRequestData] = useState<any>({})
  const [responseData, setResponseData] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const generateCurlCommand = (endpoint: EndpointConfig) => {
    let curlCommand = `curl -X ${endpoint.method} "https://api.schlep-engine.com${endpoint.path}"`
    
    // Add headers
    curlCommand += ` \\\n  -H "X-API-Key: ${apiKey || 'your_api_key_here'}"`
    
    if (endpoint.requestBody?.type === 'json') {
      curlCommand += ` \\\n  -H "Content-Type: application/json"`
      const bodyData = { ...requestData }
      if (Object.keys(bodyData).length > 0) {
        curlCommand += ` \\\n  -d '${JSON.stringify(bodyData, null, 2)}'`
      }
    } else if (endpoint.requestBody?.type === 'form-data') {
      Object.entries(requestData).forEach(([key, value]) => {
        if (value && key !== 'file') {
          curlCommand += ` \\\n  -F "${key}=${value}"`
        }
      })
      if (requestData.file) {
        curlCommand += ` \\\n  -F "file=@${requestData.file}"`
      }
    }
    
    return curlCommand
  }

  const generatePythonCode = (endpoint: EndpointConfig) => {
    let pythonCode = `import requests\n\n`
    pythonCode += `# Set your API key\n`
    pythonCode += `api_key = "${apiKey || 'your_api_key_here'}"\n`
    pythonCode += `headers = {"X-API-Key": api_key}\n\n`
    
    if (endpoint.requestBody?.type === 'json') {
      pythonCode += `# Request data\n`
      pythonCode += `data = ${JSON.stringify(requestData, null, 2)}\n\n`
      pythonCode += `# Make the request\n`
      pythonCode += `response = requests.${endpoint.method.toLowerCase()}(\n`
      pythonCode += `    "https://api.schlep-engine.com${endpoint.path}",\n`
      pythonCode += `    headers=headers,\n`
      pythonCode += `    json=data\n`
      pythonCode += `)\n\n`
    } else if (endpoint.requestBody?.type === 'form-data') {
      pythonCode += `# Form data\n`
      pythonCode += `files = {"file": open("${requestData.file || 'data.csv'}", "rb")}\n`
      const formData = { ...requestData }
      delete formData.file
      if (Object.keys(formData).length > 0) {
        pythonCode += `data = ${JSON.stringify(formData, null, 2)}\n`
      }
      pythonCode += `\n# Make the request\n`
      pythonCode += `response = requests.${endpoint.method.toLowerCase()}(\n`
      pythonCode += `    "https://api.schlep-engine.com${endpoint.path}",\n`
      pythonCode += `    headers=headers,\n`
      if (Object.keys(formData).length > 0) {
        pythonCode += `    data=data,\n`
      }
      pythonCode += `    files=files\n`
      pythonCode += `)\n\n`
    } else {
      pythonCode += `# Make the request\n`
      pythonCode += `response = requests.${endpoint.method.toLowerCase()}(\n`
      pythonCode += `    "https://api.schlep-engine.com${endpoint.path}",\n`
      pythonCode += `    headers=headers\n`
      pythonCode += `)\n\n`
    }
    
    pythonCode += `# Handle the response\n`
    pythonCode += `if response.status_code == 200:\n`
    pythonCode += `    result = response.json()\n`
    pythonCode += `    print("Success:", result)\n`
    pythonCode += `else:\n`
    pythonCode += `    print("Error:", response.status_code, response.text)`
    
    return pythonCode
  }

  const generateJavaScriptCode = (endpoint: EndpointConfig) => {
    let jsCode = `// Set your API key\n`
    jsCode += `const apiKey = '${apiKey || 'your_api_key_here'}';\n\n`
    
    if (endpoint.requestBody?.type === 'json') {
      jsCode += `// Request data\n`
      jsCode += `const data = ${JSON.stringify(requestData, null, 2)};\n\n`
      jsCode += `// Make the request\n`
      jsCode += `const response = await fetch('https://api.schlep-engine.com${endpoint.path}', {\n`
      jsCode += `  method: '${endpoint.method}',\n`
      jsCode += `  headers: {\n`
      jsCode += `    'X-API-Key': apiKey,\n`
      jsCode += `    'Content-Type': 'application/json'\n`
      jsCode += `  },\n`
      jsCode += `  body: JSON.stringify(data)\n`
      jsCode += `});\n\n`
    } else if (endpoint.requestBody?.type === 'form-data') {
      jsCode += `// Form data\n`
      jsCode += `const formData = new FormData();\n`
      Object.entries(requestData).forEach(([key, value]) => {
        if (value && key !== 'file') {
          jsCode += `formData.append('${key}', '${value}');\n`
        }
      })
      if (requestData.file) {
        jsCode += `formData.append('file', fileInput.files[0]); // file from input element\n`
      }
      jsCode += `\n// Make the request\n`
      jsCode += `const response = await fetch('https://api.schlep-engine.com${endpoint.path}', {\n`
      jsCode += `  method: '${endpoint.method}',\n`
      jsCode += `  headers: {\n`
      jsCode += `    'X-API-Key': apiKey\n`
      jsCode += `  },\n`
      jsCode += `  body: formData\n`
      jsCode += `});\n\n`
    } else {
      jsCode += `// Make the request\n`
      jsCode += `const response = await fetch('https://api.schlep-engine.com${endpoint.path}', {\n`
      jsCode += `  method: '${endpoint.method}',\n`
      jsCode += `  headers: {\n`
      jsCode += `    'X-API-Key': apiKey\n`
      jsCode += `  }\n`
      jsCode += `});\n\n`
    }
    
    jsCode += `// Handle the response\n`
    jsCode += `if (response.ok) {\n`
    jsCode += `  const result = await response.json();\n`
    jsCode += `  console.log('Success:', result);\n`
    jsCode += `} else {\n`
    jsCode += `  console.error('Error:', response.status, await response.text());\n`
    jsCode += `}`
    
    return jsCode
  }

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedCode(type)
      setTimeout(() => setCopiedCode(null), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  const simulateApiCall = async () => {
    setIsLoading(true)
    setResponseData(null)
    
    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500))
    
    // Return example response
    setResponseData(selectedEndpoint.responses[0].example)
    setIsLoading(false)
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Interactive API Explorer</h1>
        <p className="text-xl text-gray-600">
          Test Schlep Engine API endpoints with live examples and generate code in multiple languages.
        </p>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Endpoint Selection */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Endpoint</h2>
          <div className="space-y-2">
            {API_ENDPOINTS.map((endpoint, index) => (
              <button
                key={index}
                onClick={() => setSelectedEndpoint(endpoint)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedEndpoint === endpoint
                    ? 'border-blue-300 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    endpoint.method === 'GET' ? 'bg-green-100 text-green-800' :
                    endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                    endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {endpoint.method}
                  </span>
                  <code className="text-sm text-gray-700">{endpoint.path}</code>
                </div>
                <p className="text-sm text-gray-600">{endpoint.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Request Configuration */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {selectedEndpoint.method} {selectedEndpoint.path}
            </h2>
            <p className="text-gray-600 mb-6">{selectedEndpoint.description}</p>

            {/* API Key Input */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk_live_..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Request Body */}
            {selectedEndpoint.requestBody && (
              <div className="mb-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Request Body</h3>
                <div className="space-y-3">
                  {Object.entries(selectedEndpoint.requestBody.properties).map(([key, prop]) => (
                    <div key={key}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {key} {prop.required && <span className="text-red-500">*</span>}
                      </label>
                      <input
                        type={prop.type === 'file' ? 'text' : 'text'}
                        value={requestData[key] || ''}
                        onChange={(e) => setRequestData((prev: any) => ({ ...prev, [key]: e.target.value }))}
                        placeholder={prop.example?.toString() || prop.description}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">{prop.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Try It Button */}
            <button
              onClick={simulateApiCall}
              disabled={isLoading || !apiKey}
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <PlayIcon className="h-4 w-4" />
              {isLoading ? 'Processing...' : 'Try It'}
            </button>

            {/* Response */}
            {(responseData || isLoading) && (
              <div className="mt-6">
                <h3 className="text-sm font-medium text-gray-700 mb-3">Response</h3>
                <div className="bg-gray-900 rounded-lg p-4">
                  {isLoading ? (
                    <div className="flex items-center gap-2 text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                      Making API request...
                    </div>
                  ) : (
                    <pre className="text-sm text-gray-100 overflow-x-auto">
                      {JSON.stringify(responseData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="mt-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Code Examples</h2>
        
        <div className="space-y-6">
          {/* cURL */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">cURL</h3>
              <button
                onClick={() => copyToClipboard(generateCurlCommand(selectedEndpoint), 'curl')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {copiedCode === 'curl' ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                {generateCurlCommand(selectedEndpoint)}
              </pre>
            </div>
          </div>

          {/* Python */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">Python</h3>
              <button
                onClick={() => copyToClipboard(generatePythonCode(selectedEndpoint), 'python')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {copiedCode === 'python' ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                {generatePythonCode(selectedEndpoint)}
              </pre>
            </div>
          </div>

          {/* JavaScript */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900">JavaScript</h3>
              <button
                onClick={() => copyToClipboard(generateJavaScriptCode(selectedEndpoint), 'javascript')}
                className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
              >
                {copiedCode === 'javascript' ? (
                  <>
                    <CheckIcon className="h-4 w-4 text-green-600" />
                    Copied!
                  </>
                ) : (
                  <>
                    <ClipboardIcon className="h-4 w-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                {generateJavaScriptCode(selectedEndpoint)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}