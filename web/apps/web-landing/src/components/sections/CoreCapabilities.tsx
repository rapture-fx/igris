import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Smart Routing',
    description: 'Routes requests to the best provider based on real performance data. Detects slow or failing providers and shifts traffic automatically. Can query multiple providers and pick the best response.',
  },
  {
    name: 'Built for Scale',
    description: 'Handles 50,000+ requests per second with sub-millisecond caching. Each customer gets their own rate limits — no noisy neighbor problems. Requests run in parallel to cut latency.',
  },
  {
    name: 'Isolated and Resilient',
    description: 'Each customer\'s data is isolated at the database level. Your API keys work even if our servers are unreachable. Routing decisions are cached locally for 72 hours as a fallback.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4'
          }}>

              {/* Content Container */}
              <div className="w-full px-0 flex flex-col md:flex-1">
                {/* No absolute divider - use border on right column instead */}

               {/* Capabilities - Mobile - Shows first on mobile */}
               <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                 <div className="space-y-6">
                   {capabilities.map((capability) => (
                     <div key={capability.name}>
                        <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-inter" style={{ color: '#000000' }}>
                          {capability.name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          {capability.description}
                        </p>
                     </div>
                   ))}
                 </div>

               {/* Title Section - Shows last on mobile */}
                <div className="mt-12 text-left">
                     <p className="text-base text-gray-500 mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                       02. CORE
                     </p>
                     <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                     System Overview
                   </h3>
                     <p className="text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                     Overture decides which provider handles each request. Runtime executes agents safely on edge devices. Hybrid connects them with cryptographic verification.
                   </p>
                </div>
               </div>

               {/* Two-column layout */}
               <div className="hidden md:grid md:grid-cols-3 gap-0 relative">
                   {/* Left Column - Capabilities (2 columns wide) */}
                   <div className="hidden md:flex md:col-span-2 flex-col justify-start" style={{
                     paddingTop: '3rem',
                     paddingBottom: '3rem',
                     paddingRight: '1rem'
                   }}>
                   <div className="w-full max-w-[480px]">
                     <div className="space-y-6">
                     {capabilities.map((capability) => (
                        <div key={capability.name} className="flex gap-4 items-start">
                          <div style={{
                            width: '140px',
                            height: '140px',
                            border: '0.5px solid rgba(156, 163, 175, 0.3)',
                            flexShrink: 0,
                            backgroundColor: '#f6f6f4',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                             <img
                               src="/fr.png"
                               alt={capability.name}
                               style={{
                                 position: 'absolute',
                                 width: '140%',
                                 height: '140%',
                                 objectFit: 'cover',
                                 opacity: '0.7'
                               }}
                             />
                            {capabilities.indexOf(capability) === 0 && (
                              <img
                                src="/tre.png"
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.65'
                                }}
                              />
                            )}
                            {capabilities.indexOf(capability) === 1 && (
                              <img
                                src="/two.png"
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.5'
                                }}
                              />
                            )}
                            {capabilities.indexOf(capability) === 2 && (
                              <img
                                src="/one.png"
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.5'
                                }}
                              />
                            )}
                          </div>
                         <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-inter" style={{ color: '#000000' }}>
                            {capability.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      </div>
                    ))}
                 </div>
                  </div>
                </div>

                 {/* Right Column - Title and Intro (Desktop only) */}
                 <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                   <p className="text-base text-gray-500 mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                     02. CORE
                   </p>
                   <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                     System Overview
                   </h3>
                   <p className="text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                     Overture decides which provider handles each request. Runtime executes agents safely on edge devices. Hybrid connects them with cryptographic verification.
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
