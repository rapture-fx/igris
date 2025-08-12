'use client'

import { useState, useEffect } from 'react'
import { 
  Terminal, 
  Play, 
  Copy, 
  Check, 
  ChevronDown, 
  ChevronRight,
  FileText,
  Code2,
  Send,
  Book,
  Zap,
  Database,
  Key,
  Globe
} from 'lucide-react'

interface APIEndpoint {
  id: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  path: string
  description: string
  category: string
  parameters: Parameter[]
  response: any
  example: string
}

interface Parameter {
  name: string
  type: string
  required: boolean
  description: string
  example: any
}

export default function APIPlayground() {
  const [endpoints, setEndpoints] = useState<APIEndpoint[]>([])
  const [selectedEndpoint, setSelectedEndpoint] = useState<APIEndpoint | null>(null)
  const [requestBody, setRequestBody] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'parameters' | 'body' | 'headers'>('parameters')

  useEffect(() => {
    // Mock API endpoints
    const mockEndpoints: APIEndpoint[] = [
      {
        id: '1',
        method: 'POST',
        path: '/api/v1/data/upload',
        description: 'Upload a dataset for processing',
        category: 'Data Management',
        parameters: [
          { name: 'file', type: 'file', required: true, description: 'Dataset file to upload', example: 'data.csv' },
          { name: 'format', type: 'string', required: false, description: 'File format override', example: 'csv' }
        ],
        response: {
          dataset_id: 'ds_123456789',
          status: 'uploaded',
          size: '2.3MB',
          rows: 150000,
          columns: 12
        },
        example: `curl -X POST "https://api.schlepengine.com/v1/data/upload" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -F "file=@data.csv"`
      },
      {
        id: '2',
        method: 'GET',
        path: '/api/v1/data/{dataset_id}/status',
        description: 'Get dataset processing status',
        category: 'Data Management',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'Dataset identifier', example: 'ds_123456789' }
        ],
        response: {
          dataset_id: 'ds_123456789',
          status: 'ready',
          quality_score: 94.5,
          issues: [],
          processing_time: '2m 34s'
        },
        example: `curl -X GET "https://api.schlepengine.com/v1/data/ds_123456789/status" \\
  -H "Authorization: Bearer YOUR_API_KEY"`
      },
      {
        id: '3',
        method: 'POST',
        path: '/api/v1/ml/auto-label',
        description: 'Apply ML auto-labeling to dataset',
        category: 'Machine Learning',
        parameters: [
          { name: 'dataset_id', type: 'string', required: true, description: 'Dataset to label', example: 'ds_123456789' },
          { name: 'model', type: 'string', required: false, description: 'Model to use', example: 'classification_v2' },
          { name: 'confidence_threshold', type: 'number', required: false, description: 'Minimum confidence', example: 0.85 }
        ],
        response: {
          job_id: 'job_987654321',
          status: 'running',
          estimated_time: '5-10 minutes',
          records_to_label: 150000
        },
        example: `curl -X POST "https://api.schlepengine.com/v1/ml/auto-label" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"dataset_id": "ds_123456789", "model": "classification_v2"}'`
      },
      {
        id: '4',
        method: 'GET',
        path: '/api/v1/pipelines',
        description: 'List all data processing pipelines',
        category: 'Pipelines',
        parameters: [
          { name: 'status', type: 'string', required: false, description: 'Filter by status', example: 'running' },
          { name: 'limit', type: 'number', required: false, description: 'Number of results', example: 50 }
        ],
        response: {
          pipelines: [
            {
              id: 'pipe_123',
              name: 'Customer Data Processing',
              status: 'running',
              created_at: '2024-01-15T10:30:00Z'
            }
          ],
          total: 1,
          page: 1,
          limit: 50
        },
        example: `curl -X GET "https://api.schlepengine.com/v1/pipelines?status=running" \\
  -H "Authorization: Bearer YOUR_API_KEY"`
      },
      {
        id: '5',
        method: 'POST',
        path: '/api/v1/pipelines/{pipeline_id}/run',
        description: 'Execute a data processing pipeline',
        category: 'Pipelines',
        parameters: [
          { name: 'pipeline_id', type: 'string', required: true, description: 'Pipeline identifier', example: 'pipe_123' },
          { name: 'input_dataset', type: 'string', required: true, description: 'Input dataset ID', example: 'ds_123456789' }
        ],
        response: {
          execution_id: 'exec_555666777',
          status: 'started',
          pipeline_id: 'pipe_123',
          estimated_duration: '15 minutes'
        },
        example: `curl -X POST "https://api.schlepengine.com/v1/pipelines/pipe_123/run" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"input_dataset": "ds_123456789"}'`
      }
    ]

    setEndpoints(mockEndpoints)
    setSelectedEndpoint(mockEndpoints[0])
  }, [])

  const handleExecuteAPI = async () => {
    setIsLoading(true)
    setResponse('')
    
    // Simulate API call
    setTimeout(() => {
      const mockResponse = JSON.stringify(selectedEndpoint?.response, null, 2)
      setResponse(mockResponse)
      setIsLoading(false)
    }, 1500)
  }

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text)
    setCopiedCode(type)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-green-400 bg-green-900/20 border-green-700'
      case 'POST': return 'text-blue-400 bg-blue-900/20 border-blue-700'
      case 'PUT': return 'text-yellow-400 bg-yellow-900/20 border-yellow-700'
      case 'DELETE': return 'text-red-400 bg-red-900/20 border-red-700'
      default: return 'text-gray-400 bg-gray-900/20 border-gray-700'
    }
  }

  const categories = Array.from(new Set(endpoints.map(e => e.category)))

  return (
    <div className="min-h-screen bg-[#0f0f0f]">
      {/* Header */}
      <header className="bg-[#161616] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">API Playground</h1>
              <p className="text-gray-400 mt-1">Test and explore Schlep Engine APIs interactively</p>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-[#1a1a1a] text-gray-300 border border-gray-700 rounded-lg hover:bg-[#2a2a2a] transition-colors"
              >
                <Book className="w-4 h-4 mr-2" />
                Full Documentation
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* API Endpoints List */}
          <div className="lg:col-span-1">
            <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4">API Endpoints</h2>
              
              {categories.map((category) => (
                <div key={category} className="mb-6">
                  <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
                    {category}
                  </h3>
                  <div className="space-y-2">
                    {endpoints.filter(e => e.category === category).map((endpoint) => (
                      <div
                        key={endpoint.id}
                        className={`p-3 rounded-lg cursor-pointer transition-all hover:bg-gray-900/50 ${
                          selectedEndpoint?.id === endpoint.id
                            ? 'bg-[#468BE6]/10 border border-[#468BE6]'
                            : 'bg-[#0f0f0f] border border-gray-800'
                        }`}
                        onClick={() => setSelectedEndpoint(endpoint)}
                      >
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded border ${getMethodColor(endpoint.method)}`}>
                            {endpoint.method}
                          </span>
                          <span className="text-white text-sm font-mono">{endpoint.path}</span>
                        </div>
                        <p className="text-gray-400 text-xs">{endpoint.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* API Testing Panel */}
          <div className="lg:col-span-2">
            {selectedEndpoint ? (
              <div className="space-y-6">
                {/* Endpoint Header */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl p-6">
                  <div className="flex items-center space-x-4 mb-4">
                    <span className={`px-3 py-1.5 text-sm font-medium rounded border ${getMethodColor(selectedEndpoint.method)}`}>
                      {selectedEndpoint.method}
                    </span>
                    <span className="text-white font-mono text-lg">{selectedEndpoint.path}</span>
                  </div>
                  <p className="text-gray-400">{selectedEndpoint.description}</p>
                </div>

                {/* Request Configuration */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl">
                  <div className="flex border-b border-gray-800">
                    <button
                      onClick={() => setActiveTab('parameters')}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'parameters'
                          ? 'text-[#468BE6] border-b-2 border-[#468BE6]'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Parameters
                    </button>
                    <button
                      onClick={() => setActiveTab('body')}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'body'
                          ? 'text-[#468BE6] border-b-2 border-[#468BE6]'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Request Body
                    </button>
                    <button
                      onClick={() => setActiveTab('headers')}
                      className={`px-6 py-4 text-sm font-medium transition-colors ${
                        activeTab === 'headers'
                          ? 'text-[#468BE6] border-b-2 border-[#468BE6]'
                          : 'text-gray-400 hover:text-white'
                      }`}
                    >
                      Headers
                    </button>
                  </div>

                  <div className="p-6">
                    {activeTab === 'parameters' && (
                      <div className="space-y-4">
                        {selectedEndpoint.parameters.map((param) => (
                          <div key={param.name} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                            <div>
                              <label className="block text-sm font-medium text-white mb-1">
                                {param.name}
                                {param.required && <span className="text-red-400 ml-1">*</span>}
                              </label>
                              <span className="text-xs text-gray-400">{param.type}</span>
                            </div>
                            <div className="md:col-span-2">
                              <input
                                type="text"
                                placeholder={String(param.example)}
                                className="w-full bg-[#0f0f0f] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-[#468BE6]"
                              />
                              <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {activeTab === 'body' && (
                      <div>
                        <label className="block text-sm font-medium text-white mb-2">Request Body (JSON)</label>
                        <textarea
                          value={requestBody}
                          onChange={(e) => setRequestBody(e.target.value)}
                          placeholder='{"key": "value"}'
                          className="w-full h-32 bg-[#0f0f0f] border border-gray-700 rounded-lg px-3 py-2 text-white placeholder-gray-400 font-mono text-sm focus:outline-none focus:border-[#468BE6]"
                        />
                      </div>
                    )}

                    {activeTab === 'headers' && (
                      <div className="space-y-4">
                        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Key className="w-4 h-4 text-[#468BE6]" />
                            <span className="text-white font-medium">Authorization</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Bearer YOUR_API_KEY"
                            className="w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-400 font-mono text-sm focus:outline-none focus:border-[#468BE6]"
                          />
                        </div>
                        <div className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <Globe className="w-4 h-4 text-green-400" />
                            <span className="text-white font-medium">Content-Type</span>
                          </div>
                          <select className="w-full bg-transparent border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-[#468BE6]">
                            <option value="application/json">application/json</option>
                            <option value="multipart/form-data">multipart/form-data</option>
                            <option value="application/x-www-form-urlencoded">application/x-www-form-urlencoded</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Execute Button */}
                <div className="flex justify-center">
                  <button
                    onClick={handleExecuteAPI}
                    disabled={isLoading}
                    className="inline-flex items-center px-8 py-3 bg-[#468BE6] text-white rounded-lg hover:bg-[#3a7bd5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    ) : (
                      <Send className="w-4 h-4 mr-2" />
                    )}
                    {isLoading ? 'Executing...' : 'Send Request'}
                  </button>
                </div>

                {/* Response */}
                {(response || isLoading) && (
                  <div className="bg-[#161616] border border-gray-800 rounded-xl">
                    <div className="flex items-center justify-between p-4 border-b border-gray-800">
                      <h3 className="text-lg font-semibold text-white">Response</h3>
                      {response && (
                        <button
                          onClick={() => copyToClipboard(response, 'response')}
                          className="inline-flex items-center px-3 py-1.5 bg-[#0f0f0f] border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-900 transition-colors"
                        >
                          {copiedCode === 'response' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                        </button>
                      )}
                    </div>
                    <div className="p-4">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="w-6 h-6 border-2 border-[#468BE6] border-t-transparent rounded-full animate-spin mr-3" />
                          <span className="text-gray-400">Executing request...</span>
                        </div>
                      ) : (
                        <pre className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                          <code>{response}</code>
                        </pre>
                      )}
                    </div>
                  </div>
                )}

                {/* Code Example */}
                <div className="bg-[#161616] border border-gray-800 rounded-xl">
                  <div className="flex items-center justify-between p-4 border-b border-gray-800">
                    <h3 className="text-lg font-semibold text-white">Code Example</h3>
                    <button
                      onClick={() => copyToClipboard(selectedEndpoint.example, 'example')}
                      className="inline-flex items-center px-3 py-1.5 bg-[#0f0f0f] border border-gray-700 rounded text-sm text-gray-300 hover:bg-gray-900 transition-colors"
                    >
                      {copiedCode === 'example' ? <Check className="w-3 h-3 mr-1" /> : <Copy className="w-3 h-3 mr-1" />}
                      Copy
                    </button>
                  </div>
                  <div className="p-4">
                    <pre className="bg-[#0f0f0f] border border-gray-800 rounded-lg p-4 text-sm text-gray-300 overflow-x-auto">
                      <code>{selectedEndpoint.example}</code>
                    </pre>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-[#161616] border border-gray-800 rounded-xl p-12 text-center">
                <Terminal className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-white mb-2">Select an API Endpoint</h3>
                <p className="text-gray-400">Choose an endpoint from the list to start testing</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}