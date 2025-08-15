import Header from '@/components/sections/Header'
import Footer from '@/components/sections/Footer'
import Link from 'next/link'

export default function AuthenticationPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <section className="py-16 md:py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h1 className="text-4xl font-bold mb-8 text-gray-900">
                Authentication
              </h1>
              
              <div className="prose prose-lg max-w-none">
                <p className="text-xl text-gray-600 mb-8">
                  Learn how to authenticate with the schlep-engine API using API keys and tokens.
                </p>

                <h2 className="text-3xl font-semibold mt-12 mb-6">API Key Authentication</h2>
                
                <p>All API requests must be authenticated using your API key in the Authorization header:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>Authorization: Bearer YOUR_API_KEY</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">Example Request</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`curl -X GET "https://api.schlep-engine.com/v1/uploads" \\
  -H "Authorization: Bearer se_1234567890abcdef" \\
  -H "Content-Type: application/json"`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Authentication Errors</h2>
                
                <div className="space-y-4 mb-8">
                  <div className="border-l-4 border-red-400 bg-red-50 p-4">
                    <h3 className="text-lg font-semibold text-red-800 mb-2">401 Unauthorized</h3>
                    <p className="text-red-700 text-sm">Missing or invalid API key</p>
                    <div className="mt-2">
                      <code className="text-xs text-red-800 bg-red-100 px-2 py-1 rounded">
                        {`{ "error": "Invalid API key" }`}
                      </code>
                    </div>
                  </div>
                  
                  <div className="border-l-4 border-yellow-400 bg-yellow-50 p-4">
                    <h3 className="text-lg font-semibold text-yellow-800 mb-2">403 Forbidden</h3>
                    <p className="text-yellow-700 text-sm">API key doesn't have required permissions</p>
                    <div className="mt-2">
                      <code className="text-xs text-yellow-800 bg-yellow-100 px-2 py-1 rounded">
                        {`{ "error": "Insufficient permissions" }`}
                      </code>
                    </div>
                  </div>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">SDK Authentication</h2>
                
                <h3 className="text-2xl font-semibold mt-8 mb-4">Python SDK</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import schlep_engine as se

# Method 1: Direct initialization
client = se.Client(api_key="se_1234567890abcdef")

# Method 2: Environment variable
import os
client = se.Client(api_key=os.getenv("SCHLEP_API_KEY"))

# Method 3: Configuration file
client = se.Client.from_config("config.json")`}</code></pre>
                </div>

                <h3 className="text-2xl font-semibold mt-8 mb-4">JavaScript SDK</h3>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`import SchlepEngine from 'schlep-engine';

// Method 1: Direct initialization
const client = new SchlepEngine({
  apiKey: 'se_1234567890abcdef'
});

// Method 2: Environment variable
const client = new SchlepEngine({
  apiKey: process.env.SCHLEP_API_KEY
});`}</code></pre>
                </div>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Security Best Practices</h2>
                
                <ul className="list-disc list-inside space-y-2 mb-8">
                  <li>Never expose API keys in client-side code or public repositories</li>
                  <li>Use environment variables to store API keys securely</li>
                  <li>Rotate API keys regularly (quarterly recommended)</li>
                  <li>Use different API keys for different environments</li>
                  <li>Monitor API key usage in your dashboard</li>
                  <li>Revoke compromised keys immediately</li>
                </ul>

                <h2 className="text-3xl font-semibold mt-12 mb-6">Testing Authentication</h2>
                
                <p>Use the health endpoint to verify your authentication:</p>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`curl -X GET "https://api.schlep-engine.com/v1/health" \\
  -H "Authorization: Bearer YOUR_API_KEY"`}</code></pre>
                </div>

                <p>Successful response:</p>
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
                  <pre className="text-sm text-gray-900"><code>{`{
  "status": "healthy",
  "authenticated": true,
  "plan": "pro",
  "rate_limit": {
    "remaining": 599,
    "reset_at": "2024-01-15T11:00:00Z"
  }
}`}</code></pre>
                </div>

                <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mt-8">
                  <h3 className="text-lg font-semibold text-blue-800 mb-2">
                    Need an API Key?
                  </h3>
                  <p className="text-blue-700 mb-4">
                    Get started with a free API key by signing up for a schlep-engine account.
                  </p>
                  <Link 
                    href="/signup" 
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 transition-colors"
                  >
                    Get Your API Key →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}