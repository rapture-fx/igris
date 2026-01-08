import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Adaptive Execution',
    description: 'Routes AI requests to available compute based on the current environment.',
  },
  {
    name: 'Automatic Continuity',
    description: 'Continues operating when providers, connectivity, or resources change.',
  },
  {
    name: 'Unified Control',
    description: 'Provides a single control layer across cloud, edge, and autonomous systems.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
          <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4',
            height: '100%'
          }}>

            {/* Content Container */}
            <div className="w-full px-0 flex flex-col md:flex-1">
              {/* No absolute divider - use border on right column instead */}

              {/* Title Section - Shows first on mobile, last on desktop */}
              <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  System Overview
                </h3>
                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed mb-8">
                  Igris is a control and execution system for AI workloads that operate across cloud and edge environments. It manages how AI requests are routed and executed as conditions, providers, and environments change.
                </p>

                {/* Capabilities - Mobile */}
                <div className="space-y-6">
                  {capabilities.map((capability) => (
                    <div key={capability.name}>
                      <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                        {capability.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                        {capability.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

               {/* Two-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>
                {/* Left Column - Capabilities (2 columns wide) */}
                <div className="hidden md:flex md:col-span-2 flex-col items-center justify-start" style={{
                  paddingTop: '3rem',
                  paddingBottom: '3rem',
                  paddingRight: '1rem',
                  paddingLeft: '0'
                }}>
                  <div className="w-full max-w-[320px]">
                    <div className="space-y-6">
                      {capabilities.map((capability) => (
                        <div key={capability.name}>
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Right Column - Title and Intro (Desktop only) */}
                <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem', height: '100%' }}>
                  <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                    System Overview
                  </h3>
                  <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                    Igris is a control and execution system for AI workloads that operate across cloud and edge environments. It manages how AI requests are routed and executed as conditions, providers, and environments change.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
