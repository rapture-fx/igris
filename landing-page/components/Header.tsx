'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-2">
              <img 
                src="/assets/logo.svg" 
                alt="Schlep Engine" 
                className="h-8 w-8"
              />
              <span className="text-xl font-semibold text-gray-900">Schlep Engine</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="/docs" 
              className="text-gray-600 hover:text-[#1A5799] transition-colors duration-200"
            >
              Docs
            </Link>
            <Link 
              href="/pricing" 
              className="text-gray-600 hover:text-[#1A5799] transition-colors duration-200"
            >
              Pricing
            </Link>
            <Link
              href="#get-started"
              className="bg-[#1A5799] text-white px-6 py-2 rounded-lg hover:bg-[#1e3a8a] transition-colors duration-200 font-medium"
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
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="md:hidden absolute top-16 left-0 right-0 bg-white/95 backdrop-blur-lg border-b border-gray-100 px-4 py-4">
            <div className="flex flex-col space-y-4">
              <Link 
                href="/docs" 
                className="text-gray-600 hover:text-[#1A5799] transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                Docs
              </Link>
              <Link 
                href="/pricing" 
                className="text-gray-600 hover:text-[#1A5799] transition-colors duration-200"
                onClick={() => setMobileMenuOpen(false)}
              >
                Pricing
              </Link>
              <Link
                href="#get-started"
                className="bg-[#1A5799] text-white px-6 py-2 rounded-lg hover:bg-[#1e3a8a] transition-colors duration-200 font-medium text-center"
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