'use client'

import { useState, useEffect } from 'react'
import { Key, Plus, Copy, Trash2, Eye, EyeOff, RefreshCw, Shield, Calendar, Activity } from 'lucide-react'

interface ApiKey {
  id: string
  name: string
  key: string
  lastUsed: string
  created: string
  status: 'active' | 'expired' | 'revoked'
  permissions: string[]
  callsThisMonth: number
  lastActivity: string
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showNewKeyModal, setShowNewKeyModal] = useState(false)
  const [newKeyName, setNewKeyName] = useState('')
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([])
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())

  const availablePermissions = [
    'data:read',
    'data:write',
    'data:delete',
    'analytics:read',
    'transformations:execute',
    'exports:create',
    'admin:manage'
  ]

  useEffect(() => {
    // Load mock API keys
    setApiKeys([
      {
        id: 'key_001',
        name: 'Production API',
        key: 'pb_live_1234567890abcdef1234567890abcdef',
        lastUsed: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
        created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
        status: 'active',
        permissions: ['data:read', 'data:write', 'analytics:read'],
        callsThisMonth: 12847,
        lastActivity: new Date(Date.now() - 1000 * 60 * 30).toISOString()
      },
      {
        id: 'key_002',
        name: 'Development API',
        key: 'pb_test_abcdef1234567890abcdef1234567890',
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
        created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
        status: 'active',
        permissions: ['data:read', 'analytics:read'],
        callsThisMonth: 892,
        lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString()
      },
      {
        id: 'key_003',
        name: 'Analytics Dashboard',
        key: 'pb_live_9876543210fedcba9876543210fedcba',
        lastUsed: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
        created: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
        status: 'expired',
        permissions: ['analytics:read'],
        callsThisMonth: 0,
        lastActivity: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString()
      }
    ])
    setLoading(false)
  }, [])

  const generateApiKey = () => {
    if (!newKeyName.trim()) return

    const newKey: ApiKey = {
      id: 'key_' + Math.random().toString(36).substr(2, 9),
      name: newKeyName,
      key: 'pb_live_' + Math.random().toString(36).substr(2, 32),
      lastUsed: '',
      created: new Date().toISOString(),
      status: 'active',
      permissions: selectedPermissions,
      callsThisMonth: 0,
      lastActivity: ''
    }

    setApiKeys(prev => [newKey, ...prev])
    setShowNewKeyModal(false)
    setNewKeyName('')
    setSelectedPermissions([])
  }

  const revokeKey = (keyId: string) => {
    setApiKeys(prev => 
      prev.map(key => 
        key.id === keyId 
          ? { ...key, status: 'revoked' as const }
          : key
      )
    )
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    // In a real app, you'd show a toast notification
  }

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev)
      if (newSet.has(keyId)) {
        newSet.delete(keyId)
      } else {
        newSet.add(keyId)
      }
      return newSet
    })
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'expired': return 'bg-yellow-100 text-yellow-800'
      case 'revoked': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleDateString()
  }

  const maskKey = (key: string) => {
    return key.substring(0, 12) + '•'.repeat(20) + key.substring(key.length - 8)
  }

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
        <div className="flex justify-between items-center mb-8">
      <div>
            <h1 className="text-3xl font-bold text-gray-900">API Keys</h1>
            <p className="text-gray-600 mt-2">Manage your API keys for secure access to Schlep-engine services</p>
          </div>
          <button
            onClick={() => setShowNewKeyModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create API Key</span>
          </button>
      </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg border">
            <Key className="w-8 h-8 text-blue-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Total Keys</h3>
            <p className="text-3xl font-bold text-blue-600">{apiKeys.length}</p>
            <p className="text-sm text-gray-500 mt-2">active and inactive</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Shield className="w-8 h-8 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Active Keys</h3>
            <p className="text-3xl font-bold text-green-600">
              {apiKeys.filter(k => k.status === 'active').length}
            </p>
            <p className="text-sm text-gray-500 mt-2">currently in use</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Activity className="w-8 h-8 text-purple-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Total Calls</h3>
            <p className="text-3xl font-bold text-purple-600">
              {apiKeys.reduce((sum, key) => sum + key.callsThisMonth, 0).toLocaleString()}
            </p>
            <p className="text-sm text-gray-500 mt-2">this month</p>
          </div>
          <div className="bg-white p-6 rounded-lg border">
            <Calendar className="w-8 h-8 text-orange-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Last Activity</h3>
            <p className="text-xl font-bold text-orange-600">30 min ago</p>
            <p className="text-sm text-gray-500 mt-2">most recent call</p>
          </div>
        </div>

        {/* API Keys List */}
        <div className="bg-white rounded-lg border">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Your API Keys</h2>
            <p className="text-gray-600 text-sm mt-1">Manage authentication keys for your applications</p>
          </div>
          
        <div className="p-6">
            {apiKeys.length === 0 ? (
          <div className="text-center py-8">
                <Key className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No API Keys</h3>
                <p className="text-gray-500 mb-4">Create your first API key to start using the Schlep-engine API</p>
                <button
                  onClick={() => setShowNewKeyModal(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  Create API Key
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {apiKeys.map((apiKey) => (
                  <div key={apiKey.id} className="border rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center">
                        <Key className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <h3 className="font-semibold text-lg">{apiKey.name}</h3>
                          <p className="text-sm text-gray-500">Created {formatDate(apiKey.created)}</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(apiKey.status)}`}>
                          {apiKey.status.toUpperCase()}
                        </span>
                        {apiKey.status === 'active' && (
                          <button
                            onClick={() => revokeKey(apiKey.id)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4 mb-4">
                      <div className="flex items-center justify-between">
                        <code className="text-sm font-mono text-gray-700">
                          {visibleKeys.has(apiKey.id) ? apiKey.key : maskKey(apiKey.key)}
                        </code>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleKeyVisibility(apiKey.id)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            {visibleKeys.has(apiKey.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                          <button
                            onClick={() => copyKey(apiKey.key)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <Copy className="w-4 h-4" />
            </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Last Used</div>
                        <div className="font-medium">{formatDate(apiKey.lastUsed)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Calls This Month</div>
                        <div className="font-medium">{apiKey.callsThisMonth.toLocaleString()}</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Permissions</div>
                        <div className="font-medium">{apiKey.permissions.length} scopes</div>
                      </div>
                      <div>
                        <div className="text-sm text-gray-500 mb-1">Status</div>
                        <div className="font-medium capitalize">{apiKey.status}</div>
                      </div>
                    </div>

                    <div>
                      <div className="text-sm text-gray-500 mb-2">Permissions:</div>
                      <div className="flex flex-wrap gap-2">
                        {apiKey.permissions.map((permission) => (
                          <span key={permission} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                            {permission}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Create API Key Modal */}
        {showNewKeyModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">Create New API Key</h2>
                <button
                  onClick={() => setShowNewKeyModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permissions
                  </label>
                  <div className="space-y-2">
                    {availablePermissions.map((permission) => (
                      <label key={permission} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedPermissions.includes(permission)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedPermissions(prev => [...prev, permission])
                            } else {
                              setSelectedPermissions(prev => prev.filter(p => p !== permission))
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">{permission}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowNewKeyModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={generateApiKey}
                  disabled={!newKeyName.trim() || selectedPermissions.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
                >
                  Generate Key
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 