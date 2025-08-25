'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Menu, X, ChevronRight } from 'lucide-react'
import { usePathname } from 'next/navigation'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showApiPanel, setShowApiPanel] = useState(false)
  const [showDocsPanel, setShowDocsPanel] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const pathname = usePathname()
  const [scrolled, setScrolled] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const productLinkRef = useRef<HTMLDivElement>(null)
  const apiPanelRef = useRef<HTMLDivElement>(null)
  const apiLinkRef = useRef<HTMLDivElement>(null)
  const docsPanelRef = useRef<HTMLDivElement>(null)
  const docsLinkRef = useRef<HTMLDivElement>(null)
  
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

  const handleDocsHover = () => {
    if (!isClicked) {
      setShowDocsPanel(true)
    }
  }

  const handleDocsLeave = () => {
    if (!isClicked) {
      setShowDocsPanel(false)
    }
  }

  const handleDocsClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsClicked(true)
    setShowDocsPanel(true)
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
      if (
        docsPanelRef.current &&
        !docsPanelRef.current.contains(event.target as Node) &&
        docsLinkRef.current &&
        !docsLinkRef.current.contains(event.target as Node)
      ) {
        setShowDocsPanel(false)
        setIsClicked(false)
      }
    }

    if (showApiPanel || showDocsPanel || isClicked) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showApiPanel, showDocsPanel, isClicked])

  // Scroll effect
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 0) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header 
      className={`fixed top-0 left-0 w-full z-50 px-6 py-4 bg-white ${scrolled ? 'scrolled' : ''}`}
    >
      <div className="max-w-[1300px] mx-auto">
        <div className="flex items-center">
            <div className="flex items-center">
              <Link href="/" className="flex items-center">
                <Image 
                  src="/Schlep Engine new finding light.svg" 
                  alt="Schlep Engine" 
                  width={40} 
                  height={40}
                />
              </Link>
            </div>

            <nav className="hidden md:flex items-center justify-center space-x-8 absolute left-1/2 transform -translate-x-1/2">
                <div 
                  ref={apiLinkRef}
                  onMouseEnter={handleApiHover}
                  onMouseLeave={handleApiLeave}
                  onClick={handleApiClick}
                  className="cursor-pointer relative"
                >
                  <Link href="/" className={`text-sm transition-colors duration-200 ${pathname === '/' ? 'font-bold text-gray-900' : 'text-gray-700 hover:text-gray-900'}`}>
                    Platform
                  </Link>
                  
                  {/* API panel positioned relative to API link */}
                  {showApiPanel && (
                    <div 
                      ref={apiPanelRef}
                      className="absolute bg-white backdrop-blur-md border border-gray-200 rounded-lg shadow-2xl p-5 z-50"
                      onMouseEnter={handleApiHover}
                      onMouseLeave={handleApiLeave}
                      style={{
                        top: 'calc(100% + 2.2rem)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '520px'
                      }}
                    >
                      
                      <div className="grid grid-cols-3 mt-4">
                        {/* Column 1: Core Data APIs */}
                        <div className="relative">
                          <div className="w-fit mx-auto space-y-3 pr-6">
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Core Data</h4>
                            
                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Processing</h5>
                                <p className="text-xs text-gray-600">Automate data cleaning and transformation.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Quality</h5>
                                <p className="text-xs text-gray-600">Monitor and improve data quality.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference/upload" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">File Storage</h5>
                                <p className="text-xs text-gray-600">Securely store and manage your data.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Validation</h5>
                                <p className="text-xs text-gray-600">Enforce data integrity with validation rules.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Labeling</h5>
                                <p className="text-xs text-gray-600">Accelerate AI development with intuitive labeling.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                        {/* Column 2: ML & Advanced APIs */}
                        <div className="relative">
                          <div className="w-fit mx-auto space-y-3 px-6">
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">ML & Advanced</h4>
                            
                            <Link 
                              href="/docs/use-cases/ml-training" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">ML Pipeline</h5>
                                <p className="text-xs text-gray-600">Build, train, and deploy ML models.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Document Extraction</h5>
                                <p className="text-xs text-gray-600">Extract structured data from documents.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Semantic Insights</h5>
                                <p className="text-xs text-gray-600">Uncover insights with semantic analysis.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Analytics</h5>
                                <p className="text-xs text-gray-600">Visualize and explore your data.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Monitoring</h5>
                                <p className="text-xs text-gray-600">Monitor model performance and data drift.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                        {/* Column 3: Integrations & Connectivity */}
                        <div className="relative">
                          <div className="w-fit mx-auto space-y-3 pl-6">
                            <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Integrations</h4>
                            
                            <Link 
                              href="/docs/integrations" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Connections</h5>
                                <p className="text-xs text-gray-600">Connect to a wide range of data sources.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Pipeline</h5>
                                <p className="text-xs text-gray-600">Orchestrate complex data workflows.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Data Streaming</h5>
                                <p className="text-xs text-gray-600">Process and analyze data in real-time.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/integrations" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">Third-party APIs</h5>
                                <p className="text-xs text-gray-600">Integrate with your favorite third-party services.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-gray-50 transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-gray-900 text-xs group-hover:text-gray-700">WebSocket Manager</h5>
                                <p className="text-xs text-gray-600">Build real-time applications.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                      </div>
                      
                      <div className="pt-3 mt-12">
                        <div className="text-left">
                          <Link href="/docs" className="text-gray-900 hover:text-gray-700 text-xs">
                            See full API Reference →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <Link 
                  href="/solutions" 
                  className={`text-sm transition-colors duration-200 ${pathname === '/solutions' ? 'font-bold text-gray-900' : 'text-gray-700 hover:text-gray-900'}`}>
                  Solution
                </Link>
                <Link 
                  href="http://localhost:3003/api-reference" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200"
                >
                  Docs
                </Link>
                <Link 
                  href="/pricing" 
                  className={`text-sm transition-colors duration-200 ${pathname === '/pricing' ? 'font-bold text-gray-900' : 'text-gray-700 hover:text-gray-900'}`}>
                  Pricing
                </Link>
                
            </nav>

            <div className="hidden md:flex items-center space-x-3 ml-auto">
              <Link
                href="/auth"
                className="bg-black text-white px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
              >
                Sign Up
              </Link>
            </div>

            <div className="md:hidden flex items-center space-x-2">
              <button
                type="button"
                className="text-gray-700 hover:text-gray-900 transition-colors duration-300"
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
            <div className="md:hidden mt-4 pt-4 border-t border-gray-200">
              <div className="flex flex-col space-y-3">
                <Link 
                  href="#product" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Product
                </Link>
                <Link 
                  href="/industries/ecommerce" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  E-commerce
                </Link>
                <Link 
                  href="/industries/financial-services" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Financial Services
                </Link>
                <Link 
                  href="/industries/manufacturing" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Manufacturing
                </Link>
                <Link 
                  href="/sales-collateral" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Case Studies & ROI
                </Link>
                <Link 
                  href="/docs" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link 
                  href="/pricing" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  href="/signin" 
                  className="text-sm text-gray-700 hover:text-gray-900 transition-colors duration-200 py-2"
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
