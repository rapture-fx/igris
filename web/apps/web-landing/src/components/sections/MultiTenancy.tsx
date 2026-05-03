import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const features = [
  {
    title: 'Signed execution records',
    description: 'Critical runs can produce signed records that capture execution metadata, route decisions, and verification material.',
  },
  {
    title: 'Failure-aware execution',
    description: 'Design tasks with explicit stop conditions, fallback paths, and verification records so failures are visible instead of silent.',
  },
  {
    title: 'Local-first operation',
    description: 'Run closer to the environment where execution happens. Keep local records available even when cloud connectivity is limited.',
  },
  {
    title: 'Verified artifacts',
    description: 'Use signed artifacts and verification checks to reduce trust in unverified updates, outputs, and execution records.',
  },
]

export default function MultiTenancy() {
  const cardClass = "landing-surface-card landing-surface-card-interactive border rounded-2xl p-6 flex flex-col"
  const titleClass = "text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]"
  const descClass = "text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[280px]"
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Title */}
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-6 md:py-8">
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              Proof is built in
            </h3>
            <Link
              href="/security"
              className="landing-surface-button inline-flex items-center justify-center px-3 py-1.5 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
              style={{ fontFamily }}
            >
              Learn More
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width border below title */}
      <div style={{ borderTop: 'var(--section-border)' }} />

      {/* Bento grid */}
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
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
      <div style={{ borderTop: 'var(--section-border)' }} />
    </section>
  )
}
