import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Intelligent Provider Routing',
    description: 'Smart routing across OpenAI, Anthropic, and custom models. Thompson Sampling algorithm continuously learns from performance to optimize your costs, speed, and reliability.',
    icon: () => (
      <img 
        src="/Intelligent route.svg" 
        alt="Intelligent Provider Routing" 
        className="h-56 w-56 text-black"
      />
    ),
  },
  {
    name: 'Budget Protection',
    description: 'Set custom spending limits and token caps to prevent cost overruns. Automatic alerts and budget safeguards with real-time usage tracking. Never overspend again with our protection.',
    icon: () => (
      <img 
        src="/budget protection.svg" 
        alt="Budget Protection" 
        className="h-72 w-72 text-black"
      />
    ),
  },
  {
    name: 'Bring Your Own Keys',
    description: 'Use your existing OpenAI and Anthropic API keys with confidence. Secure key management, validation, and isolation ensures we never store or share your credentials.',
    icon: () => (
      <img 
        src="/BYOK.svg" 
        alt="Bring Your Own Keys" 
        className="h-56 w-56 text-black opacity-85"
      />
    ),
  },
  {
    name: 'Risk-Free Testing',
    description: 'Test your integration at zero cost with our realistic simulation mode. Perfect for development, load testing, and feature validation without making any API calls.',
    icon: () => (
      <img 
        src="/Rsik free testing.svg" 
        alt="Risk-Free Testing" 
        className="h-60 w-60 text-black"
      />
    ),
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
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Features</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Smart AI Routing That Optimizes Your Costs
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Automatically route your AI requests to the best providers based on your preferences. Cut costs, improve performance, and never worry about overspending with our intelligent optimization engine.
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
                    {capability.name === 'Budget Protection' ? (
                      <capability.icon className="h-72 w-72 text-black" aria-hidden="true" />
                    ) : (capability.name === 'Intelligent Provider Routing' || capability.name === 'Risk-Free Testing' || capability.name === 'Bring Your Own Keys') ? (
                      <capability.icon className="h-56 w-56 text-black" aria-hidden="true" />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center">
                        <capability.icon className="h-10 w-10 text-black" aria-hidden="true" />
                      </div>
                    )}
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
