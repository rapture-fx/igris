'use client';

import React, { useEffect } from 'react';

interface OverturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OverturePopup({ isOpen, onClose }: OverturePopupProps) {
  const capabilities = [
    {
      title: 'Decision Intelligence & Routing Optimization',
      description: 'Overture routes AI requests to the right provider based on real-time performance, cost, and policy compliance.',
      how: 'Routes requests based on observed provider performance, balancing exploration of new options with proven reliability. Detects provider degradation and adjusts routing parameters within your policy constraints. Maintains control while responding to changing conditions in real time.',
      features: [
        'Performance-based routing with Thompson Sampling',
        'Automatic degradation response',
        'Trust-aware selection',
        'Council mode for reduced hallucinations'
      ]
    },
    {
      title: 'Performance & Resilience',
      description: 'Keep your AI systems fast and available even when providers fail or degrade.',
      how: 'Executes multiple providers in parallel to return the fastest response. Implements circuit breakers to prevent cascading failures. Uses high-performance caching to reduce latency and maintain routing state.',
      features: [
        'Speculative execution (2–4 providers in parallel)',
        'Adaptive circuit breaker with OPEN/CLOSED/HALF_OPEN states',
        'High-performance cache (200K RPS, 4GB capacity)',
        'P99 latency reduction of 40–60%'
      ]
    },
    {
      title: 'Governance, Policy & Cost Control',
      description: 'Enforce compliance constraints and cost limits across your AI infrastructure.',
      how: 'Policy engine enforces cost ceilings, performance SLAs, compliance constraints, and geo-fencing rules at runtime. Real-time cost tracking provides per-request visibility with per-provider breakdowns and automatic budget enforcement.',
      features: [
        'Policy engine for SLAs and compliance',
        'Real-time cost tracking in USD',
        'Automatic budget enforcement',
        'Geo-fencing and compliance constraints'
      ]
    },
    {
      title: 'Transparency & Explainability',
      description: 'Every routing decision is auditable, defensible, and regulator-ready.',
      how: 'Every routing decision includes full reasoning with performance scores, trust assessments, and applied policy constraints for complete auditability.',
      features: [
        'Explainable decisions with full reasoning',
        'Performance and trust scores',
        'Applied policy constraints',
        'Audit-ready decision logs'
      ]
    },
    {
      title: 'Observability & Diagnostics',
      description: 'See, debug, and trust the system in production with comprehensive telemetry.',
      how: 'Comprehensive observability provides 180+ Prometheus metrics, OpenTelemetry traces, and full decision metadata for debugging, auditing, and compliance.',
      features: [
        '180+ Prometheus metrics',
        'OpenTelemetry trace integration',
        'Full decision metadata',
        'Debugging and compliance ready'
      ]
    },
    {
      title: 'Security, Isolation & Enterprise Readiness',
      description: 'Scale safely across customers and teams with full tenant isolation.',
      how: 'Full tenant isolation with encrypted API key storage. Customers retain ownership of provider relationships with zero lock-in.',
      features: [
        'Multi-tenancy with full isolation',
        'Encrypted API key storage (BYOK)',
        'Zero lock-in architecture',
        'Enterprise-grade security'
      ]
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
                  Overture
                </h1>
                <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                  Make the right AI routing decision, every time.
                </h2>
                <p className="text-xs md:text-sm text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Overture evaluates policies, cost, performance, and availability to decide where AI requests should run in real time before execution, so your systems remain fast, cost-efficient, and resilient as conditions change.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
                {capabilities.map((capability, index) => (
                  <div key={capability.title} className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
                    <div className="flex flex-col justify-start">
                      <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter text-left">
                        {capability.title}
                      </h4>
                      <div className="space-y-3">
                         <div>
                           <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">What It Does</h5>
                           <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">{capability.description}</p>
                         </div>
                         <div>
                           <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">How It Works</h5>
                           <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">{capability.how}</p>
                         </div>
                        <div>
                          <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Key Features</h5>
                          <ul className="space-y-1">
                            {capability.features.map((feature) => (
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
                  Use Overture your way
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed mb-4">
                  Overture can run as a standalone decision engine or as part of full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
                </p>
                <a
                  href="https://docs.igrisinertial.com/overture"
                  className="inline-flex items-center justify-start bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg w-fit"
                >
                  Explore Documentation
                </a>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
