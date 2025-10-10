'use client'

import React from 'react'
import { CodeBlock } from '@/components/ui/CodeBlock'
import Link from 'next/link'
import { ArrowRightIcon, DocumentTextIcon, ShieldCheckIcon, CloudIcon, CogIcon } from '@heroicons/react/24/outline'

export default function ApiReferencePage() {
  const apiSections = [
    {
      title: 'Model Deployment',
      icon: ShieldCheckIcon,
      description: 'Deploy AI models with automatic optimization and intelligent routing',
      href: '/api-reference/model-deployment',
      methods: ['POST /fabric/v1/models/deploy', 'POST /fabric/v1/models/configure', 'GET /fabric/v1/models/list'],
      color: 'text-blue-600'
    },
    {
      title: 'Optimized Inference',
      icon: CloudIcon,
      description: 'Run predictions with Thompson sampling routing and cost optimization',
      href: '/api-reference/inference',
      methods: ['POST /fabric/v1/predict', 'POST /fabric/v1/batch-predict', 'GET /fabric/v1/predictions/{id}'],
      color: 'text-green-600'
    },
    {
      title: 'Performance Monitoring',
      icon: CogIcon,
      description: 'Real-time metrics, cache performance, and cost tracking',
      href: '/api-reference/monitoring',
      methods: ['GET /fabric/v1/metrics', 'GET /fabric/v1/performance', 'GET /fabric/v1/caching'],
      color: 'text-purple-600'
    },
    {
      title: 'Authentication & Security',
      icon: DocumentTextIcon,
      description: 'JWT authentication, API key management, and enterprise security',
      href: '/api-reference/authentication',
      methods: ['POST /fabric/v1/auth/login', 'POST /fabric/v1/auth/token', 'GET /fabric/v1/auth/validate'],
      color: 'text-orange-600'
    },
    {
      title: 'Cache Management',
      icon: ShieldCheckIcon,
      description: 'L1/L2/L3 cache configuration and performance optimization',
      href: '/api-reference/cache-management',
      methods: ['POST /fabric/v1/cache/configure', 'GET /fabric/v1/cache/stats', 'DELETE /fabric/v1/cache/invalidate'],
      color: 'text-red-600'
    },
    {
      title: 'Cost Optimization',
      icon: CloudIcon,
      description: 'Configure cost optimization targets and budget management',
      href: '/api-reference/cost-optimization',
      methods: ['POST /fabric/v1/cost/optimize', 'GET /fabric/v1/cost/analytics', 'PUT /fabric/v1/cost/budget'],
      color: 'text-indigo-600'
    }
  ]

  return (
    <div className="max-w-none mx-auto p-4">
      <div className="max-w-none">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold mb-4 text-[#114dcd]">
            Getting Started
          </h1>
          <p className="text-sm text-gray-600 mb-6">
            Welcome to Schlep-engine! We're excited to have you onboard. This guide is your launchpad for getting started.
          </p>
          <p className="text-sm text-gray-600 mb-6">
            Schlep-engine is an enterprise-grade AI inference optimization platform that delivers sub-10ms latency with Thompson sampling routing, multi-tier caching, and intelligent cost management for production ML workloads.
          </p>
        </div>

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
                code={`curl -X POST https://api.schlep-engine.com/api/v1/industry/financial/fraud-detection \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{ \\
    "transaction_id": "txn_12345", \\
    "user_id": "user_67890", \\
    "transaction_amount": 2500.00, \\
    "merchant_category": "electronics" \\
  }'`}
                language="bash"
                title="API Key Authentication"
              />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">User Authentication</h3>
              <CodeBlock
                code={`curl -X POST https://api.schlep-engine.com/api/v1/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{ \\
    "email": "user@example.com", \\
    "password": "your_password" \\
  }'`}
                language="bash"
                title="User Authentication"
              />
            </div>
          </div>
        </section>

        {/* SDKs and Libraries */}
        <section className="mb-12">
          <h2 id="fabric-sdks" className="text-xl font-semibold mb-6 text-[#114dcd]">Fabric SDKs</h2>
          
          <p className="text-sm text-gray-600 mb-6">
            For optimal AI inference integration, use our fabric SDKs that handle Thompson sampling, caching, and optimization automatically.
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
          <h2 id="fabric-api-sections" className="text-2xl font-semibold text-gray-900 mb-6">Inference Fabric API Sections</h2>
          
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
          <h2 id="fabric-resources" className="text-xl font-semibold text-gray-900 mb-4">Fabric Resources</h2>
          
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
                  <Link href="https://postman.com/schlep-engine/fabric" className="text-blue-600 hover:text-blue-700">
                    Fabric Collection →
                  </Link>
                </li>
                <li>
                  <Link href="/sdks/openapi" className="text-blue-600 hover:text-blue-700">
                    Fabric OpenAPI Generator →
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
                  <Link href="/introduction/examples" className="text-blue-600 hover:text-blue-700">
                    Inference Examples →
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