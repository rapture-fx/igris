'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

const guarantees = [
  {
    id: '05.01',
    label: 'BOUNDED',
    title: 'Controlled runs.',
    body: 'Limits, permission checks, and stop conditions evaluated before any side effect. Tasks never continue unchecked.',
  },
  {
    id: '05.02',
    label: 'STRUCTURED',
    title: 'Explicit paths.',
    body: 'Models reason; execution proceeds on defined steps, conditions, and approvals. Long-running tasks remain inspectable.',
  },
  {
    id: '05.03',
    label: 'VERIFIABLE',
    title: 'Signed records.',
    body: 'Critical runs produce signed execution records. Teams can inspect what happened and verify the outcome independently.',
  },
]

export default function CoreCapabilities() {
  const sectionRef = useRef<HTMLElement>(null)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setRevealed(true)
      return
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.18 },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <style>{`
        @keyframes cc-col-in {
          from { opacity: 0; transform: translateY(6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cc-col { opacity: 0; }
        .cc-col.is-in {
          animation: cc-col-in 540ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>

      
        <div className="px-4 md:px-8 lg:px-12">

          {/* FIG marker */}
          <div className="pt-8 pb-6 md:pt-10 md:pb-8">
            <span className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a] text-right" style={{ fontFamily: MONO }}>
              EXECUTION&nbsp;GUARANTEES
            </span>
          </div>

          <div style={{ borderTop: borderStyle }} />

          {/* Compact heading row */}
          <div className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-y-4 pt-8 md:pt-10 pb-6 md:pb-10">
            <h3
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.02em',
              }}
            >
              Three guarantees, applied to every run.
            </h3>
            <Link
              href="/core"
              className="group inline-flex items-baseline gap-2 text-[#000000] dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
              style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.22em' }}
            >
              <span aria-hidden className="inline-block w-5 border-t border-current translate-y-[-3px]" />
              READ&nbsp;THE&nbsp;CONTRACT
              <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>

          <div style={{ borderTop: borderStyle }} />

          {/* Three guarantee blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3">
            {guarantees.map((g, i) => (
              <div
                key={g.id}
                className={`cc-col ${revealed ? 'is-in' : ''} relative py-8 md:py-10`}
                style={{
                  animationDelay: `${160 + i * 120}ms`,
                  ...(i > 0 ? ({ borderTop: borderStyle } as React.CSSProperties) : {}),
                }}
              >
                {i > 0 && (
                  <span
                    aria-hidden
                    className="hidden md:block absolute top-0 bottom-0 left-0 w-px bg-[var(--section-border)]"
                  />
                )}

                <div className={`flex flex-col gap-3 ${i > 0 ? 'md:pl-8' : ''} ${i < guarantees.length - 1 ? 'md:pr-8' : ''}`}>
                  <div className="flex items-baseline justify-between">
                    <span
                      className="text-gray-500 dark:text-[#8a8a7a]"
                      style={{
                        fontFamily: MONO,
                        fontSize: '11px',
                        letterSpacing: '0.22em',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      GUARANTEE&nbsp;{g.id}
                    </span>
                    <span
                      className="text-[#000000] dark:text-[#f6f6f4]"
                      style={{
                        fontFamily: MONO,
                        fontSize: '11px',
                        letterSpacing: '0.22em',
                        fontWeight: 500,
                      }}
                    >
                      {g.label}
                    </span>
                  </div>

                  <h4
                    className="text-[#000000] dark:text-[#f6f6f4]"
                    style={{
                      fontFamily: SANS,
                      fontSize: '1.375rem',
                      lineHeight: 1.1,
                      letterSpacing: '-0.015em',
                      fontWeight: 500,
                    }}
                  >
                    {g.title}
                  </h4>

                  <p
                    className="text-gray-600 dark:text-[#a8a898] max-w-[34ch]"
                    style={{ fontFamily: SANS, fontSize: '0.925rem', lineHeight: 1.55 }}
                  >
                    {g.body}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      
  )
}
