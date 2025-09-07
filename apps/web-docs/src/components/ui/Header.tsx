'use client'

import React from 'react'
import { HomeIcon, SunIcon, MoonIcon } from '@heroicons/react/24/outline'
import { SearchComponent } from './SearchComponent'
import { Breadcrumb } from './Breadcrumb'

export function Header() {
  return (
    <header className="relative w-full z-50 bg-white transition-colors duration-300 rounded-tl-3xl">
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between h-12">
          {/* Left side - Breadcrumb aligned with main content */}
          <div className="flex items-center" style={{ marginLeft: '1rem' }}>
            <Breadcrumb />
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center gap-3 pr-8">
            {/* Theme Toggle - disabled for now */}
            <button
              disabled
              className="p-2 text-gray-300 rounded-md cursor-not-allowed"
              title="Theme toggle temporarily disabled"
            >
              <SunIcon className="h-5 w-5" />
            </button>
            
            <a
              href="http://localhost:3000/signin"
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-black hover:bg-gray-800 transition-colors duration-300"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}