import { CodeBlock } from '@/components/ui/CodeBlock'
import Link from 'next/link'
import { ArrowRightIcon, DocumentTextIcon, ShieldCheckIcon, CloudIcon, CogIcon } from '@heroicons/react/24/outline'

export default function ApiReferencePage() {
  const apiSections = [
    {
      title: 'Financial Services',
      icon: ShieldCheckIcon,
      description: 'AI-powered fraud detection, credit risk assessment, and AML compliance screening',
      href: '/api-reference/financial-ai',
      methods: ['POST /industry/financial/fraud-detection', 'POST /industry/financial/credit-risk', 'POST /industry/financial/aml-check'],
      color: 'text-blue-600'
    },
    {
      title: 'E-commerce',
      icon: CogIcon,
      description: 'Personalized recommendations, demand forecasting, and dynamic pricing optimization',
      href: '/api-reference/ecommerce-ai',
      methods: ['POST /industry/ecommerce/recommendations', 'POST /industry/ecommerce/demand-forecast', 'POST /industry/ecommerce/price-optimization'],
      color: 'text-green-600'
    },
    {
      title: 'Manufacturing',
      icon: CloudIcon,
      description: 'Predictive maintenance, quality control, and forecasting with ML models',
      href: '/api-reference/manufacturing-forecasting',
      methods: ['POST /industry/manufacturing/predictive-maintenance', 'POST /industry/manufacturing/quality-control', 'POST /industry/manufacturing/supply-chain'],
      color: 'text-purple-600'
    },
    {
      title: 'Authentication',
      icon: DocumentTextIcon,
      description: 'User login, API key management, and session handling',
      href: '/api-reference/authentication',
      methods: ['POST /auth/login', 'POST /auth/register', 'POST /auth/refresh'],
      color: 'text-orange-600'
    },
    {
      title: 'Data Processing',
      icon: ShieldCheckIcon,
      description: 'Model execution, parameter tuning, and job management',
      href: '/api-reference/data-processing',
      methods: ['POST /process/start', 'POST /process/configure', 'GET /process/jobs/{id}'],
      color: 'text-red-600'
    },
    {
      title: 'Real-time Processing',
      icon: CloudIcon,
      description: 'WebSocket connections and streaming data endpoints',
      href: '/api-reference/streaming',
      methods: ['WS /stream/connect', 'POST /stream/data', 'GET /stream/status'],
      color: 'text-indigo-600'
    }
  ]

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-4 text-[#114dcd]">
          Getting Started
        </h1>
        <p className="text-sm text-gray-600 mb-6">
          Welcome to Schlep-engine! We’re excited to have you onboard. This guide is your launchpad for getting started.
        </p>
        <p className="text-sm text-gray-600 mb-6">
          Schlep-engine is a REST API platform that transforms messy, unstructured data into ML-ready formats with just a few API calls. It comes with built-in real-time data processing, advanced Machine Learning (ML), and Reinforcement Learning (RL) to deliver powerful, domain-specific solutions across AI, Manufacturing, Financial Services, and E-commerce.
        </p>
        
        
      </div>

      <div className="flex justify-between">
        <div className="flex justify-between">
        <div className="max-w-none">
        {/* Quick Start */}
        <section className="mb-12">
          <h2 id="tldr" className="text-xl font-semibold mb-4 text-[#114dcd]">TL;DR</h2>
          <div className="border-b border-gray-200 mb-4"></div>
          
          
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-blue-800 mb-3">
              Base URL
            </h3>
            <code className="block text-sm text-gray-900">
                https://api.schlep-engine.com
              </code>
          </div>

          <div className="flex flex-col space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">API Key Authentication</h3>
              <CodeBlock
                code={`curl -X POST https://api.schlep-engine.com/api/v1/industry/financial/fraud-detection \
  -H \"Authorization: Bearer sk_your_api_key\" \
  -H \"Content-Type: application/json\" \
  -d '{ \
    \"transaction_id\": \"txn_12345\", \
    \"user_id\": \"user_67890\", \
    \"transaction_amount\": 2500.00, \
    \"merchant_category\": \"electronics\" \
  }'`}
                language="bash"
                title="API Key Authentication"
              />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">User Authentication</h3>
              <CodeBlock
                code={`curl -X POST https://api.schlep-engine.com/api/v1/auth/login \
  -H \"Content-Type: application/json\" \
  -d '{ \
    \"email\": \"user@example.com\", \
    \"password\": \"your_password\" \
  }'`}
                language="bash"
                title="User Authentication"
              />
            </div>
          </div>
        </section>

        {/* SDKs and Libraries */}
        <section className="mb-12">
          <h2 id="sdks-and-libraries" className="text-xl font-semibold mb-6 text-[#114dcd]">SDKs and Libraries</h2>
          
          <p className="text-sm text-gray-600 mb-6">
            For a smoother developer experience, we suggest using our official SDKs instead of making direct REST API calls.
          </p>
          
          <div className="flex flex-row flex-wrap gap-6">
            <Link href="/sdks/python" className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
              <img src="/python.svg" alt="Python Logo" className="h-20 w-20" />
              <div>
                <h4 className="font-medium text-gray-900">Python SDK</h4>
                <p className="text-sm text-gray-600">Full async/await support</p>
              </div>
            </div>
            </Link>
            
            <Link href="/sdks/javascript" className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
              <img src="/JS.svg" alt="JavaScript Logo" className="h-16 w-16 mb-2" />
              <div>
                <h4 className="font-medium text-gray-900">JavaScript/TS</h4>
                <p className="text-sm text-gray-600">Browser & Node.js</p>
              </div>
            </div>
            </Link>
            
            <Link href="/sdks/go" className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
              <img src="/GO.svg" alt="Go Logo" className="h-16 w-16 mb-2" />
              <div>
                <h4 className="font-medium text-gray-900">Go SDK</h4>
                <p className="text-sm text-gray-600">Cloud-native ready</p>
              </div>
            </div>
            </Link>
            
            <Link href="/sdks/cli" className="block p-4 border-b border-gray-200 hover:bg-gray-50 transition-colors">
              <div className="flex items-center space-x-4">
              <img src="/CLI.svg" alt="CLI Logo" className="h-16 w-16 mb-2" />
              <div>
                <h4 className="font-medium text-gray-900">CLI Tool</h4>
                <p className="text-sm text-gray-600">Command-line interface</p>
              </div>
            </div>
            </Link>
          </div>
        </section>

        

        {/* API Sections */}
        <section className="mb-12">
          <h2 id="api-sections" className="text-2xl font-semibold text-gray-900 mb-6">API Sections</h2>
          
          <div className="flex flex-col gap-6">
            {apiSections.map((section, index) => {
              const IconComponent = section.icon
              return (
                <div key={index} className="border-b border-gray-200 pb-6 mb-6">
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
          <h2 id="http-status-codes" className="text-2xl font-semibold text-gray-900 mb-6">HTTP Status Codes</h2>
          
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="w-full border border-gray-200 rounded-lg">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Code</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Meaning</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      200
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">OK</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Request succeeded</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      201
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Created</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Resource created successfully</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      400
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Bad Request</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Invalid request parameters</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      401
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Unauthorized</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Invalid or missing authentication</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      403
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Forbidden</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Insufficient permissions</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      429
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Too Many Requests</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Rate limit exceeded</td>
                </tr>
                <tr>
                  <td className="px-4 py-2 whitespace-nowrap">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      500
                    </span>
                  </td>
                  <td className="px-4 py-2 text-sm font-medium text-gray-900">Internal Server Error</td>
                  <td className="px-4 py-2 text-sm text-gray-600">Server error occurred</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Rate Limiting */}
        <section className="mb-12">
          <h2 id="rate-limiting" className="text-2xl font-semibold text-gray-900 mb-6">Rate Limiting</h2>
          
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

          <div className="flex flex-col gap-6 mt-6">
            <div className="text-center p-4 border-b border-gray-200">
              <div className="text-2xl font-bold text-blue-600 mb-1">1,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Free)</div>
            </div>
            <div className="text-center p-4 border-b border-gray-200">
              <div className="text-2xl font-bold text-green-600 mb-1">10,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Pro)</div>
            </div>
            <div className="text-center p-4 border-b border-gray-200">
              <div className="text-2xl font-bold text-purple-600 mb-1">100,000</div>
              <div className="text-sm text-gray-600">Requests per hour (Enterprise)</div>
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-12">
          <h2 id="error-handling" className="text-2xl font-semibold text-gray-900 mb-6">Error Handling</h2>
          
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

          <div className="flex flex-col gap-6">
            <div className="border-b border-gray-200 pb-4 mb-4">
              <h4 className="font-medium text-gray-900 mb-2">Common Error Codes</h4>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code>VALIDATION_ERROR</code> - Invalid request data</li>
                <li><code>AUTHENTICATION_FAILED</code> - Invalid credentials</li>
                <li><code>INSUFFICIENT_PERMISSIONS</code> - Access denied</li>
                <li><code>RATE_LIMIT_EXCEEDED</code> - Too many requests</li>
                <li><code>RESOURCE_NOT_FOUND</code> - Resource doesn't exist</li>
              </ul>
            </div>
            <div className="border-b border-gray-200 pb-4 mb-4">
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

        

        {/* Resources */}
        <section className="bg-gray-50 rounded-lg p-6">
          <h2 id="additional-resources" className="text-xl font-semibold text-gray-900 mb-4">Additional Resources</h2>
          
          <div className="flex flex-col gap-6">
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
        <div className="w-64 ml-8 hidden lg:block">
          {/* TOC component will go here */}
        </div>
      </div>
    </div>
  )
}