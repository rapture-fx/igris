import { EndpointCard } from '@/components/EndpointCard'
import { CodeBlock } from '@/components/CodeBlock'
import { GlobeAltIcon, ServerIcon, ClockIcon } from '@heroicons/react/24/outline'

export default function ApiReferencePage() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">API Reference</h1>
        <p className="text-xl text-gray-600">
          Complete reference for the Schlep Engine API with examples and interactive documentation.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <GlobeAltIcon className="h-8 w-8 text-schlep-blue mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Base URL</h3>
          <code className="text-sm text-gray-600">https://api.schlepengine.com/v1</code>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <ServerIcon className="h-8 w-8 text-green-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Response Format</h3>
          <code className="text-sm text-gray-600">JSON</code>
        </div>
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <ClockIcon className="h-8 w-8 text-blue-600 mb-3" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Rate Limits</h3>
          <code className="text-sm text-gray-600">1000 req/hour</code>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Authentication</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <p className="text-gray-600 mb-4">
              All API requests must be authenticated using an API key in the Authorization header:
            </p>
            <CodeBlock
              code="Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc"
              language="http"
              title="Authentication Header"
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Common Response Format</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <p className="text-gray-600 mb-4">
              All responses follow a consistent format with metadata and data:
            </p>
            <CodeBlock
              code={`{
  "success": true,
  "data": {
    // Response data here
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789",
    "processing_time_ms": 245
  }
}`}
              language="json"
              title="Success Response"
            />
            
            <div className="mt-4">
              <h4 className="font-semibold text-gray-900 mb-2">Error Response</h4>
              <CodeBlock
                code={`{
  "success": false,
  "error": {
    "type": "validation_error",
    "message": "Invalid file format. Supported formats: CSV, JSON, Excel",
    "code": "invalid_file_format",
    "details": {
      "provided_format": "txt",
      "supported_formats": ["csv", "json", "xlsx"]
    }
  },
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "request_id": "req_123456789"
  }
}`}
                language="json"
                title="Error Response"
              />
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Quick Reference</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Endpoint
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/upload</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      POST
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Upload data files for processing
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/profile/{'{upload_id}'}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      GET
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Get data profile and quality analysis
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/process</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      POST
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Start data processing job
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/jobs/{'{job_id}'}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      GET
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Get job status and progress
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/export/{'{job_id}'}</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      GET
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Download processed data
                  </td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <code className="text-sm text-gray-900">/webhooks</code>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      POST
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    Configure webhook endpoints
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Next Steps</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <a href="/api-reference/upload" className="text-schlep-blue hover:text-schlep-purple">
                  → Data Upload API
                </a>
              </h3>
              <p className="text-gray-600 text-sm">
                Learn how to upload files and connect data sources
              </p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                <a href="/api-reference/processing" className="text-schlep-blue hover:text-schlep-purple">
                  → Data Processing API
                </a>
              </h3>
              <p className="text-gray-600 text-sm">
                Start processing jobs and configure transformations
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}