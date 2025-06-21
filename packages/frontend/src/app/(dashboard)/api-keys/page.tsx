export default function ApiKeysPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your API keys for authentication
        </p>
      </div>

      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Your API Keys</h3>
          <p className="mt-1 text-sm text-gray-500">
            Keep your API keys secure and don't share them publicly.
          </p>
        </div>
        
        <div className="p-6">
          <div className="text-center py-12">
            <p className="text-gray-500">No API keys created yet</p>
            <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">
              Create API Key
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 