'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import TechStack from '../../src/components/sections/TechStack'
import Observability from '../../src/components/sections/Observability'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const features = [
    {
      name: 'Intelligent Routing',
      description: 'Adaptive routing with Thompson Sampling, speculative execution, and council mode. Real-time quality scoring and performance analysis across providers.',
    },
    {
      name: 'Policy Engine',
      description: 'YAML-based routing policies with cost constraints, provider allowlists, and preference settings. Per-tenant policy isolation and versioning.',
    },
    {
      name: 'Cost Governance',
      description: 'Real-time cost tracking, budget enforcement, and spending caps per tenant. Automatic cost accounting across providers and models.',
    },
    {
      name: 'Provider Abstraction',
      description: 'Unified interface for OpenAI, Anthropic, Gemini, Deepseek, and custom providers. Seamless provider switching without code changes.',
    },
    {
      name: 'Multi-Tenant Isolation',
      description: 'Complete data isolation at the database level. Per-tenant API keys, budgets, policies, and audit logs. JWT-based authentication.',
    },
    {
      name: 'Observability',
      description: 'Request tracing, latency metrics, error tracking, and cost breakdowns. Prometheus metrics and OpenTelemetry integration.',
    },
  ]

  const routingModes = [
    {
      name: 'Speculative Execution',
      description: 'Race multiple providers in parallel and stream from the fastest response. Mid-stream switching when providers fail or degrade.',
    },
    {
      name: 'Thompson Sampling',
      description: 'Bayesian multi-armed bandit optimization that learns which providers are fastest and cheapest over time. Continuous exploration and exploitation.',
    },
    {
      name: 'Council Mode',
      description: 'Run requests through multiple providers simultaneously. Chairman model synthesizes the best response for complex reasoning tasks.',
    },
    {
      name: 'Semantic Routing',
      description: 'Route based on request intent and context. Classify queries to match optimal models for specific task types.',
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-8 md:pb-20 bg-transparent z-10" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8 border-t-[0.5px] border-[#1a1e21]"></div>
                  <div className="absolute top-0 left-3.5 h-8 border-l-[0.5px] border-[#1a1e21]"></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8 border-b-[0.5px] border-[#1a1e21]"></div>
                  <div className="absolute bottom-0 right-3.5 h-8 border-r-[0.5px] border-[#1a1e21]"></div>
                </div>

                <div className="max-w-[1300px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
                  <div className="pt-8 mb-6">
                    <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center">
                      ← Back to platform
                    </Link>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                          Overture
                        </h1>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Control Plane
                        </h2>
                        <p className="text-sm md:text-lg text-gray-700 max-w-2xl leading-relaxed text-left mt-6">
                          Intelligent routing and orchestration across cloud providers. Policy-driven cost governance, quality-aware optimization, and multi-tenant isolation for enterprise LLM operations.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full">
                  <div className="text-center mb-12">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Control plane capabilities
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {features.map((feature, index) => (
                      <div
                        key={feature.name}
                        className="p-4 relative"
                        style={{
                          padding: '20px 24px',
                          minHeight: '145px'
                        }}
                      >
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                          {feature.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Routing Modes */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full">
                  <div className="text-center mb-12">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Routing modes
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                      Multiple routing strategies optimized for different use cases and performance requirements.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {routingModes.map((mode) => (
                      <div key={mode.name} className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                        <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">{mode.name}</h5>
                        <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                          {mode.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works */}
          <TechStack />

          {/* Observability */}
          <Observability />

          {/* Integration with Runtime */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full text-center">
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                    Works with Runtime
                  </h3>
                  <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto mb-8">
                    Overture coordinates with Runtime for automatic local fallback when cloud providers fail. Together, they deliver zero-downtime LLM operations.
                  </p>
                  <Link href="/runtime" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                    Learn about Runtime
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
          </section>

          <CallToAction />
        </main>
        <Footer />
      </div>
      <EarlyAccessModal
        isOpen={isEarlyAccessModalOpen}
        onClose={closeEarlyAccessModal}
      />
    </>
  );
}

