import React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'

export default function Products() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
        <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          height: '100%'
        }}>

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <h2 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
              Two components of a system
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
              Overture handles routing and provider selection in cloud environments. Runtime executes models on local or edge devices. They can be deployed independently or together.
            </p>

            {/* Products - Mobile */}
            <div className="space-y-12">
              {/* Overture */}
              <div>
                <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                  Overture
                </h3>
                <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                  Decision Layer
                </p>
                <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/overtureframe.png"
                    alt="Overture Decision Layer"
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                  Intelligently routes your AI requests to the best providers. Automatically optimizes for cost, latency, and performance while keeping you under budget with real-time spend tracking.
                </p>
                <Link href="/overture" className="group inline-flex items-center">
                  <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Overture</span>
                  <ChevronRight className="ml-1 h-3 w-3" />
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
                <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/runtimeframe.png"
                    alt="Runtime Execution Layer"
                    fill
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                  Run AI models directly on your hardware with full offline capability. Includes GPU acceleration for fast inference and integrates seamlessly with robotics systems.
                </p>
                <Link href="/runtime" className="group inline-flex items-center">
                  <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Runtime</span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1" style={{ height: '100%' }}>

            {/* Left Column: Overture and Runtime - 2 columns wide (Desktop only) */}
            <div className="hidden md:flex md:col-span-2 flex-col items-center justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem', paddingLeft: '0' }}>
              <div className="w-full max-w-[500px] space-y-12">

                {/* Overture */}
                <div>
                  <h3 className="text-xl md:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                    Overture
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 font-inter mb-4">
                    Decision Layer
                  </p>
                  <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <Image
                      src="/overtureframe.png"
                      alt="Overture Decision Layer"
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                    Intelligently routes your AI requests to the best providers. Automatically optimizes for cost, latency, and performance while keeping you under budget with real-time spend tracking.
                  </p>
                  <Link href="/overture" className="group inline-flex items-center">
                    <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Overture</span>
                    <ChevronRight className="ml-1 h-3 w-3" />
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
                  <div style={{ border: '0.5px solid rgba(156, 163, 175, 0.3)', marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <Image
                      src="/runtimeframe.png"
                      alt="Runtime Execution Layer"
                      fill
                      style={{ objectFit: 'cover' }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                    Run AI models directly on your hardware with full offline capability. Includes GPU acceleration for fast inference and integrates seamlessly with robotics systems.
                  </p>
                  <Link href="/runtime" className="group inline-flex items-center">
                    <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Runtime</span>
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Link>
                </div>

              </div>
            </div>

            {/* Right Column: Title and Description (Desktop only) */}
            <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem', height: '100%' }}>
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

