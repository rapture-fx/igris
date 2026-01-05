import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 min-h-[500px]">

            {/* Left Column: Overture and Runtime - 2 columns wide */}
            <div className="md:col-span-2 py-12 md:py-16 lg:py-20 md:pr-12 space-y-12">

              {/* Overture */}
              <div>
                <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                  Overture
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                  Decision Layer
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                  Routes requests across AI providers using Thompson Sampling. Tracks costs and enforces budget limits. Provides request-level observability and multi-tenant support. Runs in cloud environments.
                </p>
                <Link href="/overture" className="group">
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs group-hover:translate-x-1 transition-transform">
                    Explore Overture
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              </div>

              {/* Runtime */}
              <div>
                <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                  Runtime
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                  Execution Layer
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                  Executes models on local hardware or edge devices. Supports ROS2 integration for robotics applications. Includes GPU, Metal, and CUDA acceleration. Functions without network connectivity.
                </p>
                <Link href="/runtime" className="group">
                  <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs group-hover:translate-x-1 transition-transform">
                    Explore Runtime
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </div>
                </Link>
              </div>

            </div>

            {/* Right Column: Title and Description - 1 column wide with full-height border */}
            <div className="md:col-span-1 py-12 md:py-16 lg:py-20 md:pl-12 md:border-l flex flex-col justify-start" style={{ borderColor: 'rgba(156, 163, 175, 0.3)' }}>
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

