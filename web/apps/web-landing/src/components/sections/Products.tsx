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
      {/* Full-width top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>

          {/* Title */}
          <div className="text-left mb-4" style={{ paddingTop: '3rem', paddingBottom: '1rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              The execution layer beneath intelligence.
            </h2>
          </div>

          {/* Two smaller cards side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4" style={{ paddingBottom: '2rem' }}>

            {/* First card */}
            <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 shadow-[0_0_10px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(246,246,244,0.08)] flex flex-col rounded-2xl">
              <div className="flex items-end justify-center relative rounded-2xl mb-3" style={{ height: '140px', overflow: 'hidden' }}>
                <Image
                  src={mounted ? (theme === 'dark' ? '/r.png' : '/prol.png') : '/prol.png'}
                  alt="Runtime AI Execution"
                  fill
                  className="object-cover rounded-2xl"
                  style={{ opacity: 0.85 }}
                />
              </div>
              <h3 className="text-base md:text-lg mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Hybrid behavior trees meet LLM reasoning.
              </h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Your AI executes through structured decision paths, invoking language models only when needed. Execution is deterministic and bounded—no uncontrolled behavior, no silent failures. Every decision is recorded and cryptographically verifiable.
              </p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Execution, intelligence, memory, and proof are designed to work together as one system.
                The runtime can be deployed on individual devices or across fleets.
              </p>
              <button
                onClick={openRuntime}
                className="group inline-flex items-center justify-center w-fit bg-[#14120a] text-white dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-md rounded-md"
              >
                Explore Platform
                <ChevronRight className="ml-1 h-3 w-3" />
              </button>
            </div>

            {/* Second card */}
            <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-[#f6f6f4] dark:bg-[#1b1912]/50 shadow-[0_0_10px_rgba(0,0,0,0.08)] dark:shadow-[0_0_15px_rgba(246,246,244,0.08)] flex flex-col rounded-2xl">
              <div className="flex items-end justify-center relative rounded-2xl mb-3" style={{ height: '140px', overflow: 'hidden' }}>
                <Image
                  src={mounted ? (theme === 'dark' ? '/rtnm.png' : '/prolg.png') : '/prolg.png'}
                  alt="Fleet Dashboard"
                  fill
                  className="object-cover rounded-2xl"
                  style={{ opacity: 0.85 }}
                />
              </div>
              <div className="flex-1">
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  See what's running. Know what's deciding. Understand what's learned. Prove what happened. A complete view of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and exports.
                </p>
              </div>
              <button
                onClick={openOverture}
                className="group inline-flex items-center justify-center w-fit bg-[#f6f6f4] text-[#1b1912] dark:bg-[#f6f6f4] dark:text-black px-3 py-1.5 hover:opacity-90 transition-all duration-200 text-xs font-medium shadow-md rounded-md border mt-auto"
                style={{ borderColor: 'rgba(20, 18, 10, 0.3)' }}
              >
                View Dashboard
                <ChevronRight className="ml-1 h-3 w-3" />
              </button>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
