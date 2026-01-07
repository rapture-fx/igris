'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function HowItWorks() {
  const [activeTab, setActiveTab] = useState<'overture' | 'runtime' | 'hybrid'>('overture')

  return (
    <section id="how-it-works" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center */}
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-33.33%)'
            }}></div>

            {/* Title Section - Shows first on mobile, last on desktop */}
            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-2" style={{ color: '#000000' }}>
                How It Works
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-4">
                Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
              </p>

              {/* Tabs for Mobile */}
              <div className="flex gap-1 mb-6">
                <button
                  onClick={() => setActiveTab('overture')}
                  className={`px-4 py-2 text-sm font-inter transition-all ${
                    activeTab === 'overture'
                      ? 'text-gray-900 border-b border-gray-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Overture
                </button>
                <button
                  onClick={() => setActiveTab('runtime')}
                  className={`px-4 py-2 text-sm font-inter transition-all ${
                    activeTab === 'runtime'
                      ? 'text-gray-900 border-b border-gray-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Runtime
                </button>
                <button
                  onClick={() => setActiveTab('hybrid')}
                  className={`px-4 py-2 text-sm font-inter transition-all ${
                    activeTab === 'hybrid'
                      ? 'text-gray-900 border-b border-gray-500'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Hybrid
                </button>
              </div>

              {/* Content Area for Mobile */}
              <div className="w-full mb-6">
                {activeTab === 'overture' && (
                  <div className="w-full h-full min-h-[300px] flex items-center justify-center">
                    {/* Placeholder for Overture image */}
                  </div>
                )}
                {activeTab === 'runtime' && (
                  <div className="w-full h-full min-h-[300px] flex items-center justify-center">
                    {/* Placeholder for Runtime image */}
                  </div>
                )}
                {activeTab === 'hybrid' && (
                  <div className="w-full h-full min-h-[300px] flex items-center justify-center">
                    {/* Placeholder for Hybrid image */}
                  </div>
                )}
              </div>

              <div className="space-y-6 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
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
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Your application sends a request</h4>
                  <p className="text-sm">
                    Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                  </p>
                </div>

                <div className="relative">
                  {/* Dot */}
                  <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.6)'
                  }}></div>
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Igris makes the decision</h4>
                  <p className="text-sm">
                    Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                  </p>
                </div>

                <div className="relative">
                  {/* Dot */}
                  <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                    backgroundColor: '#f6f6f4',
                    borderColor: 'rgba(156, 163, 175, 0.6)'
                  }}></div>
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Traffic reroutes on failure</h4>
                  <p className="text-sm">
                    If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                  </p>
                </div>
              </div>
              <Link href="/use-cases" className="group inline-flex items-center mt-4">
                <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Use Cases</span>
                <ChevronRight className="ml-1 h-3 w-3" />
              </Link>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              {/* Left Column - Section Title (Desktop only) */}
              <div className="hidden lg:flex text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex-col" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  How It Works
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-6">
                  Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                </p>
                <div className="space-y-6 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
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
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Your application sends a request</h4>
                    <p className="text-sm">
                      Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Igris makes the decision</h4>
                    <p className="text-sm">
                      Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                    </p>
                  </div>

                  <div className="relative">
                    {/* Dot */}
                    <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                      backgroundColor: '#f6f6f4',
                      borderColor: 'rgba(156, 163, 175, 0.6)'
                    }}></div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Traffic reroutes on failure</h4>
                    <p className="text-sm">
                      If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                    </p>
                  </div>
                </div>
                <Link href="/use-cases" className="group inline-flex items-center mt-6">
                  <span className="text-sm text-gray-900 dark:text-white font-inter">Explore Use Cases</span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Link>
              </div>

              {/* Right Column - Tabs and Content */}
              <div className="lg:col-span-2 relative flex flex-col">
                {/* Tabs */}
                <div className="flex justify-center gap-1 mb-8">
                  <button
                    onClick={() => setActiveTab('overture')}
                    className={`px-4 py-2 text-sm font-inter transition-all ${
                      activeTab === 'overture'
                        ? 'text-gray-900 border-b border-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Overture
                  </button>
                  <button
                    onClick={() => setActiveTab('runtime')}
                    className={`px-4 py-2 text-sm font-inter transition-all ${
                      activeTab === 'runtime'
                        ? 'text-gray-900 border-b border-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Runtime
                  </button>
                  <button
                    onClick={() => setActiveTab('hybrid')}
                    className={`px-4 py-2 text-sm font-inter transition-all ${
                      activeTab === 'hybrid'
                        ? 'text-gray-900 border-b border-gray-500'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Hybrid
                  </button>
                </div>

                {/* Content Area */}
                <div className="w-full flex-1 relative z-10">
                  {activeTab === 'overture' && (
                    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
                      {/* Placeholder for Overture image */}
                    </div>
                  )}
                  {activeTab === 'runtime' && (
                    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
                      {/* Placeholder for Runtime image */}
                    </div>
                  )}
                  {activeTab === 'hybrid' && (
                    <div className="w-full h-full min-h-[400px] flex items-center justify-center">
                      {/* Placeholder for Hybrid image */}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
