import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const features = [
  {
    title: 'Signed execution',
    description: 'Every decision cryptographically signed. Verify independently—without our control plane.',
  },
  {
    title: 'Fail-Safe Execution',
    description: 'An independent supervisor enforces hard limits. No in-process corruption. No silent fallback. If execution breaks its contract, it stops. The system survives.',
  },
  {
    title: 'Air-gapped operation',
    description: 'Runs indefinitely without network. Survives outages. Syncs when possible.',
  },
  {
    title: 'Verified updates',
    description: 'Cryptographic signatures required. Unsigned artifacts rejected. Compromised devices excluded automatically.',
  },
]

export default function MultiTenancy() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const cardClass = "border border-gray-200 dark:border-[rgba(246,246,244,0.08)] rounded-2xl p-6 bg-[#f9f9fa] dark:bg-[rgba(246,246,244,0.05)] hover:border-gray-300 dark:hover:border-[rgba(246,246,244,0.15)] transition-colors duration-200 flex flex-col"
  const titleClass = "text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]"
  const descClass = "text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[280px]"
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Title */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-6 md:py-8">
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              Proof is built in
            </h3>
            <Link
              href="/security"
              className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily }}
            >
              Learn More
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width border below title */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Bento grid */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-6 md:py-8">
            {/* Row 1: Signed execution (2 cols) | Fail-safe (1 col, spans 2 rows) */}
            <div className={cardClass + " md:col-span-2"} style={{ minHeight: '160px', fontFamily }}>
              <div className="mt-auto">
                <h4 className={titleClass} style={{ fontFamily }}>
                  {features[0].title}
                </h4>
                <p className={descClass} style={{ fontFamily }}>
                  {features[0].description}
                </p>
              </div>
            </div>

            {/* Tall card spanning 2 rows */}
            <div className={cardClass + " md:row-span-2"} style={{ minHeight: '160px', fontFamily }}>
              <div className="mt-auto">
                <h4 className={titleClass} style={{ fontFamily }}>
                  {features[1].title}
                </h4>
                <p className={descClass} style={{ fontFamily }}>
                  {features[1].description}
                </p>
              </div>
            </div>

            {/* Row 2: Air-gapped (1 col) | Verified (1 col) */}
            <div className={cardClass} style={{ minHeight: '160px', fontFamily }}>
              <div className="mt-auto">
                <h4 className={titleClass} style={{ fontFamily }}>
                  {features[2].title}
                </h4>
                <p className={descClass} style={{ fontFamily }}>
                  {features[2].description}
                </p>
              </div>
            </div>

            <div className={cardClass} style={{ minHeight: '160px', fontFamily }}>
              <div className="mt-auto">
                <h4 className={titleClass} style={{ fontFamily }}>
                  {features[3].title}
                </h4>
                <p className={descClass} style={{ fontFamily }}>
                  {features[3].description}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
