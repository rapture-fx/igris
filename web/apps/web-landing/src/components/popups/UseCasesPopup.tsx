'use client';

import React, { useEffect } from 'react';

interface UseCasesPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UseCasesPopup({ isOpen, onClose }: UseCasesPopupProps) {
  const useCases = [
    {
      title: 'Enterprise AI Operations',
      problem: 'Multi-tenant teams struggle with AI provider costs, quality consistency, and governance. Different departments use different providers, making budget control difficult. Provider behavior varies, and there is limited visibility into actual performance versus reported metrics.',
      solution: 'Overture provides multi-tenant isolation with policy-driven routing decisions informed by observed performance. Teams get isolated access with configurable spending limits and real-time cost tracking. Trust-aware selection blocks providers below quality thresholds.',
      features: ['Multi-tenant isolation', 'Policy-driven routing', 'Real-time cost tracking', 'Trust-aware selection', 'Budget enforcement']
    },
    {
      title: 'Hybrid Cloud–Edge Reliability',
      problem: 'Applications need both cloud performance and edge continuity. Cloud providers fail occasionally, network connectivity is unreliable, and downtime impacts critical operations. Manual failover requires code changes and operator intervention.',
      solution: 'Overture makes routing decisions in the cloud while Runtime executes on edge devices. Hybrid cryptographically binds decisions to execution, preventing policy bypass. When connectivity fails, Runtime continues with local models using the last approved routing policy.',
      features: ['Cryptographic binding', 'Automatic failover', 'Policy continuity', 'Edge execution', 'Unified API']
    },
    {
      title: 'Edge-First AI Systems',
      problem: 'Robotics, autonomous vehicles, and field equipment need AI inference in environments with poor or no connectivity. Cloud APIs fail in remote areas, underground facilities, or during outages. Systems must maintain operation with deterministic behavior.',
      solution: 'Runtime executes AI workloads directly on edge devices with deterministic execution envelopes and resource limits. Local models provide fallback when connectivity is unavailable. Peer-aware execution hooks enable coordination between nearby devices.',
      features: ['Deterministic execution', 'Local model inference', 'Offline operation', 'Resource safety limits', 'Peer coordination']
    },
    {
      title: 'Air-Gapped & Restricted Environments',
      problem: 'Secure facilities, classified networks, and regulated environments cannot send data to external services. AI workloads must run within isolated boundaries with no external communication. Models and data require encrypted storage.',
      solution: 'Runtime operates independently after provisioning, with no external telemetry by default. Encrypted storage protects models and execution data. Works within isolated networks using local coordination after initial setup.',
      features: ['No external telemetry', 'Encrypted storage', 'Isolated operation', 'Local coordination', 'Provisioned deployment']
    },
    {
      title: 'Research & Evaluation',
      problem: 'Teams need to evaluate AI providers, compare performance, and prototype workflows without production constraints. Switching between providers requires code changes. Cost tracking and performance comparison are manual processes.',
      solution: 'OpenAI-compatible API enables existing code to work unchanged. Configuration-driven provider switching and shadow testing compare strategies side-by-side. Cost tracking shows actual spend by provider and model.',
      features: ['OpenAI-compatible API', 'Configuration switching', 'Shadow mode testing', 'Cost tracking', 'Performance comparison']
    },
    {
      title: 'AI Reliability Engineering',
      problem: 'Production AI systems require visibility, auditability, and reproducibility. Teams need to understand routing decisions, verify provider behavior, and replay execution paths for debugging and compliance.',
      solution: 'Overture provides decision traces and observed vs reported provider metrics. Hybrid enables policy versioning and replayable execution paths. Every routing decision includes full reasoning and applied constraints.',
      features: ['Decision traces', 'Provider behavior verification', 'Policy versioning', 'Replayable paths', 'Audit logging']
    },
  ];

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-[#f6f6f4] dark:bg-dark-bg bg-opacity-80 dark:bg-opacity-80" onClick={onClose}>
      <div
        className="relative w-full max-w-[700px] h-[90vh] bg-[#f6f6f4] dark:bg-dark-bg shadow-[0_0_10px_rgba(255,255,255,0.04)] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 relative" style={{ minHeight: '180px' }}>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r section-border" style={{ minHeight: '180px' }}>
            <div className="mx-auto w-full relative z-10" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
              <div className="mb-6 text-left">
                <h1 className="text-xs md:text-sm font-medium text-[#5fdfeb] leading-[1.2] uppercase" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.1em' }}>
                  USE CASES
                </h1>
                <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                  How teams use Igris Inertial
                </h2>
                <p className="text-xs md:text-sm text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Real-world applications of Igris Inertial for AI workloads across cloud and edge environments.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
                {useCases.map((useCase, index) => (
                  <div key={useCase.title} className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
                    <div className="flex flex-col justify-start">
                      <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter text-left">
                        {useCase.title}
                      </h4>
                      <div className="space-y-3">
                         <div>
                           <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">The Challenge</h5>
                           <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">{useCase.problem}</p>
                         </div>
                         <div>
                           <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">How Igris Helps</h5>
                           <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">{useCase.solution}</p>
                         </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Key Features</h5>
                          <ul className="space-y-1">
                            {useCase.features.map((feature) => (
                              <li key={feature} className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter flex items-start">
                                <span className="mr-2">•</span>
                                <span>{feature}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
