import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Intelligent Quality Routing',
    description: 'Automatically selects the best model for every request by analyzing performance, context, and historical outcomes. Optimizes for accuracy, speed, or cost based on your priorities with continuous learning built in.',
  },
  {
    name: 'Adaptive Optimization Engine',
    description: 'Real-time quality scoring detects performance shifts across providers and dynamically adjusts routing to maintain your targets. Ensures consistent output quality and predictable latency without manual tuning.',
  },
  {
    name: 'Unified Control Plane',
    description: 'One dashboard and API for cost governance, quotas, provider usage, and performance management. Multi-tenant isolation and automated failover ensure continuity even under provider outages.',
  },
  {
    name: 'Zero-Risk Rollouts (Shadow Mode)',
    description: 'Test new routing strategies in parallel with production traffic without impacting end users. Automatically rolls back unsafe behaviors to maintain SLOs and operational stability.',
  },
  {
    name: 'Secure BYOK Architecture',
    description: 'Bring your own provider keys with full data, security, and access control retained on your side. We handle routing and optimization; you keep ownership of all credentials and traffic.',
  },
  {
    name: 'Parallel Execution for Speed',
    description: 'Boost responsiveness by running multiple providers in parallel and streaming from the fastest result. Built-in fallback prevents interruptions and ensures no dropped tokens ever.',
  },
  {
    name: 'Ensemble Intelligence (Council Mode)',
    description: 'Upgrade accuracy for complex queries by running multiple models at once and synthesizing the best answer. Ideal for medical, legal, financial, and mission-critical decision workflows.',
  },
  {
    name: 'Cognitive Advisor',
    description: 'A built-in intelligence layer that monitors intent patterns, detects degradation, predicts optimal routing strategies, and recommends configuration updates, all safely validated in shadow mode.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4'
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
              {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
            <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            transform: 'translateX(-66.67%)'
            }}></div>

            {/* Title Section - Shows first on mobile, last on desktop */}
            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Smarter routing. Predictable performance.
              </h3>
              <p className="text-sm md:text-lg text-gray-700 dark:text-gray-300 font-inter">
                Schlep-engine delivers adaptive, quality-aware routing with real-time cost, quota, and performance governance, ensuring efficient, resilient, and consistent AI operations at any scale.
              </p>
            </div>

            {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>

              {/* Left Column - 4x2 Grid (4 rows, 2 columns) */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full">
                    {capabilities.map((capability, index) => {
                      const hasRightBorder = index % 2 === 0;
                      const hasBottomBorder = index < capabilities.length - 2;

                      return (
                      <div
                        key={capability.name}
                        className="p-4 relative"
                        style={{
                          padding: '20px 24px',
                          minHeight: '145px'
                        }}
                      >
                        {/* Double dashed right border */}
                        {hasRightBorder && (
                          <>
                            <div className="absolute top-0 bottom-0 right-[2px]" style={{
                              borderRight: '1px dashed rgba(156, 163, 175, 0.25)'
                            }}></div>
                            <div className="absolute top-0 bottom-0 right-[-2px]" style={{
                              borderRight: '1px dashed rgba(156, 163, 175, 0.25)'
                            }}></div>
                          </>
                        )}

                        {/* Double dashed bottom border */}
                        {hasBottomBorder && (
                          <>
                            <div className="absolute left-0 right-0 bottom-[2px]" style={{
                              borderBottom: '1px dashed rgba(156, 163, 175, 0.25)'
                            }}></div>
                            <div className="absolute left-0 right-0 bottom-[-2px]" style={{
                              borderBottom: '1px dashed rgba(156, 163, 175, 0.25)'
                            }}></div>
                          </>
                        )}
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                          {capability.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          {capability.description}
                        </p>
                      </div>
                      )
                    })}
                  </div>
              </div>

              {/* Right Column - Section Title (Desktop only) */}
              <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Smarter routing. Predictable performance.
                </h3>
                <p className="text-sm md:text-lg text-gray-700 dark:text-gray-300 font-inter">
                  Schlep-engine delivers adaptive, quality-aware routing with real-time cost, quota, and performance governance, ensuring efficient, resilient, and consistent AI operations at any scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* New Section - Full Width Placeholder */}
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
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

          {/* Full Width Placeholder */}
          <div
            className="relative p-4 md:p-6 lg:p-8 my-4 md:my-8 lg:my-12"
            style={{
              borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderRadius: '16px',
              backgroundColor: '#f6f6f4',
              boxShadow: 'none',

              backgroundImage: `
                repeating-linear-gradient(0deg, transparent 5px, rgba(209, 213, 219, 0.3) 5px, rgba(209, 213, 219, 0.3) 6px, transparent 6px, transparent 15px),
                repeating-linear-gradient(90deg, transparent 5px, rgba(209, 213, 219, 0.3) 5px, rgba(209, 213, 219, 0.3) 6px, transparent 6px, transparent 15px)
              `,
              backgroundSize: '15px 15px',
              backgroundPosition: '5px 5px'
            }}
          >
            <div className="max-w-5xl mx-auto">
              <h4 className="text-xl md:text-2xl lg:text-3xl tracking-tight font-inter mb-6 md:mb-8 text-center" style={{ color: '#000000' }}>Fail-safe by design.</h4>

              <p className="text-base md:text-lg leading-7 md:leading-8 text-gray-700 dark:text-gray-300 mb-6 md:mb-8 font-inter text-center max-w-3xl mx-auto">
                Schlep-engine enforces automated safeguards on every optimization, validates routing decisions in real time, and isolates provider failures before they impact production. Your requests stay reliable, predictable, and fully resilient.
              </p>

              {/* 2x2 Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Card 1: EscapeVector Mode */}
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                  <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">EscapeVector Mode</h5>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 font-inter">
                    Stay online even if we go completely offline.
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    Your SDK keeps intelligent routing alive for up to 72 hours using secure cached policies. Outages don't stop your AI.
                  </p>
                </div>

                {/* Card 2: Gold Code Override */}
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                  <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">Gold Code Override</h5>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 font-inter">
                    Instant, safe, full bypass on command.
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    Set one environment variable to route traffic around our system. Enterprises get total control when needed.
                  </p>
                </div>

                {/* Card 3: SLO Enforcer */}
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                  <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">SLO Enforcer</h5>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 font-inter">
                    Your guardrails for latency, cost, and reliability.
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    We track P95, cost drift, and error rates in real time. Traffic automatically shifts to safer strategies when thresholds are hit.
                  </p>
                </div>

                {/* Card 4: Resilient Provider Health Checks */}
                <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                  <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">Resilient Provider Health Checks</h5>
                  <p className="text-xs md:text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 font-inter">
                    Know exactly when a provider is failing.
                  </p>
                  <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    We validate endpoints continuously and reroute instantly when performance drops, keeping output consistent.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
