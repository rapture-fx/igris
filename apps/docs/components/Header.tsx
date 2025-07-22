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
    <header className="bg-white/95 backdrop-blur-sm shadow-sm border border-gray-200 rounded-lg mx-auto mt-6 mb-8 max-w-6xl">
      <div className="px-6">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            {/* Company Logo */}
            <a href="/" className="flex items-center">
              <img 
                src="/schlep-logo.svg" 
                alt="Schlep-engine" 
                className="h-10 w-auto"
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
          
          <div className="flex items-center space-x-4">
            {/* Home Icon Button */}
            <a 
              href="http://localhost:3000" 
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Go to Home"
            >
              <HomeIcon className="h-5 w-5" />
            </a>
            
            <div className="relative" ref={searchRef}>
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search documentation..."
                className="w-64 pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                style={{'--tw-ring-color': '#468BE6'} as React.CSSProperties}
                onFocus={() => searchQuery.length >= 2 && setShowResults(true)}
              />
              
              {showResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50 max-h-80 overflow-y-auto">
                  {searchResults.map((result, index) => (
                    <a
                      key={index}
                      href={result.url}
                      className="block px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
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
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-50">
                  <div className="px-4 py-3 text-gray-500 text-sm">
                    No results found for "{searchQuery}"
                  </div>
                </div>
              )}
            </div>
            
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
            >
              {darkMode ? (
                <SunIcon className="h-5 w-5" />
              ) : (
                <MoonIcon className="h-5 w-5" />
              )}
            </button>
            
            <div className="flex items-center space-x-2">
              <a
                href="https://github.com/schlep-engine/api"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-gray-500"
              >
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                </svg>
              </a>
              <a
                href="https://dashboard.schlepengine.com"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white transition-colors"
                style={{backgroundColor: '#468BE6'}}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#3a7bd5'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#468BE6'}
              >
                Dashboard
              </a>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}