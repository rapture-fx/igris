'use client'

import React from 'react'
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef } from 'react'

// Define searchable content for existing documentation pages only
const searchData = [
  { title: 'Introduction', url: '/introduction', content: 'Getting started with schlep-engine - Your statistical data processing platform', category: 'Introduction' },
  { title: 'Quick Start Guide', url: '/introduction/quickstart', content: 'Get up and running with schlep-engine in minutes', category: 'Introduction' },
  { title: 'API Keys', url: '/introduction/api-keys', content: 'Get your API keys and authentication setup', category: 'Introduction' },
  { title: 'First API Call', url: '/introduction/first-call', content: 'Make your first API call to schlep-engine', category: 'Introduction' },
  { title: 'Pricing', url: '/introduction/pricing', content: 'Pricing plans and billing information', category: 'Introduction' },
  { title: 'Getting Started', url: '/getting-started', content: 'Getting started guide and setup instructions', category: 'Getting Started' },
  { title: 'Authentication', url: '/getting-started/authentication', content: 'Authentication methods and security', category: 'Getting Started' },
  { title: 'Rate Limits', url: '/getting-started/rate-limits', content: 'API rate limiting and usage guidelines', category: 'Getting Started' },
  { title: 'API Reference', url: '/api-reference', content: 'Complete API documentation with endpoints and examples', category: 'API Reference' },
  { title: 'API Authentication', url: '/api-reference/authentication', content: 'API authentication methods and examples', category: 'API Reference' },
  { title: 'Data Upload', url: '/api-reference/upload', content: 'Upload and process your data files', category: 'API Reference' },
  { title: 'SDK Overview', url: '/sdks', content: 'SDKs and libraries for different programming languages', category: 'SDKs' },
  { title: 'Python SDK', url: '/sdks/python', content: 'Python SDK documentation and examples', category: 'SDKs' },
  { title: 'JavaScript SDK', url: '/sdks/javascript', content: 'JavaScript/Node.js SDK documentation', category: 'SDKs' },
  { title: 'Jupyter Integration', url: '/integrations/jupyter', content: 'Jupyter notebooks interactive data processing analysis', category: 'Integrations' },
  { title: 'AWS SageMaker Integration', url: '/integrations/aws-sagemaker', content: 'SageMaker machine learning deployment training', category: 'Integrations' },
  { title: 'ML Model Training', url: '/use-cases/ml-training', content: 'Machine learning training pipeline feature engineering', category: 'Use Cases' },
  { title: 'E-commerce Analytics', url: '/use-cases/ecommerce', content: 'Customer segmentation inventory optimization recommendations', category: 'Use Cases' },
  { title: 'Data Quality Monitoring', url: '/use-cases/quality-monitoring', content: 'Data validation quality checks monitoring', category: 'Use Cases' },
]

interface SearchComponentProps {
  className?: string
  compact?: boolean
}

export function SearchComponent({ className = '', compact = false }: SearchComponentProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<typeof searchData>([])
  const [showResults, setShowResults] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        handleSearchFocus()
      }
    }

    const handleGlobalSearch = () => {
      handleSearchFocus()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('openGlobalSearch', handleGlobalSearch)
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('openGlobalSearch', handleGlobalSearch)
    }
  }, [])

  // Handle search functionality
  useEffect(() => {
    if (searchQuery.trim().length === 0) {
      // Show all content when search is empty and focused
      if (isSearchFocused) {
        setSearchResults(searchData)
        setShowResults(true)
      } else {
        setSearchResults([])
        setShowResults(false)
      }
      return
    }

    const query = searchQuery.toLowerCase()
    const results = searchData.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.content.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query)
    )

    setSearchResults(results)
    setShowResults(true)
  }, [searchQuery, isSearchFocused])

  // Handle click outside to close search results
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
        setIsSearchFocused(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Group results by category
  const groupedResults = searchResults.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, typeof searchData>)

  const handleSearchFocus = () => {
    setIsSearchFocused(true)
    if (searchQuery.trim().length === 0) {
      setSearchResults(searchData)
      setShowResults(true)
    }
  }

  const handleSearchBlur = () => {
    // Don't immediately close, let click outside handle it
  }

  const closeSearch = () => {
    setShowResults(false)
    setIsSearchFocused(false)
    setSearchQuery('')
    inputRef.current?.blur()
  }

  return (
    <>
      {/* Backdrop blur overlay */}
      {showResults && (
        <div 
          className="fixed inset-0 backdrop-blur-sm bg-black/10 z-[10001] pointer-events-auto"
          onClick={closeSearch}
        />
      )}
      
      <div 
        className={`relative ${className} ${showResults ? 'pointer-events-auto' : 'pointer-events-none'}`}
        ref={searchRef}
      >
        {/* Hidden input for programmatic control */}
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={handleSearchFocus}
          onBlur={handleSearchBlur}
          className="opacity-0 pointer-events-none absolute"
        />
        
        {/* Enhanced Search Modal - positioned to appear over main content */}
        {showResults && (
          <div className="fixed top-20 left-1/2 transform -translate-x-1/2 w-[42rem] z-[10002]">
            <div className="overflow-hidden transition-colors duration-300">
              {/* Search Input Header - Larger and more visible */}
              <div className="p-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className="h-5 w-5 text-gray-600" />
                  </div>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search documentation..."
                    className="w-full pl-10 pr-3 py-2 text-base bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200 focus:border-transparent text-gray-900 placeholder-gray-500"
                    autoFocus
                  />
                </div>
              </div>

              {/* Search Results - Only show when there's a query */}
              {searchQuery.trim().length > 0 && (
                <>
                  <div className="bg-white border border-gray-200 rounded-xl shadow-2xl mt-2 max-h-[60vh] overflow-y-auto">
                    {searchResults.length > 0 ? (
                      <div>
                        {Object.entries(groupedResults).map(([category, items]) => (
                          <div key={category} className="">
                            <div className="bg-gray-50 px-4 py-1 transition-colors duration-300">
                              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide transition-colors duration-300">
                                {category}
                              </h3>
                            </div>
                            {items.map((result, index) => (
                              <a
                                key={`${category}-${index}`}
                                href={result.url}
                                className="block px-4 py-2 hover:bg-gray-50 transition-colors duration-300 group"
                                onClick={closeSearch}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 text-sm group-hover:text-gray-700 transition-colors duration-300">
                                      {result.title}
                                    </div>
                                    <div className="text-gray-500 text-xs mt-1 line-clamp-2 transition-colors duration-300">
                                      {result.content}
                                    </div>
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    <svg className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <div className="text-gray-400 mb-2 transition-colors duration-300">
                          <MagnifyingGlassIcon className="h-12 w-12 mx-auto mb-4" />
                        </div>
                        <div className="text-gray-500 text-lg font-medium transition-colors duration-300">
                          No results found for "{searchQuery}"
                        </div>
                        <div className="text-gray-400 text-sm mt-2 transition-colors duration-300">
                          Try adjusting your search terms
                        </div>
                      </div>
                    )}

                    </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}