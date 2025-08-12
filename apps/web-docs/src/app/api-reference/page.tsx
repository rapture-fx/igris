import Link from 'next/link'
import { CodeBracketIcon, ArrowRightIcon, CloudArrowUpIcon, CpuChipIcon, DocumentArrowDownIcon, ClockIcon } from '@heroicons/react/24/outline'

export default function ApiReferencePage() {
  const endpoints = [
    {
      method: 'POST',
      path: '/v1/upload',
      description: 'Upload datasets for processing',
      href: '/api-reference/upload',
      icon: CloudArrowUpIcon,
    },
    {
      method: 'POST',
      path: '/v1/profile',
      description: 'Generate intelligent data profiles',
      href: '/api-reference/profiling',
      icon: CpuChipIcon,
    },
    {
      method: 'POST',
      path: '/v1/process',
      description: 'Transform and clean your data',
      href: '/api-reference/processing',
      icon: CpuChipIcon,
    },
    {
      method: 'GET',
      path: '/v1/jobs/{id}',
      description: 'Monitor processing status',
      href: '/api-reference/jobs',
      icon: ClockIcon,
    },
    {
      method: 'GET',
      path: '/v1/download/{id}',
      description: 'Download processed datasets',
      href: '/api-reference/export',
      icon: DocumentArrowDownIcon,
    },
  ]

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">API Reference</h1>
        <p className="text-xl text-gray-600 mb-6">
          Complete reference for the Schlep Engine REST API. All endpoints, parameters, 
          responses, and examples you need to integrate AI-powered data processing.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="/introduction/quickstart"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Quick Start Guide
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="/api-reference/authentication"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Authentication
          </Link>
        </div>
      </div>

      {/* Base URL and Authentication */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Base URL</h2>
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <code className="text-lg font-mono text-gray-900">https://api.schlepengine.com</code>
        </div>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-2">Authentication Required</h3>
          <p className="text-blue-800 text-sm mb-2">
            All API requests require authentication using API keys in the Authorization header.
          </p>
          <Link 
            href="/api-reference/authentication"
            className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-800 text-sm font-medium"
          >
            Learn about authentication
            <ArrowRightIcon className="h-3 w-3" />
          </Link>
        </div>
      </section>

      {/* Quick Example */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quick Example</h2>
        <p className="text-gray-600 mb-4">
          Here's a simple example to upload and process a dataset:
        </p>
        
        <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
          <pre className="text-sm text-gray-100">
{`curl -X POST "https://api.schlepengine.com/v1/upload" \\
  -H "Authorization: Bearer your_api_key" \\
  -H "Content-Type: multipart/form-data" \\
  -F "file=@dataset.csv" \\
  -F "options={\\"auto_profile\\": true}"

# Response
{
  "job_id": "job_123abc",
  "status": "processing",
  "estimated_time": "2-5 minutes"
}`}
          </pre>
        </div>
      </section>

      {/* Core Endpoints */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Core Endpoints</h2>
        <div className="space-y-4">
          {endpoints.map((endpoint, index) => (
            <Link 
              key={index}
              href={endpoint.href}
              className="block border border-gray-200 rounded-lg p-6 hover:border-blue-300 hover:shadow-sm transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  <endpoint.icon className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      endpoint.method === 'GET' ? 'bg-green-100 text-green-800' : 
                      endpoint.method === 'POST' ? 'bg-blue-100 text-blue-800' :
                      endpoint.method === 'PUT' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-gray-900">{endpoint.path}</code>
                  </div>
                  <p className="text-gray-600">{endpoint.description}</p>
                </div>
                <div className="flex-shrink-0">
                  <ArrowRightIcon className="h-5 w-5 text-gray-400" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Data Processing Pipeline */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Data Processing Pipeline</h2>
        <p className="text-gray-600 mb-6">
          Understanding the typical flow of data through our API:
        </p>
        
        <div className="space-y-6">
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              1
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/upload" className="hover:text-blue-600">
                  Data Upload
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Upload CSV, JSON, Excel files, or connect to databases and APIs. Our system automatically detects formats and begins initial analysis.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">CSV</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">JSON</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800 mr-2">Excel</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-800">Databases</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              2
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/profiling" className="hover:text-blue-600">
                  Smart Profiling
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                AI analyzes your data to detect types, quality issues, patterns, and structural anomalies. Generate comprehensive data profiles automatically.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 mr-2">Quality Score</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800 mr-2">Data Types</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-green-100 text-green-800">Issue Detection</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              3
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/processing" className="hover:text-blue-600">
                  AI Processing
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Apply intelligent transformations, clean data, handle missing values, normalize formats, and prepare for ML frameworks.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 mr-2">Auto Clean</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800 mr-2">Outlier Detection</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-purple-100 text-purple-800">ML Ready</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-semibold">
              4
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <Link href="/api-reference/export" className="hover:text-blue-600">
                  Export & Download
                </Link>
              </h3>
              <p className="text-gray-600 mb-2">
                Download processed data in multiple formats or export directly to your preferred ML framework with automated train/test splits.
              </p>
              <div className="text-sm">
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800 mr-2">TensorFlow</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800 mr-2">PyTorch</span>
                <span className="inline-flex items-center px-2 py-1 rounded bg-orange-100 text-orange-800">Parquet</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Additional Resources */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Additional Resources</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <Link 
            href="/api-reference/rate-limits"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate Limits</h3>
            <p className="text-gray-600">
              Understanding API quotas, rate limiting, and how to handle throttling.
            </p>
          </Link>
          
          <Link 
            href="/api-reference/errors"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Handling</h3>
            <p className="text-gray-600">
              Complete error code reference and best practices for error handling.
            </p>
          </Link>
          
          <Link 
            href="/api-reference/webhooks"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Webhooks</h3>
            <p className="text-gray-600">
              Real-time notifications for processing completion and status updates.
            </p>
          </Link>
          
          <Link 
            href="/sdks"
            className="block p-6 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
          >
            <h3 className="text-lg font-semibold text-gray-900 mb-2">SDKs & Libraries</h3>
            <p className="text-gray-600">
              Python, JavaScript, R packages and CLI tools for easier integration.
            </p>
          </Link>
        </div>
      </section>

      {/* Response Standards */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Response Standards</h2>
        <p className="text-gray-600 mb-4">
          All API responses follow consistent patterns with proper HTTP status codes and structured JSON.
        </p>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Success Response (200)</h3>
            <div className="bg-gray-900 rounded p-3 text-sm overflow-x-auto">
              <pre className="text-green-400">
{`{
  "status": "success",
  "data": { ... },
  "message": "Operation completed"
}`}
              </pre>
            </div>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Error Response (4xx/5xx)</h3>
            <div className="bg-gray-900 rounded p-3 text-sm overflow-x-auto">
              <pre className="text-red-400">
{`{
  "status": "error",
  "code": "INVALID_FILE_FORMAT",
  "message": "Unsupported file type",
  "details": { ... }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}