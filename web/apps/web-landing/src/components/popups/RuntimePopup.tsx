'use client';

import React, { useEffect } from 'react';

interface RuntimePopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function RuntimePopup({ isOpen, onClose }: RuntimePopupProps) {

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
                  Runtime executes AI workloads across cloud and edge environments. Maintain execution when infrastructure becomes unreliable so your AI workloads remain operational even when underlying dependencies do not.
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
              <div className="relative px-4 md:px-8 lg:px-12 py-8 flex flex-col bg-transparent border-l border-r border-b section-border">
              <h3 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-4 font-inter">
                Platform Capabilities
              </h3>

              {/* Row 1 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative mb-0 h-[280px]">
                {/* Left Column - Features */}
                <div className="flex flex-col justify-center py-5 pr-4 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Resource Safety Limits</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Enforces strict limits: max 100 tool calls, 10 recursion depth, 5 minute execution timeout, and 10MB output size.</p>
                  </div>
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Sandboxed Tool Execution</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Executes function calls in isolated environments with tool output size limits, timeouts, and safety constraints.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Deterministic Execution Envelopes</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Wraps every execution in HMAC-signed, tamper-proof envelopes with cryptographic proof of constraints.</p>
                  </div>
                </div>
                {/* Right Column - Title and Description */}
                <div className="flex flex-col justify-center py-5 pl-4">
                  <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter">
                    Safe, Sandboxed Execution
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">
                    How the system prevents runaway agents and protects infrastructure.
                  </p>
                </div>
              </div>

              {/* Row 2 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                {/* Left Column - Features */}
                <div className="flex flex-col justify-center py-5 pr-4 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Offline Operation</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Continues serving requests using local models and cached responses when network is unavailable.</p>
                  </div>
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Local Model Inference</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Runs Phi-3 and custom GGUF models locally for offline operation, privacy-sensitive workloads, and budget fallback.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">EscapeVector Semantic Cache</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Embedding-based semantic caching reduces API calls by 30-50% with similarity search and configurable TTL.</p>
                  </div>
                </div>
                {/* Right Column - Title and Description */}
                <div className="flex flex-col justify-center py-5 pl-4">
                  <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter">
                    Offline & Edge Operation
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">
                    How the system keeps working when infrastructure fails.
                  </p>
                </div>
              </div>

              {/* Row 3 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                {/* Left Column - Features */}
                <div className="flex flex-col justify-center py-5 pr-4 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                  <div className="mb-4">
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">LoRA Fine-Tuning</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">On-device fine-tuning with Metal GPU acceleration for M-series Macs. Adapters are AES-256-GCM encrypted and device-locked.</p>
                  </div>
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Device-Locked Models</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">LoRA adapters encrypted with device-specific keys cannot run on other devices, enforcing data locality.</p>
                  </div>
                </div>
                {/* Right Column - Title and Description */}
                <div className="flex flex-col justify-center py-5 pl-4">
                  <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter">
                    Adaptive Fine-Tuning
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">
                    How the system learns and improves from local data.
                  </p>
                </div>
              </div>

              {/* Row 4 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                {/* Left Column - Features */}
                <div className="flex flex-col justify-center py-5 pr-4 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Telemetry Streaming</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Streams real-time execution telemetry to Overture via gRPC, feeding Cognitive Advisor and Thompson Sampling updates.</p>
                  </div>
                </div>
                {/* Right Column - Title and Description */}
                <div className="flex flex-col justify-center py-5 pl-4">
                  <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter">
                    Telemetry & Learning
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">
                    How the system feeds data back to Overture for continuous improvement.
                  </p>
                </div>
              </div>

              {/* Row 5 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-[280px]">
                {/* Left Column - Features */}
                <div className="flex flex-col justify-center py-5 pr-4 border-r border-gray-200 dark:border-[#f6f6f4]/5">
                  <div>
                    <h5 className="text-xs font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-inter">Benchmark Fallback</h5>
                    <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">Automatically routes to simulated providers when budget exhausted, enabling zero-cost testing and development.</p>
                  </div>
                </div>
                {/* Right Column - Title and Description */}
                <div className="flex flex-col justify-center py-5 pl-4">
                  <h4 className="text-xs md:text-sm font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-inter">
                    Development & Testing
                  </h4>
                  <p className="text-xs text-gray-600 dark:text-[#c8c8b8] font-inter">
                    How teams iterate without burning budget.
                  </p>
                </div>
              </div>
            </div>
          </section>

           {/* How It Fits Section */}
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
                className="inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg w-fit"
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
