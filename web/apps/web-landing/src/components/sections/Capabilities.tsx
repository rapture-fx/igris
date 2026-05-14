'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

// ─────────────────────────────────────────────────────────────
// CARD 01 · Run · action evidence ledger
// ─────────────────────────────────────────────────────────────
function RunVisual() {
  const tools = [
    { op: 'read_file', io: ['policy.json', '2,148 B'] },
    { op: 'http_call', io: ['POST /v1/process', '200 OK'] },
    { op: 'db_write',  io: ['audit_events',     '1 row'] },
  ]
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-4 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>ACTION&nbsp;FLOW</span>
        <span className="text-emerald-700 dark:text-emerald-400">3 / 3&nbsp;COMMITTED</span>
      </div>

      <svg viewBox="0 0 320 170" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="run-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.55" />
          </marker>
        </defs>

        {/* Input node */}
        <g>
          <rect x="4" y="68" width="44" height="34" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.9" />
          <text x="26" y="82" fontSize="8" textAnchor="middle" fill="currentColor" fillOpacity="0.6" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>TASK</text>
          <text x="26" y="94" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO }}>019de343</text>
        </g>

        {/* Three tool boxes */}
        {tools.map((t, i) => {
          const x = 72 + i * 76
          return (
            <g key={t.op}>
              {/* Connector from previous to this */}
              <line
                x1={i === 0 ? 48 : x - 4 - 28}
                y1="85"
                x2={x - 2}
                y2="85"
                stroke="currentColor"
                strokeOpacity="0.4"
                strokeWidth="0.9"
                markerEnd="url(#run-arrow)"
              />
              {/* Tool box (filled emerald) */}
              <rect x={x} y="62" width="64" height="46" className="fill-emerald-700 dark:fill-emerald-500" />
              {/* Step number tab */}
              <rect x={x} y="52" width="14" height="10" className="fill-emerald-800 dark:fill-emerald-600" />
              <text x={x + 7} y="60" fontSize="7" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO }}>
                {`0${i + 1}`}
              </text>
              {/* Op name */}
              <text x={x + 32} y="80" fontSize="9" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO }}>
                {t.op}
              </text>
              {/* I/O hint */}
              <text x={x + 32} y="98" fontSize="6.5" textAnchor="middle" fill="#fff" fillOpacity="0.8" style={{ fontFamily: MONO }}>
                {t.io[0]}
              </text>
              {/* Result below box */}
              <text x={x + 32} y="124" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
                {t.io[1]}
              </text>
              <text x={x + 32} y="135" fontSize="6" textAnchor="middle" fill="currentColor" fillOpacity="0.35" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                COMMITTED
              </text>
            </g>
          )
        })}

        {/* Arrow to receipt */}
        <line x1="296" y1="85" x2="308" y2="85" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.9" markerEnd="url(#run-arrow)" />

        {/* Receipt node */}
        <g>
          <rect x="284" y="68" width="34" height="34" fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.9" strokeDasharray="2 1.5" />
          <text x="301" y="83" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.6" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>RCPT</text>
          <text x="301" y="94" fontSize="6" textAnchor="middle" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO }}>signed</text>
        </g>

        {/* Top label */}
        <text x="160" y="34" fontSize="7" textAnchor="middle" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          CONTROLLED&nbsp;EXECUTION&nbsp;PATH
        </text>
        <line x1="60" y1="42" x2="260" y2="42" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.4" strokeDasharray="1 2" />
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 02 · Recover · recovery sparkline
// ─────────────────────────────────────────────────────────────
function RecoverVisual() {
  // 4 committed boxes → halt → 3 skipped boxes → 1 resumed box
  const cells = [
    { kind: 'commit' as const, label: '01' },
    { kind: 'commit' as const, label: '02' },
    { kind: 'commit' as const, label: '03' },
    { kind: 'halt'   as const, label: 'halt' },
    { kind: 'skip'   as const, label: '01' },
    { kind: 'skip'   as const, label: '02' },
    { kind: 'skip'   as const, label: '03' },
    { kind: 'resume' as const, label: '04' },
  ]
  const cellSize = 28
  const gap = 6
  const total = cells.length
  const width = total * cellSize + (total - 1) * gap
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-4 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>STEP&nbsp;LEDGER</span>
        <span className="text-emerald-700 dark:text-emerald-400">0&nbsp;DUPLICATES</span>
      </div>

      <svg
        viewBox={`0 0 ${width} 56`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ maxHeight: '110px' }}
      >
        {cells.map((c, i) => {
          const x = i * (cellSize + gap)
          if (c.kind === 'commit' || c.kind === 'resume') {
            return (
              <g key={i}>
                <rect x={x} y={6} width={cellSize} height={cellSize} className="fill-emerald-700 dark:fill-emerald-500" />
                <text x={x + cellSize / 2} y={6 + cellSize / 2 + 3.5} fontSize="10" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO }}>
                  {c.label}
                </text>
                <text x={x + cellSize / 2} y={50} fontSize="6" textAnchor="middle" fill="currentColor" fillOpacity="0.6" style={{ fontFamily: MONO, letterSpacing: '0.15em' }}>
                  {c.kind === 'commit' ? 'COMMIT' : 'RESUME'}
                </text>
              </g>
            )
          }
          if (c.kind === 'halt') {
            return (
              <g key={i}>
                <rect x={x + 2} y={8} width={cellSize - 4} height={cellSize - 4} fill="none" stroke="#d97706" strokeWidth="1.2" strokeDasharray="2 1.5" />
                <line x1={x + 6} y1={12} x2={x + cellSize - 6} y2={cellSize - 4 + 8} stroke="#d97706" strokeWidth="1.4" />
                <line x1={x + cellSize - 6} y1={12} x2={x + 6} y2={cellSize - 4 + 8} stroke="#d97706" strokeWidth="1.4" />
                <text x={x + cellSize / 2} y={50} fontSize="6" textAnchor="middle" fill="#d97706" style={{ fontFamily: MONO, letterSpacing: '0.15em' }}>
                  HALT
                </text>
              </g>
            )
          }
          // skipped
          return (
            <g key={i}>
              <rect x={x} y={6} width={cellSize} height={cellSize} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" strokeDasharray="2 1.5" />
              <text x={x + cellSize / 2} y={6 + cellSize / 2 + 3.5} fontSize="10" textAnchor="middle" fill="currentColor" fillOpacity="0.4" style={{ fontFamily: MONO }}>
                {c.label}
              </text>
              <text x={x + cellSize / 2} y={50} fontSize="6" textAnchor="middle" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO, letterSpacing: '0.15em' }}>
                SKIP
              </text>
            </g>
          )
        })}
      </svg>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <div>
          <span className="inline-block w-2 h-2 mr-2 align-middle bg-emerald-700 dark:bg-emerald-500" />
          COMMITTED
        </div>
        <div>
          <span className="inline-block w-2 h-2 mr-2 align-middle border border-current opacity-40" style={{ borderStyle: 'dashed' }} />
          NOT REPLAYED
        </div>
        <div className="text-amber-600 dark:text-amber-400">
          <span className="inline-block w-2 h-2 mr-2 align-middle border border-current" style={{ borderStyle: 'dashed' }} />
          HALT
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 03 · Receipts · verification table
// ─────────────────────────────────────────────────────────────
function ReceiptVisual() {
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-3 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>RECEIPT</span>
        <span className="text-emerald-700 dark:text-emerald-400">VERIFIED</span>
      </div>

      {/* Hash band */}
      <div
        className="px-3 py-2.5 mb-3"
        style={{
          background: 'rgba(127,127,127,0.06)',
          border: '1px solid var(--section-border)',
        }}
      >
        <div className="text-[9px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a] mb-1">PAYLOAD&nbsp;HASH</div>
        <div className="text-gray-800 dark:text-[#e8e8de] break-all" style={{ fontSize: '11px', letterSpacing: '0.04em' }}>
          42cbd8e558e4a1<span className="text-gray-400 dark:text-[#5a5a52]">… d2c07c08ab91f4</span>
        </div>
      </div>

      {/* Verification rows */}
      <div className="space-y-1.5">
        {[
          { k: 'signature',        v: 'valid'  },
          { k: 'runtime_identity', v: 'pinned' },
          { k: 'chain_valid',      v: 'true'   },
        ].map((r) => (
          <div key={r.k} className="grid items-baseline" style={{ gridTemplateColumns: '1fr auto', gap: '12px' }}>
            <span className="text-gray-500 dark:text-[#8a8a7a]" style={{ fontSize: '11px' }}>{r.k}</span>
            <span className="flex items-baseline gap-2 text-emerald-700 dark:text-emerald-400" style={{ fontSize: '11px' }}>
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-current align-middle" />
              {r.v}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 04 · Inspect · task inspector summary
// ─────────────────────────────────────────────────────────────
function InspectVisual() {
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-3 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>TASK&nbsp;INSPECTOR</span>
        <span className="text-emerald-700 dark:text-emerald-400">VERIFIED</span>
      </div>

      {/* Mock inspector panel */}
      <div
        className="overflow-hidden"
        style={{ border: '1px solid var(--section-border)', borderRadius: '4px' }}
      >
        {/* Header strip */}
        <div
          className="flex items-center gap-2 px-3 py-2"
          style={{ background: 'rgba(127,127,127,0.06)', borderBottom: '1px solid var(--section-border)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-25" />
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-25" />
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-25" />
          <span className="ml-2 text-[10px] tracking-[0.18em] text-gray-500 dark:text-[#8a8a7a]">task_019de343</span>
        </div>
        {/* Body rows */}
        <div className="px-3 py-2.5 space-y-1.5">
          {[
            { k: 'outcome',       v: 'completed',         ok: true  },
            { k: 'runtime split', v: 'A → B',             ok: false },
            { k: 'actions',       v: '3 / 3 committed',   ok: true  },
            { k: 'receipt',       v: 'verified',          ok: true  },
            { k: 'chain',         v: 'valid',             ok: true  },
          ].map((r) => (
            <div key={r.k} className="grid items-baseline" style={{ gridTemplateColumns: '110px 1fr', gap: '10px' }}>
              <span className="text-gray-500 dark:text-[#8a8a7a]" style={{ fontSize: '11px' }}>{r.k}</span>
              <span
                className={r.ok ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-800 dark:text-[#e8e8de]'}
                style={{ fontSize: '11px' }}
              >
                {r.v}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Card layout
// ─────────────────────────────────────────────────────────────
type Card = {
  fig: string
  num: string
  name: string
  body: string
  sublist: { id: string; label: string }[]
  cta: { label: string; href: string }
  Visual: () => React.ReactElement
}

const cards: Card[] = [
  {
    fig: 'FIG.1',
    num: '01',
    name: 'Run',
    body: 'Submit an action task. Igris executes each step through a controlled path and records what committed — a file read, an HTTP call, a database row written.',
    sublist: [
      { id: '1.1', label: 'Controlled tools: read_file, http_call, db_write' },
      { id: '1.2', label: 'Each committed step is persisted before the next' },
      { id: '1.3', label: 'Safe result evidence: bytes, digests, status, row id' },
    ],
    cta: { label: 'READ THE DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RunVisual,
  },
  {
    fig: 'FIG.2',
    num: '02',
    name: 'Recover',
    body: 'When a runtime halts mid-task, a replacement runtime starts from persisted progress and resumes — without replaying steps that already committed.',
    sublist: [
      { id: '2.1', label: 'Resume from persisted state, not from zero' },
      { id: '2.2', label: 'Committed side effects are not repeated' },
      { id: '2.3', label: 'Proven across a clean-host replacement' },
    ],
    cta: { label: 'READ THE DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RecoverVisual,
  },
  {
    fig: 'FIG.3',
    num: '03',
    name: 'Verify',
    body: 'Every task produces a signed receipt. Check the signature, the runtime identity, and the chain — independently, after the fact, on demand.',
    sublist: [
      { id: '3.1', label: 'Signed receipts for every committed task' },
      { id: '3.2', label: 'Runtime identity pinned in the receipt' },
      { id: '3.3', label: 'Chain validity across recovery boundaries' },
    ],
    cta: { label: 'READ THE DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: ReceiptVisual,
  },
  {
    fig: 'FIG.4',
    num: '04',
    name: 'Inspect',
    body: 'The Task Inspector shows action evidence, result summaries, and receipt status in plain operator language — with technical detail one click away.',
    sublist: [
      { id: '4.1', label: 'Action evidence for each committed step' },
      { id: '4.2', label: 'Runtime split visible when recovery happened' },
      { id: '4.3', label: 'Receipt and chain status in plain language' },
    ],
    cta: { label: 'OPEN THE CONSOLE', href: 'https://console.igrisinertial.com' },
    Visual: InspectVisual,
  },
]

// ─────────────────────────────────────────────────────────────
// Section
// ─────────────────────────────────────────────────────────────
export default function Capabilities() {
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
      { threshold: 0.12 },
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
        @keyframes cap-card-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .cap-card { opacity: 0; }
        .cap-card.is-in {
          animation: cap-card-in 540ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
      `}</style>

      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-20 md:pt-32 pb-10 md:pb-14">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              02&nbsp;·&nbsp;EXECUTION
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
              The path applied to every task.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Run agent tasks against real systems, recover from failure on a
              replacement runtime, and prove what happened with a signed receipt.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <a
                href="https://docs.igrisinertial.com"
                className="group inline-flex items-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
              >
                READ&nbsp;THE&nbsp;DOCS
                <span aria-hidden>{'>'}</span>
              </a>
            </div>
          </div>

          {/* Proof flow strip — anchors the 2x2 below */}
          <div
            className="hidden md:flex items-center gap-3 pb-10 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO }}
          >
            {[
              'READ FILE',
              'CALL API',
              'WRITE ROW',
              'RECOVER',
              'VERIFY',
              'CHAIN VALID',
            ].map((s, i, arr) => (
              <React.Fragment key={s}>
                <span className={i === arr.length - 1 ? 'text-emerald-700 dark:text-emerald-400' : ''}>{s}</span>
                {i < arr.length - 1 && <span className="text-gray-300 dark:text-[#3a3a32]">/</span>}
              </React.Fragment>
            ))}
          </div>

          {/* 2×2 card grid */}
          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ borderTop: borderStyle, borderLeft: borderStyle }}
          >
            {cards.map((c, i) => (
              <article
                key={c.num}
                className={`cap-card ${revealed ? 'is-in' : ''} relative flex flex-col`}
                style={{
                  borderRight: borderStyle,
                  borderBottom: borderStyle,
                  animationDelay: `${120 + i * 110}ms`,
                  height: '620px',
                }}
              >
                {/* FIG.N tag */}
                <div className="px-7 md:px-9 pt-6 pb-3 flex items-baseline justify-between">
                  <span
                    className="text-gray-500 dark:text-[#8a8a7a]"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {c.fig}
                  </span>
                  <span
                    className="text-gray-400 dark:text-[#5a5a52]"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {c.name.toUpperCase()}
                  </span>
                </div>

                {/* Visual area — fixed height so all four cards align */}
                <div
                  className="px-7 md:px-9 pt-4 pb-6 flex items-start justify-center"
                  style={{ height: '300px' }}
                >
                  <div className="w-full">
                    <c.Visual />
                  </div>
                </div>

                {/* Title + body + sublist row */}
                <div className="px-7 md:px-9 pt-6 pb-8 mt-auto flex-1 flex flex-col" style={{ borderTop: borderStyle }}>
                  <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-x-8 gap-y-5 items-start">
                    <div>
                      <h3
                        className="text-[#000000] dark:text-[#f6f6f4]"
                        style={{
                          fontFamily: SANS,
                          fontSize: 'clamp(1.25rem, 1.8vw, 1.5rem)',
                          fontWeight: 500,
                          lineHeight: 1.15,
                          letterSpacing: '-0.015em',
                        }}
                      >
                        <span className="text-gray-400 dark:text-[#5a5a52] mr-2" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {c.num}
                        </span>
                        {c.name}
                      </h3>
                      <p
                        className="mt-3 text-gray-700 dark:text-[#c8c8b8] max-w-[40ch]"
                        style={{ fontFamily: SANS, fontSize: '0.925rem', lineHeight: 1.55 }}
                      >
                        {c.body}
                      </p>
                      <a
                        href={c.cta.href}
                        className="group mt-5 inline-flex items-center gap-2.5 px-3 py-2 border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                        style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                      >
                        {c.cta.label}
                        <span aria-hidden>{'>'}</span>
                      </a>
                    </div>

                    <ol className="flex flex-col gap-y-2 min-w-[180px]">
                      {c.sublist.map((s) => (
                        <li
                          key={s.id}
                          className="grid items-baseline"
                          style={{ gridTemplateColumns: '28px 1fr', gap: '8px' }}
                        >
                          <span
                            className="text-gray-400 dark:text-[#5a5a52]"
                            style={{
                              fontFamily: MONO,
                              fontSize: '11px',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {s.id}
                          </span>
                          <span
                            className="text-gray-700 dark:text-[#c8c8b8]"
                            style={{ fontFamily: SANS, fontSize: '0.85rem', lineHeight: 1.45 }}
                          >
                            {s.label}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                </div>
              </article>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
