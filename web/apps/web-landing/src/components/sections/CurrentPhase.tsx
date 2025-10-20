import React from 'react'
import Link from 'next/link'
import { Check, Shield, Zap, Sparkles } from 'lucide-react'

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

          {/* Content Container - Bento Grid Layout */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-4 gap-4 auto-rows-fr" style={{ minHeight: '600px' }}>
              
              {/* Header - spans full width */}
              <div className="col-span-4 rounded-lg border border-gray-200 dark:border-gray-700 p-6" style={{
                backgroundColor: '#f2f1ed'
              }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <h2 className="text-sm leading-7 text-green-600 dark:text-green-400 font-inter font-semibold">Latest from Schlep-engine</h2>
                </div>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Built for Production. Recently Enhanced.
                </h3>
                <p className="text-base leading-7 text-gray-700 dark:text-gray-300 font-inter">
                  Schlep Engine v1.0 delivers production-grade AI inference optimization with safety mechanisms, cost controls, and multi-provider routing. Latest additions include multi-tenancy and Rust optimization.
                </p>
              </div>

              {/* Complete Control - Large card */}
              <div className="col-span-2 row-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-6 flex flex-col" style={{
                backgroundColor: '#f7f7f3',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 8px 8px -4px rgba(0, 0, 0, 0.04)'
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <Check className="h-4 w-4 text-green-600" />
                  <h4 className="text-xs leading-6 text-green-600 dark:text-green-400 font-inter font-semibold">Complete Control</h4>
                </div>
                <div className="space-y-3 text-gray-700 dark:text-gray-300 font-inter flex-grow">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white">Your Rules</h5>
                  <p className="text-xs leading-5">
                    <strong className="text-gray-900 dark:text-white">Intelligent Multi-Provider Routing:</strong> Route between OpenAI GPT-4, Claude 3 Opus, Claude 3.5 Sonnet and more with performance-based optimization.
                  </p>
                  <p className="text-xs leading-5">
                    <strong className="text-gray-900 dark:text-white">Custom Budget Protection:</strong> Set spending limits from $5 to $5000. Real-time alerts and automatic safeguards.
                  </p>
                </div>
                <div className="mt-auto">
                  <h5 className="text-xs font-semibold text-gray-900 dark:text-white mb-2">Key Features</h5>
                  <ul className="text-xs space-y-1">
                    <li>Per-request cost breakdown</li>
                    <li>Secure API key management</li>
                    <li>Automatic provider optimization</li>
                    <li>Comprehensive analytics</li>
                  </ul>
                </div>
              </div>

              {/* Recent Development - Medium card */}
              <div className="col-span-2 row-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-6" style={{
                backgroundColor: '#f2f1ed',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 8px 8px -4px rgba(0, 0, 0, 0.04)'
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="h-4 w-4" style={{ color: '#1f53d0' }} />
                  <h4 className="text-xs leading-6 text-gray-500 dark:text-gray-400 font-inter font-semibold">Recent Developments</h4>
                </div>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-4" style={{ color: '#114dcd' }}>
                  Latest Features
                </h5>
                <div className="space-y-3 text-gray-700 dark:text-gray-300">
                  <div className="border-l-[2px] border-blue-500 pl-2">
                    <h6 className="text-xs font-medium text-gray-900 dark:text-white">Multi-Tenancy</h6>
                    <p className="text-xs leading-4">Isolated workspaces, custom domains, JWT auth</p>
                    <p className="text-xs text-blue-600 mt-1">Oct 20, 2024</p>
                  </div>
                  <div className="border-l-[2px] border-blue-500 pl-2">
                    <h6 className="text-xs font-medium text-gray-900 dark:text-white">Rust Engine</h6>
                    <p className="text-xs leading-4">40% faster processing, 20% cost reduction</p>
                    <p className="text-xs text-blue-600 mt-1">Oct 15, 2024</p>
                  </div>
                  <div className="border-l-[2px] border-blue-500 pl-2">
                    <h6 className="text-xs font-medium text-gray-900 dark:text-white">Advanced Monitoring</h6>
                    <p className="text-xs leading-4">Real-time metrics, Prometheus/Grafana</p>
                    <p className="text-xs text-blue-600 mt-1">Oct 10, 2024</p>
                  </div>
                </div>
                <div className="mt-auto pt-3">
                  <Link href="/changelog" className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium">
                    View all recent updates →
                  </Link>
                </div>
              </div>

              {/* Risk-Free Development - Medium card */}
              <div className="col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-6" style={{
                backgroundColor: '#f7f7f3',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 8px 8px -4px rgba(0, 0, 0, 0.04)'
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4" style={{ color: '#1f53d0' }} />
                  <h4 className="text-xs leading-6 text-gray-500 dark:text-gray-400 font-inter font-semibold">Risk-Free Development</h4>
                </div>
                <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-3" style={{ color: '#114dcd' }}>
                  Test Without Limits, Zero Cost
                </h5>
                <div className="space-y-3 text-gray-700 dark:text-gray-300 font-inter">
                  <p className="text-xs leading-5">
                    Build and test AI applications without costs. Simulation mode provides realistic responses with accurate timing for development and stress testing.
                  </p>
                  <div className="bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    <code className="text-xs font-mono">Switch to test mode with one click</code>
                  </div>
                </div>
              </div>

              {/* Production Safety - Small card */}
              <div className="col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-6" style={{
                backgroundColor: '#f2f1ed',
                boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 8px 8px -4px rgba(0, 0, 0, 0.04)'
              }}>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-green-600" />
                  <h4 className="text-xs leading-6 text-green-600 dark:text-green-400 font-inter font-semibold">Production Safety</h4>
                </div>
                <div className="space-y-2 text-gray-700 dark:text-gray-300">
                  <p className="text-xs leading-4">
                    <strong className="text-gray-900 dark:text-white">Shadow Mode Validation:</strong> Go router operates normally while Rust provides parallel optimization with zero impact.
                  </p>
                  <p className="text-xs leading-4">
                    <strong className="text-gray-900 dark:text-white">Automatic SLO Guardrails:</strong> Latency, cost, or error rate triggers automatic revert to ensure reliability.
                  </p>
                </div>
              </div>

              

            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
