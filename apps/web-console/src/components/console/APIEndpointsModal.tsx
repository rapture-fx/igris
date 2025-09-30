'use client'

import React, { useState, useMemo } from 'react'
import {
  X,
  Search,
  Filter,
  ChevronDown,
  ChevronRight
} from 'lucide-react'

export type Industry = 'ai' | 'manufacturing' | 'ecommerce' | 'fintech'

interface APIEndpoint {
  id: string
  name: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  path: string
  description: string
  deprecated?: boolean
  beta?: boolean
  industry: Industry
  tags: string[]
  schema?: any
  examples?: any[]
}

interface APICategory {
  id: string
  name: string
  icon: React.ReactNode
  description: string
  industry: Industry[]
  endpoints: APIEndpoint[]
}

interface APIEndpointsModalProps {
  isOpen: boolean
  onClose: () => void
  categories: APICategory[]
  selectedIndustry: Industry | 'all'
  searchQuery: string
  onSearchChange: (query: string) => void
  onEndpointSelect: (endpoint: APIEndpoint) => void
  selectedEndpoint?: APIEndpoint
}

export function APIEndpointsModal({
  isOpen,
  onClose,
  categories,
  selectedIndustry,
  searchQuery,
  onSearchChange,
  onEndpointSelect,
  selectedEndpoint
}: APIEndpointsModalProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(categories.map(c => c.id)) // Expand all by default in modal
  )

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId)
    } else {
      newExpanded.add(categoryId)
    }
    setExpandedCategories(newExpanded)
  }

  const filteredCategories = useMemo(() => {
    return categories
      .filter(category => {
        if (selectedIndustry !== 'all') {
          return category.industry.includes(selectedIndustry)
        }
        return true
      })
      .map(category => ({
        ...category,
        endpoints: category.endpoints.filter(endpoint => {
          const matchesSearch = !searchQuery ||
            endpoint.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
            endpoint.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))

          const matchesIndustry = selectedIndustry === 'all' || endpoint.industry === selectedIndustry

          return matchesSearch && matchesIndustry
        })
      }))
      .filter(category => category.endpoints.length > 0 || searchQuery === '')
  }, [selectedIndustry, searchQuery, categories])

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      case 'POST': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'PUT': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
      case 'DELETE': return 'text-red-600 bg-red-100 dark:bg-red-900/30 dark:text-red-400'
      case 'PATCH': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const getIndustryColor = (industry: Industry) => {
    switch (industry) {
      case 'ai': return 'text-purple-600 bg-purple-100 dark:bg-purple-900/30 dark:text-purple-400'
      case 'manufacturing': return 'text-orange-600 bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400'
      case 'ecommerce': return 'text-green-600 bg-green-100 dark:bg-green-900/30 dark:text-green-400'
      case 'fintech': return 'text-blue-600 bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
      default: return 'text-gray-600 bg-gray-100 dark:bg-gray-700 dark:text-gray-400'
    }
  }

  const totalEndpoints = filteredCategories.reduce((sum, cat) => sum + cat.endpoints.length, 0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl h-[80vh] bg-white dark:bg-gray-800 rounded-lg shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">API Endpoints</h2>
              <span className="px-3 py-1 text-sm bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                {totalEndpoints} endpoints
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search APIs by name, path, or tags..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Industry Filter Info */}
          {selectedIndustry !== 'all' && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-2">
                <Filter className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-700 dark:text-blue-400">
                  Filtered by: {selectedIndustry.charAt(0).toUpperCase() + selectedIndustry.slice(1)}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredCategories.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-3">
                <Search className="w-12 h-12 mx-auto" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No APIs found matching your criteria
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredCategories.map((category) => (
                <div key={category.id} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  {/* Category Header */}
                  <button
                    onClick={() => toggleCategory(category.id)}
                    className="w-full px-5 py-4 text-left flex items-center gap-3 transition-colors bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {expandedCategories.has(category.id) ? (
                      <ChevronDown className="w-5 h-5 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-gray-500" />
                    )}
                    <div className="flex items-center space-x-3 flex-1">
                      <div className="text-gray-600 dark:text-gray-300">
                        {category.icon}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-base">
                          {category.name}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {category.endpoints.length} endpoints
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Category Endpoints */}
                  {expandedCategories.has(category.id) && (
                    <div className="p-4 bg-white dark:bg-gray-800 space-y-3">
                      {category.endpoints.map((endpoint) => (
                        <button
                          key={endpoint.id}
                          onClick={() => {
                            onEndpointSelect(endpoint)
                            onClose()
                          }}
                          className={`w-full text-left p-4 transition-colors rounded-lg border ${
                            selectedEndpoint?.id === endpoint.id
                              ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-700'
                              : 'bg-gray-50 dark:bg-gray-700/30 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                              <span className={`px-2 py-1 text-xs font-medium rounded ${getMethodColor(endpoint.method)}`}>
                                {endpoint.method}
                              </span>
                              {selectedIndustry === 'all' && (
                                <span className={`px-2 py-1 text-xs font-medium rounded ${getIndustryColor(endpoint.industry)}`}>
                                  {endpoint.industry.toUpperCase()}
                                </span>
                              )}
                              {endpoint.beta && (
                                <span className="px-2 py-1 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                                  BETA
                                </span>
                              )}
                              {endpoint.deprecated && (
                                <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 rounded">
                                  DEPRECATED
                                </span>
                              )}
                            </div>
                          </div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {endpoint.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {endpoint.description}
                          </p>
                          <code className="text-xs px-3 py-1.5 rounded bg-gray-100 dark:bg-gray-700 text-blue-600 dark:text-blue-400 font-mono">
                            {endpoint.path}
                          </code>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}