import React from 'react'
import { Send, Zap, BarChart3, GitBranch, Cpu, Shield, AlertCircle, Activity } from 'lucide-react'

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

const safetyFeatures = [
  {
    name: 'Shadow Mode Validation',
    description: 'Go router operates normally while Rust optimizer runs in parallel (non-blocking). Decisions compared and logged. Zero impact on user requests.',
    icon: GitBranch,
  },
  {
    name: 'Automatic SLO Guardrails',
    description: 'P95 latency >10%, cost >5%, or error rate >0.5% triggers automatic revert to Go router. Manual re-enable required after investigation.',
    icon: AlertCircle,
  },
  {
    name: 'Rust Fallback Protection',
    description: 'FFI failures caught at boundary. No panic propagation. Automatic fallback to Go router ensures requests always succeed.',
    icon: Shield,
  },
  {
    name: 'Provider Health Checks',
    description: 'Continuous monitoring of provider endpoints. Request validation before routing. Health check and statistics endpoints for observability.',
    icon: Activity,
  },
]

export default function TechStack() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40 px-12" style={{
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

          {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
          <div className="absolute top-0 bottom-0 left-1/2 hidden lg:block" style={{
          borderLeft: '0.25px solid rgba(156, 163, 175, 0.3)',
          transform: 'translateX(-50%)'
          }}></div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-20 items-stretch">
          {/* Left Column - Title, Description, and Cards */}
          <div className="text-left">

                
          <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
            Intelligent Routing.<br/>Built-in cost protection.
          </h3>

          <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
          Schlep-engine automatically optimizes AI inference requests across providers with built-in budget tracking and safety controls. Adaptive learning improves performance while preventing runaway costs.
          </p>

          {/* Steps Cards */}
          <div className="space-y-8 max-w-lg relative">
          {steps.map((step, index) => (
          <div key={step.name} className="flex items-start gap-3 relative">
          {/* Git branch style line and dots on the left */}
          {index < steps.length - 1 && (
            <div className="absolute left-2.5 top-6 w-px h-24 bg-[#299a93]"></div>
          )}

          {/* Dot on the left side */}
          <div className="flex h-6 w-6 items-center justify-center flex-shrink-0 relative z-10">
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: '#299a93' }}></div>
          </div>

          {/* Card with icon inside */}
          <div key={step.name} className="flex-1 min-w-0">
          <div className="p-3 rounded-lg border border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#f6f6f4', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
          <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center flex-shrink-0 mx-auto">
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

              {/* Right Column - Safety Features */}
              <div className="text-left">
              
              <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
              Builtin safety mechanisms.<br />Deploy optimizations without risk.
              </h3>

              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
              Phased rollout with automatic guardrails. Shadow mode testing validates changes before production impact. Failures never affect user requests.
              </p>

              {/* Safety Features Features without card styling */}
              <div className="space-y-8 max-w-lg">
              {safetyFeatures.map((feature) => (
              <div key={feature.name} className="flex items-start gap-3">
              <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
              <feature.icon className="h-4 w-4 text-black" aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 break-words">
              {feature.name}
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-tight break-words">{feature.description}</p>
              </div>
              </div>
              ))}
              </div>
              </div>
              </div>
              </div>
        </div>
      </div>
    </section>
  )
}
