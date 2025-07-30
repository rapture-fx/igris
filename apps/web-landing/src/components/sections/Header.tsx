'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  const [isClicked, setIsClicked] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const productLinkRef = useRef<HTMLDivElement>(null)
  
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
  
  // Handle clicks outside the panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        panelRef.current && 
        !panelRef.current.contains(event.target as Node) &&
        productLinkRef.current &&
        !productLinkRef.current.contains(event.target as Node)
      ) {
        setShowProductPanel(false)
        setIsClicked(false)
      }
    }

    if (isClicked) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => {
        document.removeEventListener('mousedown', handleClickOutside)
      }
    }
  }, [isClicked])

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-7xl bg-custom-gray backdrop-blur-md border border-gray-700/30 rounded-2xl shadow-2xl px-6 py-4" style={{boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 8px 16px -8px rgba(0, 0, 0, 0.3)'}}>
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
                ref={productLinkRef}
                onMouseEnter={handleProductHover}
                onMouseLeave={handleProductLeave}
                onClick={handleProductClick}
                className="cursor-pointer relative"
              >
                <span className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200">
                  Product
                </span>
                
                {/* Product panel positioned relative to Product link */}
                {showProductPanel && (
                  <div 
                    ref={panelRef}
                    className="absolute bg-custom-gray backdrop-blur-md border border-gray-700/30 rounded-lg shadow-xl p-4 z-50"
                    onMouseEnter={handleProductHover}
                    onMouseLeave={handleProductLeave}
                    style={{
                      top: 'calc(100% + 2.2rem)',
                      left: '0px',
                      width: '290px'
                    }}
                  >
                    <div className="space-y-4">
                      {/* Processing Power */}
                      <div>
                        <h3 className="text-sm font-semibold text-beige-secondary mb-2">Processing Power</h3>
                        <div className="space-y-2">
                          <div className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer">
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">High-Performance Processing</h4>
                              <p className="text-xs text-gray-300 mt-0.5">Process 50,000+ rows in 2.3s with automated optimization</p>
                            </div>
                          </div>
                          
                          <div className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer">
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">Multi-format Support</h4>
                              <p className="text-xs text-gray-300 mt-0.5">CSV, JSON, PDF, XLSX processing in unified workflows</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* API Endpoints */}
                      <div>
                        <h3 className="text-sm font-semibold text-beige-secondary mb-2">API Endpoints</h3>
                        <div className="space-y-2">
                          <Link 
                            href="#document-extraction-api" 
                            className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer"
                          >
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">Document Extraction API</h4>
                              <p className="text-xs text-gray-300 mt-0.5">PDF, DOCX, and scanned document processing via REST API</p>
                            </div>
                          </Link>
                          
                          <Link 
                            href="#data-quality-api" 
                            className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer"
                          >
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">Data Quality API</h4>
                              <p className="text-xs text-gray-300 mt-0.5">AI-powered data cleaning and validation with confidence scores</p>
                            </div>
                          </Link>

                          <Link 
                            href="#ml-pipeline-api" 
                            className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer"
                          >
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">ML Pipeline API</h4>
                              <p className="text-xs text-gray-300 mt-0.5">Train, deploy and manage ML models through simple API calls</p>
                            </div>
                          </Link>
                        </div>
                      </div>

                      {/* Recently Added */}
                      <div>
                        <h3 className="text-sm font-semibold text-beige-secondary mb-2">Recently Added</h3>
                        <div className="space-y-2">
                          <Link 
                            href="#storage-api" 
                            className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer"
                          >
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">File Storage API</h4>
                              <p className="text-xs text-gray-300 mt-0.5">Secure upload, management and sharing with metadata support</p>
                            </div>
                          </Link>
                          
                          <Link 
                            href="#validation-api" 
                            className="flex items-start space-x-3 p-1 rounded-md hover:bg-gray-700/80 transition-colors duration-200 group cursor-pointer"
                          >
                            <div className="w-1.5 h-1.5 bg-[#1A5799] rounded-full mt-2 group-hover:bg-[#154A85]"></div>
                            <div className="flex-1">
                              <h4 className="font-medium text-beige-secondary text-sm group-hover:text-[#468BE6]">Validation API</h4>
                              <p className="text-xs text-gray-300 mt-0.5">Real-world benchmarking and business impact measurement</p>
                            </div>
                          </Link>
                        </div>
                      </div>
                      
                      <div className="border-t border-gray-600 pt-2 mt-3">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-300">480x faster • 25x cheaper</span>
                          <span className="text-[#468BE6] font-medium">98.5% quality score</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <Link 
                href="/docs" 
                className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200"
              >
                Docs
              </Link>
              <Link 
                href="/pricing" 
                className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200"
              >
                Pricing
              </Link>
              <Link 
                href="/signin" 
                className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200"
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
                  className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Product
                </Link>
                <Link 
                  href="/docs" 
                  className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Docs
                </Link>
                <Link 
                  href="/pricing" 
                  className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200 py-2"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  Pricing
                </Link>
                <Link 
                  href="/signin" 
                  className="text-sm text-gray-300 hover:text-[#468BE6] transition-colors duration-200 py-2"
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