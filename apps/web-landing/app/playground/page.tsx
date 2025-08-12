'use client'

import { useState } from 'react'
import { Play, Copy, Download, Upload, Settings, Zap } from 'lucide-react'
import Header from '@/src/components/sections/Header'
import Footer from '@/src/components/sections/Footer'

export default function PlaygroundPage() {
  const [activeEndpoint, setActiveEndpoint] = useState('transform')
  const [apiKey, setApiKey] = useState('sk-proj-demo-key-123')
  const [request, setRequest] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)

  const endpoints = {
    transform: {
      title: 'Data Transform',
      method: 'POST',
      url: '/v1/transform',
      description: 'Transform and clean your data for ML',
      example: `{
  "file": "uploaded_file.csv",
  "format": "tensorflow",
  "transformations": ["normalize", "handle_missing"],
  "options": {
    "quality_threshold": 0.9,
    "encoding": "utf-8"
  }
}`
    },
    validate: {
      title: 'Data Validation',
      method: 'POST',
      url: '/v1/validate',
      description: 'Validate data quality and structure',
      example: `{
  "file": "uploaded_file.csv",
  "schema": {
    "name": "string",
    "age": "number",
    "email": "email"
  },
  "strict": true
}`
    },
    analyze: {
      title: 'Data Analysis',
      method: 'POST',
      url: '/v1/analyze',
      description: 'Get insights and statistics about your data',
      example: `{
  "file": "uploaded_file.csv",
  "include": ["statistics", "correlations", "outliers"],
  "visualizations": true
}`
    },
    batch: {
      title: 'Batch Processing',
      method: 'POST',
      url: '/v1/batch',
      description: 'Process multiple files simultaneously',
      example: `{
  "files": ["file1.csv", "file2.json", "file3.xlsx"],
  "operations": [
    {
      "type": "transform",
      "format": "tensorflow"
    },
    {
      "type": "validate",
      "schema_id": "user_schema_123"
    }
  ]
}`
    }
  }

  const handleRunRequest = async () => {
    setLoading(true)
    
    // Simulate API call
    setTimeout(() => {
      const mockResponse = {
        transform: {
          status: "success",
          processing_time: "2.3s",
          quality_score: 0.98,
          records_processed: 15420,
          download_url: "https://api.schlep-engine.com/download/abc123",
          transformations_applied: ["normalize", "handle_missing"],
          metadata: {
            original_size: "2.4MB",
            processed_size: "2.1MB",
            columns: 12,
            rows: 15420
          }
        },
        validate: {
          status: "completed",
          validation_score: 0.95,
          errors: 23,
          warnings: 5,
          total_records: 10000,
          valid_records: 9972,
          issues: [
            { type: "missing_value", column: "email", count: 18 },
            { type: "invalid_format", column: "phone", count: 5 }
          ]
        },
        analyze: {
          status: "success",
          analysis_type: "comprehensive",
          statistics: {
            numerical_columns: 8,
            categorical_columns: 4,
            missing_values: 0.02,
            duplicates: 12
          },
          insights: [
            "Strong correlation between age and income (0.78)",
            "Outliers detected in salary column (3 records)",
            "Email column has 95% unique values"
          ]
        },
        batch: {
          status: "processing",
          job_id: "batch_job_789",
          files_processed: 2,
          total_files: 3,
          estimated_completion: "45 seconds",
          results: [
            { file: "file1.csv", status: "completed" },
            { file: "file2.json", status: "completed" },
            { file: "file3.xlsx", status: "processing" }
          ]
        }
      }

      setResponse(JSON.stringify(mockResponse[activeEndpoint as keyof typeof mockResponse], null, 2))
      setLoading(false)
    }, 1500)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="pt-24 pb-16">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
              API <span className="text-[#468BE6]">Playground</span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Test our API endpoints in real-time. No setup required - just select an endpoint and try it out.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-lg border overflow-hidden">
            <div className="border-b border-gray-200">
              <div className="flex flex-wrap">
                {Object.entries(endpoints).map(([key, endpoint]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setActiveEndpoint(key)
                      setRequest(endpoint.example)
                    }}
                    className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeEndpoint === key
                        ? 'border-[#468BE6] text-[#468BE6] bg-blue-50/50'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {endpoint.title}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-8">
              <div className="grid lg:grid-cols-2 gap-8">
                {/* Request Panel */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Request</h3>
                    
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <span className={`px-3 py-1 rounded text-sm font-medium ${
                          endpoints[activeEndpoint as keyof typeof endpoints].method === 'POST' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {endpoints[activeEndpoint as keyof typeof endpoints].method}
                        </span>
                        <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono">
                          {endpoints[activeEndpoint as keyof typeof endpoints].url}
                        </code>
                      </div>

                      <p className="text-gray-600 text-sm">
                        {endpoints[activeEndpoint as keyof typeof endpoints].description}
                      </p>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          API Key
                        </label>
                        <div className="flex">
                          <input
                            type="text"
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg text-sm font-mono focus:ring-[#468BE6] focus:border-[#468BE6]"
                            placeholder="Enter your API key"
                          />
                          <button
                            onClick={() => copyToClipboard(apiKey)}
                            className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Request Body
                        </label>
                        <div className="relative">
                          <textarea
                            value={request || endpoints[activeEndpoint as keyof typeof endpoints].example}
                            onChange={(e) => setRequest(e.target.value)}
                            className="w-full h-64 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-[#468BE6] focus:border-[#468BE6] resize-none"
                            placeholder="Enter your request body..."
                          />
                          <button
                            onClick={() => copyToClipboard(request || endpoints[activeEndpoint as keyof typeof endpoints].example)}
                            className="absolute top-2 right-2 p-1.5 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <button
                        onClick={handleRunRequest}
                        disabled={loading}
                        className="w-full bg-[#468BE6] text-white py-3 px-6 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium flex items-center justify-center space-x-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            <span>Processing...</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            <span>Send Request</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Response Panel */}
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Response</h3>
                    
                    <div className="space-y-4">
                      {response ? (
                        <div className="relative">
                          <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-96 font-mono">
                            <code>{response}</code>
                          </pre>
                          <button
                            onClick={() => copyToClipboard(response)}
                            className="absolute top-2 right-2 p-1.5 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5 text-gray-300" />
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                          <Zap className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-gray-500">Click "Send Request" to see the response</p>
                        </div>
                      )}

                      {response && (
                        <div className="flex space-x-3">
                          <button className="flex-1 bg-green-50 text-green-700 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 hover:bg-green-100 transition-colors">
                            <Download className="w-4 h-4" />
                            <span>Download Result</span>
                          </button>
                          <button className="flex-1 bg-blue-50 text-blue-700 py-2 px-4 rounded-lg text-sm font-medium flex items-center justify-center space-x-2 hover:bg-blue-100 transition-colors">
                            <Settings className="w-4 h-4" />
                            <span>View Details</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Upload className="w-8 h-8 text-[#468BE6] mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">File Upload</h3>
              <p className="text-sm text-gray-600">
                Upload CSV, JSON, Excel files up to 100MB. Supports multiple formats and encodings.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Zap className="w-8 h-8 text-[#468BE6] mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Real-time Processing</h3>
              <p className="text-sm text-gray-600">
                See live progress updates and real-time results. No polling required.
              </p>
            </div>
            
            <div className="bg-white rounded-xl p-6 shadow-sm border">
              <Download className="w-8 h-8 text-[#468BE6] mb-3" />
              <h3 className="font-semibold text-gray-900 mb-2">Multiple Outputs</h3>
              <p className="text-sm text-gray-600">
                Export to TensorFlow, PyTorch, Pandas, CSV, or JSON formats instantly.
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}