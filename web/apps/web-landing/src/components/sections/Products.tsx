import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>
          {/* Content Container */}
          <div className="w-full px-0">
            {/* Title Section */}
            <div className="pt-8 pb-8 mb-8 -mx-4 md:-mx-8 lg:-mx-12" style={{
              borderBottom: '0.3px solid rgba(156, 163, 175, 0.3)'
            }}>
              <div className="px-4 md:px-8 lg:px-12 text-left">
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-2" style={{ color: '#000000' }}>
                  Two components of the system
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter max-w-3xl">
                  Overture handles routing and provider selection in cloud environments. Runtime executes models on local or edge devices. They can be deployed independently or together.
                </p>
              </div>
            </div>

            {/* Two-column layout wrapper */}
            <div className="relative">
              {/* Vertical Divider - from top to bottom of two-column section */}
              <div className="absolute top-0 bottom-0 left-1/2 hidden lg:block" style={{
                borderLeft: '0.3px solid rgba(156, 163, 175, 0.3)',
                transform: 'translateX(-50%)'
              }}></div>

              {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0" style={{ minHeight: '400px' }}>

              {/* Left Column - Overture */}
              <div className="text-left pr-0 lg:pr-12 flex flex-col justify-between" style={{ minHeight: '400px' }}>
                <div className="pt-8">
                  <h4 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white mb-2 font-inter">Overture</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-6">
                    Decision Layer
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                    Routes requests across AI providers using Thompson Sampling. Tracks costs and enforces budget limits. Provides request-level observability and multi-tenant support. Runs in cloud environments.
                  </p>
                </div>
                <div className="pb-8">
                  <Link href="/overture" className="group">
                    <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                      Explore Overture
                      <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                    </div>
                  </Link>
                </div>
              </div>

              {/* Right Column - Runtime */}
              <div className="text-left pl-0 lg:pl-12 flex flex-col justify-between" style={{ minHeight: '400px' }}>
                <div className="pt-8">
                  <h4 className="text-lg md:text-xl font-medium text-gray-900 dark:text-white mb-2 font-inter">Runtime</h4>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-6">
                    Execution Layer
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                    Executes models on local hardware or edge devices. Supports ROS2 integration for robotics applications. Includes GPU, Metal, and CUDA acceleration. Functions without network connectivity.
                  </p>
                </div>
                <div className="pb-8">
                  <Link href="/runtime" className="group">
                    <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                      Explore Runtime
                      <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                    </div>
                  </Link>
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

