'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Hero() {
  return (
    <section className="py-0 sm:py-0 lg:py-1 dark:bg-gray-900 text-gray-900 dark:text-white relative overflow-visible" style={{ 
      backgroundColor: '#f6f6f4',
    }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative pt-8 px-12 pb-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f7f7f3'
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
          <div className="max-w-[1300px] mx-auto pt-8 px-16">
            <div className="pt-8 mb-8">
              <div className="flex justify-between items-start">
                <div className="text-left">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium font-inter" style={{ color: '#111111', lineHeight: '1.2' }}>
                    The routing engine and
                  </h1>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium font-inter" style={{ color: '#111111', lineHeight: '1.2', marginTop: '0.5rem' }}>
                    control plane for AI inference
                  </h1>
                </div>
                <p className="text-sm md:text-base text-gray-700 dark:text-gray-200 max-w-md leading-relaxed font-inter text-left">
                  Schlep-engine routes AI inference across multiple models and providers to balance cost, latency, and reliability using your own API keys.
                </p>
              </div>
            </div>

            <div className="flex justify-start gap-4 mb-4">
              <Link
                href="/auth/register"
                style={{ backgroundColor: '#000000' }}
                className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              >
                Get Started
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
    </section>
  )
}
