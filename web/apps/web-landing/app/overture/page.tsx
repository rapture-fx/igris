'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import Image from 'next/image'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const coreCapabilities = [
    { title: 'Evaluate requests', description: 'Evaluates every AI request against policy, budget, and performance signals' },
    { title: 'Score providers', description: 'Scores available providers in real time based on current conditions' },
    { title: 'Produce decision', description: 'Produces a deterministic execution decision without running inference' },
    { title: 'Deploy flexibly', description: 'Operates independently or feeds decisions into Runtime' }
  ]

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
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
        <Header />
        <main className="pt-[70px]">

          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px]" style={{
            backgroundImage: 'url(/cloudbg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top -100px',
            backgroundRepeat: 'no-repeat'
          }}>
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(246,246,244,0.5)] to-[#f6f6f4] dark:from-transparent dark:via-[rgba(27,25,18,0.5)] dark:to-[#1b1912]"></div>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible flex flex-col border-l border-r border-b section-border" style={{
                minHeight: '600px'
              }}>
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  <Image
                    src="/lo.png"
                    alt="Overture Decision Intelligence"
                    fill
                    className="object-cover opacity-30"
                  />
                </div>
                <div className="flex-1 relative z-10" style={{ paddingTop: '100px' }}>
                </div>
                <div className="max-w-[1100px] mx-auto w-full" style={{ paddingBottom: '2rem' }}>
                  <div className="mb-6 text-left">
                    <div>
                      <h1 className="text-lg md:text-xl lg:text-2xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                        Overture
                      </h1>
                      <h2 className="text-base md:text-lg lg:text-xl font-inter font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2">
                        Decision intelligence for AI requests — before execution.
                      </h2>
                      <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-inter">
                        Overture evaluates policies, cost, performance, and availability to decide where AI requests should run — producing execution-ready decisions for any environment.
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link href="/overture">
                      <button
                        className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-inter font-medium shadow-md hover:shadow-lg"
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
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      Make the right AI routing decision, every time.
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                      As AI systems grow across providers, regions, and cost models, static routing breaks. Overture exists to make real-time, policy-aware routing decisions before execution — so your systems remain fast, cost-efficient, and resilient as conditions change.
                    </p>
                  </div>

                   {/* Two-column layout */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{
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
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                        Make the right AI routing decision, every time.
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                        As AI systems grow across providers, regions, and cost models, static routing breaks. Overture exists to make real-time, policy-aware routing decisions before execution — so your systems remain fast, cost-efficient, and resilient as conditions change.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Features Section */}
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ minHeight: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ minHeight: '800px' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                minHeight: '800px'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Mobile - Title First */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      Features
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-[#c8c8b8] leading-relaxed font-inter mb-8">
                      Complete feature set verified from production codebase
                    </p>

                    {/* Features List - Mobile */}
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

                    {/* Right Column - Title (Desktop only) */}
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

          {/* Core Capabilities Section */}
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      What Overture does
                    </h3>

                   {/* Capabilities - Mobile */}
                     <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] relative pl-8">
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
                           <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2 bg-[#f6f6f4] dark:bg-[#1b1912] border-gray-400/60 dark:border-[#f6f6f4]/60"></div>
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

                    {/* Left Column - Capabilities (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <div className="w-full max-w-[320px]">
                        <div className="space-y-20 text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] relative pl-8">
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
                              <div className="absolute -left-8 top-1.5 w-3 h-3 rounded-full border-2 bg-[#f6f6f4] dark:bg-[#1b1912] border-gray-400/60 dark:border-[#f6f6f4]/60"></div>
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
                      <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                        What Overture does
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Fits Section */}
          <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-white" style={{ height: '800px' }}>
            <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                      Use Overture your way
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-[#c8c8b8] font-inter leading-relaxed">
                      Overture can run as a standalone decision engine or as part of full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
                    </p>
                  </div>

                  {/* Two-column layout */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Empty (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
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
