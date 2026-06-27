'use client'

import { useState } from 'react'
import { ChevronDown, FileDiff } from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

type StepTone = 'ok' | 'bad' | 'warn' | 'muted'

type ChangeStep = {
  index: number
  tone: StepTone
  name: string
  detail: string
  latency?: string
  receipt?: string
  status?: string
}

// Illustrates the control-layer story on the landing page: policy → route →
// execute → visible failure/recovery → signed proof for review.
const DEMO_STEPS: ChangeStep[] = [
  {
    index: 1,
    tone: 'ok',
    name: 'policy_eval',
    detail: 'Idempotent · 3 retries · allowed',
    latency: '4ms',
    status: 'allowed',
  },
  {
    index: 2,
    tone: 'ok',
    name: 'route_action',
    detail: 'Hosted API · Stripe',
    latency: '2ms',
    status: 'routed',
  },
  {
    index: 3,
    tone: 'ok',
    name: 'read_file',
    detail: 'agent input · 0.6KB digest',
    latency: '9ms',
    receipt: 'r₀₁',
    status: 'committed',
  },
  {
    index: 4,
    tone: 'ok',
    name: 'http_call',
    detail: 'POST /v1/actions/create_invoice/run · 200 OK',
    latency: '186ms',
    receipt: 'r₀₂',
    status: 'committed',
  },
  {
    index: 5,
    tone: 'warn',
    name: 'rate_limit',
    detail: 'upstream 429 · backoff 250ms · resumed',
    latency: '250ms',
    status: 'recovered',
  },
  {
    index: 6,
    tone: 'ok',
    name: 'http_call',
    detail: 'retry 1 of 3 · 202 Accepted',
    latency: '41ms',
    receipt: 'r₀₃',
    status: 'committed',
  },
  {
    index: 7,
    tone: 'ok',
    name: 'receipt_sign',
    detail: 'ed25519 · ready for team review',
    latency: '6ms',
    receipt: 'r₀₄',
    status: 'verified',
  },
]

function stepSign(tone: StepTone) {
  if (tone === 'ok') return '+'
  if (tone === 'bad') return '−'
  return ' '
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
        --vc-amber: #b45309;
        --vc-overlay-bg: rgba(0, 0, 0, 0.02);
        --vc-mono: ${MONO};
      }
      .vision-changes .ic-evidence__intro {
        font-size: 12px;
        color: var(--vc-text-6);
        margin: 0 0 10px;
        max-width: 72ch;
        line-height: 1.5;
      }
      .vision-changes .ic-diff__stat {
        margin-left: 6px;
        font-family: var(--vc-mono);
        font-size: 11.5px;
        font-weight: 400;
      }
      .vision-changes .ic-diff__add { color: var(--vc-emerald); }
      .vision-changes .ic-diff__del { color: var(--vc-rose); }
      .vision-changes .ic-diff__lines {
        margin-top: 8px;
        font-family: var(--vc-mono);
        font-size: 11.5px;
      }
      .vision-changes .ic-diff__line {
        display: grid;
        grid-template-columns: 32px 14px minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: 10px;
        padding: 2.5px 10px 2.5px 0;
      }
      .vision-changes .ic-diff__line--ok  { background: rgba(4, 120, 87, 0.07); }
      .vision-changes .ic-diff__line--bad { background: rgba(190, 18, 60, 0.07); }
      .vision-changes .ic-diff__line--warn { background: rgba(180, 83, 9, 0.06); }
      .vision-changes .ic-diff__num {
        text-align: right;
        padding-right: 6px;
        color: var(--vc-text-7);
        background: var(--vc-overlay-bg);
        align-self: stretch;
        display: flex;
        align-items: center;
        justify-content: flex-end;
      }
      .vision-changes .ic-diff__sign { text-align: center; color: var(--vc-text-7); }
      .vision-changes .ic-diff__line--ok  .ic-diff__sign { color: var(--vc-emerald); }
      .vision-changes .ic-diff__line--bad .ic-diff__sign { color: var(--vc-rose); }
      .vision-changes .ic-diff__text {
        color: var(--vc-text-2);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .vision-changes .ic-diff__dim { color: var(--vc-text-6); }
      .vision-changes .ic-diff__meta {
        display: inline-flex;
        gap: 10px;
        align-items: baseline;
        color: var(--vc-text-6);
        font-size: 10.5px;
        white-space: nowrap;
      }
      .vision-changes .ic-stepev__status--ok { color: var(--vc-emerald); }
      .vision-changes .ic-stepev__status--warn { color: var(--vc-amber); }
      .vision-changes .ic-stepev__status--bad { color: var(--vc-rose); }
      .vision-changes .ic-stepev__status--muted { color: var(--vc-text-6); }
      .vision-changes .mono { font-family: var(--vc-mono); }
      .vision-changes .ic-doc__note {
        margin: 10px 0 0;
        font-size: 11px;
        color: var(--vc-text-6);
        line-height: 1.5;
      }
      @media (max-width: 640px) {
        .vision-changes .ic-diff__meta { display: none; }
      }
    `}</style>
  )
}

function ChangesDiff() {
  return (
    <div className="vision-changes" aria-label="Example run changes">
      <VisionChangesStyles />
      <div className="ic-evidence ic-diff">
        <p className="ic-evidence__intro">
          Example of what your team sees after an agent action runs through Igris: policy checks, routed execution, visible failure and recovery, and signed proof to review later.
        </p>
        <div className="ic-diff__lines">
          {DEMO_STEPS.map((step) => (
            <div key={step.index} className={`ic-diff__line ic-diff__line--${step.tone}`}>
              <span className="ic-diff__num">{String(step.index).padStart(2, '0')}</span>
              <span className="ic-diff__sign">{stepSign(step.tone)}</span>
              <span className="ic-diff__text">
                {step.name} <span className="ic-diff__dim">{step.detail}</span>
              </span>
              <span className="ic-diff__meta">
                {step.latency && <span>{step.latency}</span>}
                {step.receipt && <span className="mono">{step.receipt}</span>}
                {step.status && (
                  <span className={`ic-stepev__status--${step.tone}`}>{step.status}</span>
                )}
              </span>
            </div>
          ))}
        </div>
        <p className="ic-doc__note">Content is redacted in the console; digests and receipts stand in for raw agent data.</p>
      </div>
    </div>
  )
}

export default function VisionChangesPanel() {
  const [open, setOpen] = useState(false)
  const added = DEMO_STEPS.filter((s) => s.tone === 'ok').length
  const removed = DEMO_STEPS.filter((s) => s.tone === 'bad').length

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.0625rem', lineHeight: 1.4, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <FileDiff size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>Changes</span>
        <span className="ic-diff__stat" style={{ fontFamily: MONO, fontSize: '11.5px', fontWeight: 400 }}>
          <span style={{ color: '#047857' }}>+{added}</span>{' '}
          <span style={{ color: '#be123c' }}>−{removed}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[1200px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="pt-4">
          {open && <ChangesDiff />}
        </div>
      </div>
    </div>
  )
}