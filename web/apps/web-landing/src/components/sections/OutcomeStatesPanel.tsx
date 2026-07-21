'use client'

import type { CSSProperties } from 'react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const OUTCOMES = [
  {
    key: 'completed',
    label: 'Completed',
    tone: '#047857',
    toneBg: '#ecf5ed',
    toneBorder: '#b8dfc4',
    summary: 'The external effect finished cleanly.',
    detail: 'The agent receives a terminal success and can continue. No recovery and no guesswork.',
  },
  {
    key: 'recovered',
    label: 'Recovered',
    tone: '#2563eb',
    toneBg: '#eff6ff',
    toneBorder: '#bfdbfe',
    summary: 'Infrastructure failed, then resumed safely.',
    detail: 'Worker crashes, timeouts, and transient faults can continue from preserved progress when it is safe to do so.',
  },
  {
    key: 'uncertain',
    label: 'Uncertain',
    tone: '#be123c',
    toneBg: '#fdf4f4',
    toneBorder: '#f0c4c4',
    summary: 'The effect may already have happened.',
    detail: 'Igris stops instead of blindly retrying. Your team inspects the run before another consequential action is attempted.',
  },
] as const

const labelStyle: CSSProperties = {
  fontFamily: MONO,
  fontSize: '0.8rem',
  letterSpacing: '0.08em',
  fontWeight: 500,
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 500,
  fontSize: '1.25rem',
  lineHeight: 1.4,
  letterSpacing: '-0.01em',
}

const bodyStyle: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: '1.125rem',
  lineHeight: 1.65,
}

export default function OutcomeStatesPanel() {
  return (
    <div
      className="mb-10 grid gap-4 md:grid-cols-3"
      role="list"
      aria-label="Completed, recovered, and uncertain outcomes"
    >
      {OUTCOMES.map((outcome) => (
        <div
          key={outcome.key}
          role="listitem"
          className="rounded-[10px] border p-5"
          style={{
            backgroundColor: outcome.toneBg,
            borderColor: outcome.toneBorder,
          }}
        >
          <p className="mb-3" style={{ ...labelStyle, color: outcome.tone }}>
            {outcome.label}
          </p>
          <p className="mb-2 text-[#171717]" style={titleStyle}>
            {outcome.summary}
          </p>
          <p className="text-[#27272a]" style={bodyStyle}>
            {outcome.detail}
          </p>
        </div>
      ))}
    </div>
  )
}
