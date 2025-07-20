import { CodeBlock } from '@/components/CodeBlock'
import { KeyIcon, ShieldCheckIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'

export default function AuthenticationPage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Authentication</h1>
        <p className="text-xl text-gray-600">
          Secure your API requests with proper authentication and authorization.
        </p>
      </div>

      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">API Keys</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Schlep Engine uses API keys to authenticate requests. You can manage your API keys in the dashboard.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <KeyIcon className="h-5 w-5 text-blue-600 mr-2" />
                <span className="text-sm font-medium text-blue-900">Test Mode</span>
              </div>
              <p className="text-sm text-blue-800 mb-2">
                Test mode keys start with <code>sk_test_</code> and process data without charges.
              </p>
              <code className="text-sm text-blue-800 block">sk_test_4eC39HqLyjWDarjtT1zdp7dc</code>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-2">
                <ShieldCheckIcon className="h-5 w-5 text-green-600 mr-2" />
                <span className="text-sm font-medium text-green-900">Live Mode</span>
              </div>
              <p className="text-sm text-green-800 mb-2">
                Live mode keys start with <code>sk_live_</code> and process real data with billing.
              </p>
              <code className="text-sm text-green-800 block">sk_live_4eC39HqLyjWDarjtT1zdp7dc</code>
            </div>

            <h3 className="text-lg font-semibold text-gray-900 mb-4">Using API Keys</h3>
            <p className="text-gray-600 mb-4">
              Include your API key in the Authorization header with the Bearer scheme:
            </p>

            <CodeBlock
              code={`curl -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  https://api.schlepengine.com/v1/profile/upload_123`}
              language="bash"
              title="cURL"
            />
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Security Best Practices</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Keep Your Keys Secret</h3>
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center mb-2">
                    <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mr-2" />
                    <span className="text-sm font-medium text-red-900">Never expose API keys in client-side code</span>
                  </div>
                  <p className="text-sm text-red-800">
                    API keys should only be used in server-side code. Never include them in frontend JavaScript, 
                    mobile apps, or any code that users can inspect.
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Environment Variables</h3>
                <p className="text-gray-600 mb-4">
                  Store API keys in environment variables, not in your source code:
                </p>
                <CodeBlock
                  code={`# .env file
SCHLEP_API_KEY=sk_test_4eC39HqLyjWDarjtT1zdp7dc

# In your code
import os
api_key = os.getenv('SCHLEP_API_KEY')`}
                  language="python"
                  title="Environment Variables"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Key Rotation</h3>
                <p className="text-gray-600 mb-4">
                  Regularly rotate your API keys for enhanced security:
                </p>
                <ul className="text-sm text-gray-600 space-y-2">
                  <li>• Create a new API key in the dashboard</li>
                  <li>• Update your applications to use the new key</li>
                  <li>• Test that everything works correctly</li>
                  <li>• Delete the old key from the dashboard</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Examples</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Python</h3>
                <CodeBlock
                  code={`import requests

# Set up authentication
api_key = "sk_test_4eC39HqLyjWDarjtT1zdp7dc"
headers = {"Authorization": f"Bearer {api_key}"}

# Make authenticated request
response = requests.get(
    "https://api.schlepengine.com/v1/profile/upload_123",
    headers=headers
)

if response.status_code == 200:
    data = response.json()
    print(f"Quality score: {data['quality_score']}")
else:
    print(f"Error: {response.status_code} - {response.text}")`}
                  language="python"
                  title="Python Example"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">JavaScript (Node.js)</h3>
                <CodeBlock
                  code={`const fetch = require('node-fetch');

// Set up authentication
const apiKey = 'sk_test_4eC39HqLyjWDarjtT1zdp7dc';
const headers = {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
};

// Make authenticated request
async function getProfile(uploadId) {
    try {
        const response = await fetch(
            \`https://api.schlepengine.com/v1/profile/\${uploadId}\`,
            { headers }
        );
        
        if (response.ok) {
            const data = await response.json();
            console.log(\`Quality score: \${data.quality_score}\`);
            return data;
        } else {
            throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
}

getProfile('upload_123');`}
                  language="javascript"
                  title="JavaScript Example"
                />
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">cURL</h3>
                <CodeBlock
                  code={`# GET request with authentication
curl -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  https://api.schlepengine.com/v1/profile/upload_123

# POST request with authentication
curl -X POST \\
  -H "Authorization: Bearer sk_test_4eC39HqLyjWDarjtT1zdp7dc" \\
  -H "Content-Type: application/json" \\
  -d '{"upload_id": "upload_123", "target_format": "tensorflow"}' \\
  https://api.schlepengine.com/v1/process`}
                  language="bash"
                  title="cURL Examples"
                />
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <p className="text-gray-600 mb-4">
              Handle authentication errors gracefully in your applications:
            </p>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold text-gray-900">401 Unauthorized</h4>
                <p className="text-sm text-gray-600">Invalid or missing API key</p>
                <CodeBlock
                  code={`{
  "error": {
    "type": "authentication_error",
    "message": "Invalid API key provided",
    "code": "invalid_api_key"
  }
}`}
                  language="json"
                  title="401 Response"
                />
              </div>

              <div>
                <h4 className="font-semibold text-gray-900">403 Forbidden</h4>
                <p className="text-sm text-gray-600">API key doesn't have permission for this resource</p>
                <CodeBlock
                  code={`{
  "error": {
    "type": "permission_error",
    "message": "Insufficient permissions for this operation",
    "code": "insufficient_permissions"
  }
}`}
                  language="json"
                  title="403 Response"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}