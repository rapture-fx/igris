import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export function OvertureSection() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>

          {/* Title */}
          <div className="text-left mb-12">
            <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
              Overture
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
              Decision Layer
            </p>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed font-inter max-w-3xl">
              Routes requests across AI providers using Thompson Sampling. Tracks costs and enforces budget limits. Provides request-level observability and multi-tenant support. Runs in cloud environments.
            </p>
          </div>

          {/* Explore Link */}
          <div className="text-left">
            <Link href="/overture" className="group">
              <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                Explore Overture
                <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
              </div>
            </Link>
          </div>

        </div>
      </div>
    </section>
  )
}

export function RuntimeSection() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>

          {/* Title */}
          <div className="text-left mb-12">
            <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
              Runtime
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
              Execution Layer
            </p>
            <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 leading-relaxed font-inter max-w-3xl">
              Executes models on local hardware or edge devices. Supports ROS2 integration for robotics applications. Includes GPU, Metal, and CUDA acceleration. Functions without network connectivity.
            </p>
          </div>

          {/* Explore Link */}
          <div className="text-left">
            <Link href="/runtime" className="group">
              <div className="flex items-center text-gray-900 dark:text-white font-inter text-xs md:text-sm group-hover:translate-x-1 transition-transform">
                Explore Runtime
                <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
              </div>
            </Link>
          </div>

        </div>
      </div>
    </section>
  )
}

export default function Products() {
  return (
    <>
      <OvertureSection />
      <RuntimeSection />
    </>
  )
}

