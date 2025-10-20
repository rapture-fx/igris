'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return (
    <div
      className="relative overflow-visible dark:bg-gray-900 pt-16"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      {/* Hero Background Image */}
      <div 
        className="absolute inset-0 z-10 opacity-45"
        style={{
          backgroundImage: 'url("/HEROBG.svg")',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          width: '100%',
          height: '100%'
        }}
      />
      <div className="relative z-20 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Content Container */}
        <div className="max-w-[1300px] mx-auto pt-8">
          <div className="text-left pt-8">
            <div className="mt-0 mx-auto relative">
              <div className="w-full max-w-full overflow-hidden">
                <h1
                  style={{ color: '#1f53d0' }}
                  className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
                >
                  The Routing Engine and Control Plane for AI Inference
                </h1>

                <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-12 max-w-3xl leading-relaxed font-inter">
                  Optimize and orchestrate LLM requests across providers with routing intelligence, shadow testing, and rollback safety.
                </p>

                <div className="flex justify-start gap-4 mb-12">
                  <Link
                    href="/auth/register"
                    style={{ backgroundColor: '#1f53d0' }}
                    className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  >
                    Start Optimizing
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>

                {/* Hero content area - displays background */}
                <div style={{ backgroundColor: 'transparent', minHeight: '600px', maxHeight: '800px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
