'use client'

import React, { useState, useEffect } from 'react'
import { 
  Settings,
  Plus,
  Edit,
  Trash2,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Download,
  Upload,
  Check,
  X,
  AlertTriangle,
  ChevronDown,
  Server,
  Database,
  Key,
  RotateCcw
} from 'lucide-react'

interface EnvironmentVariable {
  key: string
  value: string
  description?: string
  secret?: boolean
  enabled?: boolean
}

interface Environment {
  id: string
  name: string
  description?: string
  baseUrl: string
  variables: EnvironmentVariable[]
  isActive?: boolean
  color?: string
  createdAt: string
  updatedAt: string
}

interface EnvironmentManagerProps {
  onEnvironmentChange?: (environment: Environment) => void
  onVariableChange?: (variables: Record<string, string>) => void
}

export function EnvironmentManager({ onEnvironmentChange, onVariableChange }: EnvironmentManagerProps) {
  const [environments, setEnvironments] = useState<Environment[]>([])
  const [activeEnvironment, setActiveEnvironment] = useState<Environment | null>(null)
  const [isOpen, setIsOpen] = useState(false)
  const [editingEnv, setEditingEnv] = useState<Environment | null>(null)
  const [showSecrets, setShowSecrets] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Initialize with default environments
  useEffect(() => {
    const defaultEnvironments: Environment[] = [
      {
        id: 'development',
        name: 'Development',
        description: 'Local development environment',
        baseUrl: 'http://localhost:8000',
        color: '#10B981', // green
        isActive: true,
        variables: [
          { key: 'API_TOKEN', value: 'dev_token_123', secret: true, enabled: true, description: 'Development API token' },
          { key: 'API_VERSION', value: 'v1', enabled: true, description: 'API version' },
          { key: 'DEBUG_MODE', value: 'true', enabled: true, description: 'Enable debug logging' },
          { key: 'USER_ID', value: 'dev_user_001', enabled: true, description: 'Test user ID' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'staging',
        name: 'Staging',
        description: 'Staging environment for testing',
        baseUrl: 'https://staging-api.schlep-engine.com',
        color: '#F59E0B', // yellow
        variables: [
          { key: 'API_TOKEN', value: 'staging_token_456', secret: true, enabled: true, description: 'Staging API token' },
          { key: 'API_VERSION', value: 'v1', enabled: true, description: 'API version' },
          { key: 'DEBUG_MODE', value: 'false', enabled: true, description: 'Debug logging disabled' },
          { key: 'USER_ID', value: 'staging_user_001', enabled: true, description: 'Staging test user' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        id: 'production',
        name: 'Production',
        description: 'Live production environment',
        baseUrl: 'https://api.schlep-engine.com',
        color: '#EF4444', // red
        variables: [
          { key: 'API_TOKEN', value: '', secret: true, enabled: true, description: 'Production API token (set your own)' },
          { key: 'API_VERSION', value: 'v1', enabled: true, description: 'API version' },
          { key: 'DEBUG_MODE', value: 'false', enabled: true, description: 'Debug logging disabled' },
          { key: 'RATE_LIMIT', value: '1000', enabled: true, description: 'Requests per hour limit' }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ]

    // Load from localStorage or use defaults
    const savedEnvironments = localStorage.getItem('console-environments')
    if (savedEnvironments) {
      const parsed = JSON.parse(savedEnvironments)
      setEnvironments(parsed)
      const active = parsed.find((env: Environment) => env.isActive) || parsed[0]
      setActiveEnvironment(active)
      if (onEnvironmentChange) onEnvironmentChange(active)
      updateVariables(active)
    } else {
      setEnvironments(defaultEnvironments)
      setActiveEnvironment(defaultEnvironments[0])
      if (onEnvironmentChange) onEnvironmentChange(defaultEnvironments[0])
      updateVariables(defaultEnvironments[0])
      localStorage.setItem('console-environments', JSON.stringify(defaultEnvironments))
    }
  }, [])

  const updateVariables = (env: Environment) => {
    if (onVariableChange) {
      const variables: Record<string, string> = {}
      env.variables.forEach(variable => {
        if (variable.enabled) {
          variables[variable.key] = variable.value
        }
      })
      onVariableChange(variables)
    }
  }

  const saveEnvironments = (envs: Environment[]) => {
    setEnvironments(envs)
    localStorage.setItem('console-environments', JSON.stringify(envs))
  }

  const switchEnvironment = (envId: string) => {
    const updatedEnvs = environments.map(env => ({
      ...env,
      isActive: env.id === envId
    }))
    
    const newActiveEnv = updatedEnvs.find(env => env.id === envId)
    if (newActiveEnv) {
      setActiveEnvironment(newActiveEnv)
      if (onEnvironmentChange) onEnvironmentChange(newActiveEnv)
      updateVariables(newActiveEnv)
    }
    
    saveEnvironments(updatedEnvs)
    setIsOpen(false)
  }

  const createEnvironment = () => {
    const newEnv: Environment = {
      id: `env_${Date.now()}`,
      name: 'New Environment',
      description: '',
      baseUrl: 'https://api.example.com',
      color: '#6B7280',
      variables: [
        { key: 'API_TOKEN', value: '', secret: true, enabled: true, description: 'API authentication token' }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    setEditingEnv(newEnv)
  }

  const saveEnvironment = (env: Environment) => {
    env.updatedAt = new Date().toISOString()
    
    const existingIndex = environments.findIndex(e => e.id === env.id)
    let updatedEnvs
    
    if (existingIndex >= 0) {
      updatedEnvs = [...environments]
      updatedEnvs[existingIndex] = env
    } else {
      updatedEnvs = [...environments, env]
    }
    
    saveEnvironments(updatedEnvs)
    setEditingEnv(null)
    
    if (env.isActive) {
      setActiveEnvironment(env)
      if (onEnvironmentChange) onEnvironmentChange(env)
      updateVariables(env)
    }
  }

  const deleteEnvironment = (envId: string) => {
    const updatedEnvs = environments.filter(env => env.id !== envId)
    
    // If deleting active environment, switch to first available
    if (activeEnvironment?.id === envId && updatedEnvs.length > 0) {
      updatedEnvs[0].isActive = true
      setActiveEnvironment(updatedEnvs[0])
      if (onEnvironmentChange) onEnvironmentChange(updatedEnvs[0])
      updateVariables(updatedEnvs[0])
    }
    
    saveEnvironments(updatedEnvs)
  }

  const exportEnvironments = () => {
    const exportData = {
      environments: environments.map(env => ({
        ...env,
        variables: env.variables.map(v => ({
          ...v,
          value: v.secret ? '[REDACTED]' : v.value
        }))
      })),
      exportedAt: new Date().toISOString(),
      version: '1.0'
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `console_environments_${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const importEnvironments = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target?.result as string)
        if (importData.environments) {
          saveEnvironments(importData.environments)
        }
      } catch (error) {
        console.error('Failed to import environments:', error)
      }
    }
    reader.readAsText(file)
  }

  const filteredEnvironments = environments.filter(env =>
    env.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    env.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="relative">
      {/* Environment Selector */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <div 
          className="w-3 h-3 rounded-full" 
          style={{ backgroundColor: activeEnvironment?.color || '#6B7280' }}
        />
        <span className="text-sm font-medium text-gray-900 dark:text-white">
          {activeEnvironment?.name || 'No Environment'}
        </span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {/* Environment Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 min-w-96">
          {/* Header */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Environments</h3>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSecrets(!showSecrets)}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title={showSecrets ? "Hide secrets" : "Show secrets"}
                >
                  {showSecrets ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button
                  onClick={exportEnvironments}
                  className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  title="Export environments"
                >
                  <Download className="w-4 h-4" />
                </button>
                <label className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-pointer" title="Import environments">
                  <Upload className="w-4 h-4" />
                  <input
                    type="file"
                    accept=".json"
                    onChange={importEnvironments}
                    className="hidden"
                  />
                </label>
                <button
                  onClick={createEnvironment}
                  className="p-1 text-blue-600 hover:text-blue-700"
                  title="Create environment"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <input
              type="text"
              placeholder="Search environments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Environment List */}
          <div className="max-h-96 overflow-y-auto">
            {filteredEnvironments.map((env) => (
              <div 
                key={env.id}
                className={`p-4 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                  env.isActive ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <button
                    onClick={() => switchEnvironment(env.id)}
                    className="flex items-center space-x-3 flex-1 text-left"
                  >
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: env.color }}
                    />
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">{env.name}</div>
                      {env.description && (
                        <div className="text-sm text-gray-600 dark:text-gray-400">{env.description}</div>
                      )}
                      <div className="text-xs text-gray-500 dark:text-gray-500 font-mono">{env.baseUrl}</div>
                    </div>
                  </button>
                  
                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => setEditingEnv(env)}
                      className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    {environments.length > 1 && (
                      <button
                        onClick={() => deleteEnvironment(env.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Variables Preview */}
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {env.variables.slice(0, 4).map((variable) => (
                    <div key={variable.key} className="text-xs">
                      <span className="text-gray-500 dark:text-gray-400">{variable.key}:</span>
                      <span className="ml-1 text-gray-700 dark:text-gray-300">
                        {variable.secret && !showSecrets ? '••••••••' : variable.value || '[empty]'}
                      </span>
                    </div>
                  ))}
                  {env.variables.length > 4 && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      +{env.variables.length - 4} more
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Environment Editor Modal */}
      {editingEnv && (
        <EnvironmentEditor
          environment={editingEnv}
          onSave={saveEnvironment}
          onCancel={() => setEditingEnv(null)}
        />
      )}
    </div>
  )
}

interface EnvironmentEditorProps {
  environment: Environment
  onSave: (env: Environment) => void
  onCancel: () => void
}

function EnvironmentEditor({ environment, onSave, onCancel }: EnvironmentEditorProps) {
  const [env, setEnv] = useState<Environment>({ ...environment })

  const addVariable = () => {
    setEnv({
      ...env,
      variables: [...env.variables, { key: '', value: '', enabled: true }]
    })
  }

  const updateVariable = (index: number, updates: Partial<EnvironmentVariable>) => {
    const newVariables = [...env.variables]
    newVariables[index] = { ...newVariables[index], ...updates }
    setEnv({ ...env, variables: newVariables })
  }

  const removeVariable = (index: number) => {
    setEnv({
      ...env,
      variables: env.variables.filter((_, i) => i !== index)
    })
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl m-4">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {environment.id.startsWith('env_') ? 'Create Environment' : 'Edit Environment'}
          </h2>
        </div>

        <div className="p-6 max-h-96 overflow-y-auto">
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={env.name}
                  onChange={(e) => setEnv({ ...env, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Color
                </label>
                <input
                  type="color"
                  value={env.color || '#6B7280'}
                  onChange={(e) => setEnv({ ...env, color: e.target.value })}
                  className="w-full h-10 border border-gray-300 dark:border-gray-600 rounded-lg"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                type="text"
                value={env.description || ''}
                onChange={(e) => setEnv({ ...env, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Base URL
              </label>
              <input
                type="url"
                value={env.baseUrl}
                onChange={(e) => setEnv({ ...env, baseUrl: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Variables */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Variables
                </label>
                <button
                  onClick={addVariable}
                  className="flex items-center space-x-1 px-2 py-1 text-sm text-blue-600 hover:text-blue-700"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add Variable</span>
                </button>
              </div>

              <div className="space-y-3">
                {env.variables.map((variable, index) => (
                  <div key={index} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Key"
                      value={variable.key}
                      onChange={(e) => updateVariable(index, { key: e.target.value })}
                      className="col-span-3 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type={variable.secret ? "password" : "text"}
                      placeholder="Value"
                      value={variable.value}
                      onChange={(e) => updateVariable(index, { value: e.target.value })}
                      className="col-span-4 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <input
                      type="text"
                      placeholder="Description"
                      value={variable.description || ''}
                      onChange={(e) => updateVariable(index, { description: e.target.value })}
                      className="col-span-3 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <div className="col-span-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={variable.secret || false}
                        onChange={(e) => updateVariable(index, { secret: e.target.checked })}
                        className="w-4 h-4"
                        title="Secret"
                      />
                    </div>
                    <button
                      onClick={() => removeVariable(index)}
                      className="col-span-1 p-1 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(env)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Save Environment
          </button>
        </div>
      </div>
    </div>
  )
}