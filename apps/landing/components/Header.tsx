'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [showProductPanel, setShowProductPanel] = useState(false)
  
  const handleProductHover = () => {
    setShowProductPanel(true)
  }
  
  const handleProductLeave = () => {
    setShowProductPanel(false)
  }

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-6xl px-6">
      <div className="bg-white/90 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-lg px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <img 
                src="/Schlep Engine 14x11cm (2).svg" 
                alt="Schlep-engine" 
                className="h-10 w-auto"
              />
              <span className="text-lg text-gray-900 font-medium" style={{fontFamily: '"DM Sans", sans-serif'}}>Schlep-engine</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <div 
              className="relative"
              onMouseEnter={handleProductHover}
              onMouseLeave={handleProductLeave}
            >
              <Link 
                href="#product" 
                className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200"
              >
                Product
              </Link>
              
              {showProductPanel && (
                <div 
                  className="absolute top-full left-0 mt-1 w-80 bg-white/95 backdrop-blur-md border border-gray-200/50 rounded-lg shadow-xl p-4 z-50"
                  onMouseEnter={handleProductHover}
                  onMouseLeave={handleProductLeave}
                >
                  <div className="space-y-4">
                    {/* Core Product */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Core Product</h3>
                      <div className="space-y-2">
                        <Link 
                          href="#data-processing-engine" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 group-hover:bg-green-600"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-green-600">Data Processing Engine</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Transform messy data to ML-ready datasets via API</p>
                          </div>
                        </Link>
                        
                        <Link 
                          href="#ai-analysis-platform" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full mt-2 group-hover:bg-green-600"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-green-600">AI Analysis Platform</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Intelligent data profiling and quality assessment</p>
                          </div>
                        </Link>
                      </div>
                    </div>

                    {/* Recently Released Features */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2">Recently Released Features</h3>
                      <div className="space-y-2">
                        <Link 
                          href="#data-quality-api" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-[#468BE6] rounded-full mt-2 group-hover:bg-[#3a7bd5]"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-[#468BE6]">Data Quality API</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Automated assessment and cleaning with quality scoring</p>
                          </div>
                        </Link>
                        
                        <Link 
                          href="#ml-pipeline-api" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-[#468BE6] rounded-full mt-2 group-hover:bg-[#3a7bd5]"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-[#468BE6]">ML Pipeline API</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Create, train, and deploy ML models via REST API</p>
                          </div>
                        </Link>
                        
                        <Link 
                          href="#file-storage-api" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-[#468BE6] rounded-full mt-2 group-hover:bg-[#3a7bd5]"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-[#468BE6]">File Storage API</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Secure file upload, management, and sharing system</p>
                          </div>
                        </Link>
                      </div>
                    </div>

                    {/* In Beta */}
                    <div>
                      <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center">
                        In Beta
                        <span className="ml-2 text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">BETA</span>
                      </h3>
                      <div className="space-y-2">
                        <Link 
                          href="#document-extraction" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 group-hover:bg-orange-500"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-orange-500">Document Extraction</h4>
                            <p className="text-xs text-gray-600 mt-0.5">PDF, OCR, and document processing capabilities</p>
                          </div>
                        </Link>
                        
                        <Link 
                          href="#validation-benchmarking" 
                          className="flex items-start space-x-3 p-2 rounded-md hover:bg-gray-50/80 transition-colors duration-200 group cursor-pointer"
                        >
                          <div className="w-1.5 h-1.5 bg-orange-400 rounded-full mt-2 group-hover:bg-orange-500"></div>
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 text-sm group-hover:text-orange-500">Validation & Benchmarking</h4>
                            <p className="text-xs text-gray-600 mt-0.5">Data validation and competitive benchmarking tools</p>
                          </div>
                        </Link>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-100 pt-2 mt-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Process 50,000+ rows in 2.3s</span>
                        <span className="text-[#468BE6] font-medium">97% Quality Score</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <Link 
              href="http://localhost:3001" 
              className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200"
            >
              Docs
            </Link>
            <Link 
              href="/pricing" 
              className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200"
            >
              Pricing
            </Link>
            <Link
              href="#get-started"
              className="bg-[#468BE6] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a7bd5] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
            >
              Try it for Free
            </Link>
          </nav>

          <div className="md:hidden">
            <button
              type="button"
              className="text-gray-600 hover:text-gray-900"
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
          <div className="md:hidden mt-4 pt-4 border-t border-gray-100">
            <div className="flex flex-col space-y-3">
              <Link 
                href="#product" 
                className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Product
              </Link>
              <Link 
                href="http://localhost:3001" 
                className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <Link 
                href="/pricing" 
                className="text-sm text-gray-600 hover:text-[#468BE6] transition-colors duration-200 py-2"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="#get-started"
                className="bg-[#468BE6] text-white px-5 py-2.5 rounded-xl hover:bg-[#3a7bd5] transition-colors duration-200 font-medium text-sm text-center"
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