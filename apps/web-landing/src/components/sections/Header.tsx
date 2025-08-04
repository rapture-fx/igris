'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X, ChevronRight } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [showApiPanel, setShowApiPanel] = useState(false)
  const [showSolutionPanel, setShowSolutionPanel] = useState(false)
  const [showDocsPanel, setShowDocsPanel] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const productLinkRef = useRef<HTMLDivElement>(null)
  const apiPanelRef = useRef<HTMLDivElement>(null)
  const apiLinkRef = useRef<HTMLDivElement>(null)
  const solutionPanelRef = useRef<HTMLDivElement>(null)
  const solutionLinkRef = useRef<HTMLDivElement>(null)
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

  const handleSolutionHover = () => {
    if (!isClicked) {
      setShowSolutionPanel(true)
    }
  }

  const handleSolutionLeave = () => {
    if (!isClicked) {
      setShowSolutionPanel(false)
    }
  }

  const handleSolutionClick = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsClicked(true)
    setShowSolutionPanel(true)
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
        solutionPanelRef.current &&
        !solutionPanelRef.current.contains(event.target as Node) &&
        solutionLinkRef.current &&
        !solutionLinkRef.current.contains(event.target as Node)
      ) {
        setShowSolutionPanel(false)
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

    if (showApiPanel || showSolutionPanel || showDocsPanel || isClicked) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showApiPanel, showSolutionPanel, showDocsPanel, isClicked])

  return (
    <header 
      className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-6xl backdrop-blur-md rounded-2xl shadow-2xl px-6 py-4" 
      style={{backgroundColor: '#111111', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 8px 16px -8px rgba(0, 0, 0, 0.3)'}}
    >
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
                      
                      <div className="grid grid-cols-3 mt-4">
                        {/* Column 1: Core Data APIs */}
                        <div className="relative border-r border-[#1d1d1d]">
                          <div className="w-fit mx-auto space-y-3 pr-6">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Core Data</h4>
                            
                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Processing</h5>
                                <p className="text-xs text-gray-500">Automate data cleaning and transformation.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Quality</h5>
                                <p className="text-xs text-gray-500">Monitor and improve data quality.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference/upload" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">File Storage</h5>
                                <p className="text-xs text-gray-500">Securely store and manage your data.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Validation</h5>
                                <p className="text-xs text-gray-500">Enforce data integrity with validation rules.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Labeling</h5>
                                <p className="text-xs text-gray-500">Accelerate AI development with intuitive labeling.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                        {/* Column 2: ML & Advanced APIs */}
                        <div className="relative border-r border-[#1d1d1d]">
                          <div className="w-fit mx-auto space-y-3 px-6">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">ML & Advanced</h4>
                            
                            <Link 
                              href="/docs/use-cases/ml-training" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">ML Pipeline</h5>
                                <p className="text-xs text-gray-500">Build, train, and deploy ML models.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Document Extraction</h5>
                                <p className="text-xs text-gray-500">Extract structured data from documents.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Semantic Insights</h5>
                                <p className="text-xs text-gray-500">Uncover insights with semantic analysis.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Analytics</h5>
                                <p className="text-xs text-gray-500">Visualize and explore your data.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Monitoring</h5>
                                <p className="text-xs text-gray-500">Monitor model performance and data drift.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                        {/* Column 3: Integrations & Connectivity */}
                        <div className="relative">
                          <div className="w-fit mx-auto space-y-3 pl-6">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Integrations</h4>
                            
                            <Link 
                              href="/docs/integrations" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Connections</h5>
                                <p className="text-xs text-gray-500">Connect to a wide range of data sources.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Pipeline</h5>
                                <p className="text-xs text-gray-500">Orchestrate complex data workflows.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Data Streaming</h5>
                                <p className="text-xs text-gray-500">Process and analyze data in real-time.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/integrations" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Third-party APIs</h5>
                                <p className="text-xs text-gray-500">Integrate with your favorite third-party services.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/api-reference" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">WebSocket Manager</h5>
                                <p className="text-xs text-gray-500">Build real-time applications.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                      </div>
                      
                      <div className="pt-3 mt-12">
                        <div className="text-left">
                          <Link href="/docs" className="text-[#fcfcf7] hover:text-gray-400 text-xs">
                            See full API Reference →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  ref={solutionLinkRef}
                  onMouseEnter={handleSolutionHover}
                  onMouseLeave={handleSolutionLeave}
                  onClick={handleSolutionClick}
                  className="cursor-pointer relative"
                >
                  <span className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200">
                    Solution
                  </span>
                  {showSolutionPanel && (
                    <div 
                      ref={solutionPanelRef}
                      className="absolute bg-[#111111] backdrop-blur-md border border-[#161616] rounded-lg shadow-2xl p-5 z-50"
                      onMouseEnter={handleSolutionHover}
                      onMouseLeave={handleSolutionLeave}
                      style={{
                        top: 'calc(100% + 2.2rem)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '520px'
                      }}
                    >
                      <div className="grid grid-cols-2 mt-4">
                        {/* Column 1: Use Cases */}
                        <div className="relative border-r border-[#1d1d1d]">
                          <div className="w-fit mx-auto space-y-3 pr-6">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Use Cases</h4>
                            
                            <Link 
                              href="/docs/use-cases/ml-training" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">ML Training</h5>
                                <p className="text-xs text-gray-500">Prepare data for machine learning models.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/use-cases/ecommerce" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">E-commerce Analytics</h5>
                                <p className="text-xs text-gray-500">Customer insights and inventory optimization.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/docs/use-cases/quality-monitoring" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Quality Monitoring</h5>
                                <p className="text-xs text-gray-500">Monitor and validate data quality.</p>
                              </div>
                            </Link>
                          </div>
                        </div>

                        {/* Column 2: Industry */}
                        <div className="relative">
                          <div className="w-fit mx-auto space-y-3 pl-6">
                            <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Industry</h4>
                            
                            <Link 
                              href="/industries/financial-services" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Financial Services</h5>
                                <p className="text-xs text-gray-500">Empower financial services with clean data.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/industries/ecommerce" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">E-commerce</h5>
                                <p className="text-xs text-gray-500">Optimize retail operations and analytics.</p>
                              </div>
                            </Link>

                            <Link 
                              href="/industries/manufacturing" 
                              className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                            >
                              <div className="flex-1 min-w-0">
                                <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Manufacturing</h5>
                                <p className="text-xs text-gray-500">Improve manufacturing with sensor data.</p>
                              </div>
                            </Link>
                          </div>
                        </div>
                      </div>
                      
                      <div className="pt-3 mt-12">
                        <div className="text-left">
                          <Link href="/sales-collateral" className="text-[#fcfcf7] hover:text-gray-400 text-xs">
                            View case studies & ROI calculator →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                <div 
                  ref={docsLinkRef}
                  onMouseEnter={handleDocsHover}
                  onMouseLeave={handleDocsLeave}
                  onClick={handleDocsClick}
                  className="cursor-pointer relative"
                >
                  <span className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200">
                    Docs
                  </span>
                  {showDocsPanel && (
                    <div 
                      ref={docsPanelRef}
                      className="absolute bg-[#111111] backdrop-blur-md border border-[#161616] rounded-lg shadow-2xl p-5 z-50"
                      onMouseEnter={handleDocsHover}
                      onMouseLeave={handleDocsLeave}
                      style={{
                        top: 'calc(100% + 2.2rem)',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: '260px'
                      }}
                    >
                      <div className="w-fit mx-auto space-y-3">
                        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-2">Documentation</h4>
                        <Link 
                          href="/docs" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Getting Started</h5>
                            <p className="text-xs text-gray-500">A comprehensive guide to get you started.</p>
                          </div>
                        </Link>
                        <Link 
                          href="/docs/api-reference" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">API Reference</h5>
                            <p className="text-xs text-gray-500">In-depth documentation for our API.</p>
                          </div>
                        </Link>
                        <Link 
                          href="/docs/api-reference/industry-endpoints" 
                          className="flex items-start rounded-md hover:bg-[#161616] transition-colors duration-200 group cursor-pointer p-2"
                        >
                          <div className="flex-1 min-w-0">
                            <h5 className="text-beige-secondary text-xs group-hover:text-gray-400">Industry Endpoints</h5>
                            <p className="text-xs text-gray-500">Specialized APIs for specific industries.</p>
                          </div>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
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
                  href="/industries/ecommerce" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  E-commerce
                </Link>
                <Link 
                  href="/industries/financial-services" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Financial Services
                </Link>
                <Link 
                  href="/industries/manufacturing" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Manufacturing
                </Link>
                <Link 
                  href="/sales-collateral" 
                  className="text-sm text-gray-300 hover:text-gray-400 transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Case Studies & ROI
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
