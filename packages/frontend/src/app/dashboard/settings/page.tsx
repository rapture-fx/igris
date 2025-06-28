'use client'

import { useState, useEffect } from 'react'
import { 
  User, 
  Lock, 
  Bell, 
  Link2, 
  Database, 
  Palette, 
  Globe, 
  Shield, 
  Mail, 
  Smartphone,
  Key,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Save
} from 'lucide-react'

interface UserProfile {
  name: string
  email: string
  avatar: string
  company: string
  role: string
  timezone: string
  language: string
}

interface SecuritySettings {
  twoFactorEnabled: boolean
  loginNotifications: boolean
  apiKeyExpiration: number
  passwordLastChanged: string
  activeSessions: number
}

interface NotificationSettings {
  emailNotifications: {
    security: boolean
    billing: boolean
    usage: boolean
    system: boolean
    marketing: boolean
  }
  pushNotifications: {
    realTime: boolean
    daily: boolean
    weekly: boolean
  }
}

interface Integration {
  id: string
  name: string
  type: 'database' | 'storage' | 'analytics' | 'ai'
  status: 'connected' | 'disconnected' | 'error'
  description: string
  icon: string
  lastSync?: string
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('account')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [securitySettings, setSecuritySettings] = useState<SecuritySettings | null>(null)
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null)
  const [integrations, setIntegrations] = useState<Integration[]>([])
  const [showPasswordForm, setShowPasswordForm] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  useEffect(() => {
    // Load mock settings data
    setUserProfile({
      name: 'Alex Johnson',
      email: 'alex.johnson@company.com',
      avatar: '/avatars/alex.jpg',
      company: 'TechCorp Inc.',
      role: 'Data Engineer',
      timezone: 'America/New_York',
      language: 'en-US'
    })

    setSecuritySettings({
      twoFactorEnabled: true,
      loginNotifications: true,
      apiKeyExpiration: 90,
      passwordLastChanged: '2024-05-15',
      activeSessions: 3
    })

    setNotificationSettings({
      emailNotifications: {
        security: true,
        billing: true,
        usage: false,
        system: true,
        marketing: false
      },
      pushNotifications: {
        realTime: true,
        daily: false,
        weekly: true
      }
    })

    setIntegrations([
      {
        id: 'postgres',
        name: 'PostgreSQL Database',
        type: 'database',
        status: 'connected',
        description: 'Primary production database',
        icon: '🐘',
        lastSync: '2024-06-28T10:30:00Z'
      },
      {
        id: 's3',
        name: 'AWS S3',
        type: 'storage',
        status: 'connected',
        description: 'Data lake storage',
        icon: '☁️',
        lastSync: '2024-06-28T09:15:00Z'
      },
      {
        id: 'snowflake',
        name: 'Snowflake',
        type: 'database',
        status: 'error',
        description: 'Data warehouse connection',
        icon: '❄️',
        lastSync: '2024-06-27T14:20:00Z'
      },
      {
        id: 'openai',
        name: 'OpenAI API',
        type: 'ai',
        status: 'connected',
        description: 'AI processing and insights',
        icon: '🤖',
        lastSync: '2024-06-28T11:45:00Z'
      },
      {
        id: 'tableau',
        name: 'Tableau',
        type: 'analytics',
        status: 'disconnected',
        description: 'Business intelligence platform',
        icon: '📊'
      }
    ])

    setLoading(false)
  }, [])

  const saveSettings = async () => {
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
    }, 1500)
  }

  const updateProfile = (field: keyof UserProfile, value: string) => {
    if (userProfile) {
      setUserProfile({ ...userProfile, [field]: value })
    }
  }

  const updateSecuritySetting = (field: keyof SecuritySettings, value: any) => {
    if (securitySettings) {
      setSecuritySettings({ ...securitySettings, [field]: value })
    }
  }

  const updateNotificationSetting = (category: 'emailNotifications' | 'pushNotifications', field: string, value: boolean) => {
    if (notificationSettings) {
      setNotificationSettings({
        ...notificationSettings,
        [category]: {
          ...notificationSettings[category],
          [field]: value
        }
      })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'connected': return 'bg-green-100 text-green-800'
      case 'error': return 'bg-red-100 text-red-800'
      case 'disconnected': return 'bg-gray-100 text-gray-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const tabs = [
    { id: 'account', name: 'Account', icon: User },
    { id: 'security', name: 'Security', icon: Lock },
    { id: 'notifications', name: 'Notifications', icon: Bell },
    { id: 'integrations', name: 'Integrations', icon: Link2 },
    { id: 'preferences', name: 'Preferences', icon: Palette }
  ]

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <RefreshCw className="w-5 h-5 animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600 mt-2">Manage your account, security, and application preferences</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <nav className="space-y-2">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-5 h-5 mr-3" />
                    {tab.name}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg border">
              {/* Account Settings */}
              {activeTab === 'account' && userProfile && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Account Information</h2>
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                      <input
                        type="text"
                        value={userProfile.name}
                        onChange={(e) => updateProfile('name', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                      <input
                        type="email"
                        value={userProfile.email}
                        onChange={(e) => updateProfile('email', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                      <input
                        type="text"
                        value={userProfile.company}
                        onChange={(e) => updateProfile('company', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <input
                        type="text"
                        value={userProfile.role}
                        onChange={(e) => updateProfile('role', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
                      <select
                        value={userProfile.timezone}
                        onChange={(e) => updateProfile('timezone', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="America/New_York">Eastern Time</option>
                        <option value="America/Chicago">Central Time</option>
                        <option value="America/Denver">Mountain Time</option>
                        <option value="America/Los_Angeles">Pacific Time</option>
                        <option value="UTC">UTC</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Language</label>
                      <select
                        value={userProfile.language}
                        onChange={(e) => updateProfile('language', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en-US">English (US)</option>
                        <option value="en-GB">English (UK)</option>
                        <option value="es-ES">Spanish</option>
                        <option value="fr-FR">French</option>
                        <option value="de-DE">German</option>
                      </select>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t">
                    <h3 className="text-lg font-medium text-red-600 mb-4">Danger Zone</h3>
                    <button className="px-4 py-2 border border-red-300 text-red-600 rounded-md hover:bg-red-50">
                      Delete Account
                    </button>
                    <p className="text-sm text-gray-500 mt-2">
                      Once you delete your account, there is no going back. Please be certain.
                    </p>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeTab === 'security' && securitySettings && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Security Settings</h2>

                  <div className="space-y-6">
                    {/* Two-Factor Authentication */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center">
                        <Shield className="w-5 h-5 text-green-500 mr-3" />
                        <div>
                          <h3 className="font-medium">Two-Factor Authentication</h3>
                          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={securitySettings.twoFactorEnabled}
                          onChange={(e) => updateSecuritySetting('twoFactorEnabled', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Login Notifications */}
                    <div className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center">
                        <Bell className="w-5 h-5 text-blue-500 mr-3" />
                        <div>
                          <h3 className="font-medium">Login Notifications</h3>
                          <p className="text-sm text-gray-500">Get notified when someone logs into your account</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={securitySettings.loginNotifications}
                          onChange={(e) => updateSecuritySetting('loginNotifications', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>

                    {/* Password */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center">
                          <Key className="w-5 h-5 text-purple-500 mr-3" />
                          <div>
                            <h3 className="font-medium">Password</h3>
                            <p className="text-sm text-gray-500">
                              Last changed: {formatDate(securitySettings.passwordLastChanged)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => setShowPasswordForm(!showPasswordForm)}
                          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
                        >
                          Change Password
                        </button>
                      </div>

                      {showPasswordForm && (
                        <div className="mt-4 space-y-3">
                          <input
                            type="password"
                            placeholder="Current password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="password"
                            placeholder="New password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <input
                            type="password"
                            placeholder="Confirm new password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <div className="flex space-x-2">
                            <button className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
                              Update Password
                            </button>
                            <button
                              onClick={() => setShowPasswordForm(false)}
                              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Active Sessions */}
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <Smartphone className="w-5 h-5 text-orange-500 mr-3" />
                          <div>
                            <h3 className="font-medium">Active Sessions</h3>
                            <p className="text-sm text-gray-500">
                              {securitySettings.activeSessions} active sessions across all devices
                            </p>
                          </div>
                        </div>
                        <button className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
                          Manage Sessions
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === 'notifications' && notificationSettings && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Notification Preferences</h2>

                  <div className="space-y-8">
                    {/* Email Notifications */}
                    <div>
                      <h3 className="text-lg font-medium mb-4 flex items-center">
                        <Mail className="w-5 h-5 mr-2" />
                        Email Notifications
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(notificationSettings.emailNotifications).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                              <p className="text-sm text-gray-500">
                                {key === 'security' && 'Important security alerts and login notifications'}
                                {key === 'billing' && 'Invoice, payment, and billing-related updates'}
                                {key === 'usage' && 'Usage alerts and quota notifications'}
                                {key === 'system' && 'System maintenance and downtime notifications'}
                                {key === 'marketing' && 'Product updates and promotional emails'}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => updateNotificationSetting('emailNotifications', key, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Push Notifications */}
                    <div>
                      <h3 className="text-lg font-medium mb-4 flex items-center">
                        <Smartphone className="w-5 h-5 mr-2" />
                        Push Notifications
                      </h3>
                      <div className="space-y-3">
                        {Object.entries(notificationSettings.pushNotifications).map(([key, value]) => (
                          <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                            <div>
                              <h4 className="font-medium capitalize">{key.replace(/([A-Z])/g, ' $1')}</h4>
                              <p className="text-sm text-gray-500">
                                {key === 'realTime' && 'Immediate notifications for urgent events'}
                                {key === 'daily' && 'Daily summary of activity and updates'}
                                {key === 'weekly' && 'Weekly digest and performance reports'}
                              </p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                              <input
                                type="checkbox"
                                checked={value}
                                onChange={(e) => updateNotificationSetting('pushNotifications', key, e.target.checked)}
                                className="sr-only peer"
                              />
                              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Integrations */}
              {activeTab === 'integrations' && (
                <div className="p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">Integrations</h2>
                    <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2">
                      <Plus className="w-4 h-4" />
                      <span>Add Integration</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {integrations.map((integration) => (
                      <div key={integration.id} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center space-x-4">
                          <div className="text-2xl">{integration.icon}</div>
                          <div>
                            <h3 className="font-medium">{integration.name}</h3>
                            <p className="text-sm text-gray-500">{integration.description}</p>
                            {integration.lastSync && (
                              <p className="text-xs text-gray-400">
                                Last sync: {new Date(integration.lastSync).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(integration.status)}`}>
                            {integration.status.toUpperCase()}
                          </span>
                          {integration.status === 'connected' && (
                            <button className="text-gray-400 hover:text-gray-600">
                              <RefreshCw className="w-4 h-4" />
                            </button>
                          )}
                          <button className="text-red-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Preferences */}
              {activeTab === 'preferences' && (
                <div className="p-6">
                  <h2 className="text-xl font-semibold mb-6">Application Preferences</h2>

                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-medium mb-4">Display Settings</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Theme</label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="light">Light Mode</option>
                            <option value="dark">Dark Mode</option>
                            <option value="auto">Auto (System)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Date Format</label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h3 className="text-lg font-medium mb-4">Data Processing</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Default Export Format</label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                            <option value="parquet">Parquet</option>
                            <option value="excel">Excel</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Auto-save Frequency</label>
                          <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                            <option value="30">Every 30 seconds</option>
                            <option value="60">Every minute</option>
                            <option value="300">Every 5 minutes</option>
                            <option value="0">Disabled</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 pt-6 border-t">
                    <button
                      onClick={saveSettings}
                      disabled={saving}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
                    >
                      {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 