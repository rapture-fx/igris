'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
        <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          height: '100%'
        }}>

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="text-left md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-2" style={{ color: '#000000' }}>
                  How It Works
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-8">
                  Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                </p>

                <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
                  {/* Vertical dashed line */}
                  <div className="absolute left-1.5 top-0 bottom-0" style={{
                    width: '2px',
                    backgroundImage: 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 50%, transparent 50%)',
                    backgroundSize: '2px 8px',
                    backgroundRepeat: 'repeat-y'
                  }}></div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Your application sends a request</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Igris makes the decision</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Traffic reroutes on failure</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                    </p>
                  </div>
                </div>
              <Link href="/use-cases" className="group inline-flex items-center mt-16 pl-8">
                <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Use Cases</span>
                <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
          </div>

          {/* Two-column layout - Matching Products section */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1" style={{ height: '100%' }}>
            {/* Left Column - Content (2 columns wide) */}
            <div className="md:col-span-2 flex flex-col items-center justify-center" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem', paddingLeft: '0' }}>
              <div className="w-full max-w-[320px] mx-auto">
                <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
                  {/* Vertical dashed line */}
                  <div className="absolute left-1.5 top-0 bottom-0" style={{
                    width: '2px',
                    backgroundImage: 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 50%, transparent 50%)',
                    backgroundSize: '2px 8px',
                    backgroundRepeat: 'repeat-y'
                  }}></div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Your application sends a request</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Igris makes the decision</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-3">Traffic reroutes on failure</h4>
                    <p className="text-sm leading-relaxed line-clamp-2">
                      If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                    </p>
                  </div>
                </div>
                <Link href="/use-cases" className="group inline-flex items-center mt-16 pl-8">
                  <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Use Cases</span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </div>
            </div>

            {/* Right Column - Title (1 column wide with left border) */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem', height: '100%' }}>
              <h2 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                How It Works
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
