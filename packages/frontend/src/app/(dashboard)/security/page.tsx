import { Suspense } from 'react'
import { Shield, Lock, Key, AlertTriangle, CheckCircle, Settings } from 'lucide-react'

export default function SecurityPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Security</h1>
        <p className="mt-1 text-sm text-gray-500">
          Monitor and manage security settings and compliance
        </p>
      </div>

      {/* Security Status */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Shield className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Security Score
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    94%
                  </dd>
                  <dd className="text-sm text-green-600">
                    Excellent
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Lock className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Active Sessions
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    12
                  </dd>
                  <dd className="text-sm text-gray-600">
                    8 users online
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Security Alerts
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    2
                  </dd>
                  <dd className="text-sm text-yellow-600">
                    Low priority
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Key className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    API Keys
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    8
                  </dd>
                  <dd className="text-sm text-gray-600">
                    6 active
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Checks */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Security Compliance</h2>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">Data Encryption</h4>
                  <p className="text-sm text-green-700">All data encrypted at rest and in transit</p>
                </div>
              </div>
              <span className="text-green-600 text-sm font-medium">Compliant</span>
            </div>

            <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">Access Control</h4>
                  <p className="text-sm text-green-700">Role-based permissions properly configured</p>
                </div>
              </div>
              <span className="text-green-600 text-sm font-medium">Compliant</span>
            </div>

            <div className="flex items-center justify-between p-4 border border-yellow-200 bg-yellow-50 rounded-lg">
              <div className="flex items-center">
                <AlertTriangle className="h-5 w-5 text-yellow-600 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-yellow-900">Password Policy</h4>
                  <p className="text-sm text-yellow-700">2 users with weak passwords detected</p>
                </div>
              </div>
              <span className="text-yellow-600 text-sm font-medium">Review Needed</span>
            </div>

            <div className="flex items-center justify-between p-4 border border-green-200 bg-green-50 rounded-lg">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-600 mr-3" />
                <div>
                  <h4 className="text-sm font-medium text-green-900">Audit Logging</h4>
                  <p className="text-sm text-green-700">All user actions logged and monitored</p>
                </div>
              </div>
              <span className="text-green-600 text-sm font-medium">Compliant</span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Security Events */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Recent Security Events</h2>
        </div>
        <div className="p-6">
          <div className="space-y-3">
            <div className="flex items-start p-3 border border-gray-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">Successful login from Alice Johnson</p>
                <p className="text-xs text-gray-500">2 hours ago • IP: 192.168.1.100</p>
              </div>
            </div>

            <div className="flex items-start p-3 border border-gray-200 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">Failed login attempt detected</p>
                <p className="text-xs text-gray-500">4 hours ago • IP: 203.0.113.195</p>
              </div>
            </div>

            <div className="flex items-start p-3 border border-gray-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">API key rotated successfully</p>
                <p className="text-xs text-gray-500">Yesterday • User: Bob Smith</p>
              </div>
            </div>

            <div className="flex items-start p-3 border border-gray-200 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 mr-3" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">Security scan completed</p>
                <p className="text-xs text-gray-500">2 days ago • No vulnerabilities found</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white shadow rounded-lg">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Security Settings</h2>
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50">
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </button>
        </div>
        <div className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h4>
                <p className="text-sm text-gray-500">Require 2FA for all users</p>
              </div>
              <div className="flex items-center">
                <input type="checkbox" checked className="h-4 w-4 text-blue-600 rounded" />
                <span className="ml-2 text-sm text-green-600">Enabled</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">Session Timeout</h4>
                <p className="text-sm text-gray-500">Auto logout after inactivity</p>
              </div>
              <div className="flex items-center">
                <span className="text-sm text-gray-900">30 minutes</span>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-medium text-gray-900">IP Whitelisting</h4>
                <p className="text-sm text-gray-500">Restrict access to specific IP ranges</p>
              </div>
              <div className="flex items-center">
                <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" />
                <span className="ml-2 text-sm text-gray-600">Disabled</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 