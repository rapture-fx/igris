'use client'

import React from 'react'
import { HomeIcon } from '@heroicons/react/24/outline'
import { SearchComponent } from './SearchComponent'
import { Breadcrumb } from './Breadcrumb'

export function Header() {

  return (
    <header className="relative w-full z-50 bg-white transition-colors duration-300 rounded-tl-3xl">
      <div className="w-full px-4 py-4">
        <div className="flex items-center justify-between h-12">
          {/* Left side - Breadcrumb aligned with main content */}
          <div className="flex items-center" style={{ marginLeft: '3rem' }}>
            <Breadcrumb />
          </div>
          
          {/* Right side - Actions */}
          <div className="flex items-center pr-8">
            <a
              href="http://localhost:3000/signin"
              className="inline-flex items-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-[#1A5799] hover:bg-[#154A85] transition-colors duration-300"
            >
              Sign In
            </a>
          </div>
        </div>
      </div>
    </header>
  )
}