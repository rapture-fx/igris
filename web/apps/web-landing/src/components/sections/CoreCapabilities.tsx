import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Quality-Aware Routing',
    description: 'Every request is analyzed by domain, complexity, and sensitivity — then routed to the provider proven to deliver the best outcome. Real-time scoring ensures optimal results every time.',
  },
  {
    name: 'Adaptive Optimization Engine',
    description: 'Balances quality, cost, and latency using dynamic weighting. Users can tune preferences via API, or let Schlep-engine learn the best trade-off automatically.',
  },
  {
    name: 'Unified Control Plane',
    description: 'Centralized cost, quota, and performance governance across all tenants and providers — with built-in failover and multi-tenant isolation.',
  },
  {
    name: 'Shadow Mode Assurance',
    description: 'New routing strategies are validated safely in the background before going live, continuously improving accuracy and stability.',
  },
  {
    name: 'Secure BYOK Framework',
    description: 'Bring your own API keys — Schlep-engine handles routing, security, and optimization, while you retain complete data and provider control.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
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

            {/* Two-column layout */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              
              {/* Left Column - Vertical Text Stack */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="flex flex-col gap-4 justify-center w-full max-w-xl mx-auto">
                    {capabilities.map((capability, index) => (
                      <div
                        key={capability.name}
                        className="backdrop-blur-md bg-f6f6f4/80 dark:bg-gray-900/80 rounded-xl p-4 border border-gray-300/60 dark:border-gray-600/60 shadow-sm w-full max-w-[420px]"
                        style={{
                          padding: '20px 24px'
                        }}
                      >
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                          {capability.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          {capability.description}
                        </p>
                      </div>
                    ))}
                  </div>
              </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Smarter routing. Predictable performance.
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  From adaptive quality-aware routing to real-time quota and cost control, Schlep-engine keeps your AI stack efficient, intelligent, and fail-safe — even at scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* New Section - Full Width Placeholder */}
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '750px'
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
            className="absolute inset-4 md:inset-8 lg:inset-12 p-4 md:p-6 lg:p-8"
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
            <div className="max-w-5xl mx-auto h-full flex flex-col justify-center">
              <h4 className="text-3xl tracking-tight md:text-4xl font-inter mb-8 text-center" style={{ color: '#000000' }}>Fail-safe by design.</h4>
              
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 mb-8 font-inter text-center max-w-3xl mx-auto">
                Every optimization passes automated guardrails before rollout. Schlep-engine isolates provider failures, validates routing in real time, and continuously monitors health so no request ever gets lost.
              </p>

              {/* Asymmetric Grid Layout - 1 tall card on left, 2 stacked on right */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left - Tall Card */}
                <div className="rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300" style={{ backgroundColor: '#f6f6f4', height: '416px' }}>
                  <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Automatic SLO Guardrails</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    P95 latency >10%, cost >5%, or error rate >0.5% triggers automatic revert to Go router. Manual re-enable required after investigation.
                  </p>
                </div>

                {/* Right - Two Stacked Cards */}
                <div className="flex flex-col gap-4">
                  <div className="rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300" style={{ backgroundColor: '#f6f6f4', height: '200px' }}>
                    <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Provider Health Checks</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                      Continuous monitoring of provider endpoints. Request validation before routing. Health check and statistics endpoints for observability.
                    </p>
                  </div>

                  <div className="rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300" style={{ backgroundColor: '#f6f6f4', height: '200px' }}>
                    <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Resilient Fallback System</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                      Automatically detects and recovers from provider or runtime errors to ensure uninterrupted API responses under load.
                    </p>
                  </div>
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
