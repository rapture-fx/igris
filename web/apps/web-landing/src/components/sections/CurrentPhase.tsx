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

          {/* Content Container - 3 Column Layout */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-3 gap-6 items-start">
              
              {/* Left Column - All Text Content */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <h2 className="text-sm leading-7 text-green-600 dark:text-green-400 font-inter font-semibold">Latest from Schlep-engine</h2>
                </div>
                <h3 className="text-2xl tracking-tight font-inter mb-6" style={{ color: '#114dcd' }}>
                  Built for Production. Recently Enhanced.
                </h3>
                <p className="text-base leading-7 text-gray-700 dark:text-gray-300 font-inter mb-8">
                  Schlep Engine v1.0 delivers 40% faster processing, 20% cost reduction, and 99.9% uptime. Multi-tenant isolation, Rust optimization, and comprehensive monitoring.
                </p>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Risk-Free Development</h4>
                    <p className="text-sm leading-5 text-gray-700 dark:text-gray-300">
                      Build and test AI applications without costs. Simulation mode provides realistic responses with accurate timing for development and stress testing.
                    </p>
                  </div>
                  
                  <div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Production Safety</h4>
                    <div className="space-y-3">
                      <p className="text-sm leading-5 text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-white">Shadow Mode Validation:</strong> Go router operates normally while Rust provides parallel optimization with zero impact.
                      </p>
                      <p className="text-sm leading-5 text-gray-700 dark:text-gray-300">
                        <strong className="text-gray-900 dark:text-white">Automatic SLO Guardrails:</strong> Latency, cost, or error rate triggers automatic revert to ensure reliability.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Middle Column - Complete Control */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-6">
                  <Check className="h-5 w-5 text-green-600" />
                  <h4 className="text-sm leading-6 text-green-600 dark:text-green-400 font-inter font-semibold">Complete Control</h4>
                </div>
                
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">Your Rules</h5>
                
                <div className="space-y-6 text-gray-700 dark:text-gray-300 font-inter">
                  <div>
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Intelligent Multi-Provider Routing:</h6>
                    <p className="text-sm leading-5">
                      Route between OpenAI GPT-4, Claude 3 Opus, Claude 3.5 Sonnet and more with performance-based optimization.
                    </p>
                  </div>
                  
                  <div>
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Custom Budget Protection:</h6>
                    <p className="text-sm leading-5">
                      Set spending limits from $5 to $5000. Real-time alerts and automatic safeguards.
                    </p>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <h5 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Key Features</h5>
                  <ul className="text-sm space-y-2">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Per-request cost breakdown</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Secure API key management</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Automatic provider optimization</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <span>Comprehensive analytics</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Right Column - Recent Developments */}
              <div className="space-y-8">
                <div className="flex items-center gap-2 mb-6">
                  <Sparkles className="h-5 w-5" style={{ color: '#1f53d0' }} />
                  <h4 className="text-sm leading-6 text-gray-500 dark:text-gray-400 font-inter font-semibold">Recent Developments</h4>
                </div>
                
                <h5 className="text-lg font-semibold text-gray-900 dark:text-white mb-6" style={{ color: '#114dcd' }}>
                  Latest Features
                </h5>
                
                <div className="space-y-6 text-gray-700 dark:text-gray-300">
                  <div className="border-l-[3px] border-blue-500 pl-4">
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Multi-Tenancy</h6>
                    <p className="text-sm leading-5 mb-2">Isolated workspaces, custom domains, JWT auth</p>
                    <p className="text-sm text-blue-600">Oct 20, 2024</p>
                  </div>
                  
                  <div className="border-l-[3px] border-blue-500 pl-4">
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Rust Engine</h6>
                    <p className="text-sm leading-5 mb-2">40% faster processing, 20% cost reduction</p>
                    <p className="text-sm text-blue-600">Oct 15, 2024</p>
                  </div>
                  
                  <div className="border-l-[3px] border-blue-500 pl-4">
                    <h6 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Advanced Monitoring</h6>
                    <p className="text-sm leading-5 mb-2">Real-time metrics, Prometheus/Grafana</p>
                    <p className="text-sm text-blue-600">Oct 10, 2024</p>
                  </div>
                </div>
                
                <div>
                  <Link href="/changelog" className="text-sm text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1">
                    View all recent updates →
                  </Link>
                </div>
              </div>

            </div>
          </div>
          {/* Vertical divider lines between columns - divide entire section */}
          <div className="absolute left-1/3 top-40 bottom-40 w-px border-l border-gray-300 opacity-30 transform -translate-x-1/2 hidden lg:block"></div>
          <div className="absolute left-2/3 top-40 bottom-40 w-px border-l border-gray-300 opacity-30 transform -translate-x-1/2 hidden lg:block"></div>
        </div>
      </div>
    </section>
  )
}
