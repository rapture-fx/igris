import React from 'react'
import Link from 'next/link'
import { Check, Shield, Zap } from 'lucide-react'

export default function CurrentPhase() {
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* Production Ready */}
              <div className="text-left">
                <div className="flex items-center gap-2 mb-4">
                  <Check className="h-5 w-5 text-green-600" />
                  <h2 className="text-sm leading-7 text-green-600 dark:text-green-400 font-inter font-semibold">Production Ready</h2>
                </div>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Real Provider Integration & Safety Controls
                </h3>

                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-inter">
                  <p className="text-base leading-7">
                    <strong className="text-gray-900 dark:text-white">Live OpenAI & Anthropic Routing:</strong> Production-ready HTTP clients with retry logic, error handling, and cost tracking for GPT-4, Claude 3 Opus, Claude 3.5 Sonnet, and all major models.
                  </p>

                  <p className="text-base leading-7">
                    <strong className="text-gray-900 dark:text-white">Enterprise Safety Guardrails:</strong> Budget caps ($5 default), token limits (1024 default), fail-fast key validation, and automatic fallback to benchmark mode on errors or budget breaches.
                  </p>

                  <ul className="list-disc list-inside space-y-2 text-sm">
                    <li>Real-time cost tracking with USD per-request breakdown</li>
                    <li>BYOK validation on startup with latency measurement</li>
                    <li>Thompson Sampling optimizer (Rust) with Go fallback</li>
                    <li>Prometheus metrics and distributed tracing</li>
                  </ul>
                </div>
              </div>

              {/* Testing & Development */}
              <div className="text-left">
                <div className="flex items-center gap-2 mb-4">
                  <Zap className="h-5 w-5" style={{ color: '#1f53d0' }} />
                  <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter font-semibold">Testing & Development</h2>
                </div>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Zero-Cost Benchmark Mode
                </h3>

                <div className="space-y-4 text-gray-700 dark:text-gray-300 font-inter">
                  <p className="text-base leading-7">
                    Test routing logic without spending a dollar. Benchmark providers simulate OpenAI and Anthropic APIs with realistic latency (150-350ms) and pricing—no API keys required.
                  </p>

                  <div className="rounded-lg p-4 border border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Test Mode Safety Features
                    </h4>
                    <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      <li>Token truncation instead of rejection (developer-friendly)</li>
                      <li>Parameter safety limits (temperature, top_p)</li>
                      <li>Automatic benchmark fallback on real provider errors</li>
                      <li>Sandbox environment for experimentation</li>
                    </ul>
                  </div>

                  <div className="mt-4">
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono">
                      PROVIDER_MODE=benchmark PROVIDER_TEST_MODE=true
                    </code>
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
