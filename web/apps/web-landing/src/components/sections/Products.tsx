import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto w-full">
            <div className="text-center mb-12">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Two products. One platform.
              </h3>
              <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                Igris Inertial combines intelligent control with resilient execution to deliver production-grade LLM operations.
              </p>
            </div>

            {/* Two-column product layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Overture Card */}
              <Link href="/overture" className="group">
                <div className="rounded-3xl p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[300px] flex flex-col justify-between" style={{ backgroundColor: '#f6f6f4' }}>
                  <div>
                    <h4 className="text-xl md:text-2xl font-medium text-gray-900 dark:text-white mb-3 font-inter">Overture</h4>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-4 font-inter">
                      Control Plane
                    </p>
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed font-inter mb-6">
                      Intelligent routing and orchestration across cloud providers. Policy-driven cost governance, quality-aware optimization, and multi-tenant isolation for enterprise LLM operations.
                    </p>
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base group-hover:translate-x-1 transition-transform">
                    Learn more
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Link>

              {/* Runtime Card */}
              <Link href="/runtime" className="group">
                <div className="rounded-3xl p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[300px] flex flex-col justify-between" style={{ backgroundColor: '#f6f6f4' }}>
                  <div>
                    <h4 className="text-xl md:text-2xl font-medium text-gray-900 dark:text-white mb-3 font-inter">Runtime</h4>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 mb-4 font-inter">
                      Execution Plane
                    </p>
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 leading-relaxed font-inter mb-6">
                      Local, edge, and offline inference with automatic fallback. Pure Rust runtime with streaming, GPU support, and zero-downtime operation when cloud providers fail.
                    </p>
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base group-hover:translate-x-1 transition-transform">
                    Learn more
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

