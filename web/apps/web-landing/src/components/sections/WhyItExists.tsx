'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'
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
      ([entry]) => { if (entry.isIntersecting) startAnim() },
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
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12">

          <div className="pt-10 md:pt-14 pb-6 md:pb-8">
            <div
              className="pb-4 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: PIXEL }}
            >
              04&nbsp;·&nbsp;INSTALL
            </div>
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 500,
                fontSize: 'clamp(1.4rem, 2.6vw, 2rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.005em',
                maxWidth: '24ch',
              }}
            >
              One command. Verified install.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              The Igris runtime ships as a single SHA256-pinned install script.
              It is non-interactive, idempotent, and safe for CI pipelines —
              verifies its own integrity, fetches the platform binary, and
              registers the host with the supplied API key.
            </p>
          </div>

          <div className="pb-20 md:pb-32">
            <div className="flex items-baseline justify-between pb-3 gap-4">
              <span
                className="text-gray-500 dark:text-[#8a8a7a]"
                style={{ fontFamily: PIXEL, fontSize: '11px', letterSpacing: '0.18em' }}
              >
                ```bash
              </span>
              <span
                className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.02em' }}
              >
                <span
                  className="inline-block"
                  style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }}
                />
                sha256:&nbsp;verified
              </span>
            </div>

            <div style={{ borderTop: borderStyle, borderBottom: borderStyle }}>
              <div className="py-6 md:py-8 px-1 md:px-3 flex items-center justify-between gap-4 flex-wrap md:flex-nowrap">
                <div className="flex items-baseline gap-3 md:gap-4 min-w-0 flex-1">
                  <span
                    className="text-gray-400 dark:text-[#5a5a52] select-none shrink-0"
                    style={{ fontFamily: MONO, fontSize: '14px' }}
                  >
                  </span>
                  <code
                    className="select-all overflow-x-auto whitespace-nowrap text-[#000000] dark:text-[#f6f6f4]"
                    style={{
                      fontFamily: MONO,
                      fontSize: 'clamp(0.85rem, 1.5vw, 1rem)',
                      letterSpacing: '0',
                      color: animDone ? undefined : '#888',
                      transition: 'color 200ms',
                    }}
                  >
                    {displayCmd}
                  </code>
                </div>
                <button
                  onClick={copy}
                  className="shrink-0 inline-flex items-baseline gap-2 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
                  style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.02em' }}
                  title={copied ? 'Copied' : 'Copy'}
                >
                  {copied ? '// copied' : '// copy'}
                </button>
              </div>
            </div>

            <div
              className="pt-3 text-gray-400 dark:text-[#5a5a52]"
              style={{ fontFamily: PIXEL, fontSize: '11px', letterSpacing: '0.18em' }}
            >
              ```
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
