'use client'

import React, { useEffect, useRef, useState } from 'react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const EM_STROKE = 'stroke-emerald-700 dark:stroke-emerald-400'
const EM_FILL = 'fill-emerald-700 dark:fill-emerald-400'

const cards = [
  {
    id: 'side-effects',
    title: 'Real side effects',
    body: 'Use Igris when agents need to perform actions with business impact: creating invoices, calling APIs, triggering workflows, writing to databases, or changing state.',
    fig: 'FIG.A · SIDE EFFECTS',
  },
  {
    id: 'proof',
    title: 'Auditability and proof',
    body: 'Use Igris when your team needs a clear record of what the agent actually did, not just logs, screenshots, or a final answer.',
    fig: 'FIG.B · RECEIPT TRAIL',
  },
  {
    id: 'hybrid',
    title: 'Hybrid execution',
    body: 'Use Igris when some actions run through cloud endpoints and others need private, local, edge, or internal execution with the same governance model.',
    fig: 'FIG.C · HYBRID ROUTING',
  },
  {
    id: 'boundaries',
    title: 'Opinionated execution',
    body: 'Use Igris when you want stronger boundaries, recovery, and proof than a general workflow engine usually provides.',
    fig: 'FIG.D · GOVERNED PATH',
  },
] as const

function figWrap(children: React.ReactNode) {
  return (
    <div className="flex h-full w-full items-center justify-center text-gray-700 dark:text-[#c8c8b8]" style={{ fontFamily: MONO }}>
      <svg viewBox="0 0 360 240" className="h-full w-full max-h-[420px] min-h-[280px]" preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  )
}

function MicroLabel({ x, y, children, em = false }: { x: number; y: number; children: React.ReactNode; em?: boolean }) {
  return (
    <text
      x={x}
      y={y}
      fontSize="6"
      className={em ? EM_FILL : ''}
      fill={em ? undefined : 'currentColor'}
      fillOpacity={em ? 0.9 : 0.45}
      style={{ fontFamily: MONO, letterSpacing: '0.14em' }}
    >
      {children}
    </text>
  )
}

function SideEffectsVisual() {
  const targets = [
    { x: 72, y: 58, label: 'invoice' },
    { x: 288, y: 58, label: 'api_call' },
    { x: 72, y: 188, label: 'db_write' },
    { x: 288, y: 188, label: 'workflow' },
  ]
  return figWrap(
    <>
      <rect x="138" y="96" width="84" height="48" rx="5" fill="currentColor" fillOpacity="0.03" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      <text x="180" y="118" textAnchor="middle" fontSize="7" fill="currentColor" fillOpacity="0.75" style={{ fontFamily: MONO }}>
        agent_task
      </text>
      <circle cx="180" cy="132" r="3" className={EM_FILL}>
        <animate attributeName="opacity" values="1;0.35;1" dur="2.2s" repeatCount="indefinite" />
      </circle>
      {targets.map((t) => (
        <g key={t.label}>
          <line x1="180" y1="120" x2={t.x + 36} y2={t.y + 16} stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.7" strokeDasharray="3 3" />
          <rect x={t.x} y={t.y} width="72" height="32" rx="4" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.7" />
          <text x={t.x + 36} y={t.y + 19} textAnchor="middle" fontSize="5.8" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO }}>
            {t.label}
          </text>
          <circle cx={t.x + 60} cy={t.y + 10} r="2" className={EM_FILL} fillOpacity="0.8" />
        </g>
      ))}
      <MicroLabel x="24" y="228" em>
        committed actions
      </MicroLabel>
    </>,
  )
}

function ProofVisual() {
  const rows = ['charge_customer', 'http_call', 'db_write', 'signed_receipt']
  return figWrap(
    <>
      <rect x="52" y="36" width="256" height="168" rx="6" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.8" />
      <text x="68" y="58" fontSize="6.5" fill="currentColor" fillOpacity="0.5" style={{ fontFamily: MONO, letterSpacing: '0.12em' }}>
        action evidence
      </text>
      {rows.map((row, i) => {
        const y = 78 + i * 30
        return (
          <g key={row}>
            <line x1="68" y1={y + 18} x2="292" y2={y + 18} stroke="currentColor" strokeOpacity="0.12" strokeWidth="0.6" />
            <text x="76" y={y + 12} fontSize="6" fill="currentColor" fillOpacity="0.62" style={{ fontFamily: MONO }}>
              {row}
            </text>
            <circle cx="286" cy={y + 8} r="7" fill="none" className={EM_STROKE} strokeWidth="0.7" strokeOpacity="0.55" />
            <path
              d={`M ${286 - 3} ${y + 8} l 2 2.2 l 4.2 -4.6`}
              fill="none"
              className={EM_STROKE}
              strokeWidth="0.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </g>
        )
      })}
      <MicroLabel x="24" y="228" em>
        inspectable proof
      </MicroLabel>
    </>,
  )
}

function HybridVisual() {
  const nodes = [
    { x: 56, y: 92, label: 'cloud', sub: 'hosted api' },
    { x: 144, y: 156, label: 'runtime', sub: 'rt_prod_01' },
    { x: 248, y: 92, label: 'edge', sub: 'local worker' },
  ]
  return figWrap(
    <>
      <circle cx="180" cy="118" r="22" fill="currentColor" fillOpacity="0.03" stroke="currentColor" strokeOpacity="0.35" strokeWidth="0.8" />
      <text x="180" y="116" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: MONO }}>
        igris
      </text>
      <text x="180" y="126" textAnchor="middle" fontSize="5" fill="currentColor" fillOpacity="0.4" style={{ fontFamily: MONO }}>
        router
      </text>
      {nodes.map((n) => (
        <g key={n.label}>
          <line x1="180" y1="118" x2={n.x + 28} y2={n.y + 18} stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.8" />
          <rect x={n.x} y={n.y} width="56" height="36" rx="4" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.32" strokeWidth="0.7" />
          <text x={n.x + 28} y={n.y + 14} textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.62" style={{ fontFamily: MONO }}>
            {n.label}
          </text>
          <text x={n.x + 28} y={n.y + 26} textAnchor="middle" fontSize="4.8" fill="currentColor" fillOpacity="0.38" style={{ fontFamily: MONO }}>
            {n.sub}
          </text>
        </g>
      ))}
      <MicroLabel x="24" y="228" em>
        same governance
      </MicroLabel>
    </>,
  )
}

function BoundariesVisual() {
  return figWrap(
    <>
      <rect x="48" y="88" width="72" height="34" rx="4" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.7" />
      <text x="84" y="108" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO }}>
        policy
      </text>
      <line x1="120" y1="105" x2="156" y2="105" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.8" />
      <rect x="156" y="88" width="72" height="34" rx="4" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.45" strokeWidth="0.8" className="dark:stroke-emerald-400/50" />
      <text x="192" y="108" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.7" style={{ fontFamily: MONO }}>
        execute
      </text>
      <line x1="228" y1="105" x2="264" y2="105" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.8" />
      <rect x="264" y="88" width="48" height="34" rx="4" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.7" />
      <text x="288" y="108" textAnchor="middle" fontSize="6" fill="currentColor" fillOpacity="0.55" style={{ fontFamily: MONO }}>
        proof
      </text>
      <path d="M 192 122 v 26" stroke="currentColor" strokeOpacity="0.2" strokeWidth="0.7" />
      <path d="M 192 148 h 44 v 24 h -88 v -24 h 44" fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.7" strokeDasharray="3 3" />
      <rect x="124" y="172" width="136" height="30" rx="4" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.28" strokeWidth="0.7" />
      <text x="192" y="190" textAnchor="middle" fontSize="5.8" fill="currentColor" fillOpacity="0.5" style={{ fontFamily: MONO }}>
        recovery path · retry · compensate
      </text>
      <MicroLabel x="24" y="228" em>
        bounded execution
      </MicroLabel>
    </>,
  )
}

const VISUALS = [SideEffectsVisual, ProofVisual, HybridVisual, BoundariesVisual] as const

const CARD_BASE =
  'landing-surface-card flex w-full max-w-md flex-col rounded-xl border p-6 text-left transition-all duration-300 md:p-8 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] backdrop-blur-[2px] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]'

export default function WhenToUseIgris() {
  const [activeIndex, setActiveIndex] = useState(0)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const clickLockRef = useRef(false)
  const clickLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    cardRefs.current.forEach((el, index) => {
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !clickLockRef.current) {
            setActiveIndex(index)
          }
        },
        { rootMargin: '-40% 0px -40% 0px', threshold: 0.01 },
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  useEffect(() => {
    return () => {
      if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current)
    }
  }, [])

  const activateCard = (index: number) => {
    setActiveIndex(index)
    clickLockRef.current = true
    if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current)
    clickLockTimerRef.current = setTimeout(() => {
      clickLockRef.current = false
    }, 900)
  }

  const ActiveVisual = VISUALS[activeIndex]

  return (
    <section
      id="when-to-use"
      aria-labelledby="when-to-use-heading"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <style>{`
        @keyframes wtu-visual-in {
          from { opacity: 0; transform: translateY(6px) scale(0.985); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .wtu-visual.is-active {
          animation: wtu-visual-in 480ms cubic-bezier(0.22, 0.61, 0.36, 1) forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .wtu-visual.is-active { animation: none; }
        }
      `}</style>

      <div className="pt-10 md:pt-14 pb-20 md:pb-32">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
          <h2
            id="when-to-use-heading"
            className="shrink-0 text-gray-700 dark:text-[#c8c8b8]"
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              maxWidth: '28ch',
            }}
          >
            Use Igris when the action matters.
          </h2>
          <p
            className="max-w-[42ch] text-gray-600 dark:text-[#a8a898] md:text-right"
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
              lineHeight: 1.6,
            }}
          >
            Igris is most useful when agent actions have consequences and your team
            needs control, recovery, and proof around execution.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-xl md:mt-16">
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-cover"
            style={{ backgroundImage: 'url(/pkrllgol.png)' }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-white/55 dark:bg-[#110f0f]/50" aria-hidden />

          <div className="relative z-10 grid grid-cols-1 gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_minmax(380px,540px)] lg:items-center lg:gap-12 lg:p-10 lg:py-12">
            <div className="flex flex-col items-start gap-3 md:gap-4">
              {cards.map((card, index) => {
                const isActive = activeIndex === index
                return (
                  <article
                    key={card.id}
                    ref={(el) => {
                      cardRefs.current[index] = el
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onClick={() => activateCard(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        activateCard(index)
                      }
                    }}
                    className={
                      CARD_BASE +
                      ' cursor-pointer hover:border-[var(--landing-surface-border-strong)] ' +
                      (isActive
                        ? 'border-emerald-700/35 bg-white/80 ring-1 ring-emerald-700/20 dark:border-emerald-400/35 dark:bg-[#161515]/85 dark:ring-emerald-400/20'
                        : 'border-[var(--landing-surface-border)] bg-[var(--landing-surface)]/88 opacity-80')
                    }
                  >
                    <p
                      className="text-gray-400 dark:text-[#7a7a72]"
                      style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em' }}
                    >
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <h3
                      className="mt-3 text-gray-700 dark:text-[#c8c8b8]"
                      style={{
                        fontFamily: SANS,
                        fontSize: 'clamp(1.05rem, 1.2vw, 1.15rem)',
                        fontWeight: 500,
                        lineHeight: 1.35,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {card.title}
                    </h3>
                    <p
                      className="mt-3 text-gray-600 dark:text-[#a8a898]"
                      style={{
                        fontFamily: SANS,
                        fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                        lineHeight: 1.65,
                      }}
                    >
                      {card.body}
                    </p>
                  </article>
                )
              })}
            </div>

            <div className="flex w-full items-center justify-center lg:sticky lg:top-24 lg:self-center">
              <div
                className="landing-surface-card flex w-full flex-col rounded-xl border border-[var(--landing-surface-border)] bg-[var(--landing-surface)]/92 p-6 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] backdrop-blur-md dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)] md:p-8"
                aria-live="polite"
                aria-atomic="true"
              >
                <p
                  className="mb-5 text-center text-gray-500 dark:text-[#8a8a7a] lg:mb-6"
                  style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.14em' }}
                >
                  {cards[activeIndex].fig}
                </p>
                <div className="relative flex min-h-[300px] items-center justify-center md:min-h-[360px] lg:min-h-[420px]">
                  <div key={activeIndex} className="wtu-visual is-active absolute inset-0 flex items-center justify-center">
                    <ActiveVisual />
                  </div>
                </div>
                <p
                  className="mt-5 text-center text-gray-600 dark:text-[#a8a898] lg:mt-6"
                  style={{ fontFamily: SANS, fontSize: 'clamp(1rem, 1.1vw, 1.1rem)', lineHeight: 1.5 }}
                >
                  {cards[activeIndex].title}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}