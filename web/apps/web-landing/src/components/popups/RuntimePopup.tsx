'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';

interface RuntimePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RuntimePopup({ isOpen, onClose }: RuntimePopupProps) {
  const features = [
    { title: 'Resource Safety Limits', description: 'Enforces strict limits: max 100 tool calls, 10 recursion depth, 5 minute execution timeout, and 10MB output size to prevent runaway AI agents' },
    { title: 'Deterministic Execution Envelopes', description: 'Wraps every execution in HMAC-signed, tamper-proof envelopes with cryptographic proof of constraints and audit trail' },
    { title: 'LoRA Fine-Tuning', description: 'On-device fine-tuning with Metal GPU acceleration for M-series Macs. Trained adapters are AES-256-GCM encrypted and device-locked' },
    { title: 'Local Model Inference', description: 'Runs Phi-3 and custom GGUF models locally for offline operation, privacy-sensitive workloads, and budget fallback scenarios' },
    { title: 'EscapeVector Semantic Cache', description: 'Embedding-based semantic caching reduces API calls by 30-50% with similarity search and configurable TTL' },
    { title: 'Sandboxed Tool Execution', description: 'Executes function calls in isolated environments with tool output size limits, timeouts, and safety constraints' },
    { title: 'Offline Operation', description: 'Continues serving requests using local models and cached responses when network is unavailable or cloud providers fail' },
    { title: 'Telemetry Streaming', description: 'Streams real-time execution telemetry to Overture via gRPC, feeding Cognitive Advisor and Thompson Sampling updates' },
    { title: 'Device-Locked Models', description: 'LoRA adapters encrypted with device-specific keys cannot run on other devices, enforcing data locality and preventing theft' },
    { title: 'Benchmark Fallback', description: 'Automatically routes to simulated providers when budget exhausted, enabling zero-cost testing and development' }
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
          <div className="absolute inset-0 bg-[url('/lig.png')] bg-cover bg-center opacity-40"></div>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r border-b section-border" style={{
            minHeight: '200px'
          }}>
            <div className="mx-auto w-full relative z-10" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
              <div className="mb-6 text-left">
                <h1 className="text-xs md:text-sm font-medium text-[#5fdfeb] leading-[1.2] uppercase" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.1em' }}>
                  Runtime
                </h1>
                <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                  Keep AI systems running under real-world conditions.
                </h2>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Runtime executes AI workloads across cloud and edge environments. Maintain execution when infrastructure becomes unreliable so your AI workloads remain operational even when underlying dependencies don't.
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
                      Use Runtime your way
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                      Runtime can operate as a standalone execution engine or as part of a coordinated fleet managed by Overture. Deploy it independently for edge and offline workloads, or combine it with Overture for centralized decision-making with distributed execution.
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
                        Use Runtime your way
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                        Runtime can operate as a standalone execution engine or as part of a coordinated fleet managed by Overture. Deploy it independently for edge and offline workloads, or combine it with Overture for centralized decision-making with distributed execution.
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
