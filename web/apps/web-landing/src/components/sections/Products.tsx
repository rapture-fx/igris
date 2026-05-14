import React, { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Action Task V1 event stream — anchored to read_file → http_call → db_write
type Line =
  | { kind: 'cmd';      text: string }
  | { kind: 'meta';     k: string; v: string }
  | { kind: 'step';     n: string; op: string; target: string }
  | { kind: 'detail';   text: string }
  | { kind: 'commit';   text: string }
  | { kind: 'sep' }
  | { kind: 'receipt';  k: string; v: string; ok?: boolean }
  | { kind: 'final';    text: string }

const STREAM: Line[] = [
  { kind: 'cmd',     text: 'igris tasks submit ./action_task.yaml' },
  { kind: 'meta',    k: 'task',    v: 'task_019de343' },
  { kind: 'meta',    k: 'actions', v: '3 (read_file, http_call, db_write)' },
  { kind: 'sep' },
  { kind: 'step',    n: '01', op: 'read_file',  target: 'policy.json' },
  { kind: 'detail',  text: '  read 2,148 bytes · sha256 4a91f8…d2c0' },
  { kind: 'commit',  text: '  committed' },
  { kind: 'step',    n: '02', op: 'http_call',  target: 'POST /v1/process' },
  { kind: 'detail',  text: '  status 200 · response_digest 7c08ab…91f4' },
  { kind: 'commit',  text: '  committed' },
  { kind: 'step',    n: '03', op: 'db_write',   target: 'audit_events row #42' },
  { kind: 'detail',  text: '  1 row written · table audit_events' },
  { kind: 'commit',  text: '  committed' },
  { kind: 'sep' },
  { kind: 'receipt', k: 'signature',       v: 'valid',         ok: true },
  { kind: 'receipt', k: 'runtime_identity', v: 'pinned',       ok: true },
  { kind: 'receipt', k: 'chain_valid',     v: 'true',          ok: true },
  { kind: 'final',   text: 'receipt verified · 3 / 3 actions committed' },
]

function ExecutionPreview({ isDark }: { isDark: boolean }) {
  const bg         = isDark ? '#0e0e08' : '#0d0d0d'
  const chrome     = isDark ? '#1a1a12' : '#1a1a1a'
  const border     = isDark ? 'rgba(246,246,244,0.08)' : 'rgba(255,255,255,0.08)'
  const fg         = '#e8e8de'
  const dim        = '#6a6a5e'
  const muted      = '#8a8a7a'
  const accent     = '#16a34a'
  const accentDim  = 'rgba(22,163,74,0.7)'

  const [visible, setVisible] = useState(0)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setVisible(STREAM.length)
      return
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          let n = 0
          const tick = () => {
            n += 1
            setVisible(n)
            if (n < STREAM.length) setTimeout(tick, 180)
          }
          setTimeout(tick, 280)
          io.disconnect()
        }
      },
      { threshold: 0.2 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: isDark
          ? '0 1px 0 rgba(255,255,255,0.03) inset, 0 30px 80px -40px rgba(0,0,0,0.6)'
          : '0 1px 0 rgba(255,255,255,0.04) inset, 0 30px 80px -40px rgba(0,0,0,0.5)',
      }}
    >
      <style>{`
        @keyframes term-line-in {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .term-line { animation: term-line-in 220ms cubic-bezier(0.22,0.61,0.36,1) both; }
        @keyframes term-caret {
          0%,55% { opacity: 1; } 56%,100% { opacity: 0; }
        }
        .term-caret { animation: term-caret 1.1s steps(1,end) infinite; }
      `}</style>

      {/* Window chrome */}
      <div
        style={{
          background: chrome,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          borderBottom: `1px solid ${border}`,
        }}
      >
        <div style={{ display: 'flex', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
        </div>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: muted, letterSpacing: '0.04em', flex: 1, textAlign: 'center' }}>
          task_019de343 · action_task.yaml
        </span>
        <span style={{ fontFamily: MONO, fontSize: '10px', color: dim, letterSpacing: '0.22em' }}>
          IGRIS
        </span>
      </div>

      {/* Stream body */}
      <div
        style={{
          padding: '20px 22px 22px',
          minHeight: '520px',
          background: bg,
          fontFamily: MONO,
          fontSize: '13px',
          lineHeight: 1.7,
          color: fg,
        }}
      >
        {STREAM.slice(0, visible).map((l, i) => {
          const styleBase: React.CSSProperties = { animationDelay: `${i * 10}ms` }
          if (l.kind === 'cmd') {
            return (
              <div key={i} className="term-line" style={styleBase}>
                <span style={{ color: dim }}>$</span>{' '}
                <span style={{ color: fg }}>{l.text}</span>
              </div>
            )
          }
          if (l.kind === 'meta') {
            return (
              <div key={i} className="term-line" style={styleBase}>
                <span style={{ color: dim }}>{l.k.padEnd(8, ' ')}</span>
                <span style={{ color: muted }}>  {l.v}</span>
              </div>
            )
          }
          if (l.kind === 'sep') {
            return (
              <div key={i} className="term-line" style={{ ...styleBase, color: dim, opacity: 0.5 }}>
                ────────────────────────────────────────────
              </div>
            )
          }
          if (l.kind === 'step') {
            return (
              <div key={i} className="term-line" style={styleBase}>
                <span style={{ color: dim }}>[{l.n}]</span>{' '}
                <span style={{ color: fg }}>{l.op}</span>
                <span style={{ color: muted }}>  {l.target}</span>
              </div>
            )
          }
          if (l.kind === 'detail') {
            return (
              <div key={i} className="term-line" style={{ ...styleBase, color: muted }}>
                {l.text}
              </div>
            )
          }
          if (l.kind === 'commit') {
            return (
              <div key={i} className="term-line" style={{ ...styleBase, color: accentDim }}>
                {l.text}
              </div>
            )
          }
          if (l.kind === 'receipt') {
            return (
              <div key={i} className="term-line" style={styleBase}>
                <span style={{ color: dim }}>{l.k.padEnd(18, ' ')}</span>
                <span style={{ color: l.ok ? accent : fg }}>{l.v}</span>
              </div>
            )
          }
          if (l.kind === 'final') {
            return (
              <div key={i} className="term-line" style={{ ...styleBase, color: accent, marginTop: '6px' }}>
                {l.text}
              </div>
            )
          }
          return null
        })}
        {visible < STREAM.length && (
          <span className="term-caret" style={{ display: 'inline-block', width: '7px', height: '14px', background: fg, verticalAlign: 'text-bottom' }} />
        )}
      </div>

      {/* Footer status bar */}
      <div
        style={{
          background: chrome,
          borderTop: `1px solid ${border}`,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: MONO,
          fontSize: '10px',
          letterSpacing: '0.22em',
          color: dim,
        }}
      >
        <span>
          <span style={{ color: accent }}>●</span>
          &nbsp;&nbsp;ACTION&nbsp;TASK&nbsp;V1
        </span>
        <span>3&nbsp;COMMITTED&nbsp;·&nbsp;0&nbsp;DUPLICATES&nbsp;·&nbsp;CHAIN&nbsp;VALID</span>
      </div>
    </div>
  )
}


export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && theme === 'dark'
  const sectionBorder = 'var(--section-border)'

  return (
    <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: sectionBorder }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: sectionBorder, borderRight: sectionBorder }}>

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-20 md:pt-32 pb-10 md:pb-14">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              01&nbsp;·&nbsp;SUBMIT&nbsp;A&nbsp;TASK
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
              An action task, executed under a controlled path.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Igris executes the task step by step, records each committed action,
              and produces a receipt that anyone can verify.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Link
                href="https://docs.igrisinertial.com/"
                className="group inline-flex items-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
              >
                READ&nbsp;THE&nbsp;DOCS
                <span aria-hidden>{'>'}</span>
              </Link>
            </div>
          </div>

          {/* Terminal */}
          <div className="pb-24 md:pb-32">
            <div className="flex items-baseline justify-between pb-4">
              <span className="text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
                FIG.1
              </span>
              <span className="text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
                ACTION&nbsp;TASK&nbsp;V1&nbsp;·&nbsp;LIVE&nbsp;TRACE
              </span>
            </div>
            <ExecutionPreview isDark={isDark} />
          </div>

        </div>
      </div>
    </section>
  )
}
