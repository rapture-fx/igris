import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
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
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
            <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-66.67%)'
            }}></div>

            {/* Title Section - Shows first on mobile, last on desktop */}
            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Two products. One platform.
              </h3>
              <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                Igris Inertial delivers resilient LLM orchestration across cloud and edge environments. One intelligence layer, two deployment models.
              </p>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>

              {/* Left Column - Product Cards (stacked vertically) */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="flex flex-col gap-6 w-full max-w-2xl">
                  {/* Overture Card */}
                  <Link href="/overture" className="group">
                    <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group-hover:border-gray-400/80" style={{ backgroundColor: '#f6f6f4' }}>
                      <div className="flex-shrink-0 w-full">
                        <div>
                          <h4 className="text-lg md:text-xl lg:text-2xl font-medium text-gray-900 dark:text-white mb-0.5 font-inter">Overture</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-inter">
                            Control Plane
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mt-6 mb-6 break-words whitespace-normal" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                          Cloud orchestration with intelligent routing, shadow mode testing, and multi-provider consensus. Automated cost governance, quality-aware optimization, and multi-tenant isolation for enterprise operations.
                        </p>
                        <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                          Learn more
                          <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>

                  {/* Runtime Card */}
                  <Link href="/runtime" className="group">
                    <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden group-hover:border-gray-400/80" style={{ backgroundColor: '#f6f6f4' }}>
                      <div className="flex-shrink-0 w-full">
                        <div>
                          <h4 className="text-lg md:text-xl lg:text-2xl font-medium text-gray-900 dark:text-white mb-0.5 font-inter">Runtime</h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 font-inter">
                            Execution Plane
                          </p>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mt-6 mb-6 break-words whitespace-normal" style={{ wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                          Edge runtime with guaranteed latency, robot control, and fleet management. Privacy-preserving federated learning, human oversight for critical decisions, and chaos testing. Built for safety-critical systems.
                        </p>
                        <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                          Learn more
                          <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                </div>
              </div>

              {/* Right Column - Section Title (Desktop only) */}
              <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Two products. One platform.
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                  Igris Inertial delivers resilient LLM orchestration across cloud and edge environments. One intelligence layer, two deployment models.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

