'use client'

import React, { useEffect, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'

export default function Hero() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <section
      className="relative w-full overflow-hidden bg-[#0a0a0c]"
      style={{
        marginTop: '0',
        minHeight: 'clamp(720px, 92vh, 980px)',
      }}
    >
      {/* ── Full-bleed cinematic backdrop ─────────────── */}
      <div className="absolute inset-0">
        <img
          src="/SF.png"
          alt=""
          aria-hidden="true"
          className="w-full h-full object-cover"
          style={{ filter: 'brightness(0.78)' }}
        />
        {/* Bottom-up gradient so content reads on any image */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(10,10,12,0.45) 0%, rgba(10,10,12,0.0) 28%, rgba(10,10,12,0.0) 45%, rgba(10,10,12,0.55) 85%, rgba(10,10,12,0.88) 100%)',
          }}
        />
        {/* Subtle left-side darkening for legibility */}
        <div
          aria-hidden="true"
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg, rgba(10,10,12,0.55) 0%, rgba(10,10,12,0.1) 38%, rgba(10,10,12,0.0) 60%)',
          }}
        />
      </div>

      {/* ── Top mono strip — overlaid on image ────────── */}
      <div className="relative z-10 pt-24 md:pt-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12">
            <div className="flex items-baseline justify-between">
              <span
                className="text-[10px] md:text-[11px] tracking-[0.22em] text-white/60"
                style={{ fontFamily: MONO }}
              >
                IGRIS&nbsp;INERTIAL
                <span className="mx-2 text-white/25">/</span>
                RUN&nbsp;·&nbsp;RECOVER&nbsp;·&nbsp;VERIFY
              </span>
              
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom-left overlaid content ──────────────── */}
      <div className="relative z-10" style={{ minHeight: 'clamp(540px, 70vh, 760px)' }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8 h-full">
          <div className="px-4 md:px-8 lg:px-12 h-full">
            <div className="flex flex-col justify-end h-full pt-32 md:pt-40 pb-20 md:pb-24">

              <h1
                className="text-white"
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: 'clamp(2rem, 5vw, 4rem)',
                  lineHeight: 1.0,
                  letterSpacing: '-0.03em',
                  maxWidth: '24ch',
                }}
              >
                Run agent tasks that recover and prove what happened.
              </h1>

              <p
                className="mt-6 md:mt-7 text-white/72 max-w-[58ch]"
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(0.95rem, 1.1vw, 1.05rem)',
                  lineHeight: 1.55,
                }}
              >
                Igris gives AI agents a controlled execution layer for real-world
                work&nbsp;— files, APIs, databases, workflows, and systems that
                cannot fail silently.
              </p>

              <div className="mt-7 md:mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
                <a
                  href="https://console.igrisinertial.com/auth?mode=signup"
                  className="group inline-flex items-center gap-3 px-4 py-2.5 text-white border border-white/30 hover:border-white hover:bg-white/[0.06] transition-all duration-200"
                  style={{
                    fontFamily: MONO,
                    fontSize: '11px',
                    letterSpacing: '0.22em',
                  }}
                >
                  GET&nbsp;STARTED
                  <span aria-hidden className="text-white/70 group-hover:text-white transition-colors">{'>'}</span>
                </a>
                <a
                  href="https://docs.igrisinertial.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-3 px-4 py-2.5 text-white/80 border border-white/20 hover:border-white/60 hover:text-white transition-all duration-200"
                  style={{
                    fontFamily: MONO,
                    fontSize: '11px',
                    letterSpacing: '0.22em',
                  }}
                >
                  READ&nbsp;THE&nbsp;DOCS
                  <span aria-hidden className="text-white/50 group-hover:text-white/80 transition-colors">{'↗'}</span>
                </a>
              </div>

              </div>
          </div>
        </div>
      </div>

      {/* Hairline divider at bottom of hero, against the dark */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
    </section>
  )
}
