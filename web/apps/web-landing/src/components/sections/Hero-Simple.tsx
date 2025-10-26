'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-visible" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative" style={{ paddingLeft: '80px', paddingRight: '160px',
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto pt-8 relative z-20">
        {/* Content Container */}
            <div className="max-w-[1300px] mx-auto pt-8">
              <div className="text-left pt-8 pl-0">
            <div className="mt-0 mx-auto relative">
              <div className="w-full max-w-full overflow-hidden">
                <h1
                  style={{ color: '#1f53d0' }}
                  className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
                >
                  The Routing Engine and Control Plane for AI Inference
                </h1>

                <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-12 max-w-3xl leading-relaxed font-inter">
                  Schlep-engine optimize and orchestrate LLM requests across providers with routing intelligence, shadow testing, and rollback safety.
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
                <div style={{ backgroundColor: 'transparent', minHeight: '350px', maxHeight: '800px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                  </div>
                </div>
              </div>
            </div>
          </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
