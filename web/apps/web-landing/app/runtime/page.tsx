'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
export default function RuntimePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const coreCapabilities = [
    { title: 'Execute workloads', description: 'Executes AI workloads when and where they are needed' },
    { title: 'Maintain operation', description: 'Maintains operation when cloud providers, networks, or infrastructure become unavailable' },
    { title: 'Adapt automatically', description: 'Adapts to changing conditions without manual reconfiguration' },
    { title: 'Serve locally', description: 'Continues serving requests using local models or cached responses when external resources fail' }
  ]

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
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">

          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]" style={{
            backgroundImage: 'url(/cloudbg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top -100px',
            backgroundRepeat: 'no-repeat'
          }}>
            <div className="absolute inset-0 pointer-events-none" style={{
              background: 'linear-gradient(to bottom, rgba(246, 246, 244, 0) 50%, rgba(246, 246, 244, 0.5) 75%, #f6f6f4 100%)'
            }}></div>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
              <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                minHeight: '600px'
              }}>
                <div className="flex-1" style={{ paddingTop: '100px' }}>
                </div>
                <div className="max-w-[1100px] mx-auto w-full" style={{ paddingBottom: '2rem' }}>
                  <div className="mb-6 text-left">
                    <div>
                      <h1 className="text-lg md:text-xl lg:text-2xl font-inter font-medium text-[#111111] leading-[1.2]" style={{ color: '#000000' }}>
                        Runtime
                      </h1>
                      <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600" style={{ color: '#000000' }}>
                        Execution that continues when infrastructure doesn't.
                      </h2>
                      <p className="text-sm md:text-base text-gray-700 max-w-md leading-relaxed text-left mt-4 font-inter">
                        Runtime executes AI workloads across cloud and edge environments — maintaining operation when providers fail, networks disconnect, or resources become constrained.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/runtime">
                      <button
                        className="inline-flex items-center justify-center bg-black text-white px-4 py-2 hover:bg-gray-800 transition-all duration-200 text-xs font-inter font-medium shadow-md hover:shadow-lg"
                        style={{ marginBottom: '5rem' }}
                      >
                        Get Started
                      </button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Purpose & Value Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Keep AI systems running under real-world conditions.
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                      Production AI systems encounter provider outages, network failures, and resource constraints. Runtime exists to maintain execution when infrastructure becomes unreliable — so your AI workloads remain operational even when underlying dependencies don't.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                     {/* Left Column (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Keep AI systems running under real-world conditions.
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Production AI systems encounter provider outages, network failures, and resource constraints. Runtime exists to maintain execution when infrastructure becomes unreliable — so your AI workloads remain operational even when underlying dependencies don't.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Capabilities Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      What Runtime does
                    </h3>

                    {/* Capabilities - Mobile */}
                    <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
                      {/* Vertical dashed line */}
                      <div className="absolute left-1.5 top-0 bottom-0" style={{
                        width: '2px',
                        backgroundImage: 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 50%, transparent 50%)',
                        backgroundSize: '2px 8px',
                        backgroundRepeat: 'repeat-y'
                      }}></div>

                      {coreCapabilities.map((capability, index) => (
                        <div key={index} className="relative">
                          {/* Dot */}
                          <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                            backgroundColor: '#f6f6f4',
                            borderColor: 'rgba(156, 163, 175, 0.6)'
                          }}></div>
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{capability.title}</h4>
                          <p className="text-sm leading-relaxed">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                   {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Image (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <div className="w-full max-w-[320px]">
                        <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-gray-400 relative pl-8">
                          {/* Vertical dashed line */}
                          <div className="absolute left-1.5 top-0 bottom-0" style={{
                            width: '2px',
                            backgroundImage: 'linear-gradient(to bottom, rgba(156, 163, 175, 0.3) 50%, transparent 50%)',
                            backgroundSize: '2px 8px',
                            backgroundRepeat: 'repeat-y'
                          }}></div>

                          {coreCapabilities.map((capability, index) => (
                            <div key={index} className="relative">
                              {/* Dot */}
                              <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2" style={{
                                backgroundColor: '#f6f6f4',
                                borderColor: 'rgba(156, 163, 175, 0.6)'
                              }}></div>
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-3">{capability.title}</h4>
                              <p className="text-sm leading-relaxed">
                                {capability.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        What Runtime does
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Fits Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Use Runtime your way
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                      Runtime can operate as a standalone execution engine or as part of a coordinated fleet managed by Overture. Deploy it independently for edge and offline workloads, or combine it with Overture for centralized decision-making with distributed execution.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                     {/* Left Column - Image (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Use Runtime your way
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Runtime can operate as a standalone execution engine or as part of a coordinated fleet managed by Overture. Deploy it independently for edge and offline workloads, or combine it with Overture for centralized decision-making with distributed execution.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', minHeight: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ minHeight: '800px' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '800px'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Mobile - Title First */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Features
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter mb-8">
                      Complete feature set verified from production codebase
                    </p>

                    {/* Features List - Mobile */}
                    <div className="space-y-6">
                      {features.map((feature, index) => (
                        <div key={index}>
                          <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-2 font-inter" style={{ color: '#000000' }}>
                            {feature.title}
                          </h4>
                          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {feature.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column layout - Desktop */}
                  <div className="hidden md:grid md:grid-cols-3 gap-0 relative md:flex-1">

                    {/* Left Column - Features List (2 columns wide) */}
                    <div className="md:col-span-2 flex flex-col justify-start" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <div className="w-full max-w-[600px]">
                        <div className="space-y-6">
                          {features.map((feature, index) => (
                            <div key={index}>
                              <h4 className="text-sm font-normal text-gray-900 dark:text-white mb-2 font-inter" style={{ color: '#000000' }}>
                                {feature.title}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                                {feature.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title (Desktop only) */}
                    <div className="md:col-span-1 flex flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem'
                    }}>
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Features
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Complete feature set verified from production codebase
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <ClosingPosition />
        </main>
        <Footer />
      </div>
      <EarlyAccessModal
        isOpen={isEarlyAccessModalOpen}
        onClose={closeEarlyAccessModal}
      />
    </>
  );
}
