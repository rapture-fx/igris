import Link from 'next/link'
import { ArrowRightIcon, DocumentTextIcon, ShieldCheckIcon, CloudIcon, CogIcon } from '@heroicons/react/24/outline'

export default function ApiReferencePage() {
  const apiSections = [
    {
      title: 'Authentication',
      icon: ShieldCheckIcon,
      description: 'User login, API key management, and session handling',
      href: '/api-reference/authentication',
      methods: ['POST /auth/login', 'POST /auth/register', 'POST /auth/refresh'],
      color: 'text-blue-600'
    },
    {
      title: 'Data Processing',
      icon: CogIcon,
      description: 'File processing, data transformation, and quality analysis',
      href: '/api-reference/data-processing',
      methods: ['POST /data/process', 'GET /data/jobs/{id}', 'POST /data/pipelines'],
      color: 'text-green-600'
    },
    {
      title: 'Machine Learning',
      icon: CloudIcon,
      description: 'Model training, predictions, and pipeline management',
      href: '/api-reference/ml-pipeline',
      methods: ['POST /ml/pipelines', 'POST /ml/train', 'POST /ml/predict'],
      color: 'text-purple-600'
    },
    {
      title: 'Document Extraction',
      icon: DocumentTextIcon,
      description: 'Extract text and structured data from documents',
      href: '/api-reference/document-extraction',
      methods: ['POST /extract/text', 'POST /extract/tables', 'GET /extract/jobs/{id}'],
      color: 'text-orange-600'
    },
    {
      title: 'Data Quality',
      icon: ShieldCheckIcon,
      description: 'Data validation, profiling, and quality assessment',
      href: '/api-reference/data-quality',
      methods: ['POST /quality/assess', 'GET /quality/reports/{id}', 'POST /quality/rules'],
      color: 'text-red-600'
    },
    {
      title: 'Storage & Files',
      icon: CloudIcon,
      description: 'File upload, download, and storage management',
      href: '/api-reference/storage',
      methods: ['POST /storage/upload', 'GET /storage/files/{id}', 'DELETE /storage/files/{id}'],
      color: 'text-indigo-600'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          API Reference
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Complete REST API documentation for Schlep Engine. Build powerful data processing, machine learning, 
          and analytics applications with our comprehensive API.
        </p>
        
        <div className="flex gap-4">
          <Link
            href="https://api.schlep-engine.com/docs"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Interactive API Docs
            <ArrowRightIcon className="h-4 w-4" />
          </Link>
          <Link
            href="https://api.schlep-engine.com/openapi.json"
            className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
          >
            OpenAPI Spec
          </Link>
        </div>
      </div>

      <div className="prose prose-lg max-w-none">
        {/* Quick Start */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Start</h2>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Base URL
            </h3>
            <code className="text-blue-700 bg-blue-100 px-2 py-1 rounded">
              https://api.schlep-engine.com
            </code>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">API Key Authentication</h3>
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-gray-100">
{`curl -X POST https://api.schlep-engine.com/v1/data/process \\
  -H "Authorization: Bearer sk-your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "file_url": "https://example.com/data.csv",
    "format": "csv"
  }'`}
                </pre>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">User Authentication</h3>
              <div className="bg-gray-900 rounded-lg p-4">
                <pre className="text-sm text-gray-100">
{`curl -X POST https://api.schlep-engine.com/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* API Sections */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">API Sections</h2>
          
          <div className="grid gap-6">
            {apiSections.map((section, index) => {
              const IconComponent = section.icon
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-6 hover:border-blue-300 transition-colors">
                  <div className="flex items-start gap-4">
                    <IconComponent className={`h-8 w-8 ${section.color} mt-1 flex-shrink-0`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">{section.title}</h3>
                        <Link
                          href={section.href}
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 font-medium"
                        >
                          View Details
                          <ArrowRightIcon className="h-4 w-4" />
                        </Link>
                      </div>
                      <p className="text-gray-600 mb-4">{section.description}</p>
                      
                      <div className="mb-3">
                        <h4 className="font-medium text-gray-900 mb-2">Key Endpoints:</h4>
                        <div className="space-y-1">
                          {section.methods.map((method, i) => (
                            <div key={i} className="bg-gray-50 rounded px-2 py-1 text-sm font-mono">
                              {method}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* HTTP Status Codes */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">HTTP Status Codes</h2>
          
          <div className="overflow-x-auto">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Code</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meaning</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      200
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">OK</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Request succeeded</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      201
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Created</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Resource created successfully</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      400
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Bad Request</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Invalid request parameters</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      401
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Unauthorized</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Invalid or missing authentication</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      403
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Forbidden</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Insufficient permissions</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      429
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Too Many Requests</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Rate limit exceeded</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      500
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">Internal Server Error</td>
                  <td className="px-6 py-4 text-sm text-gray-600">Server error occurred</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limiting */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Rate Limiting</h2>
          
          <p className="text-gray-600 mb-4">
            The API uses rate limiting to ensure fair usage. Rate limits are applied per API key or user account.
          </p>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Rate Limit Headers</h3>
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="text-sm text-gray-100">
{`HTTP/1.1 200 OK
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
Retry-After: 3600`}
              </pre>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-1">1,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Free)</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-1">10,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Pro)</div>
            </div>
            <div className="text-center p-4 border border-gray-200 rounded-lg">
              <div className="text-2xl font-bold text-purple-600 mb-1">100,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Enterprise)</div>
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">Error Handling</h2>
          
          <p className="text-gray-600 mb-4">
            All errors return a JSON response with a consistent structure:
          </p>
          
          <div className="bg-gray-900 rounded-lg p-4 mb-6">
            <pre className="text-sm text-gray-100">
{`{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request data is invalid",
    "details": {
      "field": "email",
      "issue": "Invalid email format"
    },
    "request_id": "req_1234567890"
  }
}`}
            </pre>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Common Error Codes</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code>VALIDATION_ERROR</code> - Invalid request data</li>
                <li><code>AUTHENTICATION_FAILED</code> - Invalid credentials</li>
                <li><code>INSUFFICIENT_PERMISSIONS</code> - Access denied</li>
                <li><code>RATE_LIMIT_EXCEEDED</code> - Too many requests</li>
                <li><code>RESOURCE_NOT_FOUND</code> - Resource doesn't exist</li>
              </ul>
            </div>
            <div className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Error Response Fields</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code>code</code> - Machine-readable error code</li>
                <li><code>message</code> - Human-readable description</li>
                <li><code>details</code> - Additional context (optional)</li>
                <li><code>request_id</code> - Unique request identifier</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SDKs and Libraries */}
        <section className="mb-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-6">SDKs and Libraries</h2>
          
          <p className="text-gray-600 mb-6">
            Instead of calling the REST API directly, we recommend using our official SDKs for a better developer experience:
          </p>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/sdks/python" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="text-2xl mb-2">🐍</div>
              <h4 className="font-medium text-gray-900">Python SDK</h4>
              <p className="text-sm text-gray-600">Full async/await support</p>
            </Link>
            
            <Link href="/sdks/javascript" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="text-2xl mb-2">⚡</div>
              <h4 className="font-medium text-gray-900">JavaScript/TS</h4>
              <p className="text-sm text-gray-600">Browser & Node.js</p>
            </Link>
            
            <Link href="/sdks/go" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="text-2xl mb-2">🚀</div>
              <h4 className="font-medium text-gray-900">Go SDK</h4>
              <p className="text-sm text-gray-600">Cloud-native ready</p>
            </Link>
            
            <Link href="/sdks/cli" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="text-2xl mb-2">🔧</div>
              <h4 className="font-medium text-gray-900">CLI Tool</h4>
              <p className="text-sm text-gray-600">Command-line interface</p>
            </Link>
          </div>
        </section>

        {/* Resources */}
        <section className="bg-gray-50 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Additional Resources</h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">📚 Documentation</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/introduction/quickstart" className="text-blue-600 hover:text-blue-700">
                    Quick Start Guide →
                  </Link>
                </li>
                <li>
                  <Link href="/guides/best-practices" className="text-blue-600 hover:text-blue-700">
                    Best Practices →
                  </Link>
                </li>
                <li>
                  <Link href="/guides/troubleshooting" className="text-blue-600 hover:text-blue-700">
                    Troubleshooting →
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-3">🔗 Tools</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="https://api.schlep-engine.com/docs" className="text-blue-600 hover:text-blue-700">
                    Interactive API Explorer →
                  </Link>
                </li>
                <li>
                  <Link href="https://postman.com/schlep-engine" className="text-blue-600 hover:text-blue-700">
                    Postman Collection →
                  </Link>
                </li>
                <li>
                  <Link href="/sdks/openapi" className="text-blue-600 hover:text-blue-700">
                    OpenAPI Generator →
                  </Link>
                </li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-medium text-gray-900 mb-3">💬 Support</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="https://github.com/schlep-engine/api/discussions" className="text-blue-600 hover:text-blue-700">
                    GitHub Discussions →
                  </Link>
                </li>
                <li>
                  <Link href="mailto:support@schlep-engine.com" className="text-blue-600 hover:text-blue-700">
                    Email Support →
                  </Link>
                </li>
                <li>
                  <Link href="/use-cases" className="text-blue-600 hover:text-blue-700">
                    Use Cases & Examples →
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}