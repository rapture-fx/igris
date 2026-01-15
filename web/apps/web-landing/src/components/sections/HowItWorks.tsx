'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', minHeight: '700px' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ minHeight: '700px' }}>
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '700px'
        }}>

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                 <div className="space-y-20 text-xs text-gray-600 dark:text-gray-400 relative pl-8 md:pl-8 lg:pl-8">
                  {/* Vertical dashed line */}
                  <div className="absolute left-1.5 top-0 bottom-0" style={{
                    width: '2px',
                    backgroundImage: 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 50%, transparent 50%)',
                    backgroundSize: '2px 8px',
                    backgroundRepeat: 'repeat-y'
                  }}></div>


                </div>
                <Link href="/use-cases" className="group inline-flex items-center mt-16 pl-8 md:pl-8 lg:pl-8">
                   <span className="text-sm text-gray-900 dark:text-white font-inter">
                     Explore Use Cases
                   </span>
                   <ChevronRight className="ml-1 h-3 w-3" />
                 </Link>

          {/* Title Section - Shows last on mobile */}
                <div className="mt-12 text-left">
                <p className="text-sm text-gray-500 mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  03. FLOW
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2" style={{ color: '#000000' }}>
                  How It Works
                </h3>
                 <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                   Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                 </p>
                </div>
            </div>

           {/* Two-column layout - Matching Products section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Content (2 columns wide) */}
             <div className="md:col-span-2 flex flex-col justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem' }}>
                   <div className="space-y-20 text-sm text-gray-600 dark:text-gray-400 relative w-full max-w-[600px]">

                    <div className="flex items-start relative">
                      <div className="flex-1">
                        <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-3" style={{ color: '#000000' }}>Your application sends a request</h4>
                        <p className="text-sm leading-relaxed mb-4 max-w-[280px]">
                          Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start relative">
                      <div className="flex-1">
                        <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-3" style={{ color: '#000000' }}>Igris makes the decision</h4>
                        <p className="text-sm leading-relaxed mb-4 max-w-[280px]">
                          Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start relative">
                      <div className="flex-1">
                        <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-3" style={{ color: '#000000' }}>Traffic reroutes on failure</h4>
                        <p className="text-sm leading-relaxed mb-4 max-w-[280px]">
                          If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                        </p>
                      </div>
                    </div>
                  </div>
                 <Link href="/use-cases" className="group inline-flex items-center mt-16 pl-8 md:pl-8 lg:pl-8">
                   <span className="text-sm text-gray-900 dark:text-white font-inter">
                     Explore Use Cases
                   </span>
                   <ChevronRight className="ml-1 h-3 w-3" />
                 </Link>
              </div>

              {/* Right Column - Title (1 column wide with left border) */}
             <div className="md:col-span-1 md:border-l flex flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
               <p className="text-sm text-gray-500 mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                 03. FLOW
               </p>
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                 How It Works
               </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                  Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
