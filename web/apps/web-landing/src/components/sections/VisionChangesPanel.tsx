'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, FileDiff } from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const VISION_EASE = [0.16, 1, 0.3, 1] as const
const LOG_LINE_INTERVAL_MS = 82
const LOG_REPLAY_START_MS = 140

type ChangeStep = {
  index: number
  name: string
  detail: string
  latency?: string
  receipt?: string
  status?: string
  isFailure?: boolean
}

const SUCCESS_STATUSES = new Set(['allowed', 'routed', 'recorded', 'verified', 'confirmed'])

const DEMO_STEPS: ChangeStep[] = [
  { index: 1, name: 'action_requested', detail: 'deploy.staging, tenant scoped', latency: '4ms', status: 'recorded' },
  { index: 2, name: 'policy_check', detail: 'business idempotency key accepted', latency: '2ms', status: 'allowed' },
  { index: 3, name: 'approval_check', detail: 'operator approval recorded', latency: '2ms', status: 'allowed' },
  { index: 4, name: 'target_validated', detail: 'public HTTPS destination allowed', latency: '12ms', status: 'verified' },
  { index: 5, name: 'action_dispatched', detail: 'POST deploy.staging', latency: '38ms', receipt: 'r₀₁', status: 'routed' },
  { index: 6, name: 'connection_lost', detail: 'response missing after dispatch', latency: '31ms', status: 'uncertain', isFailure: true },
  { index: 7, name: 'automatic_replay', detail: 'blocked — external effect may exist', latency: '2ms', status: 'blocked' },
  { index: 8, name: 'run_state', detail: 'reconciliation_required', latency: '3ms', receipt: 'r₀₂', status: 'recorded' },
  { index: 9, name: 'operator_check', detail: 'deployment provider inspected', latency: '—', status: 'confirmed' },
  { index: 10, name: 'reconciliation', detail: 'operator assertion recorded', latency: '5ms', receipt: 'r₀₃', status: 'recorded' },
  { index: 11, name: 'proof_assembled', detail: 'authorization and observation linked', latency: '6ms', receipt: 'r₀₄', status: 'verified' },
  { index: 12, name: 'claim_boundary', detail: 'external correctness not cryptographic', latency: '3ms', status: 'recorded' },
]

const failureCount = DEMO_STEPS.filter((s) => s.isFailure).length
const ADDED_COUNT = DEMO_STEPS.length

const STAT_LINE_EM = 1.1
const STAT_COUNT_DURATION = 0.95
const STAT_COUNT_EASE = [0.45, 0.05, 0.25, 1] as const

function statDigitOffset(digit: number) {
  return `calc(${-digit} * ${STAT_LINE_EM}em)`
}

function alignStatDigits(from: number, to: number) {
  const fromDigits = from.toString().split('')
  const toDigits = to.toString().split('')
  const width = Math.max(fromDigits.length, toDigits.length)
  const pad = (digits: string[]) => {
    const padding = width - digits.length
    return [...Array(padding).fill('0'), ...digits]
  }

  return {
    from: pad(fromDigits).map((digit) => Number(digit)),
    to: pad(toDigits).map((digit) => Number(digit)),
    width,
  }
}

function CountingStatDigit({
  fromDigit,
  toDigit,
  animate,
  delay = 0,
}: {
  fromDigit: number
  toDigit: number
  animate: boolean
  delay?: number
}) {
  const reducedMotion = useReducedMotion()
  const shouldAnimate = animate && !reducedMotion

  return (
    <span
      className="inline-block overflow-hidden align-baseline"
      style={{ height: `${STAT_LINE_EM}em`, width: '0.55em' }}
      aria-hidden
    >
      <motion.span
        className="block"
        style={{ fontFamily: MONO }}
        initial={{ y: statDigitOffset(shouldAnimate ? fromDigit : toDigit) }}
        animate={{ y: statDigitOffset(toDigit) }}
        transition={
          shouldAnimate
            ? { duration: STAT_COUNT_DURATION, ease: STAT_COUNT_EASE, delay }
            : { duration: 0 }
        }
      >
        {Array.from({ length: 10 }, (_, digit) => (
          <span
            key={digit}
            className="block w-full text-center tabular-nums"
            style={{ height: `${STAT_LINE_EM}em`, lineHeight: `${STAT_LINE_EM}em` }}
          >
            {digit}
          </span>
        ))}
      </motion.span>
    </span>
  )
}

function RunStatRoll({
  value,
  sign,
  rollTick,
}: {
  value: number
  sign: '+' | '−'
  rollTick: number
}) {
  const reducedMotion = useReducedMotion()
  const color = sign === '+' ? '#047857' : '#be123c'
  const animate = rollTick > 0 && !reducedMotion
  const { from, to, width } = alignStatDigits(0, value)

  return (
    <span
      className="inline-flex items-baseline"
      style={{ color, fontFamily: MONO }}
      aria-label={`${sign}${value}`}
    >
      <span style={{ lineHeight: `${STAT_LINE_EM}em` }} aria-hidden>
        {sign}
      </span>
      {to.map((toDigit, index) => (
        <CountingStatDigit
          key={`${sign}-${rollTick}-${width - index}`}
          fromDigit={from[index]}
          toDigit={toDigit}
          animate={animate}
          delay={(width - index - 1) * 0.12}
        />
      ))}
    </span>
  )
}

const HIGHLIGHT_RULES: [RegExp, string][] = [
  [/\b(allowed|routed|recorded|verified|confirmed)\b/g, '#047857'],
  [/\b(uncertain|failed|blocked|denied)\b/g, '#be123c'],
  [/\b(200 OK|202 Accepted)\b/g, '#2563eb'],
  [/\b(POST|GET|PUT|PATCH|DELETE)\b/g, '#2563eb'],
  [/\b(r_[\w₀₁₂₃₄₅₆₇₈₉]+)\b/g, '#2563eb'],
  [/\b(replay|reconciliation_required|Reconciliation)\b/g, '#d97706'],
]

function highlightText(text: string) {
  const combined = new RegExp(
    HIGHLIGHT_RULES.map(([re]) => re.source).join('|'),
    'g'
  )
  const parts = text.split(combined)
  return parts.map((part, i) => {
    for (const [re, color] of HIGHLIGHT_RULES) {
      if (re.test(part)) {
        return <span key={i} style={{ color }}>{part}</span>
      }
    }
    return <span key={i}>{part}</span>
  })
}

function VisionChangesStyles() {
  return (
    <style>{`
      .vision-changes {
        --vc-text-2: #3f3f46;
        --vc-text-6: #71717a;
        --vc-text-7: #a1a1aa;
        --vc-emerald: #047857;
        --vc-rose: #be123c;
        --vc-overlay-bg: rgba(0, 0, 0, 0.02);
        --vc-mono: ${MONO};
      }
      .vision-changes .ic-evidence__intro {
        font-size: 1rem;
        color: #27272a;
        margin: 0 0 14px;
        max-width: 72ch;
        line-height: 1.6;
      }
      .vision-changes .ic-diff__lines {
        font-family: var(--vc-mono);
        font-size: 0.9375rem;
        line-height: 1.55;
        border: 1px solid #ebebeb;
        border-radius: 10px;
        padding: 16px 12px;
        background: #fff;
        --vc-line-block: calc(0.9375rem * 1.55 + 10px);
        height: calc(32px + ${DEMO_STEPS.length} * var(--vc-line-block));
        overflow-x: hidden;
        overflow-y: auto;
        scrollbar-width: none;
      }
      .vision-changes .ic-diff__lines::-webkit-scrollbar {
        display: none;
      }
      .vision-changes .ic-diff__lines--enter {
        animation: vc-frame-in 360ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }
      .vision-changes .ic-diff__line {
        display: grid;
        grid-template-columns: 24px 16px minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: 8px;
        padding: 5px 12px;
        min-height: var(--vc-line-block);
      }
      .vision-changes .ic-diff__line--committed { background: #ecf5ed; }
      .vision-changes .ic-diff__line--recovered { background: #f9ebeb; }
      .vision-changes .ic-diff__line--enter {
        animation: vc-step-in 520ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }
      .vision-changes .ic-diff__line--enter .ic-diff__meta > * {
        animation: vc-meta-in 420ms cubic-bezier(0.16, 0.84, 0.44, 1) 160ms both;
      }
      .vision-changes .ic-diff__line--committed.ic-diff__line--enter {
        animation:
          vc-step-in 520ms cubic-bezier(0.16, 0.84, 0.44, 1) both,
          vc-row-tint-ok 480ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }
      .vision-changes .ic-diff__line--recovered.ic-diff__line--enter {
        animation:
          vc-step-in 520ms cubic-bezier(0.16, 0.84, 0.44, 1) both,
          vc-row-tint-bad 480ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }
      .vision-changes .ic-diff__num {
        text-align: right;
        color: #a1a1aa;
      }
      .vision-changes .ic-diff__sign--ok { color: #047857; }
      .vision-changes .ic-diff__sign--bad { color: #be123c; }
      .vision-changes .ic-diff__text {
        color: #3f3f46;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vision-changes .ic-diff__dim { color: #71717a; }
      .vision-changes .ic-diff__meta {
        display: inline-flex;
        gap: 8px;
        align-items: baseline;
        color: #71717a;
        font-size: 0.9375rem;
        white-space: nowrap;
      }
      .vision-changes .ic-stepev__status--ok { color: var(--vc-emerald); }
      .vision-changes .ic-stepev__status--bad { color: var(--vc-rose); }
      .vision-changes .mono { font-family: var(--vc-mono); }
      .vision-changes .ic-doc__note {
        margin: 14px 0 0;
        font-size: 0.875rem;
        color: #71717a;
        line-height: 1.6;
      }
      .vision-changes .ic-evidence__intro--enter {
        animation: vc-note-in 320ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }
      .vision-changes .ic-diff__stat {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        font-size: 0.9375rem;
        line-height: 1.1;
      }
      @keyframes vc-frame-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes vc-step-in {
        from { opacity: 0; transform: translateY(3px); }
        to { opacity: 1; transform: translateY(0); }
      }
      @keyframes vc-meta-in {
        from { opacity: 0; transform: translateX(4px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes vc-note-in {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes vc-row-tint-ok {
        from { background-color: #f4faf5; }
        to { background-color: #ecf5ed; }
      }
      @keyframes vc-row-tint-bad {
        from { background-color: #fdf4f4; }
        to { background-color: #f9ebeb; }
      }
      @media (max-width: 640px) {
        .vision-changes .ic-diff__meta { display: none; }
      }
      @media (prefers-reduced-motion: reduce) {
        .vision-changes .ic-diff__lines--enter,
        .vision-changes .ic-diff__line--enter,
        .vision-changes .ic-diff__line--enter .ic-diff__meta > *,
        .vision-changes .ic-evidence__intro--enter {
          animation: none;
        }
      }
    `}</style>
  )
}

function statusTone(status: string): 'ok' | 'bad' {
  if (SUCCESS_STATUSES.has(status)) return 'ok'
  return 'bad'
}

function signTone(step: ChangeStep): null | 'ok' | 'bad' {
  if (step.status === 'committed') return 'ok'
  if (step.isFailure) return 'bad'
  return null
}

function rowClass(step: ChangeStep): string {
  if (step.isFailure) return 'ic-diff__line--recovered'
  if (step.status === 'committed') return 'ic-diff__line--committed'
  return ''
}

function ChangesDiff({ playKey }: { playKey: number }) {
  const reducedMotion = useReducedMotion()
  const [visibleCount, setVisibleCount] = useState(reducedMotion ? DEMO_STEPS.length : 0)

  useEffect(() => {
    if (reducedMotion) {
      setVisibleCount(DEMO_STEPS.length)
      return
    }

    setVisibleCount(0)
    const timers: ReturnType<typeof setTimeout>[] = []

    DEMO_STEPS.forEach((_, index) => {
      timers.push(
        setTimeout(() => {
          setVisibleCount(index + 1)
        }, LOG_REPLAY_START_MS + index * LOG_LINE_INTERVAL_MS)
      )
    })

    return () => timers.forEach(clearTimeout)
  }, [playKey, reducedMotion])

  const visibleSteps = DEMO_STEPS.slice(0, visibleCount)

  return (
    <div className="vision-changes" aria-label="Example run record">
      <VisionChangesStyles />
      <div className="ic-evidence ic-diff">
        <p className="ic-evidence__intro ic-evidence__intro--enter">
          See what was checked, what ran, where uncertainty stopped replay, and what Proof retained.
        </p>
        <div className="ic-diff__lines ic-diff__lines--enter">
          {visibleSteps.map((step) => {
            const sign = signTone(step)
            return (
              <div
                key={`${playKey}-${step.index}`}
                className={`ic-diff__line ic-diff__line--enter ${rowClass(step)}`}
              >
                <span className="ic-diff__num">{String(step.index).padStart(2, '0')}</span>
                {sign ? (
                  <span className={`ic-diff__sign--${sign}`}>{sign === 'bad' ? '−' : '+'}</span>
                ) : (
                  <span />
                )}
                <span className="ic-diff__text">
                  {step.name}{' '}
                  <span className="ic-diff__dim">
                    {highlightText(step.detail)}
                  </span>
                </span>
                <span className="ic-diff__meta">
                  {step.latency && <span>{step.latency}</span>}
                  {step.receipt && <span className="mono">{step.receipt}</span>}
                  {step.status && (
                    <span className={`ic-stepev__status--${statusTone(step.status)}`}>{step.status}</span>
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <p className="ic-doc__note">
          Raw content stays redacted. Digests and receipts preserve proof without exposing sensitive data.
        </p>
      </div>
    </div>
  )
}

export default function VisionChangesPanel() {
  const [open, setOpen] = useState(false)
  const [statRollTick, setStatRollTick] = useState(0)
  const [playKey, setPlayKey] = useState(0)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (open) setPlayKey((key) => key + 1)
  }, [open])

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onMouseEnter={() => setStatRollTick((tick) => tick + 1)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <FileDiff size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>Run record </span>
        <span className="ic-diff__stat" aria-hidden>
          <RunStatRoll value={ADDED_COUNT} sign="+" rollTick={statRollTick} />
          <RunStatRoll value={failureCount} sign="−" rollTick={statRollTick} />
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="run-record-panel"
            initial={reducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? undefined : { opacity: 0 }}
            transition={
              reducedMotion
                ? { duration: 0 }
                : { duration: 0.32, ease: VISION_EASE }
            }
            className="pt-4"
          >
            <ChangesDiff key={playKey} playKey={playKey} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
