'use client';

import React, { useEffect } from 'react';

interface OverturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OverturePopup({ isOpen, onClose }: OverturePopupProps) {

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
      {/* Modal Container with Shadow */}
      <div
        className="relative w-full max-w-[700px] h-[90vh] bg-[#f6f6f4] dark:bg-dark-bg shadow-[0_0_10px_rgba(255,255,255,0.04)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Hero Section */}
        <div className="flex-shrink-0 relative" style={{
          minHeight: '200px'
        }}>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r section-border" style={{
            minHeight: '200px'
          }}>
            <div className="mx-auto w-full relative z-10" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
              <div className="mb-6 text-left">
                <h1 className="text-xs md:text-sm font-medium text-[#5fdfeb] leading-[1.2] uppercase" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.1em' }}>
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

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            {/* Features Section */}
            <section className="bg-transparent text-gray-900 dark:text-white">
                <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
              <div className="grid grid-cols-1 gap-0 relative mb-0 h-[280px] border-t-0">
                 {/* Row 1 - Title Top */}
                  <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Decision Intelligence & Routing Optimization
                   </h4>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                      How the system chooses the best provider, every time.
                    </p>
                 </div>
                 {/* Features Below Title */}
                 <div className="flex flex-col py-0 pr-4">
                  <div className="mb-4 pt-0">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Thompson Sampling</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter line-clamp-3 max-w-lg">Bayesian multi-armed bandit selects optimal providers based on historical performance, balancing exploration and exploitation.</p>
                  </div>
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Cognitive Advisor</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter line-clamp-3 max-w-lg">Detects provider degradation and automatically tunes routing parameters in real time—no human in the loop.</p>
                  </div>
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Trust-Aware Selection</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter line-clamp-3 max-w-lg">Continuously scores provider honesty by comparing observed vs. reported metrics and blocks providers below trust thresholds.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Council Mode</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter line-clamp-3 max-w-lg">Executes full inference across multiple providers and applies peer ranking and consensus to reduce hallucinations and decision risk.</p>
                  </div>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                 <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Performance & Resilience
                   </h4>
                   <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                     How the system stays fast, available, and failure-proof.
                   </p>
                 </div>
                <div className="flex flex-col py-0 pr-4">
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Speculative Execution</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Executes 2–4 providers in parallel and returns the fastest response, cutting P99 latency by 40–60%.</p>
                  </div>
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Adaptive Circuit Breaker</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Fail-closed protection with OPEN / CLOSED / HALF_OPEN states to prevent cascading failures.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">High-Performance Cache</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Dragonfly-powered cache delivering 200K RPS with 4GB capacity for routing state and metadata.</p>
                  </div>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                 <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Governance, Policy & Cost Control
                   </h4>
                   <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                     How enterprises stay compliant, predictable, and in control.
                   </p>
                 </div>
                <div className="flex flex-col py-0 pr-4">
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Policy Engine</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Enforces cost ceilings, performance SLAs, compliance constraints, and geo-fencing rules at runtime.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Real-Time Cost Tracking</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Tracks per-request costs in USD with per-provider breakdowns and automatic budget enforcement.</p>
                  </div>
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                 <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Transparency & Explainability
                   </h4>
                   <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                     How decisions are auditable, defensible, and regulator-ready.
                   </p>
                 </div>
                <div className="flex flex-col py-0 pr-4">
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Explainable Decisions</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Every routing decision includes full reasoning: Thompson scores, trust scores, and applied policy constraints.</p>
                  </div>
                </div>
              </div>

              {/* Row 5 */}
              <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                 <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Observability & Diagnostics
                   </h4>
                   <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                     How operators see, debug, and trust the system in production.
                   </p>
                 </div>
                <div className="flex flex-col py-0 pr-4">
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Comprehensive Observability</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">180+ Prometheus metrics, OpenTelemetry traces, and full decision metadata for debugging, auditing, and compliance.</p>
                  </div>
                </div>
              </div>

                {/* Row 6 */}
                <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                  <div className="flex flex-col justify-start py-5">
                   <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-1 font-inter text-left">
                     Security, Isolation & Enterprise Readiness
                   </h4>
                   <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter text-left mb-4 max-w-lg">
                     How the platform scales safely across customers and teams.
                   </p>
                 </div>
                 <div className="flex flex-col py-0 pr-4">
                   <div className="pt-0">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Multi-Tenancy & BYOK</h5>
                     <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter max-w-lg">Full tenant isolation with encrypted API key storage. Customers retain ownership of provider relationships with zero lock-in.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

           {/* How It Fits Section */}
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
