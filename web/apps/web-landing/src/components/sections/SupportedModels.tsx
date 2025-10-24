import React from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const openaiModels = [
  {
    name: 'GPT-4',
    input: '$0.03 / 1K tokens',
    output: '$0.06 / 1K tokens',
    latency: 'P50: 1200ms',
  },
  {
    name: 'GPT-4 Turbo',
    input: '$0.01 / 1K tokens',
    output: '$0.03 / 1K tokens',
    latency: 'P50: 1200ms',
  },
  {
    name: 'GPT-4 Turbo Preview',
    input: '$0.01 / 1K tokens',
    output: '$0.03 / 1K tokens',
    latency: 'P50: 1200ms',
  },
  {
    name: 'GPT-3.5 Turbo',
    input: '$0.0005 / 1K tokens',
    output: '$0.0015 / 1K tokens',
    latency: 'P50: 600ms',
  },
  {
    name: 'GPT-3.5 Turbo 16K',
    input: '$0.001 / 1K tokens',
    output: '$0.002 / 1K tokens',
    latency: 'P50: 600ms',
  },
]

const anthropicModels = [
  {
    name: 'Claude 3 Opus (20240229)',
    input: '$0.015 / 1K tokens',
    output: '$0.075 / 1K tokens',
    latency: 'P50: 1800ms',
  },
  {
    name: 'Claude 3 Opus',
    input: '$0.015 / 1K tokens',
    output: '$0.075 / 1K tokens',
    latency: 'P50: 1800ms',
  },
  {
    name: 'Claude 3 Sonnet (20240229)',
    input: '$0.003 / 1K tokens',
    output: '$0.015 / 1K tokens',
    latency: 'P50: 1000ms',
  },
  {
    name: 'Claude 3 Sonnet',
    input: '$0.003 / 1K tokens',
    output: '$0.015 / 1K tokens',
    latency: 'P50: 1000ms',
  },
  {
    name: 'Claude 3 Haiku (20240307)',
    input: '$0.00025 / 1K tokens',
    output: '$0.00125 / 1K tokens',
    latency: 'P50: 400ms',
  },
  {
    name: 'Claude 3 Haiku',
    input: '$0.00025 / 1K tokens',
    output: '$0.00125 / 1K tokens',
    latency: 'P50: 400ms',
  },
]

export default function SupportedModels() {
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
            <div className="text-left mb-12">
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Supported Models & Providers</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Route across OpenAI and Anthropic models.<br />Automatic cost and latency optimization.
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Benchmark mode simulates all models with realistic latency profiles. Live API integration coming soon.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* OpenAI Models */}
              <div className="rounded-lg p-8" style={{
                backgroundColor: '#f2f1ed',
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.02) 2px,
                  rgba(0,0,0,0.02) 4px
                )`
              }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-2xl font-bold" style={{ color: '#114dcd' }}>OpenAI</div>
                  <span className="px-2 py-1 text-xs font-mono rounded" style={{ backgroundColor: '#f7f7f3', color: '#6b7280' }}>
                    Benchmark + Real
                  </span>
                </div>
                <div className="space-y-4">
                  {openaiModels.map((model) => (
                    <div key={model.name} className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f7f7f3' }}>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 font-mono">{model.name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
                        <div>
                          <span className="text-gray-500">Input:</span> {model.input}
                        </div>
                        <div>
                          <span className="text-gray-500">Output:</span> {model.output}
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Latency:</span> {model.latency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Anthropic Models */}
              <div className="rounded-lg p-8" style={{
                backgroundColor: '#f2f1ed',
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.02) 2px,
                  rgba(0,0,0,0.02) 4px
                )`
              }}>
                <div className="flex items-center gap-3 mb-6">
                  <div className="text-2xl font-bold" style={{ color: '#114dcd' }}>Anthropic</div>
                  <span className="px-2 py-1 text-xs font-mono rounded" style={{ backgroundColor: '#f7f7f3', color: '#6b7280' }}>
                    Benchmark + Real
                  </span>
                </div>
                <div className="space-y-4">
                  {anthropicModels.map((model) => (
                    <div key={model.name} className="p-4 rounded-lg border border-gray-200" style={{ backgroundColor: '#f7f7f3' }}>
                      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 font-mono">{model.name}</h4>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono text-gray-600">
                        <div>
                          <span className="text-gray-500">Input:</span> {model.input}
                        </div>
                        <div>
                          <span className="text-gray-500">Output:</span> {model.output}
                        </div>
                        <div className="col-span-2">
                          <span className="text-gray-500">Latency:</span> {model.latency}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Provider Modes */}
            <div className="mt-8 p-6 rounded-lg border border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-4 font-mono">Provider Modes (PROVIDER_MODE env var)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="text-xs font-mono">
                  <span className="font-semibold text-gray-900">mock:</span>
                  <p className="text-gray-600 mt-1">Instant responses for testing</p>
                </div>
                <div className="text-xs font-mono">
                  <span className="font-semibold text-gray-900">benchmark:</span>
                  <p className="text-gray-600 mt-1">Realistic simulation, no API calls</p>
                </div>
                <div className="text-xs font-mono">
                  <span className="font-semibold text-gray-900">real:</span>
                  <p className="text-gray-600 mt-1">Live API integration (Coming Soon)</p>
                </div>
                <div className="text-xs font-mono">
                  <span className="font-semibold text-gray-900">hybrid:</span>
                  <p className="text-gray-600 mt-1">All providers enabled</p>
                </div>
              </div>
            </div>

            {/* View Models Link */}
            <div className="mt-8 text-center">
              <Link
                href="/models"
                className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                style={{ color: '#1f53d0' }}
              >
                View All Models & Pricing
                <ArrowUpRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
