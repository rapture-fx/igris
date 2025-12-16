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
          <div className="max-w-[1300px] mx-auto w-full">
            <div className="text-center mb-4">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Two products. One platform.
              </h3>
            </div>
            
            <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto mb-12" style={{
              textAlign: 'center',
              verticalAlign: 'top',
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'center'
            }}>
              Igris Inertial delivers resilient LLM orchestration across cloud and edge environments. One intelligence layer — two deployment models.
            </p>

            {/* Vertically stacked product layout */}
            <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Overture Card */}
              <Link href="/overture" className="group">
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm h-[280px] flex flex-col justify-end overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
                  <div className="overflow-hidden">
                    <h4 className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-1 md:mb-2 font-inter">Overture</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-inter">
                      Control Plane
                    </p>
                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-tight font-inter mb-3 line-clamp-3">
                      Cloud orchestration with intelligent routing, shadow mode testing, and multi-provider consensus. Automated cost governance, quality-aware optimization, and multi-tenant isolation for enterprise operations.
                    </p>
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm">
                    Learn more
                    <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                  </div>
                </div>
              </Link>

              {/* Runtime Card */}
              <Link href="/runtime" className="group">
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm h-[280px] flex flex-col justify-end overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
                  <div className="overflow-hidden">
                    <h4 className="text-base md:text-lg font-medium text-gray-900 dark:text-white mb-1 md:mb-2 font-inter">Runtime</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mb-2 font-inter">
                      Execution Plane
                    </p>
                    <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-tight font-inter mb-3 line-clamp-3">
                      Offline-capable edge runtime with automatic local LLM fallback. Pure Rust with streaming, GPU acceleration, peer-to-peer swarm intelligence, and on-device fine-tuning. Zero-downtime when cloud fails.
                    </p>
                  </div>
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm">
                    Learn more
                    <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
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

