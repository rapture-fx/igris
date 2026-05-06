'use client';

import React, { useEffect } from 'react';
import { RUNTIME_PLAN_COPY } from '../../lib/pricing';

interface RuntimePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RuntimePopup({ isOpen, onClose }: RuntimePopupProps) {
  const capabilities = [
    {
      title: '16MB Binary, Zero Dependencies',
      description: 'Deploy AI to any device without Docker or complex setup.',
      how: 'Single static binary compiled for Linux, macOS, and ARM architectures. No runtime dependencies, no package managers, no version conflicts. Just download and run.',
      features: [
        'Single 16MB executable',
        'Linux, macOS, ARM support',
        'No Docker required',
        'Static compilation'
      ]
    },
    {
      title: 'BYOM - Bring Your Own Model',
      description: 'Run any GGUF model locally. Use open-source models or your own fine-tuned weights.',
      how: 'Load GGUF format models from HuggingFace, local files, or your own training pipeline. Runtime handles model quantization, memory management, and inference optimization automatically.',
      features: [
        'GGUF model support',
        'Phi-3, Llama, Mistral compatible',
        '4-bit and 8-bit quantization',
        'Automatic memory management'
      ]
    },
    {
      title: 'Works Offline',
      description: 'Execute AI without internet connectivity. Perfect for remote, mobile, and air-gapped environments.',
      how: 'All inference happens locally on-device. Models run entirely in memory with no cloud calls required. Cache persists across restarts. Network outages don\'t stop execution.',
      features: [
        '100% offline operation',
        'No cloud dependencies',
        'Persistent local cache',
        'Network-fail resilient'
      ]
    },
    {
      title: 'Sandboxed Execution',
      description: 'Secure, isolated AI execution with enforced safety boundaries.',
      how: 'Every AI workload runs in a sandboxed environment with configurable limits on execution time, memory usage, and output size. Prevents resource exhaustion and runaway processes.',
      features: [
        'Resource limits enforcement',
        'Execution timeouts',
        'Memory boundaries',
        'Safe process isolation'
      ]
    },
  {
    title: 'Fleet Dashboard Integration',
    description: 'Auto-sync with fleet dashboard when online. Visibility scales with your tier.',
    how: 'When devices have connectivity, Runtime automatically syncs status, telemetry, and logs with the fleet dashboard. Push model updates and configuration changes according to your plan, from a single execution environment on Seed through multi-environment coordination on Horizon and private deployment options on Infinite.',
    features: [
      'Zero-config sync',
      'Real-time status monitoring',
      'Over-the-air model updates',
      'QR code device pairing',
      'Plan-based fleet visibility'
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
    <div className="fixed inset-0 z-[9999] bg-black/50 backdrop-blur-sm transition-opacity" onClick={onClose}>
      <div
        className="fixed right-0 top-0 h-full w-full max-w-[800px] bg-[#f6f6f4] dark:bg-dark-bg shadow-xl flex flex-col overflow-hidden transform transition-transform duration-300 ease-in-out"
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-shrink-0 relative" style={{ minHeight: '180px' }}>
          <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r section-border" style={{ minHeight: '180px' }}>
            <div className="mx-auto w-full relative z-10" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
              <div className="mb-6 text-left">
                <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', letterSpacing: '0.1em' }}>
                  Igris Runtime
                </h1>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Secure AI execution for edge devices.
                </h2>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-geist-sans">
                  Deploy AI anywhere with a 16MB binary. Run GGUF models locally, work offline, and manage your fleet from the cloud when needed. {RUNTIME_PLAN_COPY}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-hide relative">
          <div className="relative z-10">
            <section className="bg-transparent text-gray-900 dark:text-white">
              <div className="relative px-4 md:px-8 lg:px-12 pt-0 pb-8 flex flex-col bg-transparent border-l border-r border-gray-200 dark:border-[#f6f6f4]/5">
                {capabilities.map((capability) => (
                  <div key={capability.title} className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
                    <div className="flex flex-col justify-start">
                      <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-geist-sans text-left">
                        {capability.title}
                      </h4>
                      <div className="space-y-3">
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">What It Does</h5>
                          <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.description}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">How It Works</h5>
                          <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.how}</p>
                        </div>
                        <div>
                          <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">Key Features</h5>
                          <ul className="space-y-1">
                            {capability.features.map((feature) => (
                              <li key={feature} className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans flex items-start">
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
                <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-3 font-geist-sans">
                  Get Started with Runtime
                </h4>
                <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans leading-relaxed mb-4">
                  Download the Runtime binary for your platform, add your GGUF models, and deploy to any device. {RUNTIME_PLAN_COPY}
                </p>
                <a
                  href="https://docs.igrisinertial.com/runtime/quickstart"
                  className="inline-flex items-center justify-start bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-base font-medium shadow-md hover:shadow-lg w-fit"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
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
