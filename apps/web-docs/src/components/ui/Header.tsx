'use client'

import React from 'react'
import { MagnifyingGlassIcon, HomeIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef } from 'react'
import ThemeToggle from './ThemeToggle'

// Define comprehensive searchable content for documentation
const searchData = [
  { title: 'Introduction', url: '/introduction', content: 'Getting started with Schlep Engine - Your AI-powered data processing platform', category: 'Getting Started' },
  { title: 'Quick Start Guide', url: '/quickstart', content: 'Get up and running with Schlep Engine in minutes', category: 'Getting Started' },
  { title: 'Installation', url: '/installation', content: 'Install Schlep Engine SDK and CLI tools', category: 'Getting Started' },
  { title: 'API Reference', url: '/api-reference', content: 'Complete API documentation with endpoints and examples', category: 'API' },
  { title: 'Authentication', url: '/auth', content: 'API keys, OAuth, and authentication methods', category: 'API' },
  { title: 'Rate Limits', url: '/rate-limits', content: 'API rate limiting and usage guidelines', category: 'API' },
  { title: 'SDK Overview', url: '/sdks', content: 'Python JavaScript TypeScript SDKs and libraries', category: 'SDKs' },
  { title: 'Python SDK', url: '/sdks/python', content: 'Python SDK documentation and examples', category: 'SDKs' },
  { title: 'JavaScript SDK', url: '/sdks/javascript', content: 'JavaScript/Node.js SDK documentation', category: 'SDKs' },
  { title: 'TypeScript SDK', url: '/sdks/typescript', content: 'TypeScript SDK with full type definitions', category: 'SDKs' },
  { title: 'Jupyter Integration', url: '/integrations/jupyter', content: 'Jupyter notebooks interactive data processing analysis', category: 'Integrations' },
  { title: 'AWS SageMaker Integration', url: '/integrations/aws-sagemaker', content: 'SageMaker machine learning deployment training', category: 'Integrations' },
  { title: 'Google Colab', url: '/integrations/colab', content: 'Using Schlep Engine in Google Colab notebooks', category: 'Integrations' },
  { title: 'Pandas Integration', url: '/integrations/pandas', content: 'Seamless integration with Pandas DataFrames', category: 'Integrations' },
  { title: 'ML Model Training', url: '/use-cases/ml-training', content: 'Machine learning training pipeline feature engineering', category: 'Use Cases' },
  { title: 'E-commerce Analytics', url: '/use-cases/ecommerce', content: 'Customer segmentation inventory optimization recommendations', category: 'Use Cases' },
  { title: 'Data Quality Monitoring', url: '/use-cases/quality-monitoring', content: 'Data validation quality checks monitoring', category: 'Use Cases' },
  { title: 'Real-time Processing', url: '/use-cases/realtime', content: 'Real-time streaming data processing analytics', category: 'Use Cases' },
  { title: 'Document Processing', url: '/features/document-processing', content: 'PDF, DOCX, and document extraction capabilities', category: 'Features' },
  { title: 'Data Cleaning', url: '/features/data-cleaning', content: 'Automated data cleaning and preprocessing', category: 'Features' },
  { title: 'Format Conversion', url: '/features/format-conversion', content: 'Convert between CSV, JSON, Parquet, and more', category: 'Features' },
  { title: 'Batch Processing', url: '/features/batch-processing', content: 'Process large datasets efficiently', category: 'Features' },
  { title: 'Troubleshooting', url: '/troubleshooting', content: 'Common issues and solutions', category: 'Support' },
  { title: 'FAQ', url: '/faq', content: 'Frequently asked questions and answers', category: 'Support' },
  { title: 'Community', url: '/community', content: 'Join our community forums and discussions', category: 'Support' },
  { title: 'Pricing', url: '/pricing', content: 'Pricing plans and billing information', category: 'Account' },
  { title: 'Limits & Quotas', url: '/limits', content: 'Usage limits and quota information', category: 'Account' },
]

export function Header() {
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
        inputRef.current?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
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
          className="fixed inset-0 backdrop-blur-sm z-40"
          onClick={closeSearch}
        />
      )}
      
      <header className="relative w-full backdrop-blur-sm z-50 bg-[#f7f7f8] dark:bg-zinc-800/95 border-b border-gray-200 dark:border-zinc-700 transition-colors duration-300">
        <div className="w-full px-4 py-4">
          <div className="flex items-center h-12">
            {/* Left side - Logo */}
            <div className="flex items-center flex-shrink-0">
              <a href="/" className="flex items-center">
                <img 
                  src="/Schlep Engine laest logo design.svg" 
                  alt="Schlep Engine - AI-Powered Data Preparation" 
                  className="h-12 w-auto"
                />
              </a>
              
              <div className="md:hidden ml-4">
                <button className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100">
                  <span className="sr-only">Open menu</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Center - Enhanced Search */}
            <div className="flex-1 flex justify-center px-8">
              <div 
                className={`relative w-full max-w-4xl transition-all duration-300 ${
                  isSearchFocused ? 'transform scale-105' : ''
                }`} 
                ref={searchRef}
              >
                <div className={`relative ${
                  isSearchFocused 
                    ? 'bg-white shadow-2xl rounded-xl border-2 border-gray-300' 
                    : 'bg-white/70 border border-gray-300 rounded-lg hover:bg-white/90'
                } transition-all duration-300`}>
                  <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                    <MagnifyingGlassIcon className={`h-5 w-5 transition-colors ${
                      isSearchFocused ? 'text-gray-500' : 'text-gray-400'
                    }`} />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onFocus={handleSearchFocus}
                    onBlur={handleSearchBlur}
                    placeholder="Search documentation..."
                    className={`w-full pl-12 pr-20 py-3 bg-transparent text-sm placeholder-gray-500 focus:outline-none transition-all duration-300 ${
                      isSearchFocused ? 'text-gray-900' : 'text-gray-700'
                    }`}
                  />
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center space-x-2">
                    {isSearchFocused && (
                      <button
                        onClick={closeSearch}
                        className="p-1 rounded-md text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    )}
                    <span className="text-gray-400 text-xs font-semibold bg-gray-100 px-2 py-1 rounded">
                      ⌘K
                    </span>
                  </div>
                </div>
                
                {/* Enhanced Search Results */}
                {showResults && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-hidden">
                    {searchResults.length > 0 ? (
                      <div className="overflow-y-auto max-h-[70vh] scrollbar-hide">
                        {Object.entries(groupedResults).map(([category, items]) => (
                          <div key={category} className="border-b border-gray-100 last:border-b-0">
                            <div className="bg-gray-50/50 backdrop-blur-sm px-4 py-2 border-b border-gray-100">
                              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                {category}
                              </h3>
                            </div>
                            {items.map((result, index) => (
                              <a
                                key={`${category}-${index}`}
                                href={result.url}
                                className="block px-4 py-3 hover:bg-gray-50/50 border-b border-gray-50 last:border-b-0 transition-colors group"
                                onClick={closeSearch}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="font-medium text-gray-900 text-sm group-hover:text-gray-600 transition-colors">
                                      {result.title}
                                    </div>
                                    <div className="text-gray-500 text-xs mt-1 line-clamp-2">
                                      {result.content}
                                    </div>
                                  </div>
                                  <div className="ml-3 flex-shrink-0">
                                    <svg className="h-4 w-4 text-gray-400 group-hover:text-gray-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                  </div>
                                </div>
                              </a>
                            ))}
                          </div>
                        ))}
                      </div>
                    ) : searchQuery.length >= 1 ? (
                      <div className="px-4 py-8 text-center">
                        <div className="text-gray-400 mb-2">
                          <MagnifyingGlassIcon className="h-8 w-8 mx-auto mb-2" />
                        </div>
                        <div className="text-gray-500 text-sm">
                          No results found for "{searchQuery}"
                        </div>
                        <div className="text-gray-400 text-xs mt-1">
                          Try adjusting your search terms
                        </div>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            
            {/* Right side - Actions */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <ThemeToggle />
              
              <a 
                href="http://localhost:3000" 
                className="p-2 rounded-md text-gray-400 dark:text-zinc-500 hover:text-gray-500 dark:hover:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors duration-300"
                title="Go to Home"
              >
                <HomeIcon className="h-5 w-5" />
              </a>
              
              <a
                href="https://dashboard.schlepengine.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[#1A5799] dark:bg-[#468BE6] hover:bg-[#154A85] dark:hover:bg-[#3a7bd5] transition-colors duration-300"
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </header>
    </>
  )
}