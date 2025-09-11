'use client'

import React, { useState, useEffect } from 'react'
import { X, Plus, Key, Lock, Eye, EyeOff, Copy, Check, Trash2 } from 'lucide-react'

interface AuthConfig {
  id: string
  name: string
  type: 'api-key' | 'bearer-token' | 'basic-auth' | 'oauth2'
  config: {
    key?: string
    value?: string
    username?: string
    password?: string
    token?: string
    headerName?: string
  }
  active: boolean
}

interface AuthenticationManagerProps {
  isOpen: boolean
  onClose: () => void
  onAuthChange: (authConfigs: AuthConfig[]) => void
  currentAuth?: AuthConfig[]
}

const AUTH_TYPES = [
  { value: 'api-key', label: 'API Key', icon: Key },
  { value: 'bearer-token', label: 'Bearer Token', icon: Lock },
  { value: 'basic-auth', label: 'Basic Auth', icon: Lock },
  { value: 'oauth2', label: 'OAuth 2.0', icon: Lock },
] as const

export function AuthenticationManager({ 
  isOpen, 
  onClose, 
  onAuthChange,
  currentAuth = [] 
}: AuthenticationManagerProps) {
  const [authConfigs, setAuthConfigs] = useState<AuthConfig[]>(currentAuth)
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({})
  const [copiedIds, setCopiedIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (isOpen) {
      // Load from localStorage
      const saved = localStorage.getItem('api-console-auth-configs')
      if (saved) {
        try {
          setAuthConfigs(JSON.parse(saved))
        } catch (error) {
          console.error('Failed to load auth configs:', error)
        }
      }
    }
  }, [isOpen])

  const saveConfigs = (configs: AuthConfig[]) => {
    setAuthConfigs(configs)
    localStorage.setItem('api-console-auth-configs', JSON.stringify(configs))
    onAuthChange(configs)
  }

  const addNewAuth = () => {
    const newAuth: AuthConfig = {
      id: `auth_${Date.now()}`,
      name: 'New Authentication',
      type: 'api-key',
      config: {
        headerName: 'X-API-Key',
        key: '',
        value: ''
      },
      active: false
    }
    saveConfigs([...authConfigs, newAuth])
  }

  const updateAuth = (id: string, updates: Partial<AuthConfig>) => {
    const updated = authConfigs.map(auth => 
      auth.id === id ? { ...auth, ...updates } : auth
    )
    saveConfigs(updated)
  }

  const deleteAuth = (id: string) => {
    const filtered = authConfigs.filter(auth => auth.id !== id)
    saveConfigs(filtered)
  }

  const toggleActive = (id: string) => {
    const updated = authConfigs.map(auth => 
      auth.id === id ? { ...auth, active: !auth.active } : auth
    )
    saveConfigs(updated)
  }

  const togglePasswordVisibility = (id: string) => {
    setShowPasswords(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedIds(prev => ({ ...prev, [id]: true }))
      setTimeout(() => {
        setCopiedIds(prev => ({ ...prev, [id]: false }))
      }, 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const renderAuthForm = (auth: AuthConfig) => {
    const IconComponent = AUTH_TYPES.find(t => t.value === auth.type)?.icon || Key

    return (
      <div key={auth.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <IconComponent className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <input
              type="text"
              value={auth.name}
              onChange={(e) => updateAuth(auth.id, { name: e.target.value })}
              className="text-sm font-medium bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
              placeholder="Authentication name"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={auth.active}
                onChange={() => toggleActive(auth.id)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 dark:text-gray-400">Active</span>
            </label>
            <button
              onClick={() => deleteAuth(auth.id)}
              className="p-1 text-red-600 hover:text-red-800 transition-colors"
              title="Delete authentication"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              value={auth.type}
              onChange={(e) => updateAuth(auth.id, { 
                type: e.target.value as AuthConfig['type'],
                config: {} // Reset config when type changes
              })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {AUTH_TYPES.map(type => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* API Key Configuration */}
          {auth.type === 'api-key' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Header Name
                </label>
                <input
                  type="text"
                  value={auth.config.headerName || ''}
                  onChange={(e) => updateAuth(auth.id, { 
                    config: { ...auth.config, headerName: e.target.value }
                  })}
                  placeholder="X-API-Key"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  API Key
                </label>
                <div className="relative">
                  <input
                    type={showPasswords[auth.id] ? 'text' : 'password'}
                    value={auth.config.value || ''}
                    onChange={(e) => updateAuth(auth.id, { 
                      config: { ...auth.config, value: e.target.value }
                    })}
                    placeholder="Enter your API key"
                    className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(auth.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {showPasswords[auth.id] ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                    {auth.config.value && (
                      <button
                        type="button"
                        onClick={() => copyToClipboard(auth.config.value || '', auth.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                        title="Copy API key"
                      >
                        {copiedIds[auth.id] ? (
                          <Check className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Bearer Token Configuration */}
          {auth.type === 'bearer-token' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bearer Token
              </label>
              <div className="relative">
                <input
                  type={showPasswords[auth.id] ? 'text' : 'password'}
                  value={auth.config.token || ''}
                  onChange={(e) => updateAuth(auth.id, { 
                    config: { ...auth.config, token: e.target.value }
                  })}
                  placeholder="Enter bearer token"
                  className="w-full px-3 py-2 pr-20 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-3 space-x-1">
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(auth.id)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPasswords[auth.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  {auth.config.token && (
                    <button
                      type="button"
                      onClick={() => copyToClipboard(auth.config.token || '', auth.id)}
                      className="text-gray-400 hover:text-gray-600 transition-colors"
                      title="Copy token"
                    >
                      {copiedIds[auth.id] ? (
                        <Check className="w-4 h-4 text-green-500" />
                      ) : (
                        <Copy className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Basic Auth Configuration */}
          {auth.type === 'basic-auth' && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={auth.config.username || ''}
                  onChange={(e) => updateAuth(auth.id, { 
                    config: { ...auth.config, username: e.target.value }
                  })}
                  placeholder="Enter username"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPasswords[auth.id] ? 'text' : 'password'}
                    value={auth.config.password || ''}
                    onChange={(e) => updateAuth(auth.id, { 
                      config: { ...auth.config, password: e.target.value }
                    })}
                    placeholder="Enter password"
                    className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-md text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => togglePasswordVisibility(auth.id)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPasswords[auth.id] ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </>
          )}

          {/* OAuth 2.0 Configuration */}
          {auth.type === 'oauth2' && (
            <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
              <p className="text-sm text-yellow-700 dark:text-yellow-300">
                OAuth 2.0 flow integration coming soon. For now, use Bearer Token with your OAuth access token.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                <Lock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Authentication Manager
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Manage API keys, tokens, and authentication methods
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {authConfigs.length === 0 ? (
              <div className="text-center py-12">
                <Lock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No Authentication Methods
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Add authentication methods to test protected API endpoints
                </p>
                <button
                  onClick={addNewAuth}
                  className="inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Authentication</span>
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                    Authentication Methods ({authConfigs.length})
                  </h3>
                  <button
                    onClick={addNewAuth}
                    className="inline-flex items-center space-x-2 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add New</span>
                  </button>
                </div>
                
                <div className="space-y-4">
                  {authConfigs.map(renderAuthForm)}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>
              {authConfigs.filter(a => a.active).length} active authentication method(s)
            </span>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}