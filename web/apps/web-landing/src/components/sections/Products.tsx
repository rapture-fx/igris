import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Title */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              The execution layer beneath intelligence.
            </h2>
            <Link
              href="/runtime"
              className="group inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f6f6f4', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)' }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-3 w-3" />
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width grid top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Row 1 */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Col 1 - Image */}
          <div className="p-4 md:pl-8 lg:pl-12" style={{ height: '320px', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={mounted ? (theme === 'dark' ? '/r.png' : '/prol.png') : '/prol.png'}
                alt="Runtime AI Execution"
                fill
                className="object-cover"
                style={{ opacity: 0.85 }}
              />
            </div>
          </div>
          {/* Col 2 - Text */}
          <div className="flex flex-col justify-start pt-6 pb-6 px-4 md:px-8 lg:pr-12">
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Your AI executes through structured decision paths. Language models generate decisions; the runtime enforces boundaries. Execution is deterministic and bounded—no uncontrolled behavior, no silent failures. Every decision is recorded and cryptographically verifiable.
            </p>
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Execution, intelligence, memory, and proof operate as a single system. The same runtime deploys on servers, edge devices, or robotics hardware.
            </p>
          </div>
        </div>
      </div>

      {/* Full-width middle border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Row 2 */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Col 1 - Image */}
          <div className="p-4 md:pl-8 lg:pl-12" style={{ height: '320px', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden">
              <Image
                src={mounted ? (theme === 'dark' ? '/rtnm.png' : '/prolg.png') : '/prolg.png'}
                alt="Fleet Dashboard"
                fill
                className="object-cover"
                style={{ opacity: 0.85 }}
              />
            </div>
          </div>
          {/* Col 2 - Text */}
          <div className="flex flex-col justify-start py-6 px-4 md:px-8 lg:pr-12">
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              See what's running. Know what's deciding. Understand what's learned. Prove what happened. A complete view of your AI fleet in one place—not scattered across vendor dashboards, cloud consoles, and exports.
            </p>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
