'use client'

import React, { useState } from 'react'
import Link from 'next/link'

const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Mirrors the actual web-console history/logs page — three view modes with
// real EventType / Severity vocabulary and real RequestTrace columns.

type Severity = 'info' | 'warning' | 'error' | 'critical'
type EventType =
  | 'TaskAccepted'
  | 'ExecutionAssigned'
  | 'ActionCommitted'
  | 'ActionRetry'
  | 'PolicyViolation'
  | 'ChainVerified'
  | 'ReceiptSigned'

interface EventRow {
  id: string
  time: string
  severity: Severity
  event_type: EventType
  message: string
  exec_id?: string
  latency_ms?: number
}

interface ReceiptRow {
  id: string
  task_id: string
  action: string
  committed_at: string
  receipt: 'signed'
  chain: 'valid' | 'pending'
  chain_ref: string
}

const ALL_EVENTS: EventRow[] = [
  { id: '1',  time: '14:07:42', severity: 'info',    event_type: 'TaskAccepted',       message: 'task_019de343 accepted · 3 actions queued',                          exec_id: 'task_019de343' },
  { id: '2',  time: '14:07:42', severity: 'info',    event_type: 'ExecutionAssigned',  message: 'assigned to verified worker · recovery enabled',                     exec_id: 'task_019de343', latency_ms: 23 },
  { id: '3',  time: '14:07:42', severity: 'info',    event_type: 'ActionCommitted',    message: 'read approved file · /uploads/policy-v3.pdf · 1.2KB digest',         exec_id: 'task_019de343', latency_ms: 12 },
  { id: '4',  time: '14:07:42', severity: 'info',    event_type: 'ActionCommitted',    message: 'call approved API · POST /v3/sync · 200 OK',                         exec_id: 'task_019de343', latency_ms: 38 },
  { id: '5',  time: '14:07:42', severity: 'warning', event_type: 'ActionRetry',        message: 'call approved API · 503 · retry 1/3 · backoff 250ms',                exec_id: 'task_019de343', latency_ms: 250 },
  { id: '6',  time: '14:07:42', severity: 'info',    event_type: 'ActionCommitted',    message: 'call approved API · retry 2 succeeded',                              exec_id: 'task_019de343', latency_ms: 42 },
  { id: '7',  time: '14:07:42', severity: 'info',    event_type: 'ActionCommitted',    message: 'write approved record · orders_fulfilled · row r_8421',              exec_id: 'task_019de343', latency_ms: 18 },
  { id: '8',  time: '14:07:43', severity: 'info',    event_type: 'ReceiptSigned',      message: 'receipt signed · chain assembled · 3 commits',                       exec_id: 'task_019de343' },
  { id: '9',  time: '14:07:43', severity: 'info',    event_type: 'ChainVerified',      message: 'chain valid · 3 actions · 185ms · 0 replays',                        exec_id: 'task_019de343' },
  { id: '10', time: '14:07:44', severity: 'info',    event_type: 'TaskAccepted',       message: 'task_019de421 accepted · 3 actions queued',                          exec_id: 'task_019de421' },
  { id: '11', time: '14:07:44', severity: 'info',    event_type: 'ActionCommitted',    message: 'read approved file · /uploads/order-batch-12.csv · 4.8KB digest',    exec_id: 'task_019de421', latency_ms: 9 },
  { id: '12', time: '14:07:44', severity: 'info',    event_type: 'ActionCommitted',    message: 'call approved API · POST /v3/sync · 200 OK',                         exec_id: 'task_019de421', latency_ms: 31 },
  { id: '13', time: '14:07:44', severity: 'info',    event_type: 'ActionCommitted',    message: 'write approved record · orders_fulfilled · row r_8422',              exec_id: 'task_019de421', latency_ms: 14 },
  { id: '14', time: '14:07:45', severity: 'info',    event_type: 'ReceiptSigned',      message: 'receipt signed · chain assembled · 3 commits',                       exec_id: 'task_019de421' },
]

const ALL_RECEIPTS: ReceiptRow[] = [
  { id: 'r1', task_id: 'task_019de343', action: 'read approved file · /uploads/policy-v3.pdf',     committed_at: '14:07:42', receipt: 'signed', chain: 'valid', chain_ref: 'chain_8f2c…a017' },
  { id: 'r2', task_id: 'task_019de343', action: 'call approved API · POST /v3/sync',               committed_at: '14:07:42', receipt: 'signed', chain: 'valid', chain_ref: 'chain_8f2c…a017' },
  { id: 'r3', task_id: 'task_019de343', action: 'write approved record · orders_fulfilled r_8421', committed_at: '14:07:42', receipt: 'signed', chain: 'valid', chain_ref: 'chain_8f2c…a017' },
  { id: 'r4', task_id: 'task_019de421', action: 'read approved file · /uploads/order-batch-12.csv', committed_at: '14:07:44', receipt: 'signed', chain: 'pending', chain_ref: 'chain_3b91…d442' },
  { id: 'r5', task_id: 'task_019de421', action: 'call approved API · POST /v3/sync',               committed_at: '14:07:44', receipt: 'signed', chain: 'pending', chain_ref: 'chain_3b91…d442' },
  { id: 'r6', task_id: 'task_019de421', action: 'write approved record · orders_fulfilled r_8422', committed_at: '14:07:44', receipt: 'signed', chain: 'pending', chain_ref: 'chain_3b91…d442' },
]

function sevDotClass(s: Severity) {
  return s === 'critical' ? 'bg-red-700'
       : s === 'error'    ? 'bg-red-500'
       : s === 'warning'  ? 'bg-orange-600'
       :                    'bg-green-500'
}
function sevTextClass(s: Severity) {
  return s === 'critical' ? 'text-red-700 dark:text-red-400'
       : s === 'error'    ? 'text-red-600 dark:text-red-400'
       : s === 'warning'  ? 'text-orange-700 dark:text-orange-400'
       :                    'text-green-700 dark:text-green-500'
}
function rowTintClass(s: Severity) {
  // Subtle tint only for non-info severities, so anomalies pop.
  return s === 'critical' ? 'bg-red-50/40 dark:bg-red-500/[0.04]'
       : s === 'error'    ? 'bg-red-50/30 dark:bg-red-500/[0.03]'
       : s === 'warning'  ? 'bg-orange-50/40 dark:bg-orange-500/[0.04]'
       :                    ''
}

type Tab = 'event_stream' | 'execution_timeline' | 'proof_trail'

function ExecutionPreview() {
  const [tab, setTab] = useState<Tab>('event_stream')

  const tabs: { k: Tab; label: string; n: number }[] = [
    { k: 'event_stream',       label: 'Submission Trace',   n: ALL_EVENTS.length },
    { k: 'execution_timeline', label: 'Execution Timeline', n: 2 },
    { k: 'proof_trail',        label: 'Proof Trail',        n: ALL_RECEIPTS.length },
  ]

  return (
    <div
      className="bg-white dark:bg-[#111214] border border-black/[0.08] dark:border-[#323334] dark:border-t-[#5b5c5d] dark:border-r-[#5b5c5d] rounded-lg overflow-hidden flex flex-col"
      style={{ fontFamily: MONO, minHeight: 600 }}
    >
      {/* ── Chrome: tabs (left) + utilities + live clock (right) ──────────── */}
      <div className="flex items-center justify-between gap-4 px-3 py-2 border-b border-black/[0.08] dark:border-white/[0.08]">
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => {
            const active = tab === t.k
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                type="button"
                className={
                  active
                    ? 'flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] rounded-md bg-gray-100 dark:bg-white/[0.06] text-gray-900 dark:text-[#f6f6f4] font-medium cursor-pointer'
                    : 'flex items-center gap-1.5 px-2.5 py-1 text-[11.5px] text-gray-500 dark:text-[#8a8a7a] hover:text-gray-900 dark:hover:text-[#f6f6f4] cursor-pointer transition-colors'
                }
                style={{ fontFamily: 'inherit', letterSpacing: '0.01em' }}
              >
                {t.label}
                <span className={
                  active
                    ? 'text-[10px] tabular-nums px-1 rounded bg-white dark:bg-white/[0.08] text-gray-500 dark:text-[#8a8a7a]'
                    : 'text-[10px] tabular-nums text-gray-400 dark:text-[#5a5a52]'
                }>
                  {t.n}
                </span>
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 text-[10.5px] text-gray-400 dark:text-[#6a6a5e]" style={{ fontFamily: MONO }}>
          {/* refresh — keystroke hint */}
          <span className="hidden md:flex items-center gap-1.5">
            <span className="text-gray-300 dark:text-[#3a3a32]">⌘</span>
            <span>R</span>
            <span className="text-gray-300 dark:text-[#3a3a32]">refresh</span>
          </span>
          {/* live indicator */}
          <span className="flex items-center gap-1.5 text-green-600 dark:text-green-500">
            <span className="relative inline-flex">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="absolute inset-0 inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-ping opacity-75" />
            </span>
            <span className="tabular-nums">14:07:45</span>
          </span>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {tab === 'event_stream' && <EventStreamView />}
        {tab === 'execution_timeline' && <TimelineView />}
        {tab === 'proof_trail' && <ProofTrailView />}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab 1 · Event Stream                                          */
/* ────────────────────────────────────────────────────────────── */
function EventStreamView() {
  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {ALL_EVENTS.map((e, i) => {
        const isNotInfo = e.severity !== 'info'
        return (
          <div
            key={e.id}
            className={`group flex items-center gap-3 px-4 py-[7px] cursor-pointer transition-colors
                        ${rowTintClass(e.severity)}
                        hover:bg-gray-50 dark:hover:bg-white/[0.025]`}
          >
            {/* severity dot */}
            <span
              className={`flex-shrink-0 rounded-full ${sevDotClass(e.severity)}`}
              style={{ width: 5, height: 5 }}
              aria-label={e.severity}
            />

            {/* time */}
            <span className="text-[11.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums whitespace-nowrap w-[68px] flex-shrink-0 select-none">
              {e.time}
            </span>

            {/* severity label — only when not info */}
            <span
              className={`text-[10.5px] font-semibold uppercase w-[42px] flex-shrink-0 select-none ${isNotInfo ? sevTextClass(e.severity) : 'text-transparent'}`}
              style={{ letterSpacing: '0.08em' }}
            >
              {isNotInfo ? (e.severity === 'critical' ? 'CRIT' : e.severity.slice(0, 4).toUpperCase()) : '·'}
            </span>

            {/* event type */}
            <span className="text-[11.5px] text-blue-600 dark:text-blue-400 w-[176px] flex-shrink-0 truncate select-none">
              {e.event_type}
            </span>

            {/* message */}
            <span className="text-[12px] text-gray-700 dark:text-[#c8c8b8] flex-1 min-w-0 truncate">
              {e.message}
            </span>

            {/* latency (if present) */}
            {e.latency_ms != null && (
              <span className="text-[10.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums flex-shrink-0 w-[44px] text-right select-none">
                {e.latency_ms}ms
              </span>
            )}

            {/* exec id (always visible, faint blue) */}
            <span className="text-[11px] text-blue-500/80 dark:text-blue-400/70 w-[110px] text-right flex-shrink-0 truncate select-none">
              {e.exec_id ? `${e.exec_id.slice(0, 14)}…` : ''}
            </span>

            {/* drill-in chevron, reveals on hover */}
            <span className="text-[12px] text-gray-300 dark:text-[#3a3a32] flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity select-none">
              ›
            </span>
          </div>
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab 2 · Execution Timeline                                    */
/* ────────────────────────────────────────────────────────────── */
function TimelineView() {
  const groups = new Map<string, EventRow[]>()
  for (const e of ALL_EVENTS) {
    if (!e.exec_id) continue
    const arr = groups.get(e.exec_id) ?? []
    arr.push(e)
    groups.set(e.exec_id, arr)
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollbarWidth: 'thin' }}>
      {Array.from(groups.entries()).map(([execId, evts]) => {
        const hasWarn = evts.some((e) => e.severity === 'warning')
        const hasErr = evts.some((e) => e.severity === 'error' || e.severity === 'critical')
        const firstT = evts[0]?.time
        const lastT  = evts[evts.length - 1]?.time

        return (
          <div
            key={execId}
            className="rounded-md border border-gray-200 dark:border-white/[0.06] overflow-hidden bg-white dark:bg-white/[0.01]"
          >
            {/* group header */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex-shrink-0 rounded-full ${hasErr ? 'bg-orange-500' : hasWarn ? 'bg-yellow-500' : 'bg-blue-500'}`}
                  style={{ width: 6, height: 6 }}
                />
                <span className="text-[11.5px] text-blue-600 dark:text-blue-400 truncate" style={{ fontFamily: MONO }}>
                  {execId}
                </span>
                {hasErr && (
                  <span className="text-[10px] font-semibold uppercase text-orange-600 dark:text-orange-400 tracking-wider">err</span>
                )}
                {!hasErr && hasWarn && (
                  <span className="text-[10px] font-semibold uppercase text-yellow-700 dark:text-yellow-400 tracking-wider">warn</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-[10.5px] text-gray-400 dark:text-[#6a6a5e]">
                <span className="tabular-nums">{evts.length} events</span>
                {firstT && lastT && firstT !== lastT && (
                  <span className="tabular-nums">{firstT} → {lastT}</span>
                )}
                <span className="text-gray-300 dark:text-[#3a3a32]">›</span>
              </div>
            </div>

            {/* group body */}
            <div>
              {evts.map((e, i) => (
                <div
                  key={e.id}
                  className={`group flex items-center gap-3 px-3 py-[5px] hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer
                              ${rowTintClass(e.severity)}`}
                >
                  <span
                    className={`flex-shrink-0 rounded-full ${sevDotClass(e.severity)}`}
                    style={{ width: 4, height: 4 }}
                  />
                  <span className="text-[11px] text-gray-400 dark:text-[#6a6a5e] tabular-nums whitespace-nowrap w-[68px] flex-shrink-0 select-none">
                    {e.time}
                  </span>
                  <span className="text-[11px] text-blue-600 dark:text-blue-400 w-[170px] flex-shrink-0 truncate select-none">
                    {e.event_type}
                  </span>
                  <span className="text-[11.5px] text-gray-700 dark:text-[#c8c8b8] flex-1 min-w-0 truncate">
                    {e.message}
                  </span>
                  {e.latency_ms != null && (
                    <span className="text-[10.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums flex-shrink-0 select-none">
                      {e.latency_ms}ms
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab 3 · Proof Trail                                           */
/* ────────────────────────────────────────────────────────────── */
function ProofTrailView() {
  const cols = '12px 72px 124px 1fr 70px 110px'

  return (
    <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {/* compact column header */}
      <div
        className="grid items-baseline px-4 py-2 text-[9.5px] uppercase tracking-[0.2em] text-gray-400 dark:text-[#5a5a52] border-b border-gray-100 dark:border-white/[0.04]"
        style={{ fontFamily: MONO, gridTemplateColumns: cols }}
      >
        <span />
        <span>committed</span>
        <span>task</span>
        <span>action</span>
        <span className="text-right">receipt</span>
        <span className="text-right">chain</span>
      </div>

      {ALL_RECEIPTS.map((r, i) => {
        const valid = r.chain === 'valid'
        return (
          <div
            key={r.id}
            className={`group grid items-center gap-x-3 px-4 py-[8px] cursor-pointer transition-colors
                        hover:bg-gray-50 dark:hover:bg-white/[0.025]`}
            style={{ gridTemplateColumns: cols }}
          >
            <span
              className={`flex-shrink-0 rounded-full ${valid ? 'bg-green-500' : 'bg-gray-400 dark:bg-[#5a5a52]'}`}
              style={{ width: 5, height: 5 }}
              aria-label={r.chain}
            />
            <span className="text-[11.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums select-none">{r.committed_at}</span>
            <span className="text-[11.5px] text-blue-600 dark:text-blue-400 truncate select-none" title={r.task_id}>
              {r.task_id.slice(0, 16)}…
            </span>
            <span className="text-[11.5px] text-gray-700 dark:text-[#c8c8b8] truncate" title={r.action}>{r.action}</span>
            <span className="text-right">
              <span className="inline-flex px-1.5 py-px rounded text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10">
                signed
              </span>
            </span>
            <span
              className={`text-[11px] tabular-nums text-right truncate select-none ${valid ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-[#6a6a5e]'}`}
              title={r.chain_ref}
            >
              {valid ? r.chain_ref : 'pending'}
            </span>
          </div>
        )
      })}
    </div>
  )
}


export default function Products() {
  return (
    <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-none px-3 sm:px-4 lg:px-5">
        <div className="px-0">

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-10 md:pt-14 pb-6 md:pb-8">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              01&nbsp;·&nbsp;SUBMIT&nbsp;A&nbsp;TASK
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
              Submit an agent task once. Igris records every committed action.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Your app submits a task to Igris. Each committed action is
              recorded, recovery-safe, and returned with verifiable proof
              through the API or console.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-3">
              <Link
                href="https://docs.igrisinertial.com/"
                className="group inline-flex items-center gap-3 px-4 py-2.5 rounded-md border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
              >
                READ&nbsp;THE&nbsp;DOCS
                <span aria-hidden>{'>'}</span>
              </Link>
            </div>
          </div>

          {/* Terminal */}
          <div className="pb-8 md:pb-12">
            <div className="flex items-baseline justify-between pb-3">
              <span
                className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
                style={{ fontFamily: MONO }}
              >
                SUBMISSION&nbsp;TRACE
              </span>
              <span
                className="text-[10px] md:text-[11px] tracking-[0.22em] text-gray-400 dark:text-[#5a5a52]"
                style={{ fontFamily: MONO }}
              >
                CUSTOMER&nbsp;FLOW&nbsp;·&nbsp;SUBMIT&nbsp;EXECUTE&nbsp;VERIFY
              </span>
            </div>
            <ExecutionPreview />
          </div>

        </div>
      </div>
    </section>
  )
}
