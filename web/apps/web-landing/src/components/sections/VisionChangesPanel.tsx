'use client'

import { useState } from 'react'
import { ChevronDown, FileDiff } from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

type ChangeStep = {
  index: number
  name: string
  detail: string
  latency?: string
  receipt?: string
  status?: string
  isRecovered?: boolean
}

const SUCCESS_STATUSES = new Set(['allowed', 'routed', 'committed', 'verified', 'resumed', 'recovered'])

const DEMO_STEPS: ChangeStep[] = [
  { index: 1, name: 'policy_check', detail: 'idempotent, 3 retries', latency: '4ms', status: 'allowed' },
  { index: 2, name: 'approval_check', detail: 'approval not required', latency: '2ms', status: 'allowed' },
  { index: 3, name: 'route_execution', detail: 'connected worker, action endpoint', latency: '2ms', status: 'routed' },
  { index: 4, name: 'action_input', detail: '0.6KB digest', latency: '12ms', receipt: 'r₀₁', status: 'committed' },
  { index: 5, name: 'action_call', detail: 'POST /v1/actions/create_invoice, 200 OK', latency: '38ms', receipt: 'r₀₂', status: 'committed' },
  { index: 6, name: 'host_fault', detail: 'checkpoint preserved, resumed', latency: '31ms', status: 'recovered', isRecovered: true },
  { index: 7, name: 'action_call', detail: 'retry 2 of 3, 202 Accepted', latency: '42ms', receipt: 'r₀₃', status: 'committed' },
  { index: 8, name: 'write_result', detail: 'accounts_staged, r_7720', latency: '18ms', receipt: 'r₀₄', status: 'committed' },
  { index: 9, name: 'rate_limit', detail: 'upstream 429, backoff 250ms, resumed', latency: '250ms', status: 'recovered', isRecovered: true },
  { index: 10, name: 'action_call', detail: 'retry 1 of 3, 202 Accepted', latency: '29ms', receipt: 'r₀₅', status: 'committed' },
  { index: 11, name: 'proof_recorded', detail: 'ed25519 chain, ready for team review', latency: '6ms', receipt: 'r₀₆', status: 'verified' },
  { index: 12, name: 'receipt_verify', detail: 'receipt r₀₆ cross-checked', latency: '3ms', status: 'verified' },
  { index: 13, name: 'receipt_publish', detail: 'chain anchored, team notified', latency: '5ms', receipt: 'r₀₇', status: 'verified' },
]

const recoveredCount = DEMO_STEPS.filter((s) => s.isRecovered).length

const FAILURE_REGEX = /\b(429|failed)\b/g

function highlightFailure(text: string) {
  const parts = text.split(FAILURE_REGEX)
  return parts.map((part, i) =>
    part === '429' || part === 'failed' ? (
      <span key={i} style={{ color: '#be123c' }}>{part}</span>
    ) : (
      <span key={i}>{part}</span>
    )
  )
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
        font-size: 1.125rem;
        color: #27272a;
        margin: 0 0 14px;
        max-width: 72ch;
        line-height: 1.65;
      }
      .vision-changes .ic-diff__lines {
        font-family: var(--vc-mono);
        font-size: 1.125rem;
        border: 1px solid #ebebeb;
        border-radius: 10px;
        padding: 8px 0;
        background: #fff;
      }
      .vision-changes .ic-diff__line {
        display: grid;
        grid-template-columns: 28px 18px minmax(0, 1fr) auto;
        align-items: baseline;
        column-gap: 8px;
        padding: 4px 16px;
      }
      .vision-changes .ic-diff__line--committed { background: rgba(4, 120, 87, 0.05); }
      .vision-changes .ic-diff__line--recovered { background: rgba(190, 18, 60, 0.04); }
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
        gap: 10px;
        align-items: baseline;
        color: #71717a;
        font-size: 1.125rem;
        white-space: nowrap;
      }
      .vision-changes .ic-stepev__status--ok { color: var(--vc-emerald); }
      .vision-changes .ic-stepev__status--bad { color: var(--vc-rose); }
      .vision-changes .mono { font-family: var(--vc-mono); }
      .vision-changes .ic-doc__note {
        margin: 14px 0 0;
        font-size: 1.125rem;
        color: #71717a;
        line-height: 1.65;
      }
      @media (max-width: 640px) {
        .vision-changes .ic-diff__meta { display: none; }
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
  if (step.isRecovered) return 'bad'
  return null
}

function rowClass(step: ChangeStep): string {
  if (step.isRecovered) return 'ic-diff__line--recovered'
  if (step.status === 'committed') return 'ic-diff__line--committed'
  return ''
}

function ChangesDiff() {
  return (
    <div className="vision-changes" aria-label="Example run record">
      <VisionChangesStyles />
      <div className="ic-evidence ic-diff">
        <p className="ic-evidence__intro">
          See what was checked, what ran, what failed, what recovered, and what proof was kept.
        </p>
        <div className="ic-diff__lines">
          {DEMO_STEPS.map((step) => {
            const sign = signTone(step)
            return (
            <div key={step.index} className={`ic-diff__line ${rowClass(step)}`}>
              <span className="ic-diff__num">{String(step.index).padStart(2, '0')}</span>
              {sign ? (
                <span className={`ic-diff__sign--${sign}`}>{sign === 'bad' ? '−' : '+'}</span>
              ) : (
                <span />
              )}
              <span className="ic-diff__text">
                {step.name}{' '}
                <span className="ic-diff__dim">
                  {step.isRecovered ? highlightFailure(step.detail) : step.detail}
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

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <FileDiff size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>Run record </span>
        <span className="ic-diff__stat">
          <span style={{ color: '#047857' }}>+{DEMO_STEPS.length}</span>{' '}
          <span style={{ color: '#be123c' }}>−{recoveredCount}</span>
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="pt-4">
          {open && <ChangesDiff />}
        </div>
      </div>
    </div>
  )
}
