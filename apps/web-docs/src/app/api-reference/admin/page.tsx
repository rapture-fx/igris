import { ApiLayout } from '@/components/ui/ApiLayout'
import { CogIcon, UserGroupIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function AdminApiPage() {

  return (
    <ApiLayout 
      title="Admin API"
      description="Administrative endpoints for system management, user administration, and platform monitoring. Requires admin privileges."
    >
      {/* Admin Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Admin API Overview</h2>
        <p className="text-gray-600 mb-6">
          The Admin API provides powerful administrative capabilities for system administrators and 
          platform managers. These endpoints require elevated permissions and are used for user management, 
          system monitoring, and platform configuration.
        </p>
        
        <div className="bg-amber-50 border-l-4 border-amber-400 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-amber-700">
                <strong>Note:</strong> Admin API endpoints require special authentication tokens with admin privileges. 
                Regular API keys will not work with these endpoints.
              </p>
            </div>
          </div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <UserGroupIcon className="h-6 w-6 text-blue-600" />
              <h3 className="font-semibold text-gray-900">User Management</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Create, update, and manage user accounts, roles, and permissions across the platform.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <ChartBarIcon className="h-6 w-6 text-green-600" />
              <h3 className="font-semibold text-gray-900">System Monitoring</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Monitor system health, performance metrics, and resource utilization across all services.
            </p>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <CogIcon className="h-6 w-6 text-purple-600" />
              <h3 className="font-semibold text-gray-900">Platform Configuration</h3>
            </div>
            <p className="text-gray-600 text-sm">
              Configure platform settings, feature flags, and system-wide parameters.
            </p>
          </div>
        </div>
      </section>

      {/* System Statistics */}
      <section className="mb-12" id="get-system-stats">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get System Statistics</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/admin/system/stats</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get comprehensive system statistics including user counts, API usage, and performance metrics.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "system": {
    "status": "healthy",
    "uptime": "99.97%",
    "version": "2.1.4",
    "last_deployment": "2024-01-15T10:30:00Z"
  },
  "users": {
    "total_users": 15847,
    "active_users": 12450,
    "new_users_today": 47,
    "organizations": 342
  },
  "api_usage": {
    "api_calls_today": 2458392,
    "api_calls_this_month": 45673821,
    "average_response_time": 245,
    "error_rate": 0.002
  },
  "resources": {
    "cpu_usage": 67.8,
    "memory_usage": 72.3,
    "disk_usage": 45.2,
    "active_jobs": 1247
  },
  "data_processing": {
    "files_processed_today": 8923,
    "total_storage_gb": 2847.5,
    "ml_models_trained": 156
  }
}`}
            </pre>
          </div>
        </div>
      </section>

      {/* Create User */}
      <section className="mb-12" id="create-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Create User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-blue-200 text-blue-800">POST</span>
            <code className="text-sm">/api/v1/admin/users</code>
          </div>
          <p className="text-gray-600 mb-4">
            Create a new user account with specified role and organization assignment.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Request Body Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">email</code> (string, required) - User email address</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">username</code> (string, required) - Username</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">role</code> (string, required) - user, admin, super_admin</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">organization_id</code> (string, optional) - Organization assignment</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">first_name</code> (string, optional) - First name</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">last_name</code> (string, optional) - Last name</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">is_verified</code> (boolean, optional) - Email verification status</li>
            </ul>
          </div>
        </div>
      </section>

      {/* List All Users */}
      <section className="mb-12" id="list-all-users">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">List All Users</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/admin/users</code>
          </div>
          <p className="text-gray-600 mb-4">
            Retrieve a paginated list of all users across the platform with filtering options.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Query Parameters:</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li><code className="bg-gray-100 px-2 py-1 rounded">limit</code> (int, optional) - Number of users to return (max 1000)</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">offset</code> (int, optional) - Number of users to skip</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">role</code> (string, optional) - Filter by role</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">organization_id</code> (string, optional) - Filter by organization</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">is_active</code> (boolean, optional) - Filter by active status</li>
              <li><code className="bg-gray-100 px-2 py-1 rounded">search</code> (string, optional) - Search by email or username</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Update User */}
      <section className="mb-12" id="update-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Update User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-orange-200 text-orange-800">PUT</span>
            <code className="text-sm">/api/v1/admin/users/{'{user_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">
            Update user information, role, or status. Useful for administrative user management tasks.
          </p>
        </div>
      </section>

      {/* Delete User */}
      <section className="mb-12" id="delete-user">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Delete User</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-red-200 text-red-800">DELETE</span>
            <code className="text-sm">/api/v1/admin/users/{'{user_id}'}</code>
          </div>
          <p className="text-gray-600 mb-4">
            Permanently delete a user account and all associated data. This action cannot be undone.
          </p>
          
          <div className="bg-red-50 border-l-4 border-red-400 p-4 mt-4">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This action permanently deletes the user and all their data. 
                  Consider deactivating the user instead if you want to preserve data.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* System Health Check */}
      <section className="mb-12" id="health-check">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">System Health Check</h2>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="px-2 py-1 text-xs font-semibold rounded bg-green-200 text-green-800">GET</span>
            <code className="text-sm">/api/v1/admin/system/health</code>
          </div>
          <p className="text-gray-600 mb-4">
            Get detailed health status of all system components including databases, queues, and external services.
          </p>
          
          <div className="mt-4">
            <h4 className="font-semibold text-gray-900 mb-2">Response:</h4>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`{
  "status": "healthy",
  "timestamp": "2024-01-15T12:00:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "response_time": 12,
      "connections": {
        "active": 23,
        "idle": 47,
        "max": 100
      }
    },
    "redis": {
      "status": "healthy",
      "memory_usage": "45.2%",
      "connected_clients": 156
    },
    "ml_service": {
      "status": "healthy",
      "active_jobs": 34,
      "queue_length": 12
    },
    "storage": {
      "status": "healthy",
      "disk_usage": "67.8%",
      "available_space": "892.4 GB"
    }
  },
  "metrics": {
    "uptime": 2847392,
    "requests_per_minute": 1247,
    "error_rate": 0.002
  }
}`}
            </pre>
          </div>
        </div>
      </section>
    </ApiLayout>
  )
}