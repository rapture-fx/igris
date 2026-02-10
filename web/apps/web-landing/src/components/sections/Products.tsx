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
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] min-h-[1000px]" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ letterSpacing: '0.05em', fontFamily: 'var(--font-geist-mono, "Geist Mono", monospace)' }}>
              01. PRODUCT
            </p>
            <h2 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 700, fontFamily: 'var(--font-geist-pixel-square)' }}>
              The complete nervous system for your AI fleet.
            </h2>
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-8" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Four integrated layers that execute, decide, remember, and verify—from a single device to thousands. One platform. Complete control.
            </p>

            {/* Product Narrative - Mobile */}
            <div className="space-y-8 text-left">
              {/* First frame - Top */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 min-h-[450px] flex flex-col rounded-lg">
                <div className="flex-1 flex items-end justify-center rounded" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src={mounted && theme === 'dark' ? '/r.png' : '/prol.png'}
                    alt="Runtime AI Execution"
                    fill
                    className="rounded"
                    style={{ objectFit: 'cover', opacity: 0.85 }}
                  />
                </div>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)', fontWeight: 400 }}>
                  Hybrid behavior trees meet LLM reasoning. Your AI executes through structured decision paths, invoking language models only when needed. Execution is deterministic and bounded—no uncontrolled behavior, no silent failures. Every decision is recorded and cryptographically verifiable.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Four layers—execution, intelligence, memory, and proof—work as one nervous system. Deploy on any device. As fleets grow, the dashboard reveals execution health, decision routing, behavioral patterns, and cryptographic verification across the system.
                </p>
                <button
                  onClick={openRuntime}
                  className="group inline-flex items-center justify-center w-fit bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  Explore Platform
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>

              {/* Second frame - Bottom with title */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 min-h-[450px] flex flex-col shadow-[0_0_10px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(246,246,244,0.08)] rounded-lg">
                  <h3 className="text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 700, fontFamily: 'var(--font-geist-pixel-square)' }}>
                  Four layers. One nervous system.
                </h3>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 rounded-lg" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src={mounted && theme === 'dark' ? '/rtnm.png' : '/prolg.png'}
                    alt="Fleet Dashboard"
                    fill
                    className="rounded"
                    style={{ objectFit: 'cover', opacity: 0.85 }}
                  />
                </div>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)', fontWeight: 400 }}>
                  See what's running. Know what's deciding. Understand what's learned. Prove what happened. A complete view of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and exports.
                </p>
                <button
                  onClick={openOverture}
                  className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  View Fleet Capabilities
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Split Layout: Left Content, Right Column */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 flex-1">

            {/* Left Column: Two frames - 2 columns wide */}
            <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              <div className="w-full space-y-8">

                {/* First frame - Top */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 shadow-[0_0_10px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(246,246,244,0.08)] min-h-[500px] flex flex-col rounded-lg">
                  <div className="flex-1 flex items-end justify-center relative rounded-lg" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', overflow: 'hidden' }}>
                    <Image
                      src={mounted ? (theme === 'dark' ? '/r.png' : '/prol.png') : '/prol.png'}
                      alt="Runtime AI Execution"
                      fill
                      className="object-cover rounded"
                      style={{ opacity: 0.85 }}
                    />
                  </div>
                  <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
Your AI executes through structured decision paths, invoking language models only when needed. Execution is deterministic and bounded—no uncontrolled behavior, no silent failures. Every decision is recorded and cryptographically verifiable.
                  </p>
                  <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    Execution, intelligence, memory, and proof are designed to work together as one system.
                    The runtime can be deployed on individual devices or across fleets. As scale increases, the dashboard makes execution state, decision routing, historical behavior, and verification data visible across the system.
                  </p>
                  <button
                    onClick={openRuntime}
                    className="group inline-flex items-center justify-center w-fit bg-[#14120a] text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-md rounded-md"
                  >
                    Explore Platform
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

                {/* Second frame - Bottom with title */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-[#f6f6f4] dark:bg-[#1b1912]/50 shadow-[0_0_10px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(246,246,244,0.08)] min-h-[500px] flex flex-col">
                  <div className="flex-1 flex items-end justify-center relative rounded-lg" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', overflow: 'hidden' }}>
                    <Image
                      src={mounted ? (theme === 'dark' ? '/rtnm.png' : '/prolg.png') : '/prolg.png'}
                      alt="Fleet Dashboard"
                      fill
                      className="object-cover rounded"
                      style={{ opacity: 0.85 }}
                    />
                  </div>
                  <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    See what's running. Know what's deciding. Understand what's learned. Prove what happened. A complete view of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and exports.
                  </p>
                  <button
                    onClick={openOverture}
                    className="group inline-flex items-center justify-center w-fit bg-[#f6f6f4] text-[#1b1912] dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-md rounded-md border"
                    style={{ borderColor: 'rgba(20, 18, 10, 0.3)' }}
                  >
                    View Dashboard
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

              </div>
            </div>

            {/* Right Column: Title and Description */}
            <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
            <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ letterSpacing: '0.05em', fontFamily: 'var(--font-geist-mono, "Geist Mono", monospace)' }}>
                01. PRODUCT
              </p>
            <h2 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 700, fontFamily: 'var(--font-geist-pixel-square)' }}>
                Hybrid behavior trees meet LLM reasoning.
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Execution, intelligence, memory, and proof—integrated from day one. One platform that starts on a single device and scales to fleets as adoption grows.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
