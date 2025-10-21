import React from 'react'
import { Send, Zap, BarChart3 } from 'lucide-react'

const steps = [
  {
    name: 'Send Request',
    description: 'Submit AI inference requests through a unified API endpoint. Support for OpenAI, Anthropic, and other major providers.',
    icon: Send,
  },
  {
    name: 'Smart Routing',
    description: 'Engine analyzes provider performance, availability, and cost in real-time. Routes to optimal endpoint automatically.',
    icon: Zap,
  },
  {
    name: 'Learn & Optimize',
    description: 'Continuous monitoring of latency, accuracy, and reliability. System learns and adapts routing decisions over time.',
    icon: BarChart3,
  },
]

export default function TechStack() {
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
              {/* Left Column - Title, Description, and Cards */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">How It Works</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Intelligent Routing.<br/>Zero configuration optimization.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
                  Schlep-engine automatically optimizes AI inference requests across providers, learning from performance data to deliver the best results without manual intervention.
                </p>

                {/* Steps Cards */}
                <div className="space-y-2 max-w-md relative">
                  {steps.map((step, index) => (
                    <div key={step.name} className="flex items-start gap-3 relative">
                      {/* Git branch style line and dots on the left */}
                      {index < steps.length - 1 && (
                        <div className="absolute left-3 top-6 w-0.5 h-20" style={{ backgroundColor: '#299a93' }}></div>
                      )}
                      
                      {/* Dot on the left side */}
                      <div className="flex h-6 w-6 items-center justify-center flex-shrink-0 relative z-10">
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#299a93' }}></div>
                      </div>
                      
                      {/* Card with icon inside */}
                      <div key={step.name} className="flex-1 min-w-0">
                        <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#f7f7f3', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                          <div className="flex items-start gap-3">
                            <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
                              <step.icon className="h-4 w-4 text-black" aria-hidden="true" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-1 font-mono break-words">
                                {step.name}
                              </h3>
                              <p className="text-xs text-gray-700 dark:text-gray-300 leading-tight font-mono break-words">{step.description}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - SVG Diagram */}
              <div className="rounded-lg lg:col-span-3 min-h-[500px] relative overflow-hidden border border-gray-200 dark:border-gray-700 shadow-lg" style={{
                backgroundColor: '#f2f1ed'
              }}>
                <div className="relative z-10 flex items-center justify-center h-full p-8">
                  <img src="/How it works diagram.svg" alt="How It Works Diagram" className="max-w-[80%] max-h-[80%] object-contain" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
