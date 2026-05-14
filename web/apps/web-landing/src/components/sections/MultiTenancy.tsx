'use client'

import React, { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

const proofs = [
  {
    num: '04.1',
    title: 'Signed execution records',
    body: 'Critical runs produce signed records that capture execution metadata, route decisions, and verification material.',
  },
  {
    num: '04.2',
    title: 'Failure-aware execution',
    body: 'Tasks carry explicit stop conditions, fallback paths, and verification records — failures become visible, not silent.',
  },
  {
    num: '04.3',
    title: 'Local-first operation',
    body: 'Run close to the environment where execution happens. Records remain available even when cloud connectivity is degraded.',
  },
  {
    num: '04.4',
    title: 'Verified artifacts',
    body: 'Signed artifacts and verification checks reduce trust in unverified updates, outputs, and execution records.',
  },
]

export default function MultiTenancy() {
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
        @keyframes mt-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .mt-item { opacity: 0; }
        .mt-item.is-in {
          animation: mt-fade-up 540ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>

      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Section anchor */}
          <div className="flex items-baseline justify-between pt-10 md:pt-14 pb-3">
            <span
              className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              04&nbsp;&nbsp;PROOF&nbsp;MODEL
            </span>
            <span
              className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              FIG.04
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-10 md:gap-x-16 pt-12 md:pt-20 pb-20 md:pb-28">

            <div className="md:col-span-5">
              <h2
                className="text-[#000000] dark:text-[#f6f6f4]"
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: 'clamp(2.25rem, 5.6vw, 4.25rem)',
                  lineHeight: 0.98,
                  letterSpacing: '-0.03em',
                }}
              >
                Proof
                <br />
                is built in.
              </h2>
              <p
                className="mt-6 text-gray-600 dark:text-[#a8a898] max-w-[32ch]"
                style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
              >
                Every execution surface in Igris emits the same verification material:
                signed records, failure markers, and continuity guarantees.
              </p>
              <Link
                href="/security"
                className="group mt-8 inline-flex items-baseline gap-2 text-[#000000] dark:text-[#f6f6f4] hover:opacity-70 transition-opacity"
                style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.22em' }}
              >
                <span aria-hidden className="inline-block w-5 border-t border-current translate-y-[-3px]" />
                READ&nbsp;THE&nbsp;PROOF&nbsp;MODEL
                <span aria-hidden className="ml-1 transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            <div className="md:col-span-7 md:pt-3">
              <ol className="flex flex-col gap-y-7 md:gap-y-9">
                {proofs.map((p, i) => (
                  <li
                    key={p.num}
                    className={`mt-item ${revealed ? 'is-in' : ''}`}
                    style={{ animationDelay: `${160 + i * 110}ms` }}
                  >
                    <div className="grid grid-cols-[64px_1fr] md:grid-cols-[88px_1fr] gap-x-4 md:gap-x-8 items-baseline">
                      <span
                        className="text-gray-500 dark:text-[#8a8a7a]"
                        style={{
                          fontFamily: MONO,
                          fontSize: 'clamp(0.95rem, 1.2vw, 1.05rem)',
                          letterSpacing: '0.02em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {p.num}
                      </span>
                      <div>
                        <h3
                          className="text-[#000000] dark:text-[#f6f6f4]"
                          style={{
                            fontFamily: SANS,
                            fontWeight: 500,
                            fontSize: 'clamp(1.125rem, 1.6vw, 1.375rem)',
                            lineHeight: 1.2,
                            letterSpacing: '-0.015em',
                          }}
                        >
                          {p.title}.
                        </h3>
                        <p
                          className="mt-2 text-gray-700 dark:text-[#c8c8b8] max-w-[54ch]"
                          style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
                        >
                          {p.body}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>

        </div>
      </div>

      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
