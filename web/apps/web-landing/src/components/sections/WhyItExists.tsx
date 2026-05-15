'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_-+={}|;<>?/'
const LINE_MS = 900

function scramble(target: string): string {
  return target
    .split('')
    .map((c) => (c === ' ' ? ' ' : POOL[Math.floor(Math.random() * POOL.length)]))
    .join('')
}

export default function WhyItExists() {
  const [copied, setCopied] = useState(false)
  const [displayCmd, setDisplayCmd] = useState(INSTALL_CMD)
  const [animDone, setAnimDone] = useState(true)
  const sectionRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number>()
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  const startAnim = useCallback(() => {
    cancelAnimationFrame(rafRef.current!)
    clearTimeout(timerRef.current)
    setAnimDone(false)
    let lineStart = -1

    function frame(ts: number) {
      if (lineStart < 0) lineStart = ts
      const elapsed = ts - lineStart
      if (elapsed >= LINE_MS) {
        setDisplayCmd(INSTALL_CMD)
        setAnimDone(true)
      } else {
        setDisplayCmd(scramble(INSTALL_CMD))
        rafRef.current = requestAnimationFrame(frame)
      }
    }

    timerRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(frame)
    }, 100)
  }, [])

  useEffect(() => {
    const el = sectionRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) startAnim()
      },
      { threshold: 0.18 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(rafRef.current!)
      clearTimeout(timerRef.current)
    }
  }, [startAnim])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  return (
    <section
      ref={sectionRef}
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-20 md:pt-32 pb-10 md:pb-14">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              03&nbsp;·&nbsp;INSTALL
            </div>
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                maxWidth: '22ch',
              }}
            >
              One command. Verified install.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Pinned by SHA256, local or cloud — no interactive prompts.
            </p>
          </div>

          {/* Install command frame */}
          <div className="pb-24 md:pb-32">
            <div className="flex items-baseline justify-between pb-3">
              <span className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
                FIG.6&nbsp;·&nbsp;INSTALL&nbsp;SCRIPT&nbsp;·&nbsp;SHA256&nbsp;PINNED
              </span>
              <span
                className="text-[10px] md:text-[11px] tracking-[0.22em] text-[#166534] dark:text-[#16a34a] flex items-center gap-1.5"
                style={{ fontFamily: MONO }}
              >
                <span
                  className="inline-block"
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'currentColor',
                  }}
                />
                SHA256&nbsp;VERIFIED
              </span>
            </div>

            <div style={{ borderTop: borderStyle, borderBottom: borderStyle }}>
              <div className="py-6 md:py-8 px-1 md:px-3 flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                <div className="flex items-baseline gap-3 md:gap-4 min-w-0 flex-1">
                  <span
                    className="text-gray-400 dark:text-[#5a5a52] select-none shrink-0"
                    style={{ fontFamily: MONO, fontSize: '14px', letterSpacing: '0.04em' }}
                  >
                    $
                  </span>
                  <span
                    className="select-all overflow-x-auto whitespace-nowrap text-[#000000] dark:text-[#f6f6f4]"
                    style={{
                      fontFamily: MONO,
                      fontSize: 'clamp(0.85rem, 1.6vw, 1.05rem)',
                      letterSpacing: '0.005em',
                      color: animDone ? undefined : '#888',
                      transition: 'color 200ms',
                    }}
                  >
                    {displayCmd}
                  </span>
                </div>
                <button
                  onClick={copy}
                  className="shrink-0 inline-flex items-baseline gap-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                  style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
                  title={copied ? 'Copied' : 'Copy'}
                >
                  <span aria-hidden className="inline-block w-4 border-t border-current translate-y-[-3px]" />
                  {copied ? 'COPIED' : 'COPY'}
                </button>
              </div>
            </div>

            {/* Sub-spec line */}
            <div
              className="flex flex-col md:flex-row md:items-baseline md:justify-between gap-3 pt-5"
              style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
            >
              <span className="text-gray-900 dark:text-[#f6f6f4]">
                LINUX&nbsp;AMD64
                <span className="mx-3 text-gray-400 dark:text-[#5a5a52]">·</span>
                LINUX&nbsp;ARM64
                <span className="mx-3 text-gray-400 dark:text-[#5a5a52]">·</span>
                MACOS&nbsp;ARM64
              </span>
              <span className="text-gray-500 dark:text-[#8a8a7a]">REQUIRES&nbsp;IGRIS_API_KEY</span>
            </div>
          </div>

        </div>
      </div>

      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
