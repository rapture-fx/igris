import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useProductPopup } from '../../contexts/ProductPopupContext'

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { openOverture, openRuntime } = useProductPopup()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-t border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[800px] md:h-[850px]">

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
              01. PRODUCT
            </p>
            <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
              The complete nervous system for your AI fleet.
            </h2>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed mb-8">
              Four integrated layers that execute, decide, remember, and verify—from a single device to thousands. One platform. Complete control.
            </p>

            {/* Product Narrative - Mobile */}
            <div className="space-y-8 text-left">
              {/* Single unified product story */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6">
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1.5rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/r.png"
                    alt="Runtime AI Execution"
                    fill
                    style={{ objectFit: 'cover', opacity: 0.6 }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  Hybrid behavior trees meet LLM reasoning. Your AI executes deterministically through structured decision paths while leveraging language models only when needed. No pure hallucination. No random behavior. Just predictable intelligence that proves every decision cryptographically.
                </p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  Four layers—execution, intelligence, memory, proof—work as one nervous system. Deploy on any device. When you scale to hundreds, the dashboard reveals fleet health, routing decisions, behavior patterns, and cryptographic verification. Everything you need to run AI you can actually trust.
                </p>
                <button
                  onClick={openRuntime}
                  className="group inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  <span className="font-inter">
                    Explore Runtime
                  </span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>

              {/* Four layers working together */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-[#f6f6f4] dark:bg-[#1b1912]/50">
                <h3 className="text-base font-inter mb-3 text-[#000000] dark:text-[#f6f6f4]">
                  Four layers. One nervous system.
                </h3>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/rtnm.png"
                    alt="Fleet Dashboard"
                    fill
                    style={{ objectFit: 'cover', opacity: 0.6 }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  See what's running. Know what's deciding. Understand what's learned. Prove what happened. The complete picture of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and CSV exports.
                </p>
                <button
                  onClick={openOverture}
                  className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  <span className="font-inter">
                    View Fleet Capabilities
                  </span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 flex-1">

            {/* Left Column: Single product narrative - 2 columns wide (Desktop only) */}
            <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              <div className="w-full space-y-8">

                {/* Runtime - The complete solution */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6">
                  <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1.5rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <img
                      src="/r.png"
                      alt="Runtime AI Execution"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.6
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    Hybrid behavior trees meet LLM reasoning. Your AI executes deterministically through structured decision paths while leveraging language models only when needed. No pure hallucination. No random behavior. Just predictable intelligence that proves every decision cryptographically.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    Four layers—execution, intelligence, memory, proof—work as one nervous system. Deploy on any device. When you scale to hundreds, the dashboard reveals fleet health, routing decisions, behavior patterns, and cryptographic verification. Everything you need to run AI you can actually trust.
                  </p>
                  <button
                    onClick={openRuntime}
                    className="group inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    <span className="font-inter">
                      Explore Platform
                    </span>
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

                {/* Four layers working together */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 mb-12 bg-[#f6f6f4] dark:bg-[#1b1912]/50">
                  <h3 className="text-base font-inter mb-3 text-[#000000] dark:text-[#f6f6f4]">
                    Four layers. One nervous system.
                  </h3>
                  <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <Image
                      src="/rtnm.png"
                      alt="Fleet Dashboard"
                      fill
                      style={{ objectFit: 'cover', opacity: 0.6 }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    See what's running. Know what's deciding. Understand what's learned. Prove what happened. The complete picture of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and CSV exports.
                  </p>
                  <button
                    onClick={openOverture}
                    className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    <span className="font-inter">
                      View Dashboard
                    </span>
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

              </div>
            </div>

            {/* Right Column: Title and Description (Desktop only) */}
            <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                01. PRODUCT
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                The complete nervous system for your AI fleet.
              </h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Execution, intelligence, memory, and proof—integrated from day one. One platform that scales from a single device to thousands, revealing deeper insights as you grow.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
