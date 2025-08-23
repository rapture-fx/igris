import { ApiLayout } from '@/components/ui/ApiLayout'

export default function UsersApiPage() {
  const codeExamples = [
    {
      language: 'curl',
      label: 'cURL',
      code: `# Get current user profile
curl -X GET https://api.schlep-engine.com/api/v1/users/me \
  -H "Authorization: Bearer sk_your_api_key"`
    },
    {
      language: 'python',
      label: 'Python',
      code: `import requests

api_key = "sk_your_api_key"
headers = {"Authorization": f"Bearer {api_key}"}

response = requests.get("https://api.schlep-engine.com/api/v1/users/me", headers=headers)
print(response.json())`
    },
    {
      language: 'javascript',
      label: 'JavaScript',
      code: `const apiKey = 'sk_your_api_key';

fetch('https://api.schlep-engine.com/api/v1/users/me', {
  headers: {
    'Authorization': 'Bearer ' + apiKey
  }
}).then(res => res.json()).then(console.log);`
    }
  ]

  return (
    <ApiLayout 
      title="Users API"
      description="Manage users and their profiles."
      codeExamples={codeExamples}
    >
      <section className="mb-12" id="get-current-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Current User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/users/me</code>
          </div>
          <p className="text-gray-600 mb-4">Get the profile of the currently authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="update-current-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Update Current User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-200 text-orange-800">PUT</span>
            <code className="text-sm">/api/v1/users/me</code>
          </div>
          <p className="text-gray-600 mb-4">Update the profile of the currently authenticated user.</p>
        </div>
      </section>

      <section className="mb-12" id="list-users">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List Users</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/users/</code>
          </div>
          <p className="text-gray-600 mb-4">List all users (admin only).</p>
        </div>
      </section>

      <section className="mb-12" id="get-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/users/{'{user_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Get a specific user by ID (admin only).</p>
        </div>
      </section>

      <section className="mb-12" id="delete-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/users/{'{user_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">Delete a specific user (admin only).</p>
        </div>
      </section>

      <section className="mb-12" id="activate-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Activate User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/users/{'{user_id}'}/activate</code>
          </div>
          <p className="text-gray-600 mb-4">Activate a user account (admin only).</p>
        </div>
      </section>

      <section className="mb-12" id="deactivate-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Deactivate User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/users/{'{user_id}'}/deactivate</code>
          </div>
          <p className="text-gray-600 mb-4">Deactivate a user account (admin only).</p>
        </div>
      </section>
    </ApiLayout>
  )
}