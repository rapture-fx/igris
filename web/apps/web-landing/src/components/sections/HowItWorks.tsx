import React, { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const borderStyle = 'var(--section-border)'

const stages = [
  {
    number: '01',
    title: 'Request',
    body: 'Send an AI task through one Igris API surface.',
    supporting: ['chat', 'tasks', 'tools'],
  },
  {
    number: '02',
    title: 'Execute',
    body: 'Igris routes the task, applies boundaries, and handles configured failure paths.',
    supporting: ['route', 'govern', 'observe'],
  },
  {
    number: '03',
    title: 'Verify',
    body: 'Receive execution metadata and signed records that can be inspected after the run.',
    supporting: ['metadata', 'receipt', 'verification'],
  },
]

export default function HowItWorks() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <section id="how-it-works" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-3 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          <div className="py-10 md:py-14">
            {/* Title and subtext */}
            <div className="mb-8">
              <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS }}>
                How it works
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] mt-2" style={{ fontFamily: SANS }}>
                From model output to verified execution.
              </p>
            </div>

            {/* Image with cards floating over */}
            <div style={{ position: 'relative', minHeight: 'clamp(480px, 60vw, 680px)' }}>
              <img
                src={isDark ? '/agent.jpeg' : '/hit.jpeg'}
                alt="How it works"
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  borderRadius: '0.5rem',
                }}
              />
              
              {/* Three stages floating over image */}
              <div className="absolute inset-0 z-10 p-4 md:p-8 flex flex-col justify-center">
                {/* Desktop: horizontal row */}
                <div className="hidden md:flex gap-4">
                  {stages.map((stage) => (
                    <div
                      key={stage.number}
                      className="rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col flex-1"
                    >
                      <div className="px-4 pt-3 pb-2.5 flex items-center gap-2" style={{ fontFamily: SANS }}>
                        <span className="text-xs text-gray-400 dark:text-[#666]" style={{ fontWeight: 400 }}>
                          {stage.number}
                        </span>
                        <span className="text-xs font-medium text-black dark:text-[#f6f6f4]">
                          {stage.title}
                        </span>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-4 pt-6 pb-8" style={{ minHeight: '220px' }}>
                        <p
                          className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed"
                          style={{ fontFamily: SANS }}
                        >
                          {stage.body}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-4">
                          {stage.supporting.map((term) => (
                            <span
                              key={term}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-gray-500 dark:text-[#a8a898]"
                              style={{ fontFamily: SANS }}
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Mobile: stacked */}
                <div className="flex flex-col gap-2.5 md:hidden">
                  {stages.map((stage) => (
                    <div
                      key={stage.number}
                      className="rounded-2xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a]"
                    >
                      <div className="px-3 pt-2.5 pb-2 flex items-center gap-2" style={{ fontFamily: SANS }}>
                        <span className="text-[11px] text-gray-400 dark:text-[#666]" style={{ fontWeight: 400 }}>
                          {stage.number}
                        </span>
                        <span className="text-[11px] font-medium text-black dark:text-[#f6f6f4]">
                          {stage.title}
                        </span>
                      </div>
                      <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-2xl px-3 pt-2.5 pb-3">
                        <p
                          className="text-[11px] text-gray-600 dark:text-[#a8a898] leading-relaxed"
                          style={{ fontFamily: SANS }}
                        >
                          {stage.body}
                        </p>
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {stage.supporting.map((term) => (
                            <span
                              key={term}
                              className="text-[9px] px-2 py-0.5 rounded-full border border-gray-200 dark:border-[#2a2a2a] bg-white dark:bg-[#1a1a1a] text-gray-500 dark:text-[#a8a898]"
                              style={{ fontFamily: SANS }}
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}