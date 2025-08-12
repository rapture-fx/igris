export default function ApiKeysPage() {
  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">
        API Keys
      </h1>
      
      <div className="prose prose-sm max-w-none">
        <p className="text-base text-gray-600 mb-4">
          Learn how to create and manage your Schlep Engine API keys for secure access to our platform.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
          <h3 className="text-lg font-semibold text-blue-800 mb-2">
            Important Security Notice
          </h3>
          <p className="text-blue-700">
            API keys provide access to your account and should be kept secure. Never share them publicly or include them in client-side code.
          </p>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Creating Your API Key</h2>
        
        <ol className="list-decimal list-inside space-y-4 mb-8">
          <li>Sign in to your <a href="https://dashboard.schlepengine.com" className="text-blue-600 hover:underline">Schlep Engine Dashboard</a></li>
          <li>Navigate to <strong>Settings</strong> → <strong>API Keys</strong></li>
          <li>Click <strong>"Create New API Key"</strong></li>
          <li>Give your key a descriptive name (e.g., "Production API", "Development Testing")</li>
          <li>Select the appropriate permissions for your use case</li>
          <li>Click <strong>"Generate Key"</strong></li>
          <li>Copy and securely store your API key - it won't be shown again</li>
        </ol>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Using Your API Key</h2>
        
        <p>Include your API key in the Authorization header of your requests:</p>
        
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
          <pre className="text-sm text-gray-900"><code>{`curl -X POST "https://api.schlepengine.com/v1/upload" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"data": "your data here"}'`}</code></pre>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">API Key Permissions</h2>
        
        <div className="space-y-4 mb-8">
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Read Access</h3>
            <p className="text-gray-600">View data, download results, check job status</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Write Access</h3>
            <p className="text-gray-600">Upload data, create processing jobs, modify configurations</p>
          </div>
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Admin Access</h3>
            <p className="text-gray-600">Manage team members, billing, and account settings</p>
          </div>
        </div>

        <h2 className="text-3xl font-semibold mt-12 mb-6">Best Practices</h2>
        
        <ul className="list-disc list-inside space-y-2 mb-8">
          <li>Use different API keys for different environments (development, staging, production)</li>
          <li>Regularly rotate your API keys</li>
          <li>Use environment variables to store API keys, never hardcode them</li>
          <li>Monitor API key usage in your dashboard</li>
          <li>Revoke unused or compromised keys immediately</li>
        </ul>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 mt-8">
          <h3 className="text-lg font-semibold text-yellow-800 mb-2">
            Rate Limits Apply
          </h3>
          <p className="text-yellow-700">
            API keys are subject to rate limits based on your plan. See our <a href="/api-reference/rate-limits" className="underline">Rate Limits documentation</a> for details.
          </p>
        </div>
      </div>
    </div>
  )
}