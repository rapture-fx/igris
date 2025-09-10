'use client'

import React, { useEffect } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'


export default function Hero() {
  // Diagnostic logging for Hero section
  useEffect(() => {
    console.log('🔍 Hero Component Mounted')
    console.log('🔍 Hero classes: min-h-screen pt-32 pb-16')
    
    const heroElement = document.querySelector('section')
    if (heroElement) {
      const rect = heroElement.getBoundingClientRect()
      console.log('🔍 Hero dimensions:', {
        width: rect.width,
        height: rect.height,
        top: rect.top,
        paddingTop: window.getComputedStyle(heroElement).paddingTop
      })
    }
  }, [])

  return (
    <section className="relative min-h-screen overflow-hidden bg-white dark:bg-black pt-32 pb-16">
      {/* Layer 1: Grid Background */}
      

      

      {/* Layer 3: Content */}
      <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center pt-20">
          <h1 style={{ color: '#c3d0eb' }} className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2 leading-tight py-8 text-center">
            Messy data to ML-ready in API calls.
          </h1>
          <p className="text-base md:text-lg text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Simplifies complex data handling through a unified API.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard"
              style={{ backgroundColor: '#e9eef9', color: '#114dcd' }}
              className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:bg-[#fcfcf7] dark:text-black"
            >
              Get Started <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
            <Link
              href="http://localhost:3004"
              style={{ backgroundColor: '#f6f1ec', color: '#000' }}
              className="inline-flex items-center justify-center text-gray-700 px-5 py-2.5 rounded-xl hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:text-gray-300 dark:hover:bg-gray-800"
            >
              API Console <ChevronRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
          
          
          
        </div>
      </div>
    </section>
  )
}