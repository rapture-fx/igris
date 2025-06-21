import Link from 'next/link'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Welcome to your Pollarbase API Platform
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">This Month</h3>
          <p className="text-3xl font-bold text-blue-600">$0.00</p>
          <p className="text-sm text-gray-500">0 GB processed</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">API Calls</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
          <p className="text-sm text-gray-500">This month</p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-medium text-gray-900">Free Tier</h3>
          <p className="text-3xl font-bold text-purple-600">100MB</p>
          <p className="text-sm text-gray-500">Remaining</p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Link 
              href="/dashboard/api-keys"
              className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <h4 className="font-medium">API Keys</h4>
              <p className="text-sm text-gray-500">Manage authentication</p>
            </Link>
            
            <Link 
              href="/dashboard/usage"
              className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <h4 className="font-medium">Usage</h4>
              <p className="text-sm text-gray-500">View billing & usage</p>
            </Link>
            
            <Link 
              href="/dashboard/logs"
              className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              <h4 className="font-medium">Logs</h4>
              <p className="text-sm text-gray-500">Debug API requests</p>
            </Link>
            
            <a 
              href="/docs"
              className="text-center p-4 border border-gray-200 rounded-lg hover:bg-gray-50"
              target="_blank"
            >
              <h4 className="font-medium">API Docs</h4>
              <p className="text-sm text-gray-500">Integration guide</p>
            </a>
          </div>
        </div>
      </div>
    </div>
  )
} 