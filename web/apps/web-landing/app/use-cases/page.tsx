'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import Problem from '../../src/components/sections/Problem'
import AudienceFilter from '../../src/components/sections/AudienceFilter'
import UseCasesTeaser from '../../src/components/sections/UseCasesTeaser'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'

export default function UseCasesPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const useCases = [
    {
      title: 'Enterprise AI Operations',
      problem: 'Managing AI costs across teams is complex. Multiple departments use different providers, making budget control difficult. Quality varies between providers, and there is no visibility into what is working best.',
      solution: 'Overture provides multi-tenant cost tracking with hard budget limits. Each team gets isolated access with their own spending caps. Real-time dashboards show which providers deliver the best quality for each type of request. Automatic routing learns which provider to use based on actual performance.',
      features: ['Multi-tenant isolation', 'Real-time cost tracking', 'Budget enforcement', 'Quality monitoring', 'Intelligent routing']
    },
    {
      title: 'Autonomous Systems & Robotics',
      problem: 'Robots, drones, and autonomous vehicles need AI inference but cannot rely on internet connectivity. Cloud APIs fail in remote areas, underground facilities, or during network outages. Systems need to keep working offline.',
      solution: 'Runtime runs local models directly on edge devices. When cloud providers fail, it automatically switches to on-device models with no interruption. Works on Raspberry Pi, NVIDIA Jetson, and embedded systems. Swarm mode lets multiple units share context automatically.',
      features: ['Offline operation', 'Local model fallback', 'Edge deployment', 'Swarm coordination', 'Zero network dependency']
    },
    {
      title: 'Industrial Field Operations',
      problem: 'Field technicians need AI assistance in locations with poor connectivity. Manufacturing facilities have isolated networks. Equipment diagnostics require AI but cannot send data to the cloud due to latency or security policies.',
      solution: 'Runtime deploys to edge devices at each location. Operators get AI inference even when disconnected from the internet. On-device fine-tuning adapts models to specific equipment and processes. All training happens locally with encrypted storage.',
      features: ['Edge deployment', 'Offline capability', 'On-device training', 'Low latency', 'Encrypted storage']
    },
    {
      title: 'Defense & Classified Environments',
      problem: 'Military and classified facilities cannot send data to external cloud services. AI workloads need to run in air-gapped networks with no internet access. All computation must stay within secure boundaries.',
      solution: 'Runtime operates completely offline after initial model download. No telemetry, no external communication. Encrypted storage protects models and data. Multi-instance coordination works within isolated networks. Meets requirements for secure facilities.',
      features: ['Air-gapped operation', 'No telemetry', 'Encrypted storage', 'Network isolation', 'Secure deployment']
    },
    {
      title: 'Hybrid Cloud-Edge Deployments',
      problem: 'Applications need both cloud speed and edge reliability. Cloud providers fail occasionally. Network connectivity is not guaranteed. Downtime is unacceptable.',
      solution: 'Overture routes cloud traffic intelligently while Runtime provides local backup. When cloud providers fail, Runtime automatically takes over with local models. No code changes needed. Applications stay online continuously.',
      features: ['Automatic failover', 'Cloud + local routing', 'Zero downtime', 'Transparent switching', 'Unified API']
    },
    {
      title: 'Research & Prototyping',
      problem: 'Researchers need to test different models and providers quickly. Switching between APIs requires code changes. Comparing provider performance is manual work. Budget tracking is an afterthought.',
      solution: 'OpenAI-compatible API works with existing code. Switch providers through configuration, not code changes. Shadow mode compares strategies side-by-side. Cost tracking shows actual spend by provider and model. Automatic fallback to local models saves costs.',
      features: ['OpenAI-compatible API', 'Config-driven switching', 'Shadow mode testing', 'Cost comparison', 'Local model support']
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible" style={{
        backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top -100px',
        backgroundRepeat: 'no-repeat'
      }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
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

                <div className="max-w-[1100px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
                  <div className="pt-8 mb-6">
                    <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center">
                      ← Back to home
                    </Link>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left">
                        <h1 className="text-lg md:text-2xl lg:text-2xl font-medium text-[#111111] leading-[1.2]">
                          Use Cases
                        </h1>
                        <p className="text-sm md:text-base text-gray-700 max-w-2xl leading-relaxed text-left mt-6">
                          How teams use Igris Inertial for AI workloads across cloud and edge environments.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Common Challenges Section */}
          <Problem />

          {/* Intended Use Cases Section */}
          <AudienceFilter />

          {/* Use Cases Teaser Section */}
          <UseCasesTeaser />

          {/* Use Cases Sections */}
          {useCases.map((useCase, index) => (
            <section key={useCase.title} className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
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
                    <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      transform: 'translateX(-66.67%)'
                    }}></div>

                    <div className="text-left mb-6 lg:mb-0 lg:hidden">
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        {useCase.title}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                      <div className="lg:col-span-2 relative flex items-center justify-center">
                        <div className="space-y-6 w-full">
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                              The Challenge
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              {useCase.problem}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                              How Igris Helps
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              {useCase.solution}
                            </p>
                          </div>

                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                              Key Features
                            </h4>
                            <ul className="space-y-2">
                              {useCase.features.map((feature) => (
                                <li key={feature} className="text-sm text-gray-600 dark:text-gray-400 font-inter flex items-start">
                                  <span className="mr-2">•</span>
                                  <span>{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </div>

                      <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                        <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                          {useCase.title}
                        </h3>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ))}

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
