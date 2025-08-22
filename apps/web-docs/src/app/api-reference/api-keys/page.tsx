import { ApiLayout } from '@/components/ui/ApiLayout'
import { KeyIcon, EyeIcon, ClipboardIcon } from '@heroicons/react/24/outline'

export default function ApiKeysPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Test your API key by getting user info
curl -X GET "https://api.schlep-engine.com/api/v1/user" \\
  -H "Authorization: Bearer sk_your_api_key"

# Create a new API key
curl -X POST "https://api.schlep-engine.com/api/v1/api-keys" \\
  -H "Authorization: Bearer sk_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Production API Key",
    "type": "secret",
    "permissions": ["read", "write"],
    "expires_at": "2024-12-31T23:59:59Z"
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests
import os

# Get API key from environment variable (recommended)
api_key = os.getenv('SCHLEP_ENGINE_API_KEY')

# Test API key validity
def test_api_key(api_key):
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    
    response = requests.get(
        "https://api.schlep-engine.com/api/v1/user",
        headers=headers
    )
    
    if response.status_code == 200:
        user_data = response.json()
        print(f"✅ API key valid for user: {user_data['email']}")
        return True
    else:
        print(f"❌ API key invalid: {response.status_code}")
        return False

# Create a new API key
def create_api_key(name, key_type="secret", permissions=None):
    if permissions is None:
        permissions = ["read", "write"]
    
    headers = {"Authorization": f"Bearer {api_key}"}
    data = {
        "name": name,
        "type": key_type,
        "permissions": permissions
    }
    
    response = requests.post(
        "https://api.schlep-engine.com/api/v1/api-keys",
        headers=headers,
        json=data
    )
    
    if response.status_code == 201:
        key_data = response.json()
        print(f"New API key created: {key_data['key_id']}")
        return key_data
    else:
        print(f"Failed to create key: {response.text}")
        return None

# Test the key
test_api_key(api_key)`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `// Get API key from environment variable
const apiKey = process.env.SCHLEP_ENGINE_API_KEY;

// Test API key validity
async function testApiKey(apiKey) {
  try {
    const response = await fetch('https://api.schlep-engine.com/api/v1/user', {
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      const userData = await response.json();
      console.log(\`✅ API key valid for user: \${userData.email}\`);
      return true;
    } else {
      console.log(\`❌ API key invalid: \${response.status}\`);
      return false;
    }
  } catch (error) {
    console.error('Error testing API key:', error);
    return false;
  }
}

// Create a new API key
async function createApiKey(name, keyType = 'secret', permissions = ['read', 'write']) {
  try {
    const response = await fetch('https://api.schlep-engine.com/api/v1/api-keys', {
      method: 'POST',
      headers: {
        'Authorization': \`Bearer \${apiKey}\`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        type: keyType,
        permissions
      })
    });
    
    if (response.ok) {
      const keyData = await response.json();
      console.log(\`New API key created: \${keyData.key_id}\`);
      return keyData;
    } else {
      const error = await response.text();
      console.log(\`Failed to create key: \${error}\`);
      return null;
    }
  } catch (error) {
    console.error('Error creating API key:', error);
    return null;
  }
}

// Test the key
testApiKey(apiKey);`
    }
  ]

  return (
    <ApiLayout 
      title="API Keys"
      description="Secure authentication for the Schlep Engine API using API keys with proper scoping and permissions."
      codeExamples={codeExamples}
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