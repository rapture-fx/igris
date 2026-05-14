'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

// ─────────────────────────────────────────────────────────────
// CARD 01 · Run · action evidence ledger
// ─────────────────────────────────────────────────────────────
function RunVisual() {
  // Three tools, each with input + output streams flowing through a sandbox
  const tools = [
    { op: 'read_file', input: 'policy.json',      output: '2,148 B · sha256 4a91…' },
    { op: 'http_call', input: 'POST /v1/process', output: '200 OK · digest 7c08…' },
    { op: 'db_write',  input: 'audit_events',     output: 'row #42 · 1 written'   },
  ]
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-3 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>ACTION&nbsp;FLOW</span>
        <span className="text-emerald-700 dark:text-emerald-400">3 / 3&nbsp;COMMITTED</span>
      </div>

      <svg viewBox="0 0 360 210" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="run-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.6" />
          </marker>
          <pattern id="run-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeOpacity="0.04" strokeWidth="0.3" />
          </pattern>
        </defs>

        {/* Subtle background grid */}
        <rect x="0" y="0" width="360" height="210" fill="url(#run-grid)" />

        {/* Sandbox boundary */}
        <rect
          x="6" y="38" width="348" height="148"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.18"
          strokeWidth="0.6"
          strokeDasharray="3 2"
          rx="3"
        />
        <text x="14" y="32" fontSize="7" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          SANDBOX&nbsp;BOUNDARY
        </text>
        <text x="346" y="32" fontSize="7" textAnchor="end" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          task_019de343
        </text>

        {/* Spine line */}
        <line x1="22" y1="112" x2="338" y2="112" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.6" />

        {/* Task input dot */}
        <circle cx="22" cy="112" r="3" fill="currentColor" fillOpacity="0.55" />
        <text x="22" y="146" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          TASK
        </text>

        {/* Three tools */}
        {tools.map((t, i) => {
          const cx = 88 + i * 88
          return (
            <g key={t.op}>
              {/* Input stub above */}
              <line x1={cx} y1={62} x2={cx} y2={86} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" />
              <text x={cx} y={56} fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO }}>
                {t.input}
              </text>

              {/* Box body */}
              <rect
                x={cx - 32} y={86}
                width={64} height={52}
                className="fill-emerald-700 dark:fill-emerald-500"
                rx="2"
              />
              {/* Step tab */}
              <rect x={cx - 32} y={78} width={18} height={10} className="fill-emerald-800 dark:fill-emerald-600" rx="1" />
              <text x={cx - 23} y={86} fontSize="7" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
                {`0${i + 1}`}
              </text>
              {/* Op */}
              <text x={cx} y={106} fontSize="9.5" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO }}>
                {t.op}
              </text>
              {/* Status bar inside */}
              <line x1={cx - 24} y1={114} x2={cx + 24} y2={114} stroke="#fff" strokeOpacity="0.25" strokeWidth="0.5" />
              <text x={cx} y={126} fontSize="6.5" textAnchor="middle" fill="#fff" fillOpacity="0.85" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                COMMITTED
              </text>

              {/* Output stub below */}
              <line x1={cx} y1={138} x2={cx} y2={158} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" />
              <text x={cx} y={168} fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO }}>
                {t.output}
              </text>
              <text x={cx} y={178} fontSize="6" textAnchor="middle" fill="currentColor" fillOpacity="0.35" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                EVIDENCE
              </text>

              {/* Connector to next */}
              {i < tools.length - 1 && (
                <line
                  x1={cx + 32} y1={112}
                  x2={cx + 56} y2={112}
                  stroke="currentColor"
                  strokeOpacity="0.5"
                  strokeWidth="0.9"
                  markerEnd="url(#run-arrow)"
                />
              )}
            </g>
          )
        })}

        {/* Tail line into receipt */}
        <line x1={88 + 2 * 88 + 32} y1="112" x2="332" y2="112" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.9" markerEnd="url(#run-arrow)" />

        {/* Receipt seal */}
        <g>
          <circle cx="338" cy="112" r="9" fill="none" stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.8" strokeDasharray="2 1.5" />
          <circle cx="338" cy="112" r="3.5" className="fill-emerald-700 dark:fill-emerald-500" />
          <text x="338" y="146" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
            RECEIPT
          </text>
        </g>
      </svg>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// CARD 02 · Recover · recovery sparkline
// ─────────────────────────────────────────────────────────────
function RecoverVisual() {
  return (
    <div className="w-full" style={{ fontFamily: MONO }}>
      <div className="flex items-baseline justify-between mb-3 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]">
        <span>RUNTIME&nbsp;HANDOFF</span>
        <span className="text-emerald-700 dark:text-emerald-400">0&nbsp;DUPLICATES</span>
      </div>

      <svg viewBox="0 0 360 210" className="w-full" preserveAspectRatio="xMidYMid meet">
        <defs>
          <marker id="rec-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.6" />
          </marker>
          <marker id="rec-arrow-up" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" fillOpacity="0.45" />
          </marker>
          <pattern id="rec-grid" width="12" height="12" patternUnits="userSpaceOnUse">
            <path d="M 12 0 L 0 0 0 12" fill="none" stroke="currentColor" strokeOpacity="0.04" strokeWidth="0.3" />
          </pattern>
        </defs>

        <rect x="0" y="0" width="360" height="210" fill="url(#rec-grid)" />

        {/* Lane A header */}
        <text x="14" y="22" fontSize="7" fill="currentColor" fillOpacity="0.6" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          RUNTIME&nbsp;A
        </text>
        <text x="346" y="22" fontSize="6.5" textAnchor="end" fill="currentColor" fillOpacity="0.35" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          T+00s … T+04s
        </text>
        <line x1="14" y1="32" x2="346" y2="32" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.4" />

        {/* Lane A rail */}
        <line x1="22" y1="56" x2="338" y2="56" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.6" />

        {/* RUNTIME A — three committed steps */}
        {[0, 1, 2].map((i) => {
          const cx = 50 + i * 56
          return (
            <g key={`a-${i}`}>
              <rect x={cx - 20} y={42} width={40} height={28} className="fill-emerald-700 dark:fill-emerald-500" rx="2" />
              <text x={cx} y={56} fontSize="7" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO, letterSpacing: '0.05em' }}>
                {['read_file','http_call','db_write'][i]}
              </text>
              <text x={cx} y={66} fontSize="6" textAnchor="middle" fill="#fff" fillOpacity="0.8" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
                {`0${i + 1}`}
              </text>
              {i < 2 && <line x1={cx + 20} y1={56} x2={cx + 36} y2={56} stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.7" markerEnd="url(#rec-arrow-up)" />}
              {/* Down-arrow into persisted state */}
              <line x1={cx} y1={70} x2={cx} y2={92} stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" markerEnd="url(#rec-arrow-up)" />
            </g>
          )
        })}

        {/* HALT marker (where step 04 would have been) */}
        <g>
          <line x1="218" y1="56" x2="234" y2="56" stroke="#d97706" strokeOpacity="0.6" strokeWidth="0.7" strokeDasharray="2 1.5" />
          <circle cx="248" cy="56" r="11" fill="none" stroke="#d97706" strokeWidth="1" strokeDasharray="2 1.5" />
          <line x1="242" y1="50" x2="254" y2="62" stroke="#d97706" strokeWidth="1.4" />
          <line x1="254" y1="50" x2="242" y2="62" stroke="#d97706" strokeWidth="1.4" />
          <text x="248" y="38" fontSize="7" textAnchor="middle" fill="#d97706" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
            HALT
          </text>
          <text x="248" y="80" fontSize="6" textAnchor="middle" fill="#d97706" fillOpacity="0.7" style={{ fontFamily: MONO }}>
            runtime gone
          </text>
        </g>

        {/* Persisted state — central store */}
        <g>
          <rect x="22" y="92" width="316" height="34" fill="currentColor" fillOpacity="0.05" rx="2" />
          <rect x="22" y="92" width="316" height="34" fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="0.5" strokeDasharray="3 2" rx="2" />
          <text x="36" y="106" fontSize="7" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
            PERSISTED&nbsp;STORE
          </text>
          <text x="36" y="118" fontSize="6.5" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO }}>
            committed: 01 read_file · 02 http_call · 03 db_write
          </text>
          <text x="326" y="118" fontSize="6.5" textAnchor="end" fill="currentColor" fillOpacity="0.4" className="dark:fill-emerald-400" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
            CHAIN&nbsp;INTACT
          </text>
        </g>

        {/* Handoff arrow from store down into Runtime B */}
        <path
          d="M 180 126 C 180 142 200 152 218 158"
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="1"
          strokeDasharray="2 1.5"
          markerEnd="url(#rec-arrow)"
        />
        <text x="186" y="144" fontSize="6.5" fill="currentColor" fillOpacity="0.5" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          REHYDRATE
        </text>

        {/* Lane B header */}
        <line x1="14" y1="138" x2="346" y2="138" stroke="currentColor" strokeOpacity="0.15" strokeWidth="0.4" />
        <text x="14" y="152" fontSize="7" fill="currentColor" fillOpacity="0.6" style={{ fontFamily: MONO, letterSpacing: '0.22em' }}>
          RUNTIME&nbsp;B
        </text>
        <text x="346" y="152" fontSize="6.5" textAnchor="end" fill="currentColor" fillOpacity="0.35" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          T+04s … T+18s
        </text>

        {/* Lane B rail */}
        <line x1="22" y1="176" x2="338" y2="176" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.6" />

        {/* Three ghosted (not replayed) */}
        {[0, 1, 2].map((i) => {
          const cx = 226 + i * 30
          return (
            <g key={`b-${i}`}>
              <rect x={cx - 12} y={164} width={24} height={24} fill="none" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.7" strokeDasharray="2 1.5" rx="2" />
              <text x={cx} y={180} fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.35" style={{ fontFamily: MONO }}>
                {`0${i + 1}`}
              </text>
            </g>
          )
        })}
        <text x="256" y="200" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.45" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          NOT&nbsp;REPLAYED
        </text>

        {/* New step 04 — resumed */}
        <line x1="298" y1="176" x2="312" y2="176" stroke="currentColor" strokeOpacity="0.5" strokeWidth="0.9" markerEnd="url(#rec-arrow)" />
        <g>
          <rect x="316" y="164" width={28} height={24} className="fill-emerald-700 dark:fill-emerald-500" rx="2" />
          <text x="330" y="180" fontSize="7" textAnchor="middle" fill="#fff" style={{ fontFamily: MONO }}>
            04
          </text>
        </g>
        <text x="330" y="200" fontSize="6.5" textAnchor="middle" fill="currentColor" fillOpacity="0.6" className="dark:fill-emerald-400" style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
          RESUMED
        </text>
      </svg>
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
