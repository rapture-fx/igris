'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  MagnifyingGlassIcon,
  XMarkIcon,
  DocumentTextIcon,
  CodeBracketIcon,
  CubeIcon,
  Cog6ToothIcon,
  CloudArrowUpIcon,
  LightBulbIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'
import { clsx } from 'clsx'

interface SearchInterfaceProps {
  isOpen: boolean
  onClose: () => void
  query: string
  onQueryChange: (query: string) => void
  onSelectResult: (section: string) => void
}

interface SearchResult {
  id: string
  title: string
  description: string
  section: string
  category: string
  icon: any
  href: string
}

const searchData: SearchResult[] = [
  // Getting Started
  {
    id: 'overview',
    title: 'Overview & Quick Start',
    description: 'Introduction to Schlep Engine and getting started guide',
    section: 'Getting Started',
    category: 'getting-started',
    icon: DocumentTextIcon,
    href: 'getting-started/overview'
  },
  {
    id: 'installation',
    title: 'Installation & Setup',
    description: 'How to install and configure Schlep Engine SDKs',
    section: 'Getting Started',
    category: 'getting-started',
    icon: DocumentTextIcon,
    href: 'getting-started/installation'
  },
  {
    id: 'first-call',
    title: 'First API Call',
    description: 'Make your first API request to Schlep Engine',
    section: 'Getting Started',
    category: 'getting-started',
    icon: DocumentTextIcon,
    href: 'getting-started/first-call'
  },
  {
    id: 'authentication',
    title: 'Authentication',
    description: 'API keys, authentication methods, and security',
    section: 'Getting Started',
    category: 'getting-started',
    icon: DocumentTextIcon,
    href: 'getting-started/authentication'
  },

  // API Reference
  {
    id: 'core-endpoints',
    title: 'Core Endpoints',
    description: 'Complete API reference with all endpoints and parameters',
    section: 'API Reference',
    category: 'api-reference',
    icon: CodeBracketIcon,
    href: 'api-reference/core-endpoints'
  },
  {
    id: 'data-upload',
    title: 'Data Upload',
    description: 'Upload CSV, JSON, Excel files and connect to databases',
    section: 'API Reference',
    category: 'api-reference',
    icon: CodeBracketIcon,
    href: 'api-reference/data-upload'
  },
  {
    id: 'processing-pipeline',
    title: 'Processing Pipeline',
    description: 'AI-powered data processing and transformation',
    section: 'API Reference',
    category: 'api-reference',
    icon: CodeBracketIcon,
    href: 'api-reference/processing-pipeline'
  },
  {
    id: 'export-download',
    title: 'Export & Download',
    description: 'Download processed data in multiple formats',
    section: 'API Reference',
    category: 'api-reference',
    icon: CodeBracketIcon,
    href: 'api-reference/export-download'
  },
  {
    id: 'rate-limits-errors',
    title: 'Rate Limits & Errors',
    description: 'Understanding rate limits and error handling',
    section: 'API Reference',
    category: 'api-reference',
    icon: CodeBracketIcon,
    href: 'api-reference/rate-limits-errors'
  },

  // Integration Guides
  {
    id: 'python-sdk',
    title: 'Python SDK',
    description: 'Complete Python SDK documentation and examples',
    section: 'Integration Guides',
    category: 'integration-guides',
    icon: CubeIcon,
    href: 'integration-guides/python-sdk'
  },
  {
    id: 'javascript-sdk',
    title: 'JavaScript SDK',
    description: 'JavaScript/Node.js SDK documentation and examples',
    section: 'Integration Guides',
    category: 'integration-guides',
    icon: CubeIcon,
    href: 'integration-guides/javascript-sdk'
  },
  {
    id: 'jupyter-notebooks',
    title: 'Jupyter Notebooks',
    description: 'Using Schlep Engine in Jupyter environments',
    section: 'Integration Guides',
    category: 'integration-guides',
    icon: CubeIcon,
    href: 'integration-guides/jupyter-notebooks'
  },
  {
    id: 'aws-sagemaker',
    title: 'AWS SageMaker',
    description: 'Integration with AWS SageMaker for ML workflows',
    section: 'Integration Guides',
    category: 'integration-guides',
    icon: CubeIcon,
    href: 'integration-guides/aws-sagemaker'
  },

  // Development
  {
    id: 'local-setup',
    title: 'Local Development Setup',
    description: 'Setting up your development environment',
    section: 'Development',
    category: 'development',
    icon: Cog6ToothIcon,
    href: 'development/local-setup'
  },
  {
    id: 'architecture',
    title: 'Architecture Overview',
    description: 'System architecture and design principles',
    section: 'Development',
    category: 'development',
    icon: Cog6ToothIcon,
    href: 'development/architecture'
  },
  {
    id: 'security',
    title: 'Security Implementation',
    description: 'Security features and best practices',
    section: 'Development',
    category: 'development',
    icon: Cog6ToothIcon,
    href: 'development/security'
  },

  // Deployment
  {
    id: 'production',
    title: 'Production Deployment',
    description: 'Deploying Schlep Engine to production',
    section: 'Deployment',
    category: 'deployment',
    icon: CloudArrowUpIcon,
    href: 'deployment/production'
  },
  {
    id: 'infrastructure',
    title: 'Infrastructure Setup',
    description: 'Infrastructure configuration and scaling',
    section: 'Deployment',
    category: 'deployment',
    icon: CloudArrowUpIcon,
    href: 'deployment/infrastructure'
  },
  {
    id: 'monitoring',
    title: 'Monitoring & Observability',
    description: 'Monitoring, logging, and observability setup',
    section: 'Deployment',
    category: 'deployment',
    icon: CloudArrowUpIcon,
    href: 'deployment/monitoring'
  },

  // Use Cases
  {
    id: 'ml-training',
    title: 'ML Model Training',
    description: 'Using Schlep Engine for ML model training workflows',
    section: 'Use Cases',
    category: 'use-cases',
    icon: LightBulbIcon,
    href: 'use-cases/ml-training'
  },
  {
    id: 'ecommerce-analytics',
    title: 'E-commerce Analytics',
    description: 'E-commerce data processing and analytics examples',
    section: 'Use Cases',
    category: 'use-cases',
    icon: LightBulbIcon,
    href: 'use-cases/ecommerce-analytics'
  },

  // Resources
  {
    id: 'faq',
    title: 'FAQ',
    description: 'Frequently asked questions and answers',
    section: 'Resources',
    category: 'resources',
    icon: InformationCircleIcon,
    href: 'resources/faq'
  },
  {
    id: 'support',
    title: 'Support',
    description: 'Get help and support from our team',
    section: 'Resources',
    category: 'resources',
    icon: InformationCircleIcon,
    href: 'resources/support'
  }
]

export function SearchInterface({ isOpen, onClose, query, onQueryChange, onSelectResult }: SearchInterfaceProps) {
  const [filteredResults, setFilteredResults] = useState<SearchResult[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!query.trim()) {
      setFilteredResults(searchData.slice(0, 8)) // Show top results when no query
      setSelectedIndex(0)
      return
    }

    const results = searchData.filter(item => {
      const searchTerms = query.toLowerCase().split(' ')
      const searchText = `${item.title} ${item.description} ${item.section}`.toLowerCase()
      
      return searchTerms.every(term => searchText.includes(term))
    })

    setFilteredResults(results.slice(0, 10))
    setSelectedIndex(0)
  }, [query])

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelectedIndex(prev => Math.min(prev + 1, filteredResults.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelectedIndex(prev => Math.max(prev - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (filteredResults[selectedIndex]) {
        onSelectResult(filteredResults[selectedIndex].href)
      }
    } else if (event.key === 'Escape') {
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-full items-start justify-center p-4 pt-16">
        <div className="fixed inset-0 bg-black bg-opacity-25 transition-opacity" onClick={onClose} />
        
        <div className="relative w-full max-w-2xl transform rounded-lg bg-white shadow-xl ring-1 ring-black ring-opacity-5 transition-all">
          {/* Search Input */}
          <div className="flex items-center px-4 py-4 border-b border-gray-200">
            <MagnifyingGlassIcon className="h-5 w-5 text-gray-400 mr-3" />
            <input
              ref={inputRef}
              type="text"
              className="w-full text-lg text-gray-900 placeholder-gray-500 border-0 focus:ring-0 focus:outline-none"
              placeholder="Search documentation..."
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button
              onClick={onClose}
              className="ml-3 p-1 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Search Results */}
          <div className="max-h-96 overflow-y-auto p-2">
            {filteredResults.length === 0 ? (
              <div className="px-4 py-8 text-center text-gray-500">
                <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p>No results found for "{query}"</p>
                <p className="text-sm mt-1">Try searching for different keywords</p>
              </div>
            ) : (
              <div className="space-y-1">
                {!query.trim() && (
                  <div className="px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wide">
                    Popular Pages
                  </div>
                )}
                {filteredResults.map((result, index) => (
                  <button
                    key={result.id}
                    onClick={() => onSelectResult(result.href)}
                    className={clsx(
                      "w-full text-left px-3 py-3 rounded-md transition-colors",
                      index === selectedIndex
                        ? "bg-blue-50 text-blue-900"
                        : "hover:bg-gray-50"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <result.icon className={clsx(
                        "h-5 w-5 mt-0.5 flex-shrink-0",
                        index === selectedIndex ? "text-blue-600" : "text-gray-400"
                      )} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {result.title}
                          </h3>
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                            {result.section}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2">
                          {result.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-4 py-3 text-xs text-gray-500">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">↑↓</kbd>
                  <span>to navigate</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">↵</kbd>
                  <span>to select</span>
                </div>
                <div className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded">esc</kbd>
                  <span>to close</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}