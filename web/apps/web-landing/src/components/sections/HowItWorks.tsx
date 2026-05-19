'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

const stages = [
  {
    num: '02.1',
    title: 'Run',
    body: 'Submit a task. Igris executes it against real systems with limits, permissions, and stop conditions applied before any side effect.',
  },
  {
    num: '02.2',
    title: 'Recover',
    body: 'When a step fails, Igris checkpoints progress and falls back to a recovery path. The run keeps moving instead of failing silently.',
  },
  {
    num: '02.3',
    title: 'Verify',
    body: 'Every run produces a signed receipt with action evidence and a verifiable chain you can inspect after the fact.',
  },
]

export default function HowItWorks() {
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
      id="how-it-works"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <style>{`
        @keyframes hiw-fade-up {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .hiw-item { opacity: 0; }
        .hiw-item.is-in {
          animation: hiw-fade-up 540ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>

      
        <div className="px-4 md:px-8 lg:px-12">

          {/* Section anchor */}
          <div className="pt-10 md:pt-14 pb-3">
            <span
              className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              02&nbsp;&nbsp;EXECUTION&nbsp;PATH
            </span>
          </div>

          {/* Asymmetric layout: title left, sublists right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-10 md:gap-x-16 pt-12 md:pt-20 pb-20 md:pb-28">

            {/* Left: title block */}
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
                Run.
                <br />
                Recover.
                <br />
                Verify.
              </h2>
              <p
                className="mt-6 text-gray-600 dark:text-[#a8a898] max-w-[32ch]"
                style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
              >
                The execution path for AI tasks that have to land — applied in order, every run.
              </p>
            </div>

            {/* Right: numbered sublists */}
            <div className="md:col-span-7 md:pt-3">
              <ol className="flex flex-col gap-y-8 md:gap-y-10">
                {stages.map((s, i) => (
                  <li
                    key={s.num}
                    className={`hiw-item ${revealed ? 'is-in' : ''}`}
                    style={{ animationDelay: `${160 + i * 140}ms` }}
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
                        {s.num}
                      </span>
                      <div>
                        <h3
                          className="text-[#000000] dark:text-[#f6f6f4]"
                          style={{
                            fontFamily: SANS,
                            fontWeight: 500,
                            fontSize: 'clamp(1.5rem, 2.4vw, 1.875rem)',
                            lineHeight: 1.1,
                            letterSpacing: '-0.02em',
                          }}
                        >
                          {s.title}.
                        </h3>
                        <p
                          className="mt-3 text-gray-700 dark:text-[#c8c8b8] max-w-[52ch]"
                          style={{ fontFamily: SANS, fontSize: '0.975rem', lineHeight: 1.6 }}
                        >
                          {s.body}
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

      
  )
}
