'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

// ──────────────────────────────────────────────────────────────────
// One in-flight task as Igris would render it.
// ──────────────────────────────────────────────────────────────────

type StepKind = 'action' | 'fault'
type StepStatus = 'committed' | 'running'

interface Step {
  id: string
  kind: StepKind
  num?: string
  name: string
  detail: string
  latency?: number
  status: StepStatus
  receipt?: string
  signed_at?: string
}

const TASK_STEPS: Step[] = [
  { id: 's1', kind: 'action', num: '01', name: 'read_file', detail: '/uploads/policy-v3.pdf · 1.2KB digest',                       latency: 12, status: 'committed', receipt: 'r₀₁', signed_at: '14:07:42.218' },
  { id: 's2', kind: 'action', num: '02', name: 'http_call', detail: 'POST /v3/sync · 200 OK',                                       latency: 38, status: 'committed', receipt: 'r₀₂', signed_at: '14:07:42.481' },
  { id: 's3', kind: 'fault',             name: 'HostFault', detail: 'worker_a failed · checkpoint preserved · resumed on worker_b', latency: 31, status: 'committed' },
  { id: 's4', kind: 'action', num: '03', name: 'http_call', detail: 'retry 2 of 3 succeeded',                                       latency: 42, status: 'committed', receipt: 'r₀₃', signed_at: '14:07:43.014' },
  { id: 's5', kind: 'action', num: '04', name: 'db_write',  detail: 'orders_fulfilled · r_8421',                                                 status: 'running' },
]

type Tab = 'activity' | 'receipts' | 'summary'

// ──────────────────────────────────────────────────────────────────

export function ExecutionPreview() {
  const [tab, setTab] = useState<Tab>('activity')

  return (
    <div
      className="igris-console relative overflow-hidden rounded-xl border border-black/[0.07] dark:border-white/[0.07] bg-white dark:bg-[#0c0c0a]"
      style={{ fontFamily: SANS }}
    >
      <ConsoleStyles />
      <AppChrome />

      <div className="px-7 md:px-9 pt-6 md:pt-7 pb-1">
        <PageHeader />
      </div>

      <TabStrip tab={tab} setTab={setTab} />

      <div className="px-7 md:px-9 py-6 md:py-7 min-h-[340px]">
        {tab === 'activity' && <ActivityView />}
        {tab === 'receipts' && <ReceiptsView />}
        {tab === 'summary'  && <SummaryView />}
      </div>
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────────────

function ConsoleStyles() {
  return (
    <style>{`
      @keyframes igris-step-in {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .igris-console .step-in {
        animation: igris-step-in 640ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }

      @keyframes igris-breathe {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.42; }
      }
      .igris-console .breathing {
        animation: igris-breathe 3.2s ease-in-out infinite;
      }

      @keyframes igris-cycle-fade {
        0%   { opacity: 1; }
        100% { opacity: 0; }
      }
      .igris-console .cycle-fade {
        animation: igris-cycle-fade 480ms ease-out both;
      }

      @keyframes igris-tab-in {
        from { opacity: 0; transform: translateY(2px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .igris-console .tab-in {
        animation: igris-tab-in 320ms cubic-bezier(0.16, 0.84, 0.44, 1) both;
      }

      .igris-console .kbd {
        font-family: ${MONO};
        font-size: 10px;
        padding: 1px 4px;
        border-radius: 3px;
        background: rgba(0,0,0,0.045);
        color: inherit;
      }
      @media (prefers-color-scheme: dark) {
        .igris-console .kbd { background: rgba(255,255,255,0.06); }
      }
    `}</style>
  )
}

// ── App chrome ─────────────────────────────────────────────────────

function AppChrome() {
  const nav = ['Overview', 'Tasks', 'Receipts', 'Runtimes', 'Settings']
  return (
    <div className="flex items-center gap-5 px-5 md:px-6 h-11 border-b border-black/[0.05] dark:border-white/[0.05]">
      <div className="flex items-center gap-2 text-gray-900 dark:text-[#f6f6f4]">
        <svg width="14" height="14" viewBox="0 0 24 24" className="text-gray-900 dark:text-[#f6f6f4]">
          <path d="M12 2 L22 8 L22 16 L12 22 L2 16 L2 8 Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        </svg>
        <span className="text-[13px] tracking-tight">igris</span>
      </div>

      <nav className="hidden md:flex items-center gap-px text-[12.5px]">
        {nav.map((item, i) => {
          const active = i === 1
          return (
            <span
              key={item}
              className={
                'px-2 py-1 rounded transition-colors cursor-default ' +
                (active
                  ? 'text-gray-900 dark:text-[#f6f6f4]'
                  : 'text-gray-400 dark:text-[#6b6a64] hover:text-gray-900 dark:hover:text-[#f6f6f4]')
              }
            >
              {item}
            </span>
          )
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <span className="hidden md:inline-flex items-center gap-2 text-[11.5px] text-gray-400 dark:text-[#6b6a64]">
          <span>Search</span>
          <span className="kbd">⌘K</span>
        </span>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-white/[0.08] text-[10px] text-gray-600 dark:text-[#c8c8b8]">
          M
        </span>
      </div>
    </div>
  )
}

// ── Page header ────────────────────────────────────────────────────

function PageHeader() {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[12px] text-gray-400 dark:text-[#6b6a64]">
        <span>Tasks</span>
        <span>›</span>
        <span className="text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: MONO }}>task_019de343</span>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h3
            className="text-[#0c0c0a] dark:text-[#f6f6f4]"
            style={{
              fontSize: 'clamp(1.35rem, 1.8vw, 1.55rem)',
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.018em',
            }}
          >
            Fulfill order — policy v3
          </h3>
          <p className="mt-1.5 text-[12.5px] text-gray-500 dark:text-[#7a7a6e]">
            Submitted by <span className="text-gray-700 dark:text-[#c8c8b8]">mateo@acme.io</span> · 14:07:42 UTC ·{' '}
            <span style={{ fontFamily: MONO }}>fra1·prod</span>
          </p>
        </div>

        <span className="inline-flex items-center gap-2 text-[12px] text-emerald-700 dark:text-emerald-400">
          <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>Running · recovered</span>
        </span>
      </div>
    </div>
  )
}

// ── Tab strip ──────────────────────────────────────────────────────

function TabStrip({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const tabs: { k: Tab; label: string; count?: number }[] = [
    { k: 'activity', label: 'Activity', count: 5 },
    { k: 'receipts', label: 'Receipts', count: 4 },
    { k: 'summary',  label: 'Summary' },
  ]
  return (
    <div className="px-7 md:px-9 border-b border-black/[0.05] dark:border-white/[0.05]">
      <div className="flex items-stretch gap-6">
        {tabs.map((t) => {
          const active = t.k === tab
          return (
            <button
              key={t.k}
              type="button"
              onClick={() => setTab(t.k)}
              className={
                'relative -mb-px py-3 text-[12.5px] cursor-pointer transition-colors flex items-center gap-2 ' +
                (active
                  ? 'text-gray-900 dark:text-[#f6f6f4]'
                  : 'text-gray-400 dark:text-[#6b6a64] hover:text-gray-700 dark:hover:text-[#c8c8b8]')
              }
            >
              <span>{t.label}</span>
              {t.count != null && (
                <span
                  className={
                    'text-[10.5px] tabular-nums ' +
                    (active ? 'text-gray-400 dark:text-[#6b6a64]' : 'text-gray-300 dark:text-[#4a4a44]')
                  }
                  style={{ fontFamily: MONO }}
                >
                  {t.count}
                </span>
              )}
              <span
                aria-hidden
                className={
                  'absolute left-0 right-0 -bottom-px h-px transition-opacity ' +
                  (active ? 'bg-gray-900 dark:bg-[#f6f6f4] opacity-100' : 'opacity-0')
                }
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Tab 1: Activity ────────────────────────────────────────────────

function ActivityView() {
  const [visibleCount, setVisibleCount] = useState(1)
  const [cycle, setCycle] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) {
      setVisibleCount(TASK_STEPS.length)
      return
    }
    let timeout: ReturnType<typeof setTimeout> | null = null
    const tick = setInterval(() => {
      setVisibleCount((c) => {
        if (c >= TASK_STEPS.length) {
          setFading(true)
          timeout = setTimeout(() => {
            setFading(false)
            setCycle((k) => k + 1)
            setVisibleCount(1)
          }, 480)
          return c
        }
        return c + 1
      })
    }, 1500)
    return () => {
      clearInterval(tick)
      if (timeout) clearTimeout(timeout)
    }
  }, [])

  const steps = TASK_STEPS.slice(0, visibleCount)

  return (
    <div className={'tab-in ' + (fading ? 'cycle-fade' : '')}>
      <ol className="flex flex-col">
        {steps.map((step, i) => {
          const isLast = i === steps.length - 1
          const running = step.status === 'running' && isLast
          return (
            <li key={`${cycle}-${step.id}`} className="step-in">
              {step.kind === 'fault' ? (
                <FaultRow step={step} />
              ) : (
                <ActionRow step={step} running={running} />
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function ActionRow({ step, running }: { step: Step; running: boolean }) {
  return (
    <div className="grid items-center gap-x-4 py-2.5 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0"
         style={{ gridTemplateColumns: '24px 1fr auto auto' }}>
      <span
        className="text-[11px] text-gray-400 dark:text-[#5a5a52] tabular-nums"
        style={{ fontFamily: MONO, letterSpacing: '0.04em' }}
      >
        {step.num}
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span
            className={'text-[13px] text-gray-900 dark:text-[#f6f6f4] ' + (running ? 'breathing' : '')}
            style={{ fontFamily: MONO }}
          >
            {step.name}
          </span>
          <span className="text-[12.5px] text-gray-500 dark:text-[#7a7a6e] truncate">
            {step.detail}
          </span>
        </div>
      </div>

      <span
        className="text-[11px] text-gray-400 dark:text-[#5a5a52] tabular-nums min-w-[44px] text-right"
        style={{ fontFamily: MONO }}
      >
        {step.latency != null ? `${step.latency}ms` : ''}
      </span>

      <span className="inline-flex items-center justify-center w-3.5 h-3.5">
        {running ? (
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500 breathing" />
        ) : (
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" className="text-emerald-600 dark:text-emerald-400">
            <path d="M5 12.5 L10 17 L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
    </div>
  )
}

function FaultRow({ step }: { step: Step }) {
  return (
    <div className="grid items-center gap-x-4 py-2.5 border-b border-black/[0.03] dark:border-white/[0.03]"
         style={{ gridTemplateColumns: '24px 1fr auto auto' }}>
      <span className="inline-flex items-center justify-center">
        <span className="block w-1 h-1 rounded-full bg-amber-500" />
      </span>

      <div className="min-w-0">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span
            className="text-[13px] text-amber-800 dark:text-amber-300"
            style={{ fontFamily: MONO }}
          >
            host_fault
          </span>
          <span className="text-[12.5px] text-gray-500 dark:text-[#7a7a6e] truncate">
            {step.detail}
          </span>
        </div>
      </div>

      <span
        className="text-[11px] text-gray-400 dark:text-[#5a5a52] tabular-nums min-w-[44px] text-right"
        style={{ fontFamily: MONO }}
      >
        {step.latency != null ? `${step.latency}ms` : ''}
      </span>

      <span className="text-[10.5px] text-amber-700 dark:text-amber-400 tracking-[0.06em] uppercase">
        recovered
      </span>
    </div>
  )
}

// ── Tab 2: Receipts ────────────────────────────────────────────────

function ReceiptsView() {
  const receipts = TASK_STEPS.filter((s) => s.receipt)
  return (
    <div className="tab-in">
      <div className="flex items-baseline justify-between pb-3">
        <span className="text-[12px] text-gray-500 dark:text-[#7a7a6e]">
          Chain <span className="text-emerald-700 dark:text-emerald-400">valid</span> · 3 of 4 signed · <span style={{ fontFamily: MONO }}>ed25519</span>
        </span>
        <span className="text-[11px] text-gray-400 dark:text-[#5a5a52]" style={{ fontFamily: MONO }}>
          chain_8f2c…a017
        </span>
      </div>

      <div
        className="grid text-[10.5px] uppercase tracking-[0.14em] text-gray-400 dark:text-[#5a5a52] pb-2 border-b border-black/[0.05] dark:border-white/[0.05]"
        style={{ gridTemplateColumns: '60px 1fr 110px 90px' }}
      >
        <span>Receipt</span>
        <span>Action</span>
        <span>Signed</span>
        <span className="text-right">Status</span>
      </div>

      {receipts.map((r) => (
        <div
          key={r.id}
          className="grid items-center gap-x-4 py-2.5 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0"
          style={{ gridTemplateColumns: '60px 1fr 110px 90px' }}
        >
          <span className="text-[12px] text-gray-900 dark:text-[#f6f6f4]" style={{ fontFamily: MONO }}>
            {r.receipt}
          </span>
          <span className="text-[12.5px] text-gray-700 dark:text-[#c8c8b8] truncate">
            <span style={{ fontFamily: MONO }}>{r.name}</span>
            <span className="text-gray-400 dark:text-[#6b6a64]"> · {r.detail}</span>
          </span>
          <span className="text-[11.5px] text-gray-500 dark:text-[#7a7a6e] tabular-nums" style={{ fontFamily: MONO }}>
            {r.signed_at}
          </span>
          <span className="text-right text-[11.5px] text-emerald-700 dark:text-emerald-400">
            signed
          </span>
        </div>
      ))}

      <div
        className="grid items-center gap-x-4 py-2.5"
        style={{ gridTemplateColumns: '60px 1fr 110px 90px' }}
      >
        <span className="text-[12px] text-gray-400 dark:text-[#5a5a52]" style={{ fontFamily: MONO }}>
          r₀₄
        </span>
        <span className="text-[12.5px] text-gray-400 dark:text-[#6b6a64] truncate">
          <span style={{ fontFamily: MONO }}>db_write</span>
          <span> · orders_fulfilled · r_8421</span>
        </span>
        <span className="text-[11.5px] text-gray-400 dark:text-[#5a5a52] tabular-nums" style={{ fontFamily: MONO }}>—</span>
        <span className="text-right text-[11.5px] text-gray-400 dark:text-[#6b6a64] breathing">
          pending
        </span>
      </div>
    </div>
  )
}

// ── Tab 3: Summary ─────────────────────────────────────────────────

function SummaryView() {
  const rows: { label: string; value: React.ReactNode; mono?: boolean }[] = [
    { label: 'Status',         value: <span className="text-emerald-700 dark:text-emerald-400">Running · recovered</span> },
    { label: 'Worker',         value: <>worker_a → <span className="text-gray-900 dark:text-[#f6f6f4]">worker_b</span></>, mono: true },
    { label: 'Actions',        value: <>3 of 4 committed</> },
    { label: 'Failures',       value: '0' },
    { label: 'Replays',        value: '0' },
    { label: 'Latency p50',    value: '18ms', mono: true },
    { label: 'Latency p95',    value: '42ms', mono: true },
    { label: 'Receipt chain',  value: <><span className="text-emerald-700 dark:text-emerald-400">valid</span> · 3 of 4 signed</> },
    { label: 'Region',         value: 'fra1 · prod', mono: true },
  ]
  return (
    <dl className="tab-in flex flex-col">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between py-2.5 border-b border-black/[0.03] dark:border-white/[0.03] last:border-b-0">
          <dt className="text-[12.5px] text-gray-500 dark:text-[#7a7a6e]">{r.label}</dt>
          <dd
            className="text-[12.5px] text-gray-900 dark:text-[#f6f6f4] tabular-nums"
            style={r.mono ? { fontFamily: MONO } : undefined}
          >
            {r.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

// ──────────────────────────────────────────────────────────────────
// Products section
// ──────────────────────────────────────────────────────────────────

export default function Products() {
  return (
    <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="px-0">
        <div className="px-0">
          <div className="pt-6 md:pt-8 pb-6 md:pb-8">
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
              style={{ fontFamily: SANS, fontSize: 'clamp(0.95rem, 1.05vw, 1rem)', lineHeight: 1.6 }}
            >
              AI systems should be able to operate in real environments without
              becoming difficult to understand, unreliable, or impossible to
              trust. As agents begin interacting with infrastructure, APIs,
              files, workflows, and eventually physical systems, execution
              reliability becomes as important as intelligence itself.
            </p>

            <p
              className="mt-4 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{ fontFamily: SANS, fontSize: 'clamp(0.95rem, 1.05vw, 1rem)', lineHeight: 1.6 }}
            >
              Igris is building infrastructure for AI actions - helping AI
              systems execute work with recovery, operational boundaries, and
              verifiable execution records built in. Instead of relying on
              retries and scattered logs, Igris gives operators visibility into
              what happened, what failed, what recovered, and how actions were
              executed across runtimes and environments.
            </p>

            <p
              className="mt-4 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{ fontFamily: SANS, fontSize: 'clamp(0.95rem, 1.05vw, 1rem)', lineHeight: 1.6 }}
            >
              Tasks execute with checkpointed recovery, replay safety,
              runtime-aware boundaries, and execution verification, allowing
              teams to inspect failures, validate execution paths, and operate
              AI systems with real operational control as agents begin handling
              more critical work.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Link
                href="https://docs.igrisinertial.com/"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80 bg-white text-[#1b1912] border-black/10 dark:bg-white/[0.06] dark:text-[#f6f6f4] dark:border-white/[0.12]"
                style={{ fontFamily: SANS }}
              >
                Read the docs ↗
              </Link>
              <Link
                href="https://console.igrisinertial.com"
                className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: SANS }}
              >
                Open the console
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
