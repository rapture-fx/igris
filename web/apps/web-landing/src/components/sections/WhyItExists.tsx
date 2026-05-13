'use client'

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'
const POOL = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*_-+={}|;<>?/'
const LINE_MS = 900

function scramble(target: string): string {
  return target.split('').map(c => c === ' ' ? ' ' : POOL[Math.floor(Math.random() * POOL.length)]).join('')
}

export default function WhyItExists() {
  const [copied, setCopied] = useState(false)
  const [displayCmd, setDisplayCmd] = useState(INSTALL_CMD)
  const [animDone, setAnimDone] = useState(true)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const sectionRef = useRef<HTMLElement>(null)
  const rafRef = useRef<number>()
  const timerRef = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => { setMounted(true) }, [])

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
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => { observer.disconnect(); cancelAnimationFrame(rafRef.current!); clearTimeout(timerRef.current) }
  }, [startAnim])

  const copy = useCallback(() => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <section ref={sectionRef} className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div
          className="relative px-4 md:px-8 lg:px-12 mobile-auto-height"
          style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', paddingTop: '2rem', paddingBottom: '2rem' }}
        >
          <div className="rounded-lg overflow-hidden relative" style={{ height: 'clamp(400px, 60vw, 700px)' }}>
            <img
              src="/SF.jpeg"
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
            {/* Install command overlay — centered, theme-aware */}
            <div className="absolute inset-0 flex items-center justify-center px-6 z-10">
              <div
                className="inline-flex items-center gap-4 rounded-2xl px-6 py-3.5 text-sm border shadow-xl backdrop-blur-md"
                style={{
                  backgroundColor: isDark ? 'rgba(17,17,17,0.80)' : 'rgba(255,255,255,0.82)',
                  borderColor: isDark ? 'rgba(246,246,244,0.10)' : 'rgba(0,0,0,0.08)',
                  color: isDark ? '#c8c8b8' : '#374151',
                }}
              >
                <span
                  className="select-all font-mono whitespace-nowrap transition-colors"
                  style={{ color: animDone ? undefined : (isDark ? '#555' : '#bbb') }}
                >{displayCmd}</span>
                <button
                  onClick={copy}
                  className="shrink-0 transition-opacity hover:opacity-60"
                  title={copied ? 'Copied' : 'Copy'}
                  style={{ color: isDark ? '#a8a898' : '#6b7280' }}
                >
                  {copied ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
