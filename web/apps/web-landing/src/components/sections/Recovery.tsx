'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

type Row = {
  t: string
  state: 'HALT' | 'RESUME' | 'SKIP' | 'VERIFY'
  line: string
  isFinal?: boolean
}

const rows: Row[] = [
  { t: 'T+00s', state: 'HALT',   line: 'Runtime halted after step 02.' },
  { t: 'T+04s', state: 'RESUME', line: 'Task picked up on replacement runtime.' },
  { t: 'T+04s', state: 'SKIP',   line: 'Committed steps were not repeated.' },
  { t: 'T+18s', state: 'VERIFY', line: 'Receipt chain end-to-end intact.', isFinal: true },
]

export default function Recovery() {
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
        @keyframes recovery-row-in {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes recovery-rule-grow {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        @keyframes recovery-dot-pulse {
          0%   { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70%  { box-shadow: 0 0 0 6px transparent; opacity: 1; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 1; }
        }
        .recovery-row {
          opacity: 0;
        }
        .recovery-row.is-in {
          animation: recovery-row-in 480ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .recovery-rule {
          transform-origin: left;
          transform: scaleX(0);
        }
        .recovery-rule.is-in {
          animation: recovery-rule-grow 720ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        .recovery-dot {
          animation: recovery-dot-pulse 1600ms ease-out 1;
        }
      `}</style>

      
        <div
          className="px-4 md:px-8 lg:px-12"
          style={{}}
        >

          {/* Section anchor */}
          <div className="pt-10 md:pt-14 pb-3">
            <span
              className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              03&nbsp;&nbsp;CONTINUITY
            </span>
          </div>

          {/* ── Headline / prose row ─────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-y-8 md:gap-x-12 pt-10 md:pt-16 pb-12 md:pb-20">

            {/* Left: editorial headline */}
            <div className="md:col-span-7">
              <h2
                className="text-[#000000] dark:text-[#f6f6f4]"
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: 'clamp(2rem, 5.2vw, 3.75rem)',
                  lineHeight: 1.02,
                  letterSpacing: '-0.025em',
                }}
              >
                Recovery
                <br />
                without
                <br />
                duplicate work.
              </h2>
            </div>

            {/* Right: prose */}
            <div className="md:col-span-5 md:pt-3">
              <p
                className="text-gray-700 dark:text-[#c8c8b8] max-w-[34ch]"
                style={{
                  fontFamily: SANS,
                  fontSize: '0.95rem',
                  lineHeight: 1.65,
                }}
              >
                A runtime halts mid-task. Recovery picks up from the last checkpoint
                on a replacement runtime — without repeating committed steps. The
                signed receipt chain remains continuous across both runs.
              </p>
              <p
                className="mt-5 text-[11px] tracking-[0.18em] text-gray-500 dark:text-[#8a8a7a]"
                style={{ fontFamily: MONO }}
              >
                EXAMPLE EXECUTION · TASK_019DE343
              </p>
            </div>
          </div>

          {/* ── Ledger ───────────────────────────────────── */}
          <div className="pb-10 md:pb-16">
            {/* Header rule */}
            <div
              className={`recovery-rule ${revealed ? 'is-in' : ''}`}
              style={{
                height: '1px',
                background: 'currentColor',
                opacity: 0.18,
                animationDelay: '60ms',
              }}
            />

            {/* Column labels (hidden on mobile) */}
            <div
              className="hidden md:grid items-baseline py-3"
              style={{
                gridTemplateColumns: '90px 110px 1fr 24px',
                gap: '24px',
                fontFamily: MONO,
                fontSize: '10px',
                letterSpacing: '0.22em',
                color: 'rgba(0,0,0,0.45)',
              }}
            >
              <span>OFFSET</span>
              <span>STATE</span>
              <span>EVENT</span>
              <span />
            </div>

            <div
              className={`recovery-rule ${revealed ? 'is-in' : ''} hidden md:block`}
              style={{
                height: '1px',
                background: 'currentColor',
                opacity: 0.12,
                animationDelay: '120ms',
              }}
            />

            {/* Rows */}
            {rows.map((r, i) => (
              <Row
                key={r.state + i}
                row={r}
                index={i}
                revealed={revealed}
              />
            ))}

            {/* Bottom rule */}
            <div
              className={`recovery-rule ${revealed ? 'is-in' : ''}`}
              style={{
                height: '1px',
                background: 'currentColor',
                opacity: 0.18,
                animationDelay: `${120 + rows.length * 110 + 80}ms`,
              }}
            />

            {/* Assertion footer */}
            <div
              className={`recovery-row ${revealed ? 'is-in' : ''} flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 pt-6`}
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.18em',
                animationDelay: `${120 + rows.length * 110 + 180}ms`,
              }}
            >
              <span className="text-gray-900 dark:text-[#f6f6f4]">
                RECEIPT CHAIN — CONTINUOUS
                <span className="mx-3 text-gray-400 dark:text-[#5a5a52]">·</span>
                02 RUNTIMES
                <span className="mx-3 text-gray-400 dark:text-[#5a5a52]">·</span>
                00 DUPLICATES
              </span>
              <span className="text-gray-500 dark:text-[#8a8a7a]">
                EXEC_019DE343
              </span>
            </div>
          </div>

        </div>
      </div>

      
  )
}

function Row({ row, index, revealed }: { row: Row; index: number; revealed: boolean }) {
  const baseDelay = 220 + index * 110
  const isVerify = row.isFinal

  return (
    <>
      <div
        className={`recovery-row ${revealed ? 'is-in' : ''}`}
        style={{
          animationDelay: `${baseDelay}ms`,
        }}
      >
        {/* Desktop layout */}
        <div
          className="hidden md:grid items-baseline py-4"
          style={{
            gridTemplateColumns: '90px 110px 1fr 24px',
            gap: '24px',
          }}
        >
          <span
            className="text-gray-500 dark:text-[#8a8a7a]"
            style={{
              fontFamily: MONO,
              fontSize: '13px',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '0.02em',
            }}
          >
            {row.t}
          </span>
          <span
            className={isVerify ? 'text-[#166534] dark:text-[#16a34a]' : 'text-gray-900 dark:text-[#f6f6f4]'}
            style={{
              fontFamily: MONO,
              fontSize: '12px',
              letterSpacing: '0.22em',
              fontWeight: 500,
            }}
          >
            {row.state}
          </span>
          <span
            className="text-gray-900 dark:text-[#e8e8de]"
            style={{
              fontFamily: SANS,
              fontSize: '0.975rem',
              lineHeight: 1.4,
              letterSpacing: '-0.005em',
            }}
          >
            {row.line}
          </span>
          <span className="flex items-center justify-end">
            {isVerify && (
              <span
                className="recovery-dot text-[#166534] dark:text-[#16a34a] inline-block"
                style={{
                  width: '7px',
                  height: '7px',
                  borderRadius: '50%',
                  background: 'currentColor',
                }}
              />
            )}
          </span>
        </div>

        {/* Mobile layout */}
        <div className="md:hidden py-3">
          <div className="flex items-baseline justify-between mb-1">
            <span
              className="text-gray-500 dark:text-[#8a8a7a]"
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
              }}
            >
              {row.t}
            </span>
            <span
              className={`flex items-center gap-2 ${isVerify ? 'text-[#166534] dark:text-[#16a34a]' : 'text-gray-900 dark:text-[#f6f6f4]'}`}
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.22em',
                fontWeight: 500,
              }}
            >
              {row.state}
              {isVerify && (
                <span
                  className="recovery-dot inline-block"
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: 'currentColor',
                  }}
                />
              )}
            </span>
          </div>
          <p
            className="text-gray-900 dark:text-[#e8e8de]"
            style={{
              fontFamily: SANS,
              fontSize: '0.9rem',
              lineHeight: 1.45,
            }}
          >
            {row.line}
          </p>
        </div>
      </div>

      {/* Inter-row hairline (no rule after final row — bottom rule handles it) */}
      {index < rows.length - 1 && (
        <div
          className={`recovery-rule ${revealed ? 'is-in' : ''}`}
          style={{
            height: '1px',
            background: 'currentColor',
            opacity: 0.08,
            animationDelay: `${baseDelay + 80}ms`,
          }}
        />
      )}
    </>
  )
}
