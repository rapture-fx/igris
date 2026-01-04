import React from 'react'

export default function WhatIgrisDoes() {
  const capabilities = [
    'Routes requests across providers based on cost, latency, and quality metrics',
    'Redirects traffic when a provider returns errors or timeouts',
    'Tracks spending and applies configurable budget limits',
    'Executes models locally when cloud providers are unavailable'
  ]

  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '500px'
        }}>

          {/* Content Container */}
          <div className="w-full px-0">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Control and execution layer for AI requests
                </h3>
                <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed max-w-3xl mx-auto">
                  Igris sits between applications and AI providers, handling routing decisions and model execution across cloud and edge environments.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {capabilities.map((capability, index) => (
                  <div
                    key={index}
                    className="p-5 rounded-xl border border-gray-300/60"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.4)' }}
                  >
                    <p className="text-sm text-gray-800 dark:text-gray-200 font-inter leading-relaxed">
                      {capability}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
