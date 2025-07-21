'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Menu, X } from 'lucide-react'

export default function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <header className="fixed top-6 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-4xl px-6">
      <div className="bg-white/90 backdrop-blur-md border border-gray-200/50 rounded-2xl shadow-lg px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <Link href="/" className="flex items-center space-x-3">
              <img 
                src="/Schlep Engine 14x11cm (2).svg" 
                alt="Schlep-engine" 
                className="h-8 w-auto"
              />
              <span className="text-lg font-medium text-gray-900">Schlep-engine</span>
            </Link>
          </div>

          <nav className="hidden md:flex items-center space-x-8">
            <Link 
              href="/docs" 
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
                href="/docs" 
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