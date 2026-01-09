'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const coreCapabilities = [
    'Evaluates every AI request against policy, budget, and performance signals',
    'Scores available providers in real time based on current conditions',
    'Produces a deterministic execution decision without running inference',
    'Operates independently or feeds decisions into Runtime'
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">

          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]" style={{
            backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top -100px',
            backgroundRepeat: 'no-repeat',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)'
          }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
              }}>
                <div className="max-w-[1100px] mx-auto pt-24 px-0 md:px-8 lg:px-16 relative z-10">
                  <div className="pt-24 mb-6">
                    <button
                      onClick={() => router.push('/')}
                      className="text-sm text-gray-600 hover:text-gray-900 hover:underline mb-4 inline-flex items-center transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      ← Back to platform
                    </button>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left md:w-2/3">
                        <h1 className="text-2xl md:text-2xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                          Overture
                        </h1>
                        <h2 className="text-lg md:text-lg lg:text-2xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Decision intelligence for AI requests — before execution.
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Overture evaluates policies, cost, performance, and availability to decide where AI requests should run — producing execution-ready decisions for any environment.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Purpose & Value Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Make the right AI routing decision, every time.
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                      As AI systems grow across providers, regions, and cost models, static routing breaks. Overture exists to make real-time, policy-aware routing decisions before execution — so your systems remain fast, cost-efficient, and resilient as conditions change.
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
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Make the right AI routing decision, every time.
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        As AI systems grow across providers, regions, and cost models, static routing breaks. Overture exists to make real-time, policy-aware routing decisions before execution — so your systems remain fast, cost-efficient, and resilient as conditions change.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Capabilities Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      What Overture does
                    </h3>

                    {/* Capabilities - Mobile */}
                    <div className="space-y-4">
                      {coreCapabilities.map((capability, index) => (
                        <p key={index} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          • {capability}
                        </p>
                      ))}
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Capabilities (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[320px] mx-auto">
                        <div className="space-y-4">
                          {coreCapabilities.map((capability, index) => (
                            <p key={index} className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              • {capability}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        What Overture does
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* How It Fits Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Use Overture your way
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                      Overture can run as a standalone decision engine or as part of the full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
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
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Use Overture your way
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Overture can run as a standalone decision engine or as part of the full Igris Inertial system. Use it alone to generate routing decisions, or pair it with Runtime for end-to-end adaptive execution under real-world uncertainty.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CallToAction />
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
