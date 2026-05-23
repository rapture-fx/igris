'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--capabilities-border)'

// ═══════════════════════════════════════════════════════════════
// FIGURE KIT — a small, restrained set of primitives. Each figure
// is one clean object with generous negative space, hairline
// strokes, monospace micro-labels, and a single emerald accent.
// ═══════════════════════════════════════════════════════════════

const EM_STROKE = 'stroke-emerald-700 dark:stroke-emerald-400'
const EM_FILL = 'fill-emerald-700 dark:fill-emerald-400'

const fig = (children: React.ReactNode) => (
  <div className="w-full" style={{ fontFamily: MONO }}>
    <svg viewBox="0 0 360 200" className="w-full" preserveAspectRatio="xMidYMid meet">
      {children}
    </svg>
  </div>
)

function Lbl({
  x, y, children, anchor = 'start', em = false, size = 6, op = 0.45, ls = '0.2em',
}: {
  x: number; y: number; children: React.ReactNode
  anchor?: 'start' | 'middle' | 'end'; em?: boolean; size?: number; op?: number; ls?: string
}) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size}
          className={em ? EM_FILL : ''} fill={em ? undefined : 'currentColor'}
          fillOpacity={em ? 0.85 : op}
          style={{ fontFamily: MONO, letterSpacing: ls }}>
      {children}
    </text>
  )
}

function Panel({
  x, y, w, h, op = 0.4, r = 4,
}: {
  x: number; y: number; w: number; h: number; op?: number; r?: number
}) {
  return (
    <rect x={x} y={y} width={w} height={h} rx={r}
          fill="currentColor" fillOpacity="0.015"
          stroke="currentColor" strokeOpacity={op} strokeWidth="0.8" />
  )
}

// small emerald checkmark
function Tick({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <path d={`M ${cx - 2.4 * s} ${cy} l ${1.6 * s} ${1.7 * s} l ${3.2 * s} ${-3.6 * s}`}
          fill="none" className={EM_STROKE}
          strokeWidth={0.9 * s} strokeLinecap="round" strokeLinejoin="round" />
  )
}

// signature wave glyph
function Wave({ x, y, w = 56, em = true }: { x: number; y: number; w?: number; em?: boolean }) {
  const n = 6
  const seg = w / n
  let d = `M ${x} ${y} q ${seg / 2} ${-seg * 0.75} ${seg} 0`
  for (let i = 1; i < n; i++) d += ` t ${seg} 0`
  return (
    <path d={d} fill="none"
          className={em ? EM_STROKE : ''} stroke={em ? undefined : 'currentColor'}
          strokeOpacity={em ? 0.62 : 0.4} strokeWidth="0.7" strokeLinecap="round" />
  )
}

// circular verification seal — the recurring "proof" mark
function Seal({ cx, cy, r = 12 }: { cx: number; cy: number; r?: number }) {
  return (
    <g className={EM_STROKE} fill="none">
      <circle cx={cx} cy={cy} r={r} strokeWidth="0.8" strokeOpacity="0.55" />
      <circle cx={cx} cy={cy} r={r - 3} strokeWidth="0.5" strokeOpacity="0.3"
              strokeDasharray="1.5 2" />
      <path d={`M ${cx - r * 0.34} ${cy + r * 0.02} l ${r * 0.22} ${r * 0.24} l ${r * 0.46} ${-r * 0.5}`}
            strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="stroke-opacity" values="1;0.5;1" dur="2.6s" repeatCount="indefinite" />
      </path>
    </g>
  )
}

// ─────────────────────────────────────────────────────────────
// FIG.1 · RUN — a minimal execution console: agent actions run
// through controlled tools, each row recorded as it commits.
// ─────────────────────────────────────────────────────────────
function RunVisual() {
  const CX = 68, CY = 38, CW = 224, CH = 124
  const barY = CY + 26
  const rows = [
    { n: '01', a: 'read_file', done: true },
    { n: '02', a: 'http_call', done: true },
    { n: '03', a: 'db_write', done: false },
  ]
  return fig(
    <>
      <Panel x={CX} y={CY} w={CW} h={CH} />

      {/* title bar */}
      <circle cx={CX + 15} cy={CY + 13} r="2" className={EM_FILL}>
        <animate attributeName="opacity" values="1;0.35;1" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x={CX + 23} y={CY + 16} fontSize="7" fill="currentColor" fillOpacity="0.8"
            style={{ fontFamily: MONO, letterSpacing: '0.04em' }}>
        igris&nbsp;·&nbsp;execution
      </text>
      <text x={CX + CW - 14} y={CY + 16} textAnchor="end" fontSize="5.4"
            fill="currentColor" fillOpacity="0.35"
            style={{ fontFamily: MONO, letterSpacing: '0.06em' }}>
        task_019de343
      </text>
      <line x1={CX} y1={barY} x2={CX + CW} y2={barY}
            stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.6" />

      {/* action rows */}
      {rows.map((r, i) => {
        const yc = barY + i * 28 + 14
        return (
          <g key={r.n}>
            {i > 0 && (
              <line x1={CX + 16} y1={yc - 14} x2={CX + CW - 16} y2={yc - 14}
                    stroke="currentColor" strokeOpacity="0.09" strokeWidth="0.5" />
            )}
            <text x={CX + 18} y={yc + 2.4} fontSize="5.6" fill="currentColor" fillOpacity="0.32"
                  style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>{r.n}</text>
            <text x={CX + 38} y={yc + 2.6} fontSize="7.6" fill="currentColor" fillOpacity="0.85"
                  style={{ fontFamily: MONO }}>{r.a}</text>
            {r.done ? (
              <>
                <text x={CX + CW - 31} y={yc + 2.4} textAnchor="end" fontSize="6"
                      className={EM_FILL} fillOpacity="0.7"
                      style={{ fontFamily: MONO, letterSpacing: '0.08em' }}>committed</text>
                <Tick cx={CX + CW - 21} cy={yc} s={1.05} />
              </>
            ) : (
              <>
                <text x={CX + CW - 31} y={yc + 2.4} textAnchor="end" fontSize="6"
                      fill="currentColor" fillOpacity="0.42"
                      style={{ fontFamily: MONO, letterSpacing: '0.08em' }}>running</text>
                <circle cx={CX + CW - 21} cy={yc} r="2.5" fill="none"
                        className={EM_STROKE} strokeWidth="0.75">
                  <animate attributeName="stroke-opacity" values="0.65;0.15;0.65"
                           dur="1.4s" repeatCount="indefinite" />
                </circle>
              </>
            )}
          </g>
        )
      })}

      {/* footer */}
      <line x1={CX} y1={barY + 84} x2={CX + CW} y2={barY + 84}
            stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.6" />
      <Lbl x={CX + CW / 2} y={CY + CH - 8} anchor="middle" size={5.2} op={0.4} ls="0.16em">
        CONTROLLED&nbsp;TOOLS&nbsp;·&nbsp;RECORDED&nbsp;AS&nbsp;EVIDENCE
      </Lbl>
    </>,
  )
}

// ─────────────────────────────────────────────────────────────
// FIG.2 · RECOVER — one execution timeline. The host faults
// mid-run; a checkpoint carries progress onto a clean runtime.
// ─────────────────────────────────────────────────────────────
function RecoverVisual() {
  const steps = [
    { a: 'read_file', n: '01' },
    { a: 'http_call', n: '02' },
    { a: 'db_write', n: '03' },
    { a: 'receipt', n: '04' },
    { a: 'verify', n: '05' },
  ]
  const Y = 108
  const xs = [48, 114, 180, 246, 312]
  const faultX = (xs[2] + xs[3]) / 2

  return fig(
    <>
      {/* runtime labels */}
      <Lbl x={xs[1]} y={56} anchor="middle">RUNTIME&nbsp;A</Lbl>
      <line x1={xs[0]} y1={62} x2={xs[2]} y2={62}
            stroke="currentColor" strokeOpacity="0.16" strokeWidth="0.6" />
      <Lbl x={(xs[3] + xs[4]) / 2} y={56} anchor="middle" em>RUNTIME&nbsp;B</Lbl>
      <line x1={xs[3]} y1={62} x2={xs[4]} y2={62}
            className={EM_STROKE} strokeOpacity="0.32" strokeWidth="0.6" />

      {/* main line — broken at the fault */}
      <line x1={xs[0]} y1={Y} x2={faultX - 13} y2={Y}
            stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.7" />
      <line x1={faultX + 13} y1={Y} x2={xs[4]} y2={Y}
            className={EM_STROKE} strokeOpacity="0.5" strokeWidth="0.7" />

      {/* checkpoint carried across the break */}
      <path d={`M ${xs[2]} ${Y - 6} Q ${faultX} ${Y - 34} ${xs[3]} ${Y - 6}`}
            fill="none" className={EM_STROKE}
            strokeOpacity="0.4" strokeWidth="0.6" strokeDasharray="2 2.5" />
      <Lbl x={faultX} y={Y - 30} anchor="middle" size={5} em ls="0.18em">CHECKPOINT</Lbl>
      <g>
        <rect x="-3" y="-2.1" width="6" height="4.2" rx="0.7"
              className={EM_FILL} fillOpacity="0.92" />
        <animateMotion dur="3s" repeatCount="indefinite"
          path={`M ${xs[2]} ${Y - 6} Q ${faultX} ${Y - 34} ${xs[3]} ${Y - 6}`} />
      </g>

      {/* fault mark */}
      <g stroke="darkorange" strokeOpacity="0.8" strokeWidth="1" strokeLinecap="round">
        <line x1={faultX - 3.4} y1={Y - 3.4} x2={faultX + 3.4} y2={Y + 3.4} />
        <line x1={faultX + 3.4} y1={Y - 3.4} x2={faultX - 3.4} y2={Y + 3.4} />
      </g>
      <text x={faultX} y={Y + 19} textAnchor="middle" fontSize="5"
            fill="darkorange" fillOpacity="0.8"
            style={{ fontFamily: MONO, letterSpacing: '0.18em' }}>
        HOST&nbsp;FAULT
      </text>

      {/* step nodes */}
      {steps.map((s, i) => {
        const x = xs[i]
        const em = i >= 3
        const isVerify = i === 4
        return (
          <g key={s.n}>
            <text x={x} y={Y - 14} textAnchor="middle" fontSize="6.4"
                  fill="currentColor" fillOpacity="0.62" style={{ fontFamily: MONO }}>
              {s.a}
            </text>
            {isVerify ? (
              <>
                <circle cx={x} cy={Y} r="4.6" fill="none"
                        className={EM_STROKE} strokeWidth="0.8" strokeOpacity="0.7" />
                <Tick cx={x} cy={Y} s={0.95} />
              </>
            ) : (
              <>
                <circle cx={x} cy={Y} r="3.4" fill="none"
                        className={em ? EM_STROKE : ''}
                        stroke={em ? undefined : 'currentColor'}
                        strokeWidth="0.8" strokeOpacity={em ? 0.7 : 0.42} />
                <circle cx={x} cy={Y} r="1.4"
                        className={em ? EM_FILL : ''}
                        fill={em ? undefined : 'currentColor'}
                        fillOpacity={em ? 0.9 : 0.5} />
              </>
            )}
            <text x={x} y={Y + 21} textAnchor="middle" fontSize="5.4"
                  fill="currentColor" fillOpacity="0.32"
                  style={{ fontFamily: MONO, letterSpacing: '0.16em' }}>
              {s.n}
            </text>
          </g>
        )
      })}
    </>,
  )
}

// ─────────────────────────────────────────────────────────────
// FIG.3 · VERIFY — one signed receipt. Ghosted receipts behind
// it imply the chain; the seal carries the verification verdict.
// ─────────────────────────────────────────────────────────────
function ReceiptVisual() {
  const CW = 104, CH = 134
  const X = 180 - CW / 2
  const Y = 40
  const cx = 180

  return fig(
    <>
      {/* ghosted prior receipts — the chain behind this one */}
      <rect x={X + 14} y={Y - 14} width={CW} height={CH} rx="4" fill="none"
            stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.7" />
      <rect x={X + 7} y={Y - 7} width={CW} height={CH} rx="4" fill="none"
            stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.7" />

      {/* front receipt */}
      <Panel x={X} y={Y} w={CW} h={CH} op={0.42} />
      <Lbl x={cx} y={Y + 17} anchor="middle" size={6} op={0.5} ls="0.26em">RECEIPT</Lbl>
      <line x1={X + 12} y1={Y + 24} x2={X + CW - 12} y2={Y + 24}
            stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5" />

      <text x={cx} y={Y + 43} textAnchor="middle" fontSize="11"
            fill="currentColor" fillOpacity="0.9"
            style={{ fontFamily: MONO, letterSpacing: '0.12em' }}>
        r₀₅
      </text>
      <Lbl x={cx} y={Y + 54} anchor="middle" size={4.8} op={0.4} ls="0.14em">
        SIGNED&nbsp;·&nbsp;ED25519
      </Lbl>

      <Wave x={X + 22} y={Y + 72} w={CW - 44} />
      <Lbl x={cx} y={Y + 82} anchor="middle" size={4.6} op={0.36} ls="0.18em">SIGNATURE</Lbl>
      <line x1={X + 12} y1={Y + 90} x2={X + CW - 12} y2={Y + 90}
            stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.5" />

      {/* seal — the verdict */}
      <Seal cx={cx} cy={Y + 110} r={13} />
      <Lbl x={cx} y={Y + 131} anchor="middle" size={6} em ls="0.22em">CHAIN&nbsp;VALID</Lbl>
    </>,
  )
}

// ─────────────────────────────────────────────────────────────
// FIG.4 · INSPECT — one operator record. Four facets of a
// completed task gathered into a single place.
// ─────────────────────────────────────────────────────────────
function InspectVisual() {
  const cx = 180, cy = 100
  const ccw = 70, cch = 30
  const facets = [
    { k: 'OUTCOME', v: 'completed', em: true,
      x: 138, y: 24, w: 84, h: 30, dot: [180, 54] as const, to: [180, cy - cch / 2] as const },
    { k: 'VERIFICATION', v: 'chain valid', em: true,
      x: 252, y: 84, w: 92, h: 32, dot: [252, 100] as const, to: [cx + ccw / 2, cy] as const },
    { k: 'EVIDENCE', v: 'receipt r₀₅', em: false,
      x: 138, y: 146, w: 84, h: 30, dot: [180, 146] as const, to: [180, cy + cch / 2] as const },
    { k: 'RECOVERY', v: 'fra1·a → b', em: false,
      x: 16, y: 84, w: 92, h: 32, dot: [108, 100] as const, to: [cx - ccw / 2, cy] as const },
  ]

  return fig(
    <>
      {/* spokes — every facet gathers inward to the record */}
      {facets.map((f) => {
        const horiz = f.dot[1] === f.to[1]
        let head: string
        if (horiz) {
          const d = f.to[0] > f.dot[0] ? 1 : -1
          head = `M ${f.to[0] - d * 3.4} ${f.to[1] - 2.3} L ${f.to[0]} ${f.to[1]} L ${f.to[0] - d * 3.4} ${f.to[1] + 2.3}`
        } else {
          const d = f.to[1] > f.dot[1] ? 1 : -1
          head = `M ${f.to[0] - 2.3} ${f.to[1] - d * 3.4} L ${f.to[0]} ${f.to[1]} L ${f.to[0] + 2.3} ${f.to[1] - d * 3.4}`
        }
        return (
          <g key={f.k}>
            <line x1={f.dot[0]} y1={f.dot[1]} x2={f.to[0]} y2={f.to[1]}
                  stroke="currentColor" strokeOpacity="0.26"
                  strokeWidth="0.6" strokeDasharray="2 2.5" />
            <path d={head} fill="none" stroke="currentColor" strokeOpacity="0.4"
                  strokeWidth="0.7" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        )
      })}

      {/* facet panels */}
      {facets.map((f) => (
        <g key={`p-${f.k}`}>
          <Panel x={f.x} y={f.y} w={f.w} h={f.h} op={0.34} />
          <Lbl x={f.x + f.w / 2} y={f.y + 13} anchor="middle" size={5} op={0.42} ls="0.18em">
            {f.k}
          </Lbl>
          <text x={f.x + f.w / 2} y={f.y + 24} textAnchor="middle" fontSize="7.4"
                className={f.em ? EM_FILL : ''}
                fill={f.em ? undefined : 'currentColor'}
                fillOpacity={f.em ? 0.9 : 0.82}
                style={{ fontFamily: MONO }}>
            {f.v}
          </text>
        </g>
      ))}

      {/* center — the record itself */}
      <rect x={cx - ccw / 2} y={cy - cch / 2} width={ccw} height={cch} rx="4"
            className={EM_FILL} fillOpacity="0.05" stroke="none" />
      <rect x={cx - ccw / 2} y={cy - cch / 2} width={ccw} height={cch} rx="4"
            fill="none" className={EM_STROKE} strokeOpacity="0.5" strokeWidth="0.85" />
      <Lbl x={cx} y={cy - 3} anchor="middle" size={5} op={0.45} ls="0.2em">TASK&nbsp;RECORD</Lbl>
      <text x={cx} y={cy + 9} textAnchor="middle" fontSize="6.4"
            fill="currentColor" fillOpacity="0.88"
            style={{ fontFamily: MONO, letterSpacing: '0.02em' }}>
        task_019de343
      </text>
    </>,
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
    fig: 'FIG.1 · THE TASK',
    num: '01',
    name: 'Run',
    body: 'Turn agent decisions into controlled actions. Igris runs each action through a bounded execution path and records exactly what committed.',
    sublist: [
      { id: '1.1', label: 'Real actions execute through controlled tools' },
      { id: '1.2', label: 'Each committed step becomes durable evidence' },
      { id: '1.3', label: 'Side effects are counted and attributable' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RunVisual,
  },
  {
    fig: 'FIG.2 · RECOVERY HANDOFF',
    num: '02',
    name: 'Recover',
    body: 'When an execution environment stops mid-run, the task does not restart from zero. Igris continues from recorded progress.',
    sublist: [
      { id: '2.1', label: 'Resume from recorded progress' },
      { id: '2.2', label: 'Already-committed actions are not replayed' },
      { id: '2.3', label: 'Recovery behavior is proven before release' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: RecoverVisual,
  },
  {
    fig: 'FIG.3 · RECEIPT CHAIN',
    num: '03',
    name: 'Verify',
    body: 'Check the receipt chain. Every committed action leaves a signed receipt that can be checked later.',
    sublist: [
      { id: '3.1', label: 'Signed receipts for completed work' },
      { id: '3.2', label: 'Execution identity is bound to the proof' },
      { id: '3.3', label: 'Chain validity survives recovery boundaries' },
    ],
    cta: { label: 'DOCS', href: 'https://docs.igrisinertial.com/' },
    Visual: ReceiptVisual,
  },
  {
    fig: 'FIG.4 · OPERATOR RECORD',
    num: '04',
    name: 'Inspect',
    body: 'See the evidence without raw payloads. Operators see the outcome, recovery path, evidence trail, and verification state in one place.',
    sublist: [
      { id: '4.1', label: 'Plain status for agent actions' },
      { id: '4.2', label: 'Recovery handoff remains visible' },
      { id: '4.3', label: 'Evidence summaries stay safe to inspect' },
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

      <div className="px-0">
        <div className="px-0">

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-10 md:pt-14 pb-6 md:pb-8">

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
              Run agent actions you can recover and prove.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Igris turns agent decisions into controlled actions with
              recorded progress, clean-host recovery, signed receipts, and
              operator-readable evidence.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <a
                href="https://docs.igrisinertial.com"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
                style={{ fontFamily: SANS }}
              >
                Read the docs ↗
              </a>
            </div>
          </div>



          {/* 2×2 card grid */}
          <div
            className="grid grid-cols-1 md:grid-cols-2"
          >
            {cards.map((c, i) => (
              <article
                key={c.num}
                className={`cap-card ${revealed ? 'is-in' : ''} relative flex flex-col`}
                style={{
                  animationDelay: `${120 + i * 110}ms`,
                  height: 'clamp(580px, 60vw, 660px)',
                }}
              >
                {/* FIG.N tag · plain-language name + dominant status */}
                <div className="px-7 md:px-9 pt-6 pb-3 flex items-baseline justify-between gap-4">
                  <span
                    className="text-gray-400 dark:text-[#5a5a52] truncate"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {c.fig}
                  </span>
                </div>

                {/* Visual area — fixed height so all four cards align */}
                <div
                  className="px-6 md:px-7 pt-6 pb-8 flex items-center justify-center text-gray-900 dark:text-[#c8c8b8]"
                  style={{ height: 'clamp(260px, 26vw, 320px)' }}
                >
                  <div className="w-full">
                    <c.Visual />
                  </div>
                </div>

                {/* Title + body + sublist row */}
                <div className="px-7 md:px-9 pt-6 pb-8 mt-auto flex-1 flex flex-col">
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
                        className="mt-5 self-start inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12] normal-case"
                        style={{ fontFamily: SANS }}
                      >
                        {c.cta.label} ↗
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

          <div className="pb-6 md:pb-10" />

        </div>
      </div>
    </section>
  )
}
