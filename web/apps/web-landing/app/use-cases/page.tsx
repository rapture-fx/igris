'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import UseCasesTeaser from '../../src/components/sections/UseCasesTeaser'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'

export default function UseCasesPage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const useCases = [
    {
      id: 'internal-automation',
      title: 'Enterprise AI Operations',
      problem: 'Multi-tenant teams struggle with AI provider costs, quality consistency, and governance. Different departments use different providers, making budget control difficult. Provider behavior varies, and there is limited visibility into actual performance versus reported metrics.',
      solution: 'Igris provides multi-tenant isolation, governed execution, and policy-driven path selection informed by observed performance. Teams get isolated access, configurable spending limits, and better visibility into execution decisions and outcomes.',
      features: ['Multi-tenant isolation', 'Governed execution', 'Real-time cost tracking', 'Path-selection visibility', 'Budget enforcement']
    },
    {
      id: 'edge-ai',
      title: 'Hybrid Cloud–Edge Reliability',
      problem: 'Applications need both cloud performance and edge continuity. Cloud providers fail occasionally, network connectivity is unreliable, and downtime impacts critical operations. Manual failover requires code changes and operator intervention.',
      solution: 'Igris can coordinate hosted and local execution surfaces under one execution model. Hybrid deployments help teams keep governance and reviewability consistent across both. Stronger automatic failover claims should still be validated against current proof status.',
      features: ['Cryptographic binding', 'Visible failure paths', 'Policy continuity', 'Local execution surfaces', 'Unified API']
    },
    {
      id: 'specialized-environments',
      title: 'Edge-First AI Systems',
      problem: 'Robotics, autonomous vehicles, and field equipment need AI inference in environments with poor or no connectivity. Cloud APIs fail in remote areas, underground facilities, or during outages. Systems must maintain operation with deterministic behavior.',
      solution: 'Igris can run workloads closer to devices with bounded execution and resource limits. Local execution is useful where connectivity is constrained, but robotics and peer-coordination workflows should still be treated as preview-oriented unless separately proven.',
      features: ['Governed execution', 'Local model inference', 'Constrained environments', 'Resource safety limits', 'Preview-oriented coordination']
    },
    {
      id: 'regulated-workflows',
      title: 'Air-Gapped & Restricted Environments',
      problem: 'Secure facilities, classified networks, and regulated environments cannot send data to external services. AI workloads must run within isolated boundaries with no external communication. Models and data require encrypted storage.',
      solution: 'Local execution surfaces can operate independently after provisioning, with no external telemetry by default. Encrypted storage protects models and execution data. Teams can keep execution inside isolated networks using local coordination after initial setup.',
      features: ['No external telemetry', 'Encrypted storage', 'Isolated operation', 'Local coordination', 'Provisioned deployment']
    },
    {
      id: 'ai-agents',
      title: 'Research & Evaluation',
      problem: 'Teams need to evaluate AI providers, compare performance, and prototype workflows without production constraints. Switching between providers requires code changes. Cost tracking and performance comparison are manual processes.',
      solution: 'OpenAI-compatible API enables existing code to work unchanged. Configuration-driven provider switching and shadow testing compare strategies side-by-side. Cost tracking shows actual spend by provider and model.',
      features: ['OpenAI-compatible API', 'Configuration switching', 'Shadow mode testing', 'Cost tracking', 'Performance comparison']
    },
    {
      id: 'ai-agents-secondary',
      title: 'AI Reliability Engineering',
      problem: 'Production AI systems require visibility, auditability, and reproducibility. Teams need to understand routing decisions, verify provider behavior, and replay execution paths for debugging and compliance.',
      solution: 'Igris provides execution traces, signed records, and verification-ready receipts so teams can inspect what happened after a run. Policy versioning and execution metadata make debugging and review workflows more reliable.',
      features: ['Execution traces', 'Verification-ready receipts', 'Policy versioning', 'Replayable paths', 'Audit logging']
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px]" style={{
        borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)'
      }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
              <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible" style={{
              }}>
                <div className="max-w-[1100px] mx-auto pt-20 px-0 md:px-8 lg:px-16 pb-12">
                  <div className="text-left mb-6">
                    <Link href="/" className="text-sm text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] mb-4 inline-flex items-center transition-colors">
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

          {/* Use Cases Teaser Section */}
          <UseCasesTeaser />

          {/* Use Cases Sections */}
          {useCases.map((useCase, index) => (
            <section key={useCase.title} id={useCase.id} className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
              <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
                <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                  backgroundColor: '#f6f6f4',
                  height: '100%'
                }}>
                  <div className="w-full px-0 md:px-8 lg:px-8" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                      <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center">
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

          <ClosingPosition />
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
