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
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f7f7f3'
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
          <div className="absolute top-0 bottom-0 left-1/2 hidden lg:block" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          transform: 'translateX(-50%)'
          }}></div>

          {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              
              {/* Left Column - Vertical Text Stack */}
              <div className="lg:col-span-1">
              {capabilities.map((capability, index) => (
                <div key={capability.name} className="mb-6 pr-4">
                  <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                    {capability.name}
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter max-w-2xl">
                    {capability.description}
                  </p>
                  {index < capabilities.length - 1 && <div className="mt-6 border-b border-gray-300 opacity-30"></div>}
                </div>
              ))}
            </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-12 flex flex-col justify-end h-full">
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                  Built for Intelligent, Reliable AI Infrastructure
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-0" style={{ marginBottom: '-90px' }}>
                  Schlep-Engine combines adaptive routing, quota-aware control, and real-time validation to keep your AI workloads efficient and predictable — 
                  even at scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
