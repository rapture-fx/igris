import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Decision Intelligence',
    description: 'Thompson Sampling and trust-aware routing with explainable decision traces.',
  },
  {
    name: 'Governed Execution',
    description: 'Resource safety limits and deterministic execution envelopes with telemetry.',
  },
  {
    name: 'Cryptographic Enforcement',
    description: 'Observed vs reported verification with signed execution contracts.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
          <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4',
            height: '100%'
          }}>

             {/* Content Container */}
             <div className="w-full px-0 flex flex-col md:flex-1">
               {/* No absolute divider - use border on right column instead */}

              {/* Title Section - Shows first on mobile, last on desktop */}
              <div className="mb-6 md:mb-0 md:hidden pl-4 md:pl-8 lg:pl-12 text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                   <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000', fontFamily: 'Roboto Mono, monospace' }}>
                   System Overview
                 </h3>
                   <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed mb-8" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                   Overture provides decision intelligence and routing control. Runtime provides governed execution with safety guarantees. Hybrid enforces cryptographic integrity between decision and execution.
                 </p>

                 {/* Capabilities - Mobile */}
                 <div className="space-y-6">
                   {capabilities.map((capability) => (
                     <div key={capability.name}>
                       <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                         {capability.name}
                       </h4>
                       <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                         {capability.description}
                       </p>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Two-column layout */}
               <div className="hidden md:grid md:grid-cols-3 gap-0 relative" style={{ height: '100%' }}>
                  {/* Left Column - Capabilities (2 columns wide) */}
                  <div className="hidden md:flex md:col-span-2 flex-col justify-center pl-4 md:pl-8 lg:pl-12" style={{
                    paddingTop: '3rem',
                    paddingBottom: '3rem',
                    paddingRight: '1rem'
                  }}>
                  <div className="w-full max-w-[320px] mr-auto">
                    <div className="space-y-6">
                   {capabilities.map((capability) => (
                     <div key={capability.name}>
                       <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                         {capability.name}
                       </h4>
                       <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                         {capability.description}
                       </p>
                     </div>
                   ))}
                 </div>
                  </div>
                </div>

                {/* Right Column - Title and Intro (Desktop only) */}
                <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '23rem', paddingBottom: '3rem', paddingLeft: '1rem', height: '100%' }}>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000', fontFamily: 'Roboto Mono, monospace' }}>
                    System Overview
                  </h3>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                    Overture provides decision intelligence and routing control. Runtime provides governed execution with safety guarantees. Hybrid enforces cryptographic integrity between decision and execution.
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
