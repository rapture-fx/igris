import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-4 lg:px-6" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0">

            {/* Left Column: Overture and Runtime - 2 columns wide */}
            <div className="md:col-span-2 space-y-4" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem', paddingLeft: '0' }}>

              {/* Overture */}
              <div style={{ backgroundColor: '#f6f6f4', border: '0.5px solid rgba(156, 163, 175, 0.3)', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem', position: 'relative' }}>
                <div>
                  <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                    Overture
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                    Decision Layer
                  </p>
                </div>
                <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px' }}></div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4 break-words max-w-lg">
                    Intelligently routes your AI requests to the best providers. Automatically optimizes for cost, latency, and performance while keeping you under budget with real-time spend tracking.
                  </p>
                  <Link href="/overture" className="group">
                    <button className="flex items-center text-gray-900 dark:text-white font-inter text-xs px-4 py-2 transition-all duration-200 hover:shadow-md" style={{ backgroundColor: '#f6f6f4', border: '0.5px solid rgba(156, 163, 175, 0.3)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
                      Explore Overture
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </button>
                  </Link>
                </div>
              </div>

              {/* Runtime */}
              <div style={{ backgroundColor: '#f6f6f4', border: '0.5px solid rgba(156, 163, 175, 0.3)', minHeight: '380px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.5rem' }}>
                <div>
                  <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                    Runtime
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                    Execution Layer
                  </p>
                </div>
                <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px' }}></div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4 break-words max-w-lg">
                    Run AI models directly on your hardware with full offline capability. Includes GPU acceleration for fast inference and integrates seamlessly with robotics systems.
                  </p>
                  <Link href="/runtime" className="group">
                    <button className="flex items-center text-gray-900 dark:text-white font-inter text-xs px-4 py-2 transition-all duration-200 hover:shadow-md" style={{ backgroundColor: '#f6f6f4', border: '0.5px solid rgba(156, 163, 175, 0.3)', boxShadow: '0 1px 4px rgba(0, 0, 0, 0.08)' }}>
                      Explore Runtime
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </button>
                  </Link>
                </div>
              </div>

            </div>

            {/* Right Column: Title and Description - 1 column wide with full-height border */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <h2 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Two components of a system
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                Overture handles routing and provider selection in cloud environments. Runtime executes models on local or edge devices. They can be deployed independently or together.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}

