'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RuntimePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const coreCapabilities = [
    { title: 'Execute workloads', description: 'Executes AI workloads when and where they are needed' },
    { title: 'Maintain operation', description: 'Maintains operation when cloud providers, networks, or infrastructure become unavailable' },
    { title: 'Adapt automatically', description: 'Adapts to changing conditions without manual reconfiguration' },
    { title: 'Serve locally', description: 'Continues serving requests using local models or cached responses when external resources fail' }
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
                        <h1 className="text-lg md:text-xl lg:text-2xl font-medium text-[#111111] leading-[1.2]">
                          Runtime
                        </h1>
                        <h2 className="text-base md:text-lg lg:text-xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Execution that continues when infrastructure doesn't.
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Runtime executes AI workloads across cloud and edge environments — maintaining operation when providers fail, networks disconnect, or resources become constrained.
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
                    <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Keep AI systems running under real-world conditions.
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                      Production AI systems encounter provider outages, network failures, and resource constraints. Runtime exists to maintain execution when infrastructure becomes unreliable — so your AI workloads remain operational even when underlying dependencies don't.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Image (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center pl-4 md:pl-8 lg:pl-12" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <img
                        src="/runtimepage.png"
                        alt="Runtime Page"
                        className="max-w-full h-auto"
                        style={{ maxHeight: '500px', objectFit: 'contain' }}
                      />
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '13rem',
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
                    <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start pl-4 md:pl-8 lg:pl-12" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
                    }}>
                      <div className="w-full max-w-[320px] mr-auto">
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
                      paddingTop: '23rem',
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
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center pl-4 md:pl-8 lg:pl-12" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem'
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
