'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import TechStack from '../../src/components/sections/TechStack'
import Observability from '../../src/components/sections/Observability'
import MultiTenancy from '../../src/components/sections/MultiTenancy'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const features = [
    {
      name: 'Thompson Sampling Routing',
      description: 'Bayesian multi-armed bandit learns optimal provider selection. Beta distribution sampling with exploration/exploitation balance. Composite reward updates (latency, cost, success rate).',
    },
    {
      name: 'Shadow Mode Testing',
      description: 'Test routing strategies in parallel with production traffic. Automatic rollback on SLO violations. Zero-risk validation before deployment. Statistical significance detection.',
    },
    {
      name: 'EscapeVector Mode',
      description: '72-hour cached routing intelligence for offline operation. AES-256-GCM encrypted Bayesian state. Continues Thompson Sampling even when control plane is down.',
    },
    {
      name: 'Council Mode',
      description: 'Multi-provider consensus with peer ranking. Chairman synthesizes best response from 3-5 models. Weighted voting based on quality scores and historical performance.',
    },
    {
      name: 'Cost & Budget Control',
      description: 'Real-time cost tracking per tenant, provider, and model. Automatic budget enforcement with hard caps. Spending alerts and detailed audit logs. Cost-aware routing.',
    },
    {
      name: 'Enterprise Security',
      description: 'Multi-tenant isolation with row-level security. AES-256 encrypted API key vault. JWT authentication. RBAC with tenant-scoped permissions. Audit logging.',
    },
  ]

  const routingModes = [
    {
      name: 'Speculative Execution',
      description: 'Launch top N providers in parallel, stream from first responder. Token-level switching with <12ms P99 overhead. Automatic cancellation of slower providers. First-token timeout: 5000ms.',
    },
    {
      name: 'Thompson Sampling',
      description: 'Bayesian optimization with Beta(α,β) distributions per provider. Learns latency, cost, and success patterns. 30% cost reduction, 40% latency improvement after 100 requests.',
    },
    {
      name: 'Council Mode',
      description: 'Multi-provider consensus with anonymous peer ranking. Chairman (GPT-4, Claude Opus) synthesizes final answer. 3-5 council members. Ideal for medical, legal, financial reasoning.',
    },
    {
      name: 'Cognitive Advisor',
      description: 'Built-in intelligence layer monitors intent patterns, detects degradation, and recommends routing strategies. All changes validated in shadow mode before production.',
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
                          Cloud orchestration with intelligent routing, shadow mode testing, and multi-provider consensus. Automated cost governance, quality-aware optimization, and multi-tenant isolation for enterprise operations.
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

          {/* Core Capabilities Section */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                {/* Top left bleeding cross */}
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                {/* Bottom right bleeding cross */}
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                {/* Content Container */}
                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Smarter routing. Predictable performance.
                    </h3>
                    <p className="text-sm md:text-lg text-gray-700 dark:text-gray-300 font-inter">
                      Igris Inertial delivers adaptive, quality-aware routing with real-time cost, quota, and performance governance, ensuring efficient, resilient, and consistent AI operations at any scale.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>

                    {/* Left Column - 4x2 Grid (4 rows, 2 columns) */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full">
                        {[
                          {
                            name: 'Intelligent Quality Routing',
                            description: 'Automatically selects the best model for every request by analyzing performance, context, and historical outcomes. Optimizes for accuracy, speed, or cost based on your priorities with continuous learning built in.',
                          },
                          {
                            name: 'Adaptive Optimization Engine',
                            description: 'Real-time quality scoring detects performance shifts across providers and dynamically adjusts routing to maintain your targets. Ensures consistent output quality and predictable latency without manual tuning.',
                          },
                          {
                            name: 'Unified Control Plane',
                            description: 'One dashboard and API for cost governance, quotas, provider usage, and performance management. Multi-tenant isolation and automated failover ensure continuity even under provider outages.',
                          },
                          {
                            name: 'Zero-Risk Rollouts (Shadow Mode)',
                            description: 'Test new routing strategies in parallel with production traffic without impacting end users. Automatically rolls back unsafe behaviors to maintain SLOs and operational stability.',
                          },
                          {
                            name: 'Secure BYOK Architecture',
                            description: 'Bring your own provider keys with full data, security, and access control retained on your side. We handle routing and optimization; you keep ownership of all credentials and traffic.',
                          },
                          {
                            name: 'Parallel Execution for Speed',
                            description: 'Boost responsiveness by running multiple providers in parallel and streaming from the fastest result. Built-in fallback prevents interruptions and ensures no dropped tokens ever.',
                          },
                          {
                            name: 'Ensemble Intelligence (Council Mode)',
                            description: 'Upgrade accuracy for complex queries by running multiple models at once and synthesizing the best answer. Ideal for medical, legal, financial, and mission-critical decision workflows.',
                          },
                          {
                            name: 'Cognitive Advisor',
                            description: 'A built-in intelligence layer that monitors intent patterns, detects degradation, predicts optimal routing strategies, and recommends configuration updates, all safely validated in shadow mode.',
                          },
                        ].map((capability, index) => {
                          const hasRightBorder = index % 2 === 0;
                          const hasBottomBorder = index < 6;

                          return (
                            <div
                              key={capability.name}
                              className="p-4 relative"
                              style={{
                                padding: '20px 24px',
                                minHeight: '145px'
                              }}
                            >
                              {/* Double dashed right border */}
                              {hasRightBorder && (
                                <>
                                  <div className="absolute top-0 bottom-0 right-[2px]" style={{
                                    borderRight: '1px dashed rgba(156, 163, 175, 0.25)'
                                  }}></div>
                                  <div className="absolute top-0 bottom-0 right-[-2px]" style={{
                                    borderRight: '1px dashed rgba(156, 163, 175, 0.25)'
                                  }}></div>
                                </>
                              )}

                              {/* Double dashed bottom border */}
                              {hasBottomBorder && (
                                <>
                                  <div className="absolute left-0 right-0 bottom-[2px]" style={{
                                    borderBottom: '1px dashed rgba(156, 163, 175, 0.25)'
                                  }}></div>
                                  <div className="absolute left-0 right-0 bottom-[-2px]" style={{
                                    borderBottom: '1px dashed rgba(156, 163, 175, 0.25)'
                                  }}></div>
                                </>
                              )}
                              <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                                {capability.name}
                              </h3>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                                {capability.description}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Smarter routing. Predictable performance.
                      </h3>
                      <p className="text-sm md:text-lg text-gray-700 dark:text-gray-300 font-inter">
                        Igris Inertial optimizes every request with adaptive quality scoring, real-time cost governance, and intelligent failover. Your workloads stay fast, consistent, and fully operational even during provider instability. Below, you can see how the platform enforces safety on every optimization.
                      </p>
                    </div>
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

          {/* Multi-Tenancy */}
          <MultiTenancy />

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

