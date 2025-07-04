import { Suspense } from 'react'
import { Settings, User, Bell, Database, Shield, Palette, Globe } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage your account preferences and system configuration
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Settings</h3>
              <nav className="space-y-1">
                <a href="#profile" className="bg-blue-50 text-blue-700 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <User className="text-blue-500 mr-3 h-5 w-5" />
                  Profile
                </a>
                <a href="#notifications" className="text-gray-700 hover:bg-gray-50 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <Bell className="text-gray-400 mr-3 h-5 w-5" />
                  Notifications
                </a>
                <a href="#data-sources" className="text-gray-700 hover:bg-gray-50 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <Database className="text-gray-400 mr-3 h-5 w-5" />
                  Data Sources
                </a>
                <a href="#security" className="text-gray-700 hover:bg-gray-50 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <Shield className="text-gray-400 mr-3 h-5 w-5" />
                  Security
                </a>
                <a href="#appearance" className="text-gray-700 hover:bg-gray-50 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <Palette className="text-gray-400 mr-3 h-5 w-5" />
                  Appearance
                </a>
                <a href="#system" className="text-gray-700 hover:bg-gray-50 group flex items-center px-3 py-2 text-sm font-medium rounded-md">
                  <Globe className="text-gray-400 mr-3 h-5 w-5" />
                  System
                </a>
              </nav>
            </div>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Profile Settings */}
          <div id="profile" className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Profile Information</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700">First Name</label>
                  <input type="text" defaultValue="Admin" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Last Name</label>
                  <input type="text" defaultValue="User" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
                </div>
              </div>
              <div className="mt-4">
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">Admin Email</label>
                <input type="email" defaultValue="admin@schlep-engine.com" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Role</label>
                <input type="text" defaultValue="System Administrator" disabled className="mt-1 block w-full border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 sm:text-sm" />
              </div>
              <div className="flex justify-end">
                <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div id="notifications" className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Notification Preferences</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Email Notifications</h4>
                  <p className="text-sm text-gray-500">Receive email alerts for important events</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Workflow Alerts</h4>
                  <p className="text-sm text-gray-500">Get notified when workflows complete or fail</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Data Quality Alerts</h4>
                  <p className="text-sm text-gray-500">Receive alerts for data quality issues</p>
                </div>
                <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Security Notifications</h4>
                  <p className="text-sm text-gray-500">Important security and login alerts</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" />
              </div>
            </div>
          </div>

          {/* Appearance Settings */}
          <div id="appearance" className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">Appearance</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input type="radio" name="theme" value="light" defaultChecked className="h-4 w-4 text-blue-600" />
                    <label className="ml-2 text-sm text-gray-700">Light</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" name="theme" value="dark" className="h-4 w-4 text-blue-600" />
                    <label className="ml-2 text-sm text-gray-700">Dark</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" name="theme" value="system" className="h-4 w-4 text-blue-600" />
                    <label className="ml-2 text-sm text-gray-700">System</label>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option>English (US)</option>
                  <option>English (UK)</option>
                  <option>Spanish</option>
                  <option>French</option>
                  <option>German</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Timezone</label>
                <select className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm">
                  <option>UTC</option>
                  <option>US/Eastern</option>
                  <option>US/Central</option>
                  <option>US/Mountain</option>
                  <option>US/Pacific</option>
                  <option>Europe/London</option>
                  <option>Europe/Paris</option>
                  <option>Asia/Tokyo</option>
                </select>
              </div>
            </div>
          </div>

          {/* System Settings */}
          <div id="system" className="bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-medium text-gray-900">System Configuration</h3>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Default Data Retention (days)</label>
                <input type="number" defaultValue="90" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Max Concurrent Jobs</label>
                <input type="number" defaultValue="5" className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Auto-cleanup Failed Jobs</h4>
                  <p className="text-sm text-gray-500">Automatically remove failed job logs after 30 days</p>
                </div>
                <input type="checkbox" defaultChecked className="h-4 w-4 text-blue-600 rounded" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-gray-900">Enable Debug Logging</h4>
                  <p className="text-sm text-gray-500">Detailed logging for troubleshooting (impacts performance)</p>
                </div>
                <input type="checkbox" className="h-4 w-4 text-blue-600 rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 