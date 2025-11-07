import React from 'react'
import { Send, Zap, BarChart3, GitBranch, Cpu, Shield } from 'lucide-react'

const steps = [
  {
    name: 'API Gateway',
    description: 'Unified REST API with built-in authentication and request validation. Every request is traced and logged for complete observability.',
    icon: Send,
  },
  {
    name: 'Intelligent Routing',
    description: 'Real-time analysis of performance, cost, and availability across providers. Automatic fallback on failures ensures zero-downtime operation.',
    icon: GitBranch,
  },
  {
    name: 'Adaptive Learning',
    description: 'Thompson Sampling algorithm continuously optimizes routing decisions. Gradual rollout with shadow mode testing ensures safe deployment.',
    icon: Cpu,
  },
  {
    name: 'Safety Controls',
    description: 'Built-in budget tracking and token limits prevent runaway costs. Audit logging ensures compliance and complete cost visibility.',
    icon: Shield,
  },
]



export default function TechStack() {
  return (
    <>
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-80 px-12" style={{
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
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-24 items-center">
              {/* Left Column - SVG Diagram */}
              <div className="lg:col-span-7 flex items-center justify-center pl-8">
                <img
                  src="/okdiagar.svg"
                  alt="OK Diagram"
                  className="w-full h-full max-h-[700px] object-contain"
                />
              </div>

              {/* Right Column - Title and Description */}
              <div className="lg:col-span-5 text-left">
                <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  How Schlep-engine Works
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8 max-w-lg">
                  Schlep-Engine routes, monitors, and optimizes AI inference across providers through a unified control plane. Each layer is designed for performance, cost efficiency, and reliability at scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
