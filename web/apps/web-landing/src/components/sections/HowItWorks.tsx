import React from 'react'
import Image from 'next/image'

export default function HowItWorks() {
  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center */}
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-33.33%)'
            }}></div>

            {/* Title Section - Shows first on mobile, last on desktop */}
            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                How Igris Inertial Works
              </h3>
              <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                One intelligence layer — two deployment models
              </p>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              {/* Left Column - Section Title (Desktop only) */}
              <div className="hidden lg:flex text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  How Igris Inertial Works
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                  One intelligence layer — two deployment models
                </p>
              </div>

              {/* Right Column - Diagram and Explanation */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="w-full">
                  {/* Architecture Diagram Placeholder - Replace with rendered mermaid diagram image */}
                  <div className="rounded-3xl p-6 md:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm mb-6" style={{ backgroundColor: '#ffffff' }}>
                    <div className="w-full flex items-center justify-center min-h-[400px] text-gray-400">
                      {/* TODO: Replace this with rendered architecture diagram image from architecture.mmd */}
                      <p className="text-center text-sm">Architecture diagram will be rendered here from architecture.mmd</p>
                    </div>
                  </div>

                  {/* Explanation Text */}
                  <div className="rounded-3xl p-4 md:p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-sm" style={{ backgroundColor: '#f6f6f4' }}>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                      Applications send OpenAI-compatible requests to <strong>Overture</strong>, which routes them through intelligent policy-based selection, shadow mode provider racing, and consensus voting. <strong>Runtime</strong> executes inference using cloud providers when available, or automatically falls back to local models when offline. Swarm instances coordinate via MCP for distributed resilience, while telemetry flows back to Overture for adaptive optimization.
                    </p>
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
