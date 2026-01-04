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
import { useRouter } from 'next/navigation'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const features = [
    {
      name: 'Learn From Every Request',
      description: 'Automatically discovers which providers work best for each type of task. Routes based on real performance data, not vendor promises. Gets smarter over time without manual tuning.',
    },
    {
      name: 'Test Without Risk',
      description: 'Try new routing strategies alongside production traffic. Compare results side-by-side before making changes. Automatic rollback prevents bad updates from affecting users.',
    },
    {
      name: 'Work Offline',
      description: 'Edge instances cache routing decisions locally. Keep operating for up to 72 hours without connecting to the control plane. Encrypted state ensures security even when disconnected.',
    },
    {
      name: 'Combine Multiple Models',
      description: 'Send complex requests to several AI providers at once. One model synthesizes the best aspects of each response. Higher quality answers when correctness matters more than cost.',
    },
    {
      name: 'Control Your Spending',
      description: 'Real-time cost tracking across every provider. Hard limits that actually enforce—requests fail instead of breaking your budget. Alerts before you hit thresholds, not after.',
    },
    {
      name: 'Enterprise Isolation',
      description: 'Complete separation between tenants with encrypted API keys. Per-tenant authentication and granular permissions. Audit logs show exactly who did what and when.',
    },
  ]

  const additionalFeatures = [
    {
      name: 'One API, Every Provider',
      description: 'OpenAI, Anthropic, Gemini, Deepseek, Groq, and custom models through a single interface. Switch providers by changing one line of config. Your code stays the same.',
    },
    {
      name: 'See Everything',
      description: 'Real-time visibility into latency, cost, and errors for every request. Distributed tracing shows exactly where time is spent. Performance dashboards across all providers.',
    },
    {
      name: 'Maintain Quality',
      description: 'Automatic quality scoring for every response. Detects when providers start degrading. Shifts traffic away before your users notice problems.',
    },
    {
      name: 'Handle Failures Gracefully',
      description: 'Circuit breakers stop sending requests to failing providers. Automatic recovery when services come back. Prevents one provider outage from taking down your entire system.',
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]">
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
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

                <div className="max-w-[1100px] mx-auto pt-24 px-0 md:px-8 lg:px-16 relative z-10">
                  <div className="pt-24 mb-6">
                    <button
                      onClick={() => router.push('/')}
                      className="text-sm text-gray-600 hover:text-gray-900 hover:underline mb-4 inline-flex items-center transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      ← Back to platform
                    </button>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left md:w-2/3">
                        <h1 className="text-2xl md:text-2xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                          Overture
                        </h1>
                        <h2 className="text-lg md:text-lg lg:text-2xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Control Plane
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Route requests to the best AI provider for each task. Test changes without risking production. Control costs with hard limits that actually enforce. Built for teams running AI at scale.
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Control plane capabilities
                    </h3>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
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

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Control plane capabilities
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Additional Features */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Enterprise-grade infrastructure
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                      Monitoring, provider management, and reliability features that keep your AI operations running smoothly.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {additionalFeatures.map((feature) => (
                          <div key={feature.name} className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                            <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">{feature.name}</h5>
                            <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                              {feature.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Enterprise-grade infrastructure
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                        Monitoring, provider management, and reliability features that keep your AI operations running smoothly.
                      </p>
                    </div>
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Works with Runtime
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                      Overture handles cloud routing while Runtime provides local backup when cloud providers fail. Together they keep your AI running without interruption.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="w-full text-center">
                        <Link href="/runtime" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                          Learn about Runtime
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Works with Runtime
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                        Overture handles cloud routing while Runtime provides local backup when cloud providers fail. Together they keep your AI running without interruption.
                      </p>
                    </div>
                  </div>
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

