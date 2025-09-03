import { ApiLayout } from '@/components/ui/ApiLayout'
import { KeyIcon, EyeIcon, ClipboardIcon } from '@heroicons/react/24/outline'

export default function ApiKeysPage() {
  return (
    <ApiLayout 
      title="API Keys"
      description="Secure authentication for the Schlep Engine API using API keys with proper scoping and permissions."
    >
      {/* Authentication Methods */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Methods</h2>
        <p className="text-gray-600 mb-6">
          Schlep Engine supports API key authentication with two header options:
        </p>
        
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2">Authorization Header (Recommended)</h3>
            <code className="text-sm bg-white px-2 py-1 rounded">Authorization: Bearer sk_your_api_key</code>
            <p className="text-blue-800 text-sm mt-2">
              Standard OAuth 2.0 Bearer token format, widely supported by HTTP clients.
            </p>
          </div>
          
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">X-API-Key Header (Alternative)</h3>
            <code className="text-sm bg-white px-2 py-1 rounded">X-API-Key: sk_your_api_key</code>
            <p className="text-gray-600 text-sm mt-2">
              Direct API key header, useful for simple integrations.
            </p>
          </div>
        </div>
      </section>

      {/* API Key Types */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">API Key Types</h2>
        <p className="text-gray-600 mb-6">
          Different key types provide different levels of access to your data and operations:
        </p>
        
        <div className="grid gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                <KeyIcon className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Secret Keys (sk_)</h3>
                <p className="text-sm text-gray-600">Full access to all API endpoints</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Upload and process data</li>
              <li>• Access all investigation results</li>
              <li>• Manage ML pipelines</li>
              <li>• View billing and usage</li>
              <li>• Administrative operations</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                <EyeIcon className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Public Keys (pk_)</h3>
                <p className="text-sm text-gray-600">Read-only access to public data</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• View investigation results</li>
              <li>• Access metrics and analytics</li>
              <li>• Read documentation</li>
              <li>• No write or delete permissions</li>
            </ul>
          </div>

          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                <ClipboardIcon className="h-4 w-4 text-orange-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Restricted Keys (rk_)</h3>
                <p className="text-sm text-gray-600">Limited scope for specific operations</p>
              </div>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Specific endpoint access only</li>
              <li>• Time-limited validity</li>
              <li>• Perfect for integrations</li>
              <li>• Minimal security risk</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Security Best Practices */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Security Best Practices</h2>
        
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-red-900 mb-2">⚠️ Keep Your Keys Secure</h3>
          <ul className="text-red-800 text-sm space-y-1">
            <li>• Never commit API keys to version control</li>
            <li>• Use environment variables or secure vaults</li>
            <li>• Rotate keys regularly (recommended: every 90 days)</li>
            <li>• Revoke keys immediately if compromised</li>
          </ul>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">✅ Do</h3>
            <ul className="text-green-800 text-sm space-y-1">
              <li>• Use HTTPS for all API calls</li>
              <li>• Store keys in secure environment variables</li>
              <li>• Use restricted keys for limited scopes</li>
              <li>• Monitor key usage regularly</li>
            </ul>
          </div>
          
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h3 className="font-semibold text-red-900 mb-2">❌ Don't</h3>
            <ul className="text-red-800 text-sm space-y-1">
              <li>• Hardcode keys in your application</li>
              <li>• Share keys via email or chat</li>
              <li>• Use the same key across environments</li>
              <li>• Log API keys in application logs</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Rate Limits by Key Type</h2>
        <p className="text-gray-600 mb-6">
          Different API key types have different rate limits to ensure fair usage:
        </p>
        
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Key Type</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Rate Limit</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Burst Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Secret Keys (sk_)</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">1000 requests/minute</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100 requests/second</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Public Keys (pk_)</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">500 requests/minute</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">50 requests/second</td>
              </tr>
              <tr>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Restricted Keys (rk_)</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">100 requests/minute</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">10 requests/second</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </ApiLayout>
  )
}