import { ApiLayout } from '@/components/ui/ApiLayout'
import { ExclamationTriangleIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function RateLimitsPage() {
  return (
    <ApiLayout 
      title="Rate Limits"
      description="Understanding and handling API rate limits to ensure optimal performance and fair usage across all users."
    >
      {/* Rate Limit Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limit Overview</h2>
        <p className="text-gray-600 mb-6">
          Schlep Engine implements rate limiting to ensure fair usage and maintain system performance. 
          Limits are applied per API key and are based on a sliding window algorithm.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <ChartBarIcon className="h-6 w-6 text-blue-600" />
            <h3 className="font-semibold text-blue-900">Rate Limiting Strategy</h3>
          </div>
          <ul className="text-blue-800 text-sm space-y-2">
            <li>• <strong>Sliding Window:</strong> Requests are counted over a rolling time period</li>
            <li>• <strong>Per API Key:</strong> Each key has its own separate rate limit bucket</li>
            <li>• <strong>Tiered Limits:</strong> Different key types have different limits</li>
            <li>• <strong>Burst Protection:</strong> Short-term burst limits prevent abuse</li>
          </ul>
        </div>
      </section>

      {/* Rate Limit Tables */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limit Tiers</h2>
        <p className="text-gray-600 mb-6">
          Rate limits vary based on your API key type and subscription plan:
        </p>
        
        {/* Free Tier */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Free Tier</h3>
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Minute</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Hour</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Data Upload</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">60</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Data Processing</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">120</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">200</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Analytics & Metrics</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">30</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">300</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Pro Tier */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Pro Tier</h3>
          <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Endpoint Category</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Minute</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Hour</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Requests/Day</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Data Upload</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">50</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1000</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5000</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Data Processing</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">2000</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10000</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Analytics & Metrics</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">500</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">5000</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">50000</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Enterprise */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-900 mb-2">Enterprise Tier</h3>
          <p className="text-purple-800 text-sm mb-4">
            Custom rate limits based on your specific needs. Contact our sales team for enterprise pricing and limits.
          </p>
          <ul className="text-purple-800 text-sm space-y-1">
            <li>• Custom rate limits up to 10,000 requests/minute</li>
            <li>• Dedicated rate limit pools</li>
            <li>• Priority processing queues</li>
            <li>• 24/7 support and monitoring</li>
          </ul>
        </div>
      </section>

      {/* Rate Limit Headers */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limit Headers</h2>
        <p className="text-gray-600 mb-6">
          Every API response includes headers to help you track your rate limit usage:
        </p>
        
        <div className="space-y-4">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Response Headers</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <code className="text-sm bg-white px-2 py-1 rounded">X-RateLimit-Limit</code>
                <span className="text-sm text-gray-600">Maximum requests allowed in the time window</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-sm bg-white px-2 py-1 rounded">X-RateLimit-Remaining</code>
                <span className="text-sm text-gray-600">Requests remaining in current window</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-sm bg-white px-2 py-1 rounded">X-RateLimit-Reset</code>
                <span className="text-sm text-gray-600">Unix timestamp when the window resets</span>
              </div>
              <div className="flex items-center justify-between">
                <code className="text-sm bg-white px-2 py-1 rounded">Retry-After</code>
                <span className="text-sm text-gray-600">Seconds to wait before retrying (429 responses only)</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Handling Rate Limits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Handling Rate Limits</h2>
        
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <ExclamationTriangleIcon className="h-6 w-6 text-yellow-600" />
            <h3 className="font-semibold text-yellow-900">429 Too Many Requests</h3>
          </div>
          <p className="text-yellow-800 text-sm mb-4">
            When you exceed your rate limit, the API returns a 429 status code with a JSON response:
          </p>
          <pre className="bg-white p-3 rounded text-sm overflow-x-auto">
{`{
  "error": "rate_limit_exceeded",
  "message": "Rate limit exceeded. Maximum 60 calls per 60 seconds.",
  "retry_after": 45,
  "limit": 60,
  "remaining": 0,
  "reset_time": 1642694400
}`}
          </pre>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">✅ Best Practices</h3>
            <ul className="text-green-800 text-sm space-y-1">
              <li>• Implement exponential backoff</li>
              <li>• Monitor rate limit headers</li>
              <li>• Cache responses when possible</li>
              <li>• Batch requests efficiently</li>
              <li>• Use webhooks instead of polling</li>
            </ul>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">❌ Avoid</h3>
            <ul className="text-red-800 text-sm space-y-1">
              <li>• Ignoring rate limit headers</li>
              <li>• Immediate retries after 429</li>
              <li>• Unnecessary duplicate requests</li>
              <li>• Polling endpoints too frequently</li>
              <li>• Not implementing retry logic</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Rate Limit Increase Requests */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibond text-gray-900 mb-4">Requesting Rate Limit Increases</h2>
        <p className="text-gray-600 mb-6">
          If your application requires higher rate limits, you can request an increase:
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-4">How to Request an Increase</h3>
          <ol className="text-blue-800 text-sm space-y-2 list-decimal list-inside">
            <li>Contact our support team with your API key</li>
            <li>Provide details about your use case and expected traffic</li>
            <li>Include evidence of efficient API usage (caching, batching, etc.)</li>
            <li>Specify the endpoints and limits you need increased</li>
            <li>Allow 2-3 business days for review and approval</li>
          </ol>
          
          <p className="text-blue-800 text-sm mt-4">
            <strong>Note:</strong> Rate limit increases may require upgrading to a higher tier plan.
          </p>
        </div>
      </section>
    </ApiLayout>
  )
}