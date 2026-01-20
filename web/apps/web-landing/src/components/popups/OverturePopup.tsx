'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Image from 'next/image';

interface OverturePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function OverturePopup({ isOpen, onClose }: OverturePopupProps) {
  const coreCapabilities = [
    { title: 'Evaluate requests', description: 'Evaluates every AI request against policy, budget, and performance signals' },
    { title: 'Score providers', description: 'Scores available providers in real time based on current conditions' },
    { title: 'Produce decision', description: 'Produces a deterministic execution decision without running inference' },
    { title: 'Deploy flexibly', description: 'Operates independently or feeds decisions into Runtime' }
  ];

  const features = [
    { title: 'Thompson Sampling', description: 'Bayesian multi-armed bandit intelligently selects optimal AI providers based on historical performance, balancing exploration and exploitation' },
    { title: 'Speculative Execution', description: 'Launches 2-4 providers in parallel, fastest response wins. Reduces P99 latency by 40-60% automatically' },
    { title: 'Council Mode', description: 'Runs full inference on multiple providers with peer ranking and consensus selection to reduce hallucinations' },
    { title: 'Cognitive Advisor', description: 'Automatically detects provider degradation and tunes routing parameters in real-time without manual intervention' },
    { title: 'Trust-Aware Selection', description: 'Tracks provider honesty by comparing observed vs reported metrics. Automatically blocks providers with trust scores below 30%' },
    { title: 'Adaptive Circuit Breaker', description: 'Fail-closed protection with OPEN/CLOSED/HALF_OPEN states. Prevents cascading failures across providers' },
    { title: 'Policy Engine', description: 'Enforces routing rules for cost limits, performance requirements, compliance constraints, and geo-fencing' },
    { title: 'Explainable Decisions', description: 'Every routing decision includes full reasoning with Thompson scores, trust scores, and policy constraints applied' },
    { title: 'Multi-Tenancy & BYOK', description: 'Complete tenant isolation with encrypted API key storage. Users own their provider relationships with zero vendor lock-in' },
    { title: 'Real-Time Cost Tracking', description: 'Tracks every request cost in USD with per-provider breakdowns and automatic budget enforcement' },
    { title: 'High-Performance Cache', description: 'Dragonfly cache delivers 200K RPS (25x faster than Redis) with 4GB capacity for routing state and metadata' },
    { title: 'Comprehensive Observability', description: '180+ Prometheus metrics, OpenTelemetry tracing, and full decision metadata for debugging and compliance' }
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
      {/* Modal Container with Shadow */}
      <div
        className="relative w-full max-w-[700px] h-[90vh] bg-[#f6f6f4] dark:bg-dark-bg shadow-[0_0_15px_rgba(255,255,255,0.08)] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Hero Section */}
        <div className="flex-shrink-0 relative" style={{
          backgroundImage: 'url(/cloudbg.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center top -100px',
          backgroundRepeat: 'no-repeat'
        }}>
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(246,246,244,0.1)] to-[#f6f6f4] dark:from-transparent dark:via-[rgba(27,25,18,0.1)] dark:to-[#1b1912]"></div>
          <div className="absolute inset-0 bg-[url('/ov.png')] bg-cover bg-center opacity-20"></div>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r border-b section-border" style={{
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
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Overture evaluates policies, cost, performance, and availability to decide where AI requests should run in real time before execution, so your systems remain fast, cost-efficient, and resilient as conditions change.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">

          {/* Features Section */}
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ minHeight: '600px' }}>
            <div style={{ minHeight: '600px' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                minHeight: '600px'
              }}>
                <div className="w-full px-0 flex flex-col md:flex-1">
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      Features
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-[#c8c8b8] leading-relaxed font-inter mb-8">
                      Complete feature set verified from production codebase
                    </p>

                    <div className="space-y-6">
                      {features.map((feature, index) => (
                        <div key={index}>
                          <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-2 font-inter">
                            {feature.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-[#c8c8b8] leading-relaxed font-inter">
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="hidden md:grid md:grid-cols-3 gap-0 relative md:flex-1">
                    <div className="md:col-span-2 flex flex-col justify-start" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <div className="w-full max-w-[600px]">
                        <div className="space-y-6">
                          {features.map((feature, index) => (
                            <div key={index}>
                              <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-2 font-inter">
                                {feature.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-[#c8c8b8] leading-relaxed font-inter">
                                {feature.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="md:col-span-1 flex flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                        Features
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                        Complete feature set verified from production codebase
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Fits Section */}
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ minHeight: '400px' }}>
            <div style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                height: '100%'
              }}>
                <div className="w-full px-0 flex flex-col md:flex-1">
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      Use Overture your way
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                      Overture can run as a standalone decision engine or as part of full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                    </div>

                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                        Use Overture your way
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                        Overture can run as a standalone decision engine or as part of full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
