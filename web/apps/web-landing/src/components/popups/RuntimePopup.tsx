'use client';

import React, { useEffect } from 'react';

interface RuntimePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RuntimePopup({ isOpen, onClose }: RuntimePopupProps) {
  const capabilities = [
    {
      title: 'Safe, Sandboxed Execution',
      description: 'Runtime prevents runaway agents and protects infrastructure with strict safety boundaries.',
      how: 'Enforces configurable limits on tool calls, recursion depth, execution time, and output size to prevent runaway behavior and resource exhaustion. Executes function calls in isolated environments with safety constraints. Wraps every execution in HMAC-signed, tamper-proof envelopes with cryptographic proof of constraints.',
      features: [
        'Configurable resource safety limits',
        'Sandboxed tool execution with timeouts',
        'Deterministic execution envelopes',
        'HMAC-signed tamper-proof constraints'
      ]
    },
    {
      title: 'Offline & Edge Operation',
      description: 'Keep working when infrastructure fails. Runtime maintains operation even without network connectivity.',
      how: 'Continues serving requests using local models and cached responses when network is unavailable. Runs Phi-3 and custom GGUF models locally for offline operation, privacy-sensitive workloads, and budget fallback. Embedding-based semantic caching reduces API calls with similarity search and configurable TTL.',
      features: [
        'Offline operation with local models',
        'Local model inference (Phi-3, GGUF)',
        'Semantic cache (30-50% API reduction)',
        'Network-independent execution'
      ]
    },
    {
      title: 'Adaptive Fine-Tuning',
      description: 'Learn from local data and improve performance without sending data to the cloud.',
      how: 'On-device fine-tuning with Metal GPU acceleration for M-series Macs. Adapters are AES-256-GCM encrypted and device-locked. LoRA adapters encrypted with device-specific keys cannot run on other devices, enforcing data locality.',
      features: [
        'LoRA fine-tuning with Metal GPU acceleration',
        'AES-256-GCM encrypted adapters',
        'Device-locked models',
        'Data locality enforcement'
      ]
    },
    {
      title: 'Telemetry & Learning',
      description: 'Feed execution data back to Overture for continuous improvement.',
      how: 'Streams real-time execution telemetry to Overture via gRPC, enabling continuous routing optimization based on observed performance and reliability.',
      features: [
        'Real-time telemetry streaming via gRPC',
        'Observed performance feedback',
        'Continuous routing optimization',
        'Reliability data collection'
      ]
    },
    {
      title: 'Development & Testing',
      description: 'Iterate and test without burning budget or making API calls.',
      how: 'Automatically routes to simulated providers when budget exhausted, enabling zero-cost testing and development.',
      features: [
        'Benchmark fallback mode',
        'Zero-cost testing',
        'Simulated provider support',
        'Budget-aware development'
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
                  Runtime
                </h1>
                <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                  Keep AI systems running under real-world conditions.
                </h2>
                <p className="text-xs md:text-sm text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                  Runtime executes AI workloads across cloud and edge environments. Maintain execution when infrastructure becomes unreliable so your AI workloads remain operational even when underlying dependencies do not.
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
                  Use Runtime your way
                </h4>
                <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed mb-4">
                  Runtime can operate as a standalone execution engine or as part of a coordinated fleet managed by Overture. Deploy it independently for edge and offline workloads, or combine it with Overture for centralized decision-making with distributed execution.
                </p>
                <a
                  href="https://docs.igrisinertial.com/runtime"
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
