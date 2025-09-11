'use client'

import React, { useState, useEffect } from 'react'
import { 
  Play, 
  Save, 
  Copy, 
  Download,
  Settings,
  Code2,
  Eye,
  EyeOff,
  Plus,
  Minus,
  RefreshCw,
  Clock,
  Key,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Info,
  Zap,
  ChevronDown,
  ChevronRight,
  Upload,
  File,
  Image,
  X,
  FileText
} from 'lucide-react'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
}

interface RequestParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'object' | 'array'
  required: boolean
  description: string
  example?: any
  enum?: string[]
  pattern?: string
  min?: number
  max?: number
}

interface AuthConfig {
  type: 'api_key' | 'bearer' | 'basic' | 'oauth2'
  apiKey?: string
  token?: string
  username?: string
  password?: string
}

interface Environment {
  id: string
  name: string
  baseUrl: string
  color: string
}

interface UploadedFile {
  id: string
  name: string
  size: number
  type: string
  file: File
  preview?: string
}

interface FormField {
  id: string
  key: string
  value: string
  type: 'text' | 'file'
  files?: UploadedFile[]
}

interface RequestBuilderProps {
  endpoint?: APIEndpoint
  onSendRequest: (config: any) => Promise<any>
  loading?: boolean
  onSaveRequest?: (config: any) => void
  onOpenCodeGen?: () => void
  onRequestConfigChange?: (config: any) => void
}

export function RequestBuilder({ endpoint, onSendRequest, loading = false, onSaveRequest, onOpenCodeGen, onRequestConfigChange }: RequestBuilderProps) {
  const [environment, setEnvironment] = useState<Environment>({
    id: 'production',
    name: 'Production',
    baseUrl: 'https://api.schlep-engine.com',
    color: 'green'
  })
  
  const [auth, setAuth] = useState<AuthConfig>({
    type: 'api_key',
    apiKey: 'sk_live_...'
  })
  
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  })
  
  const [pathParams, setPathParams] = useState<Record<string, string>>({})
  const [queryParams, setQueryParams] = useState<Record<string, string>>({})
  const [requestBody, setRequestBody] = useState<string>('')
  const [bodyType, setBodyType] = useState<'json' | 'form-data' | 'raw' | 'none'>('json')
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [showAuthDetails, setShowAuthDetails] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [requestTimeout, setRequestTimeout] = useState(30000)
  const [followRedirects, setFollowRedirects] = useState(true)

  const environments: Environment[] = [
    { id: 'production', name: 'Production', baseUrl: 'https://api.schlep-engine.com', color: 'green' },
    { id: 'staging', name: 'Staging', baseUrl: 'https://staging-api.schlep-engine.com', color: 'yellow' },
    { id: 'development', name: 'Development', baseUrl: 'https://dev-api.schlep-engine.com', color: 'blue' },
    { id: 'local', name: 'Local', baseUrl: 'http://localhost:8000', color: 'gray' }
  ]

  // Sample parameters for the current endpoint
  const getEndpointParameters = (endpoint?: APIEndpoint): RequestParameter[] => {
    if (!endpoint) return []

    // This would normally come from OpenAPI spec or endpoint configuration
    const parameterMap: Record<string, RequestParameter[]> = {
      'create-ai-twin': [
        {
          name: 'twin_id',
          type: 'string',
          required: true,
          description: 'Unique identifier for the digital twin',
          example: 'ai_model_twin_001'
        },
        {
          name: 'twin_name',
          type: 'string',
          required: true,
          description: 'Human-readable name for the twin',
          example: 'Fraud Detection Model Twin'
        },
        {
          name: 'twin_type',
          type: 'string',
          required: true,
          description: 'Type of digital twin',
          enum: ['AI_MODEL', 'PROCESS', 'SYSTEM'],
          example: 'AI_MODEL'
        },
        {
          name: 'configuration',
          type: 'object',
          required: true,
          description: 'Configuration object for the twin',
          example: {
            model_type: 'xgboost',
            version: '2.1.0',
            performance_targets: { accuracy: 0.95, latency_ms: 50 }
          }
        }
      ],
      'dataset-quality': [
        {
          name: 'id',
          type: 'string',
          required: true,
          description: 'Dataset ID',
          example: 'ds_001'
        },
        {
          name: 'include_bias_analysis',
          type: 'boolean',
          required: false,
          description: 'Include bias analysis in the report',
          example: true
        }
      ]
    }

    return parameterMap[endpoint.id] || []
  }

  const parameters = getEndpointParameters(endpoint)

  // Extract path parameters from endpoint path
  useEffect(() => {
    if (endpoint) {
      const pathParamMatches = endpoint.path.match(/{([^}]+)}/g)
      if (pathParamMatches) {
        const newPathParams: Record<string, string> = {}
        pathParamMatches.forEach(match => {
          const paramName = match.slice(1, -1)
          newPathParams[paramName] = pathParams[paramName] || ''
        })
        setPathParams(newPathParams)
      }

      // Set default request body for POST/PUT requests
      if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
        const bodyParams = parameters.filter(p => p.type === 'object')
        if (bodyParams.length > 0 && !requestBody) {
          const exampleBody = {}
          parameters.forEach(param => {
            if (param.example !== undefined) {
              // @ts-ignore
              exampleBody[param.name] = param.example
            }
          })
          setRequestBody(JSON.stringify(exampleBody, null, 2))
        }
      }
    }
  }, [endpoint, parameters, pathParams, requestBody])

  const addHeader = () => {
    setHeaders({ ...headers, '': '' })
  }

  const removeHeader = (key: string) => {
    const newHeaders = { ...headers }
    delete newHeaders[key]
    setHeaders(newHeaders)
  }

  const updateHeader = (oldKey: string, newKey: string, value: string) => {
    const newHeaders = { ...headers }
    if (oldKey !== newKey) {
      delete newHeaders[oldKey]
    }
    newHeaders[newKey] = value
    setHeaders(newHeaders)
  }

  const addQueryParam = () => {
    setQueryParams({ ...queryParams, '': '' })
  }

  const removeQueryParam = (key: string) => {
    const newParams = { ...queryParams }
    delete newParams[key]
    setQueryParams(newParams)
  }

  // File upload and form data helpers
  const addFormField = () => {
    const newField: FormField = {
      id: `field_${Date.now()}`,
      key: '',
      value: '',
      type: 'text'
    }
    setFormFields([...formFields, newField])
  }

  const removeFormField = (id: string) => {
    setFormFields(formFields.filter(field => field.id !== id))
  }

  const updateFormField = (id: string, updates: Partial<FormField>) => {
    setFormFields(formFields.map(field => 
      field.id === id ? { ...field, ...updates } : field
    ))
  }

  const handleFileUpload = (fieldId: string, files: FileList) => {
    const uploadedFiles: UploadedFile[] = []
    
    Array.from(files).forEach(file => {
      const uploadedFile: UploadedFile = {
        id: `file_${Date.now()}_${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        file
      }

      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          uploadedFile.preview = e.target?.result as string
        }
        reader.readAsDataURL(file)
      }

      uploadedFiles.push(uploadedFile)
    })

    updateFormField(fieldId, { 
      type: 'file', 
      files: uploadedFiles 
    })
  }

  const removeFile = (fieldId: string, fileId: string) => {
    const field = formFields.find(f => f.id === fieldId)
    if (field && field.files) {
      const updatedFiles = field.files.filter(f => f.id !== fileId)
      updateFormField(fieldId, { files: updatedFiles })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Update Content-Type header based on body type
  useEffect(() => {
    if (bodyType === 'form-data') {
      // Remove Content-Type header for form-data - browser will set it with boundary
      const newHeaders = { ...headers }
      delete newHeaders['Content-Type']
      setHeaders(newHeaders)
    } else if (bodyType === 'json') {
      setHeaders({ ...headers, 'Content-Type': 'application/json' })
    } else if (bodyType === 'raw') {
      setHeaders({ ...headers, 'Content-Type': 'text/plain' })
    }
  }, [bodyType])

  const updateQueryParam = (oldKey: string, newKey: string, value: string) => {
    const newParams = { ...queryParams }
    if (oldKey !== newKey) {
      delete newParams[oldKey]
    }
    newParams[newKey] = value
    setQueryParams(newParams)
  }

  const buildFinalUrl = () => {
    if (!endpoint) return ''
    
    let url = environment.baseUrl + endpoint.path
    
    // Replace path parameters
    Object.entries(pathParams).forEach(([key, value]) => {
      url = url.replace(`{${key}}`, encodeURIComponent(value))
    })
    
    // Add query parameters
    const queryString = Object.entries(queryParams)
      .filter(([key, value]) => key && value)
      .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      .join('&')
    
    if (queryString) {
      url += '?' + queryString
    }
    
    return url
  }

  const buildAuthHeaders = () => {
    const authHeaders: Record<string, string> = {}
    
    switch (auth.type) {
      case 'api_key':
        if (auth.apiKey) {
          authHeaders['Authorization'] = `Bearer ${auth.apiKey}`
        }
        break
      case 'bearer':
        if (auth.token) {
          authHeaders['Authorization'] = `Bearer ${auth.token}`
        }
        break
      case 'basic':
        if (auth.username && auth.password) {
          const credentials = btoa(`${auth.username}:${auth.password}`)
          authHeaders['Authorization'] = `Basic ${credentials}`
        }
        break
    }
    
    return authHeaders
  }

  const buildCurrentRequestConfig = () => {
    if (!endpoint) return null

    const authHeaders = buildAuthHeaders()
    
    const finalHeaders: Record<string, string> = {
      ...authHeaders,
      ...headers
    }

    if (requestBody && (endpoint.method === 'POST' || endpoint.method === 'PUT' || endpoint.method === 'PATCH')) {
      if (bodyType === 'json') {
        finalHeaders['Content-Type'] = 'application/json'
      } else if (bodyType === 'form-data') {
        finalHeaders['Content-Type'] = 'multipart/form-data'
      } else if (bodyType === 'form-urlencoded') {
        finalHeaders['Content-Type'] = 'application/x-www-form-urlencoded'
      }
    }

    return {
      method: endpoint.method,
      url: buildFinalUrl(),
      headers: finalHeaders,
      body: requestBody || undefined
    }
  }

  // Update the request config whenever the form changes
  useEffect(() => {
    if (onRequestConfigChange) {
      const config = buildCurrentRequestConfig()
      onRequestConfigChange(config)
    }
  }, [endpoint, environment, auth, headers, pathParams, queryParams, requestBody, bodyType, formFields, onRequestConfigChange])

  const handleSendRequest = async () => {
    if (!endpoint) return
    
    const finalHeaders = {
      ...headers,
      ...buildAuthHeaders()
    }

    let requestData: any = undefined
    
    if (['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      if (bodyType === 'form-data') {
        // Create FormData for file uploads and form fields
        const formData = new FormData()
        
        formFields.forEach(field => {
          if (field.type === 'file' && field.files) {
            field.files.forEach(uploadedFile => {
              formData.append(field.key, uploadedFile.file)
            })
          } else if (field.type === 'text' && field.key && field.value) {
            formData.append(field.key, field.value)
          }
        })
        
        requestData = formData
        // Remove Content-Type header for FormData - browser will set it with boundary
        delete finalHeaders['Content-Type']
      } else if (bodyType === 'json') {
        requestData = requestBody
      } else if (bodyType === 'raw') {
        requestData = requestBody
      }
    }

    const requestConfig = {
      method: endpoint.method,
      url: buildFinalUrl(),
      headers: finalHeaders,
      data: requestData,
      timeout: requestTimeout,
      followRedirects,
      bodyType
    }

    try {
      await onSendRequest(requestConfig)
    } catch (error) {
      console.error('Request failed:', error)
    }
  }

  const handleSaveRequest = () => {
    if (!onSaveRequest || !endpoint) return

    const requestConfig = {
      endpoint,
      environment,
      auth,
      headers,
      pathParams,
      queryParams,
      requestBody,
      timeout: requestTimeout
    }

    onSaveRequest(requestConfig)
  }

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(requestBody)
      setRequestBody(JSON.stringify(parsed, null, 2))
    } catch (error) {
      // Invalid JSON, keep as is
    }
  }

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
      case 'POST': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
      case 'PUT': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
      case 'DELETE': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
      case 'PATCH': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  if (!endpoint) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <Code2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Select an API Endpoint
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            Choose an endpoint from the sidebar to start building your request
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 bg-white dark:bg-gray-800 flex flex-col">
      {/* Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <span className={`px-3 py-1 text-sm font-medium rounded ${getMethodColor(endpoint.method)}`}>
              {endpoint.method}
            </span>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              {endpoint.name}
            </h1>
            {endpoint.beta && (
              <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                BETA
              </span>
            )}
            {endpoint.deprecated && (
              <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded flex items-center">
                <AlertTriangle className="w-3 h-3 mr-1" />
                DEPRECATED
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleSaveRequest}
              className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              <Save className="w-4 h-4" />
              <span>Save</span>
            </button>
            <button className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
              <Copy className="w-4 h-4" />
              <span>Copy</span>
            </button>
          </div>
        </div>

        <p className="text-gray-600 dark:text-gray-400 mb-4">
          {endpoint.description}
        </p>

        {/* Environment Selector */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Globe className="w-4 h-4 text-gray-500" />
            <span className="text-sm text-gray-700 dark:text-gray-300">Environment:</span>
          </div>
          <select
            value={environment.id}
            onChange={(e) => setEnvironment(environments.find(env => env.id === e.target.value)!)}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {environments.map((env) => (
              <option key={env.id} value={env.id}>
                {env.name} ({env.baseUrl})
              </option>
            ))}
          </select>
          <div className={`w-2 h-2 rounded-full bg-${environment.color}-500`}></div>
        </div>

        {/* Final URL Preview */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Request URL:</span>
            <button className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <code className="text-sm text-purple-600 dark:text-purple-400 break-all">
            {buildFinalUrl()}
          </code>
        </div>
      </div>

      {/* Request Configuration */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Authentication */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
              <Key className="w-5 h-5 mr-2" />
              Authentication
            </h3>
            <button
              onClick={() => setShowAuthDetails(!showAuthDetails)}
              className="flex items-center text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              {showAuthDetails ? <EyeOff className="w-4 h-4 mr-1" /> : <Eye className="w-4 h-4 mr-1" />}
              {showAuthDetails ? 'Hide' : 'Show'} Details
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auth Type
              </label>
              <select
                value={auth.type}
                onChange={(e) => setAuth({ ...auth, type: e.target.value as AuthConfig['type'] })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="api_key">API Key</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
                <option value="oauth2">OAuth 2.0</option>
              </select>
            </div>

            {auth.type === 'api_key' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API Key
                </label>
                <input
                  type={showAuthDetails ? 'text' : 'password'}
                  value={auth.apiKey || ''}
                  onChange={(e) => setAuth({ ...auth, apiKey: e.target.value })}
                  placeholder="sk_live_..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            {auth.type === 'bearer' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Bearer Token
                </label>
                <input
                  type={showAuthDetails ? 'text' : 'password'}
                  value={auth.token || ''}
                  onChange={(e) => setAuth({ ...auth, token: e.target.value })}
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            )}

            {auth.type === 'basic' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Username
                  </label>
                  <input
                    type="text"
                    value={auth.username || ''}
                    onChange={(e) => setAuth({ ...auth, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Password
                  </label>
                  <input
                    type={showAuthDetails ? 'text' : 'password'}
                    value={auth.password || ''}
                    onChange={(e) => setAuth({ ...auth, password: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </>
            )}
          </div>
        </div>

        {/* Path Parameters */}
        {Object.keys(pathParams).length > 0 && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              Path Parameters
            </h3>
            <div className="space-y-3">
              {Object.entries(pathParams).map(([key, value]) => (
                <div key={key} className="grid grid-cols-3 gap-4 items-center">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      {key} <span className="text-red-500">*</span>
                    </label>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => setPathParams({ ...pathParams, [key]: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      placeholder={`Enter ${key}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Query Parameters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Query Parameters
            </h3>
            <button
              onClick={addQueryParam}
              className="flex items-center space-x-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Parameter</span>
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(queryParams).map(([key, value], index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => updateQueryParam(key, e.target.value, value)}
                  placeholder="Parameter name"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateQueryParam(key, key, e.target.value)}
                  placeholder="Parameter value"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <button
                  onClick={() => removeQueryParam(key)}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Minus className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Headers */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Headers
            </h3>
            <button
              onClick={addHeader}
              className="flex items-center space-x-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Add Header</span>
            </button>
          </div>
          <div className="space-y-2">
            {Object.entries(headers).map(([key, value], index) => (
              <div key={index} className="flex space-x-2">
                <input
                  type="text"
                  value={key}
                  onChange={(e) => updateHeader(key, e.target.value, value)}
                  placeholder="Header name"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <input
                  type="text"
                  value={value}
                  onChange={(e) => updateHeader(key, key, e.target.value)}
                  placeholder="Header value"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                {!['Content-Type', 'Accept'].includes(key) && (
                  <button
                    onClick={() => removeHeader(key)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Request Body */}
        {['POST', 'PUT', 'PATCH'].includes(endpoint.method) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Request Body
              </h3>
              <div className="flex items-center space-x-3">
                {/* Body Type Selector */}
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as any)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="json">JSON</option>
                  <option value="form-data">Form Data (multipart/form-data)</option>
                  <option value="raw">Raw Text</option>
                  <option value="none">None</option>
                </select>
                
                {bodyType === 'json' && (
                  <button
                    onClick={formatJSON}
                    className="flex items-center space-x-1 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Format JSON</span>
                  </button>
                )}
              </div>
            </div>

            {/* JSON/Raw Body */}
            {(bodyType === 'json' || bodyType === 'raw') && (
              <>
                <textarea
                  value={requestBody}
                  onChange={(e) => setRequestBody(e.target.value)}
                  placeholder={bodyType === 'json' ? "Enter JSON request body..." : "Enter raw text..."}
                  rows={12}
                  className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                />
                {requestBody && (
                  <div className="mt-2">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {requestBody.split('\n').length} lines, {requestBody.length} characters
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Form Data Body */}
            {bodyType === 'form-data' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Add form fields and file uploads for multipart/form-data requests
                  </p>
                  <button
                    onClick={addFormField}
                    className="flex items-center space-x-1 px-3 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/30 transition-colors text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Field</span>
                  </button>
                </div>

                {formFields.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-500 dark:text-gray-400">
                      No form fields added yet. Click "Add Field" to get started.
                    </p>
                  </div>
                )}

                {formFields.map((field) => (
                  <div key={field.id} className="flex items-start space-x-3 p-3 border border-gray-300 dark:border-gray-600 rounded-lg">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      {/* Field Key */}
                      <input
                        type="text"
                        placeholder="Field name"
                        value={field.key}
                        onChange={(e) => updateFormField(field.id, { key: e.target.value })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />

                      {/* Field Type Selector */}
                      <select
                        value={field.type}
                        onChange={(e) => updateFormField(field.id, { type: e.target.value as 'text' | 'file', value: '', files: [] })}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="text">Text</option>
                        <option value="file">File</option>
                      </select>

                      {/* Field Value/File Input */}
                      <div className="flex items-center space-x-2">
                        {field.type === 'text' ? (
                          <input
                            type="text"
                            placeholder="Field value"
                            value={field.value}
                            onChange={(e) => updateFormField(field.id, { value: e.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                          />
                        ) : (
                          <input
                            type="file"
                            multiple
                            onChange={(e) => e.target.files && handleFileUpload(field.id, e.target.files)}
                            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
                          />
                        )}
                      </div>
                    </div>

                    {/* Remove Field Button */}
                    <button
                      onClick={() => removeFormField(field.id)}
                      className="p-2 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Remove field"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* File Previews */}
                {formFields.some(field => field.files && field.files.length > 0) && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white">Uploaded Files</h4>
                    {formFields.map(field => (
                      field.files && field.files.length > 0 && (
                        <div key={field.id} className="space-y-2">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Field: {field.key}</p>
                          <div className="grid grid-cols-2 gap-3">
                            {field.files.map(file => (
                              <div key={file.id} className="flex items-center space-x-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg">
                                {/* File Icon */}
                                <div className="flex-shrink-0">
                                  {file.type.startsWith('image/') ? (
                                    file.preview ? (
                                      <img src={file.preview} alt={file.name} className="w-10 h-10 object-cover rounded" />
                                    ) : (
                                      <Image className="w-10 h-10 text-blue-500" />
                                    )
                                  ) : file.type.includes('pdf') ? (
                                    <FileText className="w-10 h-10 text-red-500" />
                                  ) : (
                                    <File className="w-10 h-10 text-gray-500" />
                                  )}
                                </div>
                                
                                {/* File Info */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {file.name}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {formatFileSize(file.size)}
                                  </p>
                                </div>

                                {/* Remove File Button */}
                                <button
                                  onClick={() => removeFile(field.id, file.id)}
                                  className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                                  title="Remove file"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* No Body Message */}
            {bodyType === 'none' && (
              <div className="text-center py-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  No request body will be sent
                </p>
              </div>
            )}
          </div>
        )}

        {/* Advanced Options */}
        <div>
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center space-x-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Settings className="w-4 h-4" />
            <span>Advanced Options</span>
            {showAdvanced ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>

          {showAdvanced && (
            <div className="mt-4 space-y-4 pl-6 border-l-2 border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Timeout (ms)
                  </label>
                  <input
                    type="number"
                    value={requestTimeout}
                    onChange={(e) => setRequestTimeout(parseInt(e.target.value) || 30000)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="follow-redirects"
                    checked={followRedirects}
                    onChange={(e) => setFollowRedirects(e.target.checked)}
                    className="w-4 h-4 text-purple-600 border-gray-300 dark:border-gray-600 rounded focus:ring-purple-500 dark:focus:ring-purple-400 focus:ring-2"
                  />
                  <label htmlFor="follow-redirects" className="text-sm text-gray-700 dark:text-gray-300">
                    Follow redirects
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Send Button */}
      <div className="border-t border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1">
              <Clock className="w-4 h-4" />
              <span>Timeout: {requestTimeout / 1000}s</span>
            </div>
            <div className="flex items-center space-x-1">
              <Info className="w-4 h-4" />
              <span>Environment: {environment.name}</span>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {onOpenCodeGen && (
              <button
                onClick={onOpenCodeGen}
                className="flex items-center space-x-2 px-4 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <Code2 className="w-5 h-5" />
                <span>Code</span>
              </button>
            )}
            <button
              onClick={handleSendRequest}
              disabled={loading}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Zap className="w-5 h-5" />
              )}
              <span>{loading ? 'Sending...' : 'Send Request'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}