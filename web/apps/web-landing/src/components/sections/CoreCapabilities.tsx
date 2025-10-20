import React from 'react'
import { Cpu, Zap, Shield, BarChart } from 'lucide-react'

const capabilities = [
  {
    name: 'Real Provider Routing',
    description: 'Live integration with OpenAI and Anthropic APIs. Automatic provider selection using Thompson Sampling optimization based on cost, latency, and reliability metrics.',
    icon: Cpu,
  },
  {
    name: 'Budget & Safety Controls',
    description: 'Enforce monthly spending limits, token caps per request, and automatic fallback to benchmark mode when budgets are exceeded. Enterprise-grade cost protection built-in.',
    icon: Shield,
  },
  {
    name: 'BYOK with Validation',
    description: 'Bring Your Own Keys for OpenAI and Anthropic. Pre-flight validation on startup, automatic key rotation support, and isolated provider credentials.',
    icon: Shield,
  },
  {
    name: 'Benchmark Mode',
    description: 'Zero-cost testing with simulated providers. Realistic latency and pricing models for OpenAI and Anthropic without making real API calls. No keys required.',
    icon: Zap,
  },
]

export default function CoreCapabilities() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
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
          <div className="max-w-[1300px] mx-auto">
            {/* Section Title - Above Cards */}
            <div className="text-left mb-12">
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Enterprise Features</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Production-Ready AI Routing with Cost and Safety Controls
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Built for teams that need cost visibility, budget protection, and reliable multi-provider failover. Bring your own API keys or test with zero-cost benchmark mode.
              </p>
            </div>

            {/* Horizontal Cards Stack */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {capabilities.map((capability) => (
                <div
                  key={capability.name}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between overflow-hidden"
                  style={{
                    backgroundColor: '#f7f7f3',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    minHeight: '400px'
                  }}
                >
                  {/* Icon at top with background pattern */}
                  <div
                    className="flex-1 flex items-center justify-center p-8"
                    style={{
                      backgroundColor: '#f2f1ed',
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 2px,
                        rgba(0,0,0,0.02) 2px,
                        rgba(0,0,0,0.02) 4px
                      )`
                    }}
                  >
                    <div className="flex h-16 w-16 items-center justify-center">
                      <capability.icon className="h-10 w-10 text-black" aria-hidden="true" />
                    </div>
                  </div>

                  {/* Title and Description at Bottom */}
                  <div className="p-6" style={{ backgroundColor: '#f7f7f3' }}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                      {capability.name}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                      {capability.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
