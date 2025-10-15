'use client'

import React, { useState } from 'react'
import { 
  Upload, 
  File, 
  Download, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  X, 
  Globe, 
  RefreshCw,
  FileText,
  Code,
  Search,
  Filter,
  Plus
} from 'lucide-react'

interface OpenAPISpec {
  openapi?: string
  swagger?: string
  info: {
    title: string
    version: string
    description?: string
  }
  servers?: Array<{
    url: string
    description?: string
  }>
  paths: Record<string, Record<string, any>>
  components?: {
    schemas?: Record<string, any>
    securitySchemes?: Record<string, any>
  }
}

interface ParsedEndpoint {
  id: string
  name: string
  method: string
  path: string
  description: string
  operationId?: string
  tags?: string[]
  deprecated?: boolean
  parameters?: any[]
  requestBody?: any
  responses?: Record<string, any>
  security?: any[]
}

interface OpenAPIImporterProps {
  isOpen: boolean
  onClose: () => void
  onImport: (endpoints: ParsedEndpoint[], spec: OpenAPISpec) => void
}

const OpenAPIImporter: React.FC<OpenAPIImporterProps> = ({
  isOpen,
  onClose,
  onImport
}) => {
  const [importMethod, setImportMethod] = useState<'file' | 'url'>('file')
  const [specUrl, setSpecUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [spec, setSpec] = useState<OpenAPISpec | null>(null)
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>([])
  const [selectedEndpoints, setSelectedEndpoints] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterByTag, setFilterByTag] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parseOpenAPISpec = (specData: any): { spec: OpenAPISpec, endpoints: ParsedEndpoint[] } => {
    const parsedSpec: OpenAPISpec = specData
    const parsedEndpoints: ParsedEndpoint[] = []

    // Validate spec format
    if (!parsedSpec.paths) {
      throw new Error('Invalid OpenAPI specification: missing paths object')
    }

    // Extract all endpoints
    Object.entries(parsedSpec.paths).forEach(([path, pathItem]: [string, any]) => {
      const httpMethods = ['get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace']
      
      httpMethods.forEach(method => {
        if (pathItem[method]) {
          const operation = pathItem[method]
          const endpoint: ParsedEndpoint = {
            id: operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`,
            name: operation.summary || operation.operationId || `${method.toUpperCase()} ${path}`,
            method: method.toUpperCase(),
            path,
            description: operation.description || operation.summary || '',
            operationId: operation.operationId,
            tags: operation.tags || [],
            deprecated: operation.deprecated || false,
            parameters: operation.parameters || [],
            requestBody: operation.requestBody,
            responses: operation.responses || {},
            security: operation.security || parsedSpec.security || []
          }
          parsedEndpoints.push(endpoint)
        }
      })
    })

    return { spec: parsedSpec, endpoints: parsedEndpoints }
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)

    try {
      const text = await file.text()
      let specData: any

      // Try to parse as JSON first, then YAML
      try {
        specData = JSON.parse(text)
      } catch {
        // For YAML, we would need a YAML parser library
        // For now, we'll show an error suggesting JSON format
        throw new Error('YAML format not supported yet. Please convert to JSON format or provide a JSON OpenAPI spec.')
      }

      const { spec, endpoints } = parseOpenAPISpec(specData)
      setSpec(spec)
      setEndpoints(endpoints)
      setSelectedEndpoints(new Set(endpoints.map(e => e.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse OpenAPI specification')
    } finally {
      setLoading(false)
    }
  }

  const handleUrlImport = async () => {
    if (!specUrl.trim()) return

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(specUrl)
      if (!response.ok) {
        throw new Error(`Failed to fetch specification: ${response.status} ${response.statusText}`)
      }

      const specData = await response.json()
      const { spec, endpoints } = parseOpenAPISpec(specData)
      setSpec(spec)
      setEndpoints(endpoints)
      setSelectedEndpoints(new Set(endpoints.map(e => e.id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import from URL')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = () => {
    if (!spec || endpoints.length === 0) return

    const selectedEndpointsList = endpoints.filter(e => selectedEndpoints.has(e.id))
    onImport(selectedEndpointsList, spec)
    onClose()
  }

  const toggleEndpointSelection = (endpointId: string) => {
    const newSelection = new Set(selectedEndpoints)
    if (newSelection.has(endpointId)) {
      newSelection.delete(endpointId)
    } else {
      newSelection.add(endpointId)
    }
    setSelectedEndpoints(newSelection)
  }

  const selectAllEndpoints = () => {
    setSelectedEndpoints(new Set(filteredEndpoints().map(e => e.id)))
  }

  const deselectAllEndpoints = () => {
    setSelectedEndpoints(new Set())
  }

  const filteredEndpoints = () => {
    return endpoints.filter(endpoint => {
      const matchesSearch = !searchQuery || 
        endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
        endpoint.description.toLowerCase().includes(searchQuery.toLowerCase())
      
      const matchesTag = !filterByTag || endpoint.tags?.includes(filterByTag)
      
      return matchesSearch && matchesTag
    })
  }

  const getAllTags = () => {
    const tags = new Set<string>()
    endpoints.forEach(endpoint => {
      endpoint.tags?.forEach(tag => tags.add(tag))
    })
    return Array.from(tags).sort()
  }

  const getMethodColor = (method: string) => {
    switch (method.toLowerCase()) {
      case 'get': return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
      case 'post': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400'
      case 'put': return 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400'
      case 'delete': return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400'
      case 'patch': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400'
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-6xl h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Import OpenAPI/Swagger Specification
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Import API endpoints from OpenAPI 3.0+ or Swagger 2.0 specifications
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Import Section */}
          <div className="w-1/3 border-r border-gray-200 dark:border-gray-700 flex flex-col">
            <div className="p-6 space-y-6">
              {/* Import Method Selection */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                  Import Method
                </h3>
                <div className="space-y-2">
                  <label className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="importMethod"
                      value="file"
                      checked={importMethod === 'file'}
                      onChange={(e) => setImportMethod(e.target.value as 'file' | 'url')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Upload File</span>
                  </label>
                  <label className="flex items-center space-x-3">
                    <input
                      type="radio"
                      name="importMethod"
                      value="url"
                      checked={importMethod === 'url'}
                      onChange={(e) => setImportMethod(e.target.value as 'file' | 'url')}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-gray-700 dark:text-gray-300">Import from URL</span>
                  </label>
                </div>
              </div>

              {/* File Upload */}
              {importMethod === 'file' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    OpenAPI Specification File
                  </label>
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center">
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Upload JSON file (YAML support coming soon)
                    </p>
                    <input
                      type="file"
                      accept=".json,.yaml,.yml"
                      onChange={handleFileUpload}
                      className="hidden"
                      id="spec-file-upload"
                      disabled={loading}
                    />
                    <label
                      htmlFor="spec-file-upload"
                      className="cursor-pointer inline-flex items-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      <File className="w-4 h-4" />
                      <span>Choose File</span>
                    </label>
                  </div>
                </div>
              )}

              {/* URL Import */}
              {importMethod === 'url' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Specification URL
                  </label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={specUrl}
                      onChange={(e) => setSpecUrl(e.target.value)}
                      placeholder="https://api.example.com/openapi.json"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      disabled={loading}
                    />
                    <button
                      onClick={handleUrlImport}
                      disabled={!specUrl.trim() || loading}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      <span>{loading ? 'Importing...' : 'Import from URL'}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="flex items-start space-x-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">Import Error</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-1">{error}</p>
                  </div>
                </div>
              )}

              {/* Specification Info */}
              {spec && (
                <div className="space-y-3">
                  <h4 className="font-medium text-gray-900 dark:text-white">Specification Info</h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3 space-y-2">
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Title:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{spec.info.title}</span>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Version:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{spec.info.version}</span>
                    </div>
                    {spec.info.description && (
                      <div>
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Description:</span>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{spec.info.description}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Endpoints:</span>
                      <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">{endpoints.length}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Endpoints List */}
          <div className="flex-1 flex flex-col">
            {spec && endpoints.length > 0 ? (
              <>
                {/* Endpoints Header */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                      Available Endpoints ({filteredEndpoints().length})
                    </h3>
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={selectAllEndpoints}
                        className="text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                      >
                        Select All
                      </button>
                      <button
                        onClick={deselectAllEndpoints}
                        className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                      >
                        Deselect All
                      </button>
                    </div>
                  </div>

                  {/* Search and Filter */}
                  <div className="flex items-center space-x-3">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search endpoints..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      />
                    </div>
                    {getAllTags().length > 0 && (
                      <select
                        value={filterByTag}
                        onChange={(e) => setFilterByTag(e.target.value)}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        <option value="">All Tags</option>
                        {getAllTags().map(tag => (
                          <option key={tag} value={tag}>{tag}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Endpoints List */}
                <div className="flex-1 overflow-y-auto p-6">
                  <div className="space-y-3">
                    {filteredEndpoints().map(endpoint => (
                      <div
                        key={endpoint.id}
                        className={`flex items-start space-x-3 p-4 border rounded-lg cursor-pointer transition-colors ${
                          selectedEndpoints.has(endpoint.id)
                            ? 'border-purple-300 bg-purple-50 dark:border-purple-600 dark:bg-purple-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                        }`}
                        onClick={() => toggleEndpointSelection(endpoint.id)}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEndpoints.has(endpoint.id)}
                          onChange={() => toggleEndpointSelection(endpoint.id)}
                          className="w-4 h-4 text-purple-600 mt-1"
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className={`px-2 py-1 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                              {endpoint.method}
                            </span>
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {endpoint.name}
                            </h4>
                            {endpoint.deprecated && (
                              <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 rounded">
                                Deprecated
                              </span>
                            )}
                          </div>
                          
                          <p className="text-sm font-mono text-gray-600 dark:text-gray-400 mb-1">
                            {endpoint.path}
                          </p>
                          
                          {endpoint.description && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              {endpoint.description}
                            </p>
                          )}
                          
                          {endpoint.tags && endpoint.tags.length > 0 && (
                            <div className="flex items-center space-x-1">
                              {endpoint.tags.map(tag => (
                                <span
                                  key={tag}
                                  className="inline-flex items-center px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Import Button */}
                <div className="p-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedEndpoints.size} of {endpoints.length} endpoints selected
                    </p>
                    <button
                      onClick={handleImport}
                      disabled={selectedEndpoints.size === 0}
                      className="flex items-center space-x-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Import Selected Endpoints</span>
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Code className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No Specification Loaded
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Upload a file or import from URL to see available endpoints
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default OpenAPIImporter