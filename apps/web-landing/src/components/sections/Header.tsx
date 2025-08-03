'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronRight } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showApiPanel, setShowApiPanel] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const productLinkRef = useRef<HTMLDivElement>(null)
  const apiPanelRef = useRef<HTMLDivElement>(null)
  const apiLinkRef = useRef<HTMLDivElement>(null)
  
  const handleProductHover = () => {
    if (!isClicked) {
      setShowProductPanel(true)
    }
  }
  
  const handleProductLeave = () => {
    if (!isClicked) {
      setShowProductPanel(false)
    }
  }
  
  const handleProductClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsClicked(true)
    setShowProductPanel(true)
  }

  const handleApiHover = () => {
    if (!isClicked) {
      setShowApiPanel(true)
    }
  }

  const handleApiLeave = () => {
    if (!isClicked) {
      setShowApiPanel(false)
    }
  }

  const handleApiClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsClicked(true)
    setShowApiPanel(true)
  }
  
  // Handle clicks outside the panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        apiPanelRef.current &&
        !apiPanelRef.current.contains(event.target as Node) &&
        apiLinkRef.current &&
        !apiLinkRef.current.contains(event.target as Node)
      ) {
        setShowApiPanel(false)
        setIsClicked(false)
      }
    }

    if (showApiPanel || isClicked) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [showApiPanel, isClicked])

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-7xl backdrop-blur-md rounded-2xl shadow-2xl px-6 py-4" style={{backgroundColor: '#111111', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 8px 16px -8px rgba(0, 0, 0, 0.3)'}}>
      <div>
        <div className="flex justify-between items-center">
            <div className="flex items-center flex-1">
              <Link href="/" className="flex items-center space-x-3">
                <img 
                  src="/Schlep Engine laest logo design.svg" 
                  alt="schlep-engine - AI-Powered Data Preparation" 
                  className="h-12 w-auto"
                />
                <span className="text-lg" style={{fontFamily: '"DM Sans", sans-serif', color: '#f6f1ec', fontWeight: '700'}}>Schlep-engine</span>
              </Link>
            </div>

            <nav className="hidden md:flex items-center justify-center space-x-8 relative flex-1">
              <div 
                ref={apiLinkRef}
                onMouseEnter={handleApiHover}
                onMouseLeave={handleApiLeave}
                onClick={handleApiClick}
                className="cursor-pointer relative"
              >
                <span className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200">
                  Platform
                </span>
                
                {/* API panel positioned relative to API link */}
                {showApiPanel && (
                  <div 
                    ref={apiPanelRef}
                    className="absolute bg-[#111111] backdrop-blur-md border border-[#161616] rounded-lg shadow-2xl p-5 z-50"
                    onMouseEnter={handleApiHover}
                    onMouseLeave={handleApiLeave}
                    style={{
                      top: 'calc(100% + 2.2rem)',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      width: '520px'
                    }}
                  >
                    
                    <div className="grid grid-cols-3 gap-6 mt-8">
                      {/* Column 1: Core Data APIs */}
                      <div className="space-y-3 relative">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Core Data</h4>
                        
                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Processing</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Quality</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference/upload" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">File Storage</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Validation</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Labeling</h5>
                          </div>
                        </Link>
                      </div>

                      {/* Column 2: ML & Advanced APIs */}
                      <div className="space-y-3 relative">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">ML & Advanced</h4>
                        
                        <Link 
                          href="/docs/use-cases/ml-training" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">ML Pipeline</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Document Extraction</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Semantic Insights</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Analytics</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Monitoring</h5>
                          </div>
                        </Link>
                      </div>

                      {/* Column 3: Integrations & Connectivity */}
                      <div className="space-y-3 relative">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Integrations</h4>
                        
                        <Link 
                          href="/docs/integrations" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Connections</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Pipeline</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Streaming</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/integrations" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Third-party APIs</h5>
                          </div>
                        </Link>

                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">WebSocket Manager</h5>
                          </div>
                        </Link>
                      </div>

                    </div>
                    
                    <div className="border-t border-[#1d1d1d] pt-3 mt-12">
                      <div className="text-left">
                        <Link href="/docs" className="text-[#fcfcf7] hover:text-gray-400 text-xs">
                          See full documentation →
                        </Link>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Link 
                href="/docs" 
                className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200"
              >
                Docs
              </Link>
              <Link 
                href="/solutions" 
                className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200"
              >
                Solution
              </Link>
              <Link 
                href="/pricing" 
                className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200"
              >
                Pricing
              </Link>
              <Link 
                href="/signin" 
                className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200"
              >
                Sign In
              </Link>

            </nav>

            <div className="hidden md:flex items-center space-x-3">
              <Link
                href="#get-started"
                className="bg-[#1A5799] text-beige-secondary px-5 py-2.5 rounded-xl hover:bg-[#154A85] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
              >
                Try it for Free
              </Link>
            </div>

            <div className="md:hidden flex items-center space-x-2">
              <button
                type="button"
                className="text-gray-300 hover:text-gray-100 transition-colors duration-300"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-5 w-5" />
                ) : (
                  <Menu className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>


          {mobileMenuOpen && (
            <div className="md:hidden mt-4 pt-4 border-t border-gray-600">
              <div className="flex flex-col space-y-3">
                <Link 
                  href="#product" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Product
                </Link>
                <Link 
                  href="/docs" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link 
                  href="/pricing" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  href="/signin" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Sign In
                </Link>
                <Link
                  href="#get-started"
                  className="bg-[#468BE6] text-beige-secondary px-5 py-2.5 rounded-xl hover:bg-[#3a7bd5] transition-colors duration-200 font-medium text-sm text-center"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Try it for Free
                </Link>
              </div>
            </div>
          )}
        </div>
    </header>
  )
}