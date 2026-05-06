'use client';

import React, { useEffect } from 'react';
import { RUNTIME_PLAN_COPY } from '../../lib/pricing';

interface UseCasesPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UseCasesPopup({ isOpen, onClose }: UseCasesPopupProps) {
  const useCases = [
    {
      title: 'IoT & Embedded Systems',
      problem: 'IoT devices need AI capabilities but lack reliable internet connectivity. Cloud APIs are too slow, expensive, and fail when networks are unavailable. Traditional solutions require heavy cloud infrastructure.',
      solution: 'Runtime deploys as a 16MB binary to any embedded device. Run GGUF models locally for instant inference. Works offline indefinitely. When connected, sync with Fleet Dashboard for monitoring and updates.',
      features: ['16MB binary fits on any device', 'Offline AI execution', 'Local GGUF model support', 'Fleet Dashboard monitoring', 'Over-the-air updates']
    },
    {
      title: 'Robotics & Autonomous Systems',
      problem: 'Robots and autonomous vehicles need deterministic AI behavior with low latency. Cloud dependencies introduce unacceptable delays and failure modes. Systems must operate in areas with poor connectivity.',
      solution: 'Runtime provides deterministic, sandboxed AI execution on-device. Sub-millisecond inference with local models. Sandboxed execution ensures safety limits. Fleet Dashboard tracks robot status and deploys model updates fleet-wide.',
      features: ['Deterministic local execution', 'Sandboxed safety limits', 'Sub-millisecond inference', 'Fleet-wide model deployment', 'Real-time status monitoring']
    },
    {
      title: 'Edge AI for SaaS Products',
      problem: 'SaaS companies need on-premise AI for enterprise customers with data privacy requirements. Customers want AI features but cannot send sensitive data to cloud providers.',
      solution: 'Bundle Runtime with your SaaS product for on-premise AI execution. Customers get AI features while keeping data local. You manage deployments through the Fleet Dashboard included with your Runtime license.',
      features: ['On-premise AI execution', 'Data stays local', 'White-label ready', 'Fleet Dashboard included', 'Simple deployment model']
    },
    {
      title: 'Remote & Air-Gapped Environments',
      problem: 'Mining operations, ships, remote facilities, and secure environments cannot rely on cloud connectivity. AI systems must operate autonomously for days or weeks without network access.',
      solution: 'Runtime works completely offline after initial setup. Models execute locally with no cloud dependencies. When connectivity is available, the Fleet Dashboard syncs logs and status. QR code pairing for field deployment.',
      features: ['100% offline capable', 'No cloud dependencies', 'Field-ready QR pairing', 'Long-duration autonomy', 'Sync when connected']
    },
    {
      title: 'Hardware Manufacturers',
      problem: 'Hardware OEMs want to add AI capabilities to their products but lack AI infrastructure expertise. Building cloud systems is expensive and distracts from core hardware development.',
      solution: 'Embed Runtime in your hardware products for instant AI capabilities. 16MB binary integrates easily. Ship with pre-loaded models or let customers add their own. Manage customer fleets through the included Dashboard.',
      features: ['Easy hardware integration', '16MB footprint', 'Pre-loaded or BYOM', 'Customer fleet management', 'No cloud build required']
    },
    {
      title: 'Development & Prototyping',
      problem: 'Developers need to test AI workloads without expensive cloud costs or complex infrastructure setup. Switching between models requires code changes and redeployment.',
      solution: 'Runtime runs locally on your laptop for zero-cost development. Test any GGUF model instantly. Same binary deploys to production devices. Fleet Dashboard provides testing insights and debugging across your dev fleet.',
      features: ['Zero-cost local development', 'Instant model switching', 'Same binary for dev/prod', 'Fleet debugging tools', 'No cloud account needed']
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
                <h1 className="text-xs md:text-sm font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.1em' }}>
                  USE CASES
                </h1>
                <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                  How teams use Igris Runtime
                </h2>
                <p className="text-xs md:text-sm text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Real-world applications of Runtime for AI execution on edge devices, with fleet visibility and coordination that scale with your plan.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
                {useCases.map((useCase) => (
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
                          <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">The Solution</h5>
                          <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">{useCase.solution}</p>
                        </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Key Capabilities</h5>
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

            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 py-8 flex flex-col bg-transparent border-l border-r border-b section-border">
                <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-3 font-inter">
                  Start with Runtime
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed mb-4">
                  Download the 16MB Runtime binary and deploy to any device. {RUNTIME_PLAN_COPY}
                </p>
                <a
                  href="https://docs.igrisinertial.com/runtime/quickstart"
                  className="inline-flex items-center justify-start bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg w-fit"
                >
                  Download Runtime
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
