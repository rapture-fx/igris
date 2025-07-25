'use client'

import { MagnifyingGlassIcon, SunIcon, MoonIcon, HomeIcon } from '@heroicons/react/24/outline'
import { useState, useEffect, useRef } from 'react'

// Define searchable content for documentation
const searchData = [
  { title: 'Introduction', url: '/introduction', content: 'Getting started with Schlep Engine' },
  { title: 'API Reference', url: '/api-reference', content: 'Complete API documentation' },
  { title: 'SDK Overview', url: '/sdks', content: 'Python JavaScript TypeScript SDKs' },
  { title: 'Jupyter Integration', url: '/integrations/jupyter', content: 'Jupyter notebooks interactive data processing analysis' },
  { title: 'AWS SageMaker Integration', url: '/integrations/aws-sagemaker', content: 'SageMaker machine learning deployment training' },
  { title: 'ML Model Training', url: '/use-cases/ml-training', content: 'Machine learning training pipeline feature engineering' },
  { title: 'E-commerce Analytics', url: '/use-cases/ecommerce', content: 'Customer segmentation inventory optimization recommendations' },
  { title: 'Data Quality Monitoring', url: '/use-cases/quality-monitoring', content: 'Data validation quality checks monitoring' },
  { title: 'Real-time Processing', url: '/use-cases/realtime', content: 'Real-time streaming data processing analytics' },
]

export function Header() {
  const [darkMode, setDarkMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef(null)

  // Handle search functionality
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    const query = searchQuery.toLowerCase()
    const results = searchData.filter(item => 
      item.title.toLowerCase().includes(query) || 
      item.content.toLowerCase().includes(query)
    ).slice(0, 5) // Limit to 5 results

    setSearchResults(results)
    setShowResults(true)
  }, [searchQuery])

  // Handle click outside to close search results
  useEffect(() => {
    function handleClickOutside(event) {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowResults(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <header className="w-full backdrop-blur-sm" style={{backgroundColor: '#f7f7f8'}}>
      <div className="w-full pl-16 pr-8 pt-8 pb-6">
        <div className="flex items-center h-14">
          {/* Left side - Logo */}
          <div className="flex items-center">
            <a href="/" className="flex items-center">
              <img 
                src="/schlep-logo.svg" 
                alt="Schlep-engine" 
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
          
          {/* Center - Search - Aligned with main content */}
          <div className="absolute left-1/2 transform -translate-x-1/2">
            <div className="relative max-w-4xl mx-auto px-6">
              <div className="relative w-96" ref={searchRef}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                style={{'--tw-ring-color': '#468BE6'} as React.CSSProperties}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              />
              
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <a
                      key={index}
                      href={result.url}
                      className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                      onClick={() => {
                        setShowResults(false)
                        setSearchQuery('')
                      }}
                    >
                      <div className="font-medium text-gray-900 text-sm">{result.title}</div>
                      <div className="text-gray-500 text-xs mt-1 line-clamp-2">{result.content}</div>
                    </a>
                  ))}
                </div>
              )}
              
              {showResults && searchResults.length === 0 && searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50">
                  <div className="px-4 py-3 text-gray-500 text-sm text-center">
                    No results found for "{searchQuery}"
                  </div>
                </div>
              )}
              </div>
            </div>
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center space-x-3 ml-auto">
            <a 
              href="http://localhost:3000" 
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Go to Home"
            >
              <HomeIcon className="h-5 w-5" />
            </a>
            
            <a
              href="https://dashboard.schlepengine.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white transition-colors"
              style={{backgroundColor: '#1A5799'}}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#154A85'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#1A5799'}
            >
              Dashboard
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}