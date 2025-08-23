import { ApiLayout } from '@/components/ui/ApiLayout'

export default function AuthenticationApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Login
curl -X POST https://api.schlep-engine.com/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{ 
    "email": "your@email.com",
    "password": "your_password"
  }'

# Register
curl -X POST https://api.schlep-engine.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{ 
    "email": "new@email.com",
    "password": "new_password",
    "username": "new_user"
  }'`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

# Login
login_data = {
    "email": "your@email.com",
    "password": "your_password"
}
response = requests.post("https://api.schlep-engine.com/api/v1/auth/login", json=login_data)
print(response.json())

# Register
register_data = {
    "email": "new@email.com",
    "password": "new_password",
    "username": "new_user"
}
response = requests.post("https://api.schlep-engine.com/api/v1/auth/register", json=register_data)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `// Login
fetch('https://api.schlep-engine.com/api/v1/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'your@email.com', password: 'your_password' }) 
}).then(res => res.json()).then(console.log);

// Register
fetch('https://api.schlep-engine.com/api/v1/auth/register', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ email: 'new@email.com', password: 'new_password', username: 'new_user' }) 
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Authentication API"
      description="Manage users, authentication, and authorization."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="login">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Login</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/auth/login</code>
          </div>
          <p className="text-gray-600 mb-4">Authenticate a user and receive access and refresh tokens.</p>
        </div>
      </section>

      <section className="mb-12" id="register">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Registration</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/auth/register</code>
          </div>
          <p className="text-gray-600 mb-4">Create a new user account.</p>
        </div>
      </section>

      <section className="mb-12" id="oauth-authentication">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">OAuth Authentication</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <p className="text-gray-600 mb-6">
            Authenticate users using OAuth providers like Google and GitHub for seamless SSO integration.
          </p>
          
          <div className="mb-6">
            <h4 className="font-semibold text-gray-900 mb-2">Initiate OAuth Flow:</h4>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
              <code className="text-sm">/api/v1/auth/oauth/{'{provider}'}/authorize</code>
            </div>
            <p className="text-gray-600 text-sm mb-4">Redirect users to OAuth provider for authentication. Supported providers: <code>google</code>, <code>github</code></p>
            
            <div className="bg-white p-4 rounded border mb-4">
              <h5 className="font-medium mb-2">Query Parameters:</h5>
              <ul className="text-sm text-gray-600 space-y-1">
                <li><code>redirect_uri</code> - URL to redirect after authentication</li>
                <li><code>state</code> - Optional state parameter for security</li>
              </ul>
            </div>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-2">Complete OAuth Flow:</h4>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
              <code className="text-sm">/api/v1/auth/oauth/{'{provider}'}/callback</code>
            </div>
            <p className="text-gray-600 text-sm mb-4">Handle OAuth callback and create user session.</p>
            
            <div className="bg-white p-4 rounded border">
              <h5 className="font-medium mb-2">Request Body:</h5>
              <pre className="text-sm text-gray-600 overflow-x-auto">
{`{
  "code": "oauth_authorization_code",
  "state": "optional_state_parameter"
}`}
              </pre>
              
              <h5 className="font-medium mb-2 mt-4">Response:</h5>
              <pre className="text-sm text-gray-600 overflow-x-auto">
{`{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "expires_in": 1800,
  "user": {
    "id": "user_123456",
    "email": "user@company.com",
    "provider": "google",
    "is_verified": true
  }
}`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-12" id="refresh">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Refresh Token</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/auth/refresh</code>
          </div>
          <p className="text-gray-600 mb-4">Obtain a new access token using a refresh token.</p>
        </div>
      </section>

      <section className="mb-12" id="me">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Current User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/me</code>
          </div>
          <p className="text-gray-600 mb-4">Get information about the currently authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="logout">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">User Logout</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/auth/logout</code>
          </div>
          <p className="text-gray-600 mb-4">Log out the current user.</p>
        </div>
      </section>

      <section className="mb-12" id="status">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Authentication Status</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/status</code>
          </div>
          <p className="text-gray-600 mb-4">Get the status of the authentication system.</p>
        </div>
      </section>

      <section className="mb-12" id="list-users">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Users (Admin)</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/admin/users</code>
          </div>
          <p className="text-gray-600 mb-4">List all users. Requires admin privileges.</p>
        </div>
      </section>

      <section className="mb-12" id="update-user-role">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Update User Role (Admin)</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-200 text-orange-800">PUT</span>
            <code className="text-sm">/api/v1/auth/admin/users/{{'{user_id}'}}/role</code>
          </div>
          <p className="text-gray-600 mb-4">Update the role of a specific user. Requires admin privileges.</p>
        </div>
      </section>

      <section className="mb-12" id="oauth-authorization">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">OAuth 2.0 Authorization</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/oauth/{{'{provider}'}}/authorize</code>
          </div>
          <p className="text-gray-600 mb-4">Start the OAuth 2.0 authorization flow for a given provider (e.g., google, github).</p>
        </div>
      </section>

      <section className="mb-12" id="oauth-callback">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">OAuth 2.0 Callback</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/oauth/{{'{provider}'}}/callback</code>
          </div>
          <p className="text-gray-600 mb-4">Handle the callback from the OAuth 2.0 provider.</p>
        </div>
      </section>

      <section className="mb-12" id="oauth-accounts">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get OAuth Accounts</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/auth/oauth/accounts</code>
          </div>
          <p className="text-gray-600 mb-4">Get the OAuth accounts linked to the current user.</p>
        </div>
      </section>

      <section className="mb-12" id="unlink-oauth">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Unlink OAuth Account</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/auth/oauth/{{'{provider}'}}/unlink</code>
          </div>
          <p className="text-gray-600 mb-4">Unlink an OAuth account from the current user.</p>
        </div>
      </section>
    </ApiLayout>
  )
}