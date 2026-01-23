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
          <img src="/po.png" alt="" className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.8 }} />
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
                          <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">{useCase.problem}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">How Igris Helps</h5>
                          <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">{useCase.solution}</p>
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
