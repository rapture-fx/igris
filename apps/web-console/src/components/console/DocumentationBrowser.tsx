'use client'

import React, { useState, useEffect } from 'react'
import { 
  Book,
  Search,
  Code2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Play,
  Eye,
  ChevronRight,
  ChevronDown,
  Hash,
  Tag,
  Clock,
  Star,
  Filter,
  Zap,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { openAPIService, ParsedEndpoint } from '../../services/openapi'

interface DocSection {
  id: string
  title: string
  content: string
  type: 'overview' | 'endpoint' | 'schema' | 'example' | 'guide'
  tags: string[]
  lastUpdated: string
  version: string
  category: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

interface CodeExample {
  language: string
  title: string
  code: string
  description?: string
}

interface TryItState {
  endpoint?: ParsedEndpoint
  parameters: Record<string, any>
  headers: Record<string, string>
  body: string
  response?: any
  loading: boolean
  error?: string
}

export function DocumentationBrowser() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSection, setSelectedSection] = useState<DocSection | null>(null)
  const [selectedEndpoint, setSelectedEndpoint] = useState<ParsedEndpoint | null>(null)
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set())
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterDifficulty, setFilterDifficulty] = useState<string>('all')
  const [showTryIt, setShowTryIt] = useState(false)
  const [tryItState, setTryItState] = useState<TryItState>({
    parameters: {},
    headers: { 'Content-Type': 'application/json' },
    body: '',
    loading: false
  })
  const [darkMode, setDarkMode] = useState(false)
  const [favoriteEndpoints, setFavoriteEndpoints] = useState<Set<string>>(new Set())
  const [recentlyViewed, setRecentlyViewed] = useState<string[]>([])

  // Mock documentation sections
  const [docSections] = useState<DocSection[]>([
    {
      id: 'overview',
      title: 'Getting Started',
      content: `# Schlep-Engine AI Company API

Welcome to the comprehensive API documentation for Schlep-Engine's AI Company solutions. Our API provides powerful endpoints for digital twin management, dataset marketplace, MLOps automation, and real-time AI inference.

## Quick Start

1. **Get your API key** from the console dashboard
2. **Choose your environment** (production, staging, development)  
3. **Make your first API call** using our interactive examples
4. **Explore our SDKs** for seamless integration

## Base URLs

- Production: \`https://api.schlep-engine.com\`
- Staging: \`https://staging-api.schlep-engine.com\`
- Development: \`https://dev-api.schlep-engine.com\`

## Authentication

All API requests require authentication using either:
- **API Key**: Include in header as \`X-API-Key: your_api_key\`
- **Bearer Token**: Include in header as \`Authorization: Bearer your_token\``,
      type: 'overview',
      tags: ['getting-started', 'authentication', 'quick-start'],
      lastUpdated: '2024-01-15T10:00:00Z',
      version: '2.1.0',
      category: 'Getting Started',
      difficulty: 'beginner'
    },
    {
      id: 'digital-twin-guide',
      title: 'Digital Twin AI Guide',
      content: `# Digital Twin AI Implementation Guide

Digital Twins represent virtual replicas of your AI models, providing comprehensive lifecycle management, performance monitoring, and optimization capabilities.

## Core Concepts

### Twin Types
- **AI_MODEL**: Virtual representation of ML models
- **PROCESS**: Business process digital twins
- **SYSTEM**: Complete system replicas

### Key Features
- **Real-time Synchronization**: Keep twins updated with live model performance
- **Predictive Analytics**: Forecast model degradation and optimization opportunities  
- **Automated Optimization**: AI-driven hyperparameter tuning
- **Performance Monitoring**: Comprehensive metrics and alerting

## Implementation Flow

1. Create digital twin with model configuration
2. Configure synchronization parameters
3. Monitor performance and analytics
4. Apply optimization recommendations
5. Track lifecycle and versioning`,
      type: 'guide',
      tags: ['digital-twin', 'ai-models', 'monitoring', 'optimization'],
      lastUpdated: '2024-01-14T15:30:00Z',
      version: '2.1.0',
      category: 'Digital Twin AI',
      difficulty: 'intermediate'
    },
    {
      id: 'dataset-marketplace',
      title: 'Dataset Marketplace Integration',
      content: `# Dataset Marketplace Guide

The Dataset Marketplace provides a comprehensive platform for dataset discovery, quality assessment, and collaborative data sharing.

## Features

### Dataset Discovery
- Advanced search with quality filters
- Tag-based categorization
- Collaborative ratings and reviews
- Automated quality scoring

### Quality Assessment
- **Completeness Analysis**: Missing data detection
- **Consistency Checks**: Data format validation  
- **Bias Detection**: Demographic and geographic bias analysis
- **Lineage Tracking**: Data provenance and transformations

### Integration Patterns

#### Search and Filter
\`\`\`python
# Search for high-quality financial datasets
response = client.search_datasets({
    "query": "fraud detection",
    "tags": ["finance", "classification"],
    "quality_min": 0.9,
    "limit": 10
})
\`\`\`

#### Quality Assessment
\`\`\`python
# Get comprehensive quality report
quality = client.get_dataset_quality("ds_001")
print(f"Overall Score: {quality.overall_score}")
print(f"Bias Analysis: {quality.bias_analysis}")
\`\`\``,
      type: 'guide',
      tags: ['datasets', 'marketplace', 'quality', 'search'],
      lastUpdated: '2024-01-13T09:15:00Z',
      version: '2.1.0',
      category: 'Dataset Marketplace',
      difficulty: 'beginner'
    }
  ])

  // Mock endpoints from OpenAPI
  const [endpoints, setEndpoints] = useState<ParsedEndpoint[]>([])

  useEffect(() => {
    // Load mock endpoints
    const mockEndpoints: ParsedEndpoint[] = [
      {
        id: 'create-digital-twin',
        name: 'Create Digital Twin',
        method: 'POST',
        path: '/api/v1/manufacturing/digital-twin/create',
        description: 'Create a digital twin of your ML model with comprehensive tracking',
        category: 'Digital Twin AI',
        parameters: [
          {
            name: 'twin_id',
            in: 'query',
            required: true,
            schema: { type: 'string', example: 'ai_model_twin_001' },
            description: 'Unique identifier for the digital twin'
          }
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  twin_name: { type: 'string' },
                  twin_type: { type: 'string', enum: ['AI_MODEL', 'PROCESS', 'SYSTEM'] },
                  configuration: { type: 'object' }
                }
              },
              example: {
                twin_name: 'Fraud Detection Model Twin',
                twin_type: 'AI_MODEL',
                configuration: {
                  model_type: 'xgboost',
                  version: '2.1.0'
                }
              }
            }
          }
        },
        responses: {
          '200': {
            description: 'Digital twin created successfully',
            content: {
              'application/json': {
                schema: { type: 'object' },
                example: {
                  success: true,
                  twin_id: 'ai_model_twin_001',
                  status: 'created'
                }
              }
            }
          }
        }
      }
    ]
    setEndpoints(mockEndpoints)
  }, [])

  const filteredSections = docSections.filter(section => {
    const matchesSearch = searchQuery === '' || 
      section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      section.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    
    const matchesCategory = filterCategory === 'all' || section.category === filterCategory
    const matchesDifficulty = filterDifficulty === 'all' || section.difficulty === filterDifficulty
    
    return matchesSearch && matchesCategory && matchesDifficulty
  })

  const handleSectionSelect = (section: DocSection) => {
    setSelectedSection(section)
    setSelectedEndpoint(null)
    setShowTryIt(false)
    
    // Add to recently viewed
    setRecentlyViewed(prev => {
      const updated = [section.id, ...prev.filter(id => id !== section.id)]
      return updated.slice(0, 10) // Keep only last 10
    })
  }

  const handleEndpointSelect = (endpoint: ParsedEndpoint) => {
    setSelectedEndpoint(endpoint)
    setSelectedSection(null)
    setTryItState(prev => ({
      ...prev,
      endpoint,
      parameters: {},
      body: JSON.stringify(openAPIService.generateExampleRequest(endpoint), null, 2) || ''
    }))
  }

  const generateCodeExample = (endpoint: ParsedEndpoint, language: string): string => {
    const examples = openAPIService.generateCodeSnippets(endpoint, {
      method: endpoint.method,
      url: `https://api.schlep-engine.com${endpoint.path}`,
      headers: { 'Authorization': 'Bearer your_token' },
      data: openAPIService.generateExampleRequest(endpoint)
    })
    return examples[language] || ''
  }

  const handleTryIt = async () => {
    if (!selectedEndpoint) return

    setTryItState(prev => ({ ...prev, loading: true, error: undefined }))

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const mockResponse = {
        status: 200,
        data: {
          success: true,
          message: `${selectedEndpoint.name} executed successfully`,
          timestamp: new Date().toISOString(),
          request_id: `req_${Date.now()}`
        }
      }

      setTryItState(prev => ({ ...prev, response: mockResponse, loading: false }))
    } catch (error) {
      setTryItState(prev => ({ 
        ...prev, 
        error: error instanceof Error ? error.message : 'Request failed',
        loading: false 
      }))
    }
  }

  const toggleFavorite = (endpointId: string) => {
    setFavoriteEndpoints(prev => {
      const updated = new Set(prev)
      if (updated.has(endpointId)) {
        updated.delete(endpointId)
      } else {
        updated.add(endpointId)
      }
      return updated
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const categories = Array.from(new Set(docSections.map(s => s.category)))
  const difficulties = ['beginner', 'intermediate', 'advanced']

  return (
    <div className="h-full flex bg-gray-50 dark:bg-gray-900">
      {/* Sidebar Navigation */}
      <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3 mb-4">
            <Book className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
              API Documentation
            </h1>
          </div>

          {/* Search */}
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          {/* Filters */}
          <div className="space-y-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Categories</option>
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={filterDifficulty}
              onChange={(e) => setFilterDifficulty(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="all">All Levels</option>
              {difficulties.map(diff => (
                <option key={diff} value={diff}>{diff.charAt(0).toUpperCase() + diff.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* Recently Viewed */}
          {recentlyViewed.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center">
                <Clock className="w-4 h-4 mr-2" />
                Recently Viewed
              </h3>
              <div className="space-y-1">
                {recentlyViewed.slice(0, 3).map(sectionId => {
                  const section = docSections.find(s => s.id === sectionId)
                  if (!section) return null
                  return (
                    <button
                      key={sectionId}
                      onClick={() => handleSectionSelect(section)}
                      className="w-full text-left px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      {section.title}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Documentation Sections */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Documentation
            </h3>
            {filteredSections.map(section => (
              <button
                key={section.id}
                onClick={() => handleSectionSelect(section)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedSection?.id === section.id
                    ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{section.title}</span>
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    section.difficulty === 'beginner' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    section.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {section.difficulty}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {section.category} • v{section.version}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {section.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 text-xs bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400 rounded">
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>

          {/* API Endpoints */}
          <div className="mt-6 space-y-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              API Endpoints
            </h3>
            {endpoints.map(endpoint => (
              <button
                key={endpoint.id}
                onClick={() => handleEndpointSelect(endpoint)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedEndpoint?.id === endpoint.id
                    ? 'bg-purple-100 text-purple-900 dark:bg-purple-900/30 dark:text-purple-100'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${
                      endpoint.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      endpoint.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {endpoint.method}
                    </span>
                    <span className="font-medium text-sm">{endpoint.name}</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleFavorite(endpoint.id)
                    }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                  >
                    <Star className={`w-3 h-3 ${
                      favoriteEndpoints.has(endpoint.id) 
                        ? 'text-yellow-500 fill-current' 
                        : 'text-gray-400'
                    }`} />
                  </button>
                </div>
                <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                  {endpoint.path}
                </code>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedSection && (
          <div className="flex-1 bg-white dark:bg-gray-800 p-8 overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                    {selectedSection.title}
                  </h1>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                    <span>Category: {selectedSection.category}</span>
                    <span>Version: {selectedSection.version}</span>
                    <span>Updated: {new Date(selectedSection.lastUpdated).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => copyToClipboard(selectedSection.content)}
                    className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    <span>Copy</span>
                  </button>
                  <button className="flex items-center space-x-1 px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    <ExternalLink className="w-4 h-4" />
                    <span>Share</span>
                  </button>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-6">
                {selectedSection.tags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-full">
                    #{tag}
                  </span>
                ))}
              </div>

              {/* Content */}
              <div className="prose dark:prose-invert max-w-none">
                <div 
                  dangerouslySetInnerHTML={{ 
                    __html: selectedSection.content.replace(/\n/g, '<br/>') 
                  }} 
                />
              </div>
            </div>
          </div>
        )}

        {selectedEndpoint && (
          <div className="flex-1 flex">
            {/* Endpoint Documentation */}
            <div className="flex-1 bg-white dark:bg-gray-800 p-8 overflow-y-auto">
              <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-3">
                    <span className={`px-3 py-1 text-sm font-medium rounded ${
                      selectedEndpoint.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      selectedEndpoint.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                    }`}>
                      {selectedEndpoint.method}
                    </span>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      {selectedEndpoint.name}
                    </h1>
                  </div>
                  <button
                    onClick={() => setShowTryIt(!showTryIt)}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                      showTryIt
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <Play className="w-4 h-4" />
                    <span>Try it out</span>
                  </button>
                </div>

                {/* Endpoint URL */}
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                  <div className="flex items-center space-x-2 mb-2">
                    <Hash className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Endpoint URL</span>
                  </div>
                  <code className="text-purple-600 dark:text-purple-400 font-mono">
                    https://api.schlep-engine.com{selectedEndpoint.path}
                  </code>
                </div>

                {/* Description */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Description</h3>
                  <p className="text-gray-700 dark:text-gray-300">{selectedEndpoint.description}</p>
                </div>

                {/* Parameters */}
                {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Parameters</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full border border-gray-200 dark:border-gray-700 rounded-lg">
                        <thead className="bg-gray-50 dark:bg-gray-700">
                          <tr>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Name</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Type</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Required</th>
                            <th className="px-4 py-2 text-left text-sm font-medium text-gray-700 dark:text-gray-300">Description</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedEndpoint.parameters.map((param, index) => (
                            <tr key={index} className="border-t border-gray-200 dark:border-gray-700">
                              <td className="px-4 py-2 text-sm font-mono text-purple-600 dark:text-purple-400">
                                {param.name}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                {param.schema.type}
                              </td>
                              <td className="px-4 py-2 text-sm">
                                {param.required ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : (
                                  <span className="text-gray-400">Optional</span>
                                )}
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300">
                                {param.description}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request Body Example */}
                {selectedEndpoint.requestBody && (
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Request Body</h3>
                    <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                      <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">application/json</span>
                      </div>
                      <SyntaxHighlighter
                        language="json"
                        style={darkMode ? oneDark : oneLight}
                        customStyle={{
                          margin: 0,
                          padding: '16px',
                          fontSize: '14px'
                        }}
                      >
                        {JSON.stringify(
                          selectedEndpoint.requestBody.content['application/json']?.example || {},
                          null,
                          2
                        )}
                      </SyntaxHighlighter>
                    </div>
                  </div>
                )}

                {/* Code Examples */}
                <div className="mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Code Examples</h3>
                  <div className="space-y-4">
                    {['curl', 'javascript', 'python', 'node'].map(language => (
                      <div key={language} className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        <div className="bg-gray-50 dark:bg-gray-700 px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                            {language}
                          </span>
                          <button
                            onClick={() => copyToClipboard(generateCodeExample(selectedEndpoint, language))}
                            className="p-1 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                        <SyntaxHighlighter
                          language={language === 'node' ? 'javascript' : language}
                          style={darkMode ? oneDark : oneLight}
                          customStyle={{
                            margin: 0,
                            padding: '16px',
                            fontSize: '14px'
                          }}
                        >
                          {generateCodeExample(selectedEndpoint, language)}
                        </SyntaxHighlighter>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Try It Out Panel */}
            {showTryIt && (
              <div className="w-96 bg-gray-50 dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 flex flex-col">
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Try it out
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Test this endpoint with live data
                  </p>
                </div>

                <div className="flex-1 p-4 space-y-4 overflow-y-auto">
                  {/* Parameters */}
                  {selectedEndpoint.parameters && selectedEndpoint.parameters.length > 0 && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Parameters</h4>
                      <div className="space-y-3">
                        {selectedEndpoint.parameters.map((param, index) => (
                          <div key={index}>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                              {param.name}
                              {param.required && <span className="text-red-500 ml-1">*</span>}
                            </label>
                            <input
                              type="text"
                              value={tryItState.parameters[param.name] || ''}
                              onChange={(e) => setTryItState(prev => ({
                                ...prev,
                                parameters: { ...prev.parameters, [param.name]: e.target.value }
                              }))}
                              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder={param.schema.example || `Enter ${param.name}`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Request Body */}
                  {selectedEndpoint.requestBody && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Request Body</h4>
                      <textarea
                        value={tryItState.body}
                        onChange={(e) => setTryItState(prev => ({ ...prev, body: e.target.value }))}
                        rows={8}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                        placeholder="Enter JSON request body..."
                      />
                    </div>
                  )}

                  {/* Send Request Button */}
                  <button
                    onClick={handleTryIt}
                    disabled={tryItState.loading}
                    className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {tryItState.loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>{tryItState.loading ? 'Sending...' : 'Send Request'}</span>
                  </button>

                  {/* Response */}
                  {(tryItState.response || tryItState.error) && (
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white mb-2">Response</h4>
                      <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                        {tryItState.error ? (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm">
                            {tryItState.error}
                          </div>
                        ) : (
                          <SyntaxHighlighter
                            language="json"
                            style={darkMode ? oneDark : oneLight}
                            customStyle={{
                              margin: 0,
                              padding: '16px',
                              fontSize: '12px'
                            }}
                          >
                            {JSON.stringify(tryItState.response, null, 2)}
                          </SyntaxHighlighter>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {!selectedSection && !selectedEndpoint && (
          <div className="flex-1 flex items-center justify-center bg-white dark:bg-gray-800">
            <div className="text-center">
              <Book className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
                Welcome to API Documentation
              </h3>
              <p className="text-gray-600 dark:text-gray-400 max-w-md">
                Select a documentation section or API endpoint from the sidebar to get started with comprehensive guides and interactive examples.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}