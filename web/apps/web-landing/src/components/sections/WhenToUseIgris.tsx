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
      <svg viewBox="0 0 400 280" className="h-full w-full max-h-[440px] min-h-[300px]" preserveAspectRatio="xMidYMid meet">
        {children}
      </svg>
    </div>
  )
}

function FigPanel({ x, y, w, h, r = 6 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill="currentColor"
      fillOpacity="0.018"
      stroke="currentColor"
      strokeOpacity="0.34"
      strokeWidth="0.9"
    />
  )
}

function FigLbl({
  x,
  y,
  children,
  anchor = 'start',
  em = false,
  size = 6.2,
  op = 0.42,
}: {
  x: number
  y: number
  children: React.ReactNode
  anchor?: 'start' | 'middle' | 'end'
  em?: boolean
  size?: number
  op?: number
}) {
  return (
    <text
      x={x}
      y={y}
      textAnchor={anchor}
      fontSize={size}
      className={em ? EM_FILL : ''}
      fill={em ? undefined : 'currentColor'}
      fillOpacity={em ? 0.88 : op}
      style={{ fontFamily: MONO, letterSpacing: '0.16em' }}
    >
      {children}
    </text>
  )
}

function FigTick({ cx, cy, s = 1 }: { cx: number; cy: number; s?: number }) {
  return (
    <path
      d={`M ${cx - 2.6 * s} ${cy} l ${1.7 * s} ${1.8 * s} l ${3.4 * s} ${-3.8 * s}`}
      fill="none"
      className={EM_STROKE}
      strokeWidth={0.95 * s}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  )
}

function FigSeal({ cx, cy, r = 13 }: { cx: number; cy: number; r?: number }) {
  return (
    <g className={EM_STROKE} fill="none">
      <circle cx={cx} cy={cy} r={r} strokeWidth="0.85" strokeOpacity="0.58" />
      <circle cx={cx} cy={cy} r={r - 3.5} strokeWidth="0.55" strokeOpacity="0.28" strokeDasharray="2 2.5" />
      <FigTick cx={cx} cy={cy} s={1.05} />
    </g>
  )
}

function SideEffectsVisual() {
  const CX = 44
  const CY = 34
  const CW = 312
  const CH = 196
  const targets = [
    { x: 58, y: 72, label: 'create_invoice', status: 'committed' },
    { x: 226, y: 72, label: 'http_call', status: 'committed' },
    { x: 58, y: 168, label: 'db_write', status: 'running' },
    { x: 226, y: 168, label: 'workflow', status: 'queued' },
  ]
  return figWrap(
    <>
      <FigPanel x={CX} y={CY} w={CW} h={CH} />
      <circle cx={CX + 16} cy={CY + 14} r="2.2" className={EM_FILL}>
        <animate attributeName="opacity" values="1;0.3;1" dur="2.1s" repeatCount="indefinite" />
      </circle>
      <text x={CX + 26} y={CY + 17} fontSize="7.2" fill="currentColor" fillOpacity="0.82" style={{ fontFamily: MONO, letterSpacing: '0.05em' }}>
        action dispatch
      </text>
      <FigLbl x={CX + CW - 16} y={CY + 17} anchor="end" size={5.4} op={0.34}>
        charge_customer
      </FigLbl>
      <line x1={CX} y1={CY + 30} x2={CX + CW} y2={CY + 30} stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.7" />

      <rect x={152} y={108} width={96} height={48} rx="6" fill="currentColor" fillOpacity="0.035" stroke="currentColor" strokeOpacity="0.38" strokeWidth="0.85" />
      <text x={200} y={130} textAnchor="middle" fontSize="7.4" fill="currentColor" fillOpacity="0.78" style={{ fontFamily: MONO }}>
        agent_task
      </text>
      <FigLbl x={200} y={146} anchor="middle" size={5.2} em>
        real side effects
      </FigLbl>

      {targets.map((t) => {
        const tx = t.x + 58
        const ty = t.y + 20
        const committed = t.status === 'committed'
        const running = t.status === 'running'
        return (
          <g key={t.label}>
            <path
              d={`M 200 120 Q ${(200 + tx) / 2} ${(120 + ty) / 2 - 18} ${tx} ${ty}`}
              fill="none"
              stroke="currentColor"
              strokeOpacity={committed ? 0.34 : 0.18}
              strokeWidth="0.75"
              className={committed ? EM_STROKE : ''}
              strokeDasharray={running ? '3 3' : undefined}
            />
            <rect x={t.x} y={t.y} width={116} height={40} rx="5" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.3" strokeWidth="0.75" />
            <text x={t.x + 12} y={t.y + 17} fontSize="6.4" fill="currentColor" fillOpacity="0.72" style={{ fontFamily: MONO }}>
              {t.label}
            </text>
            <text x={t.x + 12} y={t.y + 30} fontSize="5.2" fill="currentColor" fillOpacity="0.38" style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
              {t.status}
            </text>
            {committed ? (
              <g transform={`translate(${t.x + 98} ${t.y + 20})`}>
                <FigTick cx={0} cy={0} />
              </g>
            ) : running ? (
              <circle cx={t.x + 98} cy={t.y + 20} r="3" fill="none" className={EM_STROKE} strokeWidth="0.8">
                <animate attributeName="stroke-opacity" values="0.7;0.2;0.7" dur="1.5s" repeatCount="indefinite" />
              </circle>
            ) : null}
          </g>
        )
      })}

      <FigLbl x={200} y={CY + CH + 18} anchor="middle" size={5.4} op={0.38}>
        STATE CHANGES · APIS · WORKFLOWS
      </FigLbl>
    </>,
  )
}

function ProofVisual() {
  const CX = 48
  const CY = 38
  const CW = 304
  const CH = 188
  const rows = [
    { action: 'charge_customer', proof: 'verified', hash: 'r0a8…f2' },
    { action: 'http_call', proof: 'verified', hash: 'r1c3…9b' },
    { action: 'db_write', proof: 'pending', hash: 'r2d1…44' },
    { action: 'signed_receipt', proof: 'sealed', hash: 'r3e7…aa' },
  ]
  return figWrap(
    <>
      <FigPanel x={CX} y={CY} w={CW} h={CH} />
      <FigLbl x={CX + 16} y={CY + 18} size={6.4} op={0.48}>
        EVIDENCE LEDGER
      </FigLbl>
      <line x1={CX} y1={CY + 28} x2={CX + CW} y2={CY + 28} stroke="currentColor" strokeOpacity="0.14" strokeWidth="0.7" />

      {rows.map((row, i) => {
        const y = CY + 48 + i * 34
        const verified = row.proof === 'verified' || row.proof === 'sealed'
        return (
          <g key={row.action}>
            {i > 0 && <line x1={CX + 14} y1={y - 10} x2={CX + CW - 14} y2={y - 10} stroke="currentColor" strokeOpacity="0.08" strokeWidth="0.55" />}
            <text x={CX + 18} y={y + 4} fontSize="6.8" fill="currentColor" fillOpacity="0.78" style={{ fontFamily: MONO }}>
              {row.action}
            </text>
            <text x={CX + CW - 108} y={y + 4} fontSize="5.6" fill="currentColor" fillOpacity="0.4" style={{ fontFamily: MONO }}>
              {row.hash}
            </text>
            <text x={CX + CW - 44} y={y + 4} textAnchor="end" fontSize="5.8" className={verified ? EM_FILL : ''} fill={verified ? undefined : 'currentColor'} fillOpacity={verified ? 0.75 : 0.42} style={{ fontFamily: MONO, letterSpacing: '0.1em' }}>
              {row.proof}
            </text>
            {verified ? <FigTick cx={CX + CW - 24} cy={y} s={0.95} /> : <circle cx={CX + CW - 24} cy={y} r="2.5" fill="currentColor" fillOpacity="0.25" />}
          </g>
        )
      })}

      <rect x={CX + CW - 92} y={CY + CH - 54} width={72} height={38} rx="5" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.7" />
      <FigSeal cx={CX + CW - 56} cy={CY + CH - 35} r={11} />
      <FigLbl x={CX + CW - 56} y={CY + CH - 8} anchor="middle" size={5} em>
        inspectable
      </FigLbl>
    </>,
  )
}

function HybridVisual() {
  const nodes = [
    { x: 52, y: 78, label: 'CLOUD', sub: 'hosted api', em: false },
    { x: 152, y: 178, label: 'RUNTIME', sub: 'rt_prod_01', em: true },
    { x: 252, y: 78, label: 'EDGE', sub: 'local worker', em: false },
  ]
  return figWrap(
    <>
      <circle cx={200} cy={128} r="34" fill="currentColor" fillOpacity="0.025" stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.8" />
      <circle cx={200} cy={128} r="22" fill="currentColor" fillOpacity="0.04" stroke="currentColor" strokeOpacity="0.42" strokeWidth="0.85" />
      <text x={200} y={124} textAnchor="middle" fontSize="7.2" fill="currentColor" fillOpacity="0.82" style={{ fontFamily: MONO, letterSpacing: '0.08em' }}>
        IGRIS
      </text>
      <FigLbl x={200} y={138} anchor="middle" size={5.2} em>
        router
      </FigLbl>

      <ellipse cx={200} cy={128} rx="118" ry="72" fill="none" stroke="currentColor" strokeOpacity="0.1" strokeWidth="0.7" strokeDasharray="4 4" />

      {nodes.map((n) => {
        const nx = n.x + 48
        const ny = n.y + 24
        return (
          <g key={n.label}>
            <line x1={200} y1={128} x2={nx} y2={ny} stroke="currentColor" strokeOpacity="0.22" strokeWidth="0.85" className={n.em ? EM_STROKE : ''} />
            <rect x={n.x} y={n.y} width={96} height={48} rx="6" fill="currentColor" fillOpacity={n.em ? 0.04 : 0.02} stroke="currentColor" strokeOpacity={n.em ? 0.45 : 0.3} strokeWidth="0.8" className={n.em ? 'dark:stroke-emerald-400/45' : ''} />
            <FigLbl x={n.x + 48} y={n.y + 18} anchor="middle" size={6} op={0.62}>
              {n.label}
            </FigLbl>
            <text x={n.x + 48} y={n.y + 34} textAnchor="middle" fontSize="5.4" fill="currentColor" fillOpacity="0.38" style={{ fontFamily: MONO }}>
              {n.sub}
            </text>
            <circle cx={n.x + 84} cy={n.y + 12} r="2.2" className={n.em ? EM_FILL : ''} fill={n.em ? undefined : 'currentColor'} fillOpacity={n.em ? 1 : 0.35} />
          </g>
        )
      })}

      <FigLbl x={200} y={252} anchor="middle" size={5.4} op={0.38}>
        ONE GOVERNANCE MODEL · ANY SURFACE
      </FigLbl>
    </>,
  )
}

function BoundariesVisual() {
  const steps = [
    { x: 62, label: 'policy', sub: 'limits' },
    { x: 152, label: 'execute', sub: 'bounded' },
    { x: 242, label: 'proof', sub: 'receipt' },
    { x: 332, label: 'inspect', sub: 'operator' },
  ]
  const Y = 118
  return figWrap(
    <>
      <FigPanel x={36} y={52} w={328} h={148} />

      {steps.map((s, i) => {
        const cx = s.x + 34
        const em = i === 1 || i === 2
        return (
          <g key={s.label}>
            {i < steps.length - 1 && (
              <line
                x1={cx + 22}
                y1={Y}
                x2={steps[i + 1].x + 12}
                y2={Y}
                stroke="currentColor"
                strokeOpacity="0.24"
                strokeWidth="0.8"
                className={i >= 1 ? EM_STROKE : ''}
              />
            )}
            <rect x={s.x} y={Y - 22} width={68} height={44} rx="5" fill="currentColor" fillOpacity={em ? 0.04 : 0.02} stroke="currentColor" strokeOpacity={em ? 0.42 : 0.28} strokeWidth="0.8" />
            <text x={cx} y={Y - 4} textAnchor="middle" fontSize="6.6" fill="currentColor" fillOpacity="0.74" style={{ fontFamily: MONO }}>
              {s.label}
            </text>
            <text x={cx} y={Y + 10} textAnchor="middle" fontSize="5.2" fill="currentColor" fillOpacity="0.36" style={{ fontFamily: MONO }}>
              {s.sub}
            </text>
            <circle cx={cx} cy={Y + 28} r="3.2" fill="none" className={em ? EM_STROKE : ''} stroke={em ? undefined : 'currentColor'} strokeWidth="0.8" strokeOpacity={em ? 0.7 : 0.35} />
          </g>
        )
      })}

      <path
        d="M 186 166 Q 200 198 152 210 Q 104 222 120 196"
        fill="none"
        stroke="currentColor"
        strokeOpacity="0.26"
        strokeWidth="0.75"
        strokeDasharray="3 3"
      />
      <rect x={118} y={206} width={124} height={32} rx="5" fill="currentColor" fillOpacity="0.02" stroke="currentColor" strokeOpacity="0.24" strokeWidth="0.7" />
      <FigLbl x={180} y={226} anchor="middle" size={5.4} em>
        recovery · retry · compensate
      </FigLbl>

      <FigLbl x={200} y={72} anchor="middle" size={5.6} op={0.4}>
        OPINIONATED EXECUTION PATH
      </FigLbl>
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