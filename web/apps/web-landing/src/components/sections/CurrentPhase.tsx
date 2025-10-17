import React from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

export default function CurrentPhase() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-8" style={{
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Now Available */}
              <div className="text-left">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Now Available</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Benchmark Mode — Available Now
                </h3>

                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-inter">
                  <p className="text-base leading-7">
                    <strong className="text-gray-900 dark:text-white">Simulated Providers with Real Latency & Cost:</strong> Benchmark providers simulate OpenAI and Anthropic APIs without external requests. Zero-cost testing with realistic latency profiles — no API keys required.
                  </p>

                  <p className="text-base leading-7">
                    <strong className="text-gray-900 dark:text-white">Smart Routing & Optimization:</strong> Admin-controlled phased rollout (1% → 100%) with shadow mode validation and automatic SLO guardrails.
                  </p>

                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Thompson Sampling multi-armed bandit routing</li>
                    <li>OpenAI-compatible API endpoints</li>
                    <li>Cost and latency optimization modes</li>
                    <li>Prometheus metrics and distributed tracing</li>
                  </ul>
                </div>
              </div>

              {/* Coming Soon */}
              <div className="text-left">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Coming Soon</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Live Provider Integration
                </h3>

                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-inter">
                  <p className="text-base leading-7">
                    Live integration with OpenAI and Anthropic APIs. Hybrid fallback from benchmark to real providers. Production-ready credential management.
                  </p>

                  <div className="rounded-lg p-4 border border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">Upcoming Capabilities</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      <li>Live API connections to OpenAI and Anthropic</li>
                      <li>Secure API key management with rotation</li>
                      <li>Connection validation before routing</li>
                      <li>True streaming with provider-native responses</li>
                    </ul>
                  </div>

                  <div className="mt-4">
                    <Link
                      href="/roadmap"
                      className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                      style={{ color: '#1f53d0' }}
                    >
                      View Full Roadmap
                      <ArrowUpRight className="ml-2 h-4 w-4" />
                    </Link>
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
