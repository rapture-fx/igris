import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Intelligent Routing Engine',
    description: 'Schlep-Engine intelligently selects the best AI provider for every request using adaptive routing logic. It balances performance, reliability, and cost automatically — no manual configuration required.',
  },
  {
    name: 'Multi-Tenant Budget Control',
    description: 'Each tenant runs within defined cost and usage limits. Real-time enforcement protects workloads from cost overruns while keeping performance stable across customers.',
  },
  {
    name: 'Smart Quota Management',
    description: 'Automatically manages token usage and rate limits across providers. Requests are adjusted on the fly to stay within quota, preventing interruptions and failed calls.',
  },
  {
    name: 'Shadow Mode Validation',
    description: 'Validate routing decisions in real time without affecting live traffic. Shadow requests run safely in the background to improve accuracy and reliability before deployment.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="relative py-8 px-12" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
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
                <div className="flex gap-4 justify-center w-full max-w-xl mx-auto">
                    <div className="flex flex-col gap-4">
                      {capabilities.slice(0, 2).map((capability, index) => (
                        <div key={capability.name} className="backdrop-blur-md bg-f6f6f4/80 dark:bg-gray-900/80 rounded-2xl p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-md" style={{ padding: '24px 20px', width: '280px', height: '180px' }} >
                          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-4">
                      {capabilities.slice(2, 4).map((capability, index) => (
                        <div key={capability.name} className="backdrop-blur-md bg-f6f6f4/80 dark:bg-gray-900/80 rounded-2xl p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-md" style={{ padding: '24px 20px', width: '280px', height: '180px' }} >
                          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-8 flex flex-col justify-end" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Built for Intelligent, Reliable AI Infrastructure
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Schlep-engine combines adaptive routing, quota-aware control, and real-time validation to keep your AI workloads efficient and predictable — even at scale.
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
        <div className="relative py-8 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '700px'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Full Width Placeholder */}
          <div 
            className="absolute inset-12 p-8"
            style={{
              border: '1px solid #d1d5db',
              borderRadius: '16px',
              backgroundColor: '#f6f6f4',
              
              backgroundImage: `
                repeating-linear-gradient(0deg, transparent, transparent 9px, rgba(209, 213, 219, 0.3) 9px, rgba(209, 213, 219, 0.3) 10px),
                repeating-linear-gradient(90deg, transparent, transparent 9px, rgba(209, 213, 219, 0.3) 9px, rgba(209, 213, 219, 0.3) 10px)
              `,
              backgroundSize: '10px 10px'
            }}
          >
            <div className="max-w-5xl mx-auto h-full flex flex-col justify-center">
              <h4 className="text-3xl tracking-tight md:text-4xl font-inter mb-8 text-center" style={{ color: '#000000' }}>Builtin safety mechanisms.</h4>
              
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 mb-8 font-inter text-center max-w-3xl mx-auto">
                Deploy optimizations without risk. Phased rollout with automatic guardrails. Shadow mode testing validates changes before production impact. Failures never affect user requests.
              </p>

              <div className="grid grid-cols-1 lg:grid-cols-2 lg:gap-8 xl:grid-cols-2 xl:gap-6 xxl:grid-cols-4 xxl:gap-4">
                <div className="backdrop-blur-xl bg-white/40 dark:bg-gray-900/40 rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Shadow Mode Validation</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    Go router operates normally while Rust optimizer runs in parallel (non-blocking). Decisions compared and logged. Zero impact on user requests.
                  </p>
                </div>

                <div className="backdrop-blur-xl bg-white/40 dark:bg-gray-900/40 rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Automatic SLO Guardrails</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    P95 latency >10%, cost >5%, or error rate >0.5% triggers automatic revert to Go router. Manual re-enable required after investigation.
                  </p>
                </div>

                <div className="backdrop-blur-xl bg-white/40 dark:bg-gray-900/40 rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Rust Fallback Protection</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    FFI failures caught at boundary. No panic propagation. Automatic fallback to Go router ensures requests always succeed.
                  </p>
                </div>

                <div className="backdrop-blur-xl bg-white/40 dark:bg-gray-900/40 rounded-3xl p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-lg hover:shadow-xl transition-all duration-300">
                  <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">Provider Health Checks</h5>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                    Continuous monitoring of provider endpoints. Request validation before routing. Health check and statistics endpoints for observability.
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
