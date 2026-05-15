'use client'

import React, { useState } from 'react'
import Link from 'next/link'

const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Mirrors the actual web-console history/logs page — three view modes with
// real EventType / Severity vocabulary and real RequestTrace columns.

type Severity = 'info' | 'warning' | 'error' | 'critical'
type EventType =
  | 'ExecutionStarted'
  | 'ProviderSelected'
  | 'ToolCall'
  | 'PolicyViolation'
  | 'ExecutionTerminated'
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

interface TraceRow {
  id: string
  time: string
  provider: string
  model: string
  status: number
  latency_ms: number
  tokens: number | null
  cost: number | null
  tag?: 'cache' | 'spec' | null
}

const ALL_EVENTS: EventRow[] = [
  { id: '1',  time: '14:07:42', severity: 'info',    event_type: 'ExecutionStarted',    message: 'task_019de343 started',                          exec_id: 'task_019de343' },
  { id: '2',  time: '14:07:42', severity: 'info',    event_type: 'ProviderSelected',    message: 'routed to fra1-a · 23ms',                        exec_id: 'task_019de343', latency_ms: 23 },
  { id: '3',  time: '14:07:42', severity: 'info',    event_type: 'ToolCall',            message: 'read approved file',                             exec_id: 'task_019de343', latency_ms: 12 },
  { id: '4',  time: '14:07:42', severity: 'info',    event_type: 'ToolCall',            message: 'call approved API · partner.sync',               exec_id: 'task_019de343', latency_ms: 38 },
  { id: '5',  time: '14:07:42', severity: 'warning', event_type: 'ToolCall',            message: 'api retry · backoff 250ms',                      exec_id: 'task_019de343', latency_ms: 250 },
  { id: '6',  time: '14:07:42', severity: 'info',    event_type: 'ToolCall',            message: 'api succeeded on retry',                         exec_id: 'task_019de343', latency_ms: 42 },
  { id: '7',  time: '14:07:42', severity: 'info',    event_type: 'ToolCall',            message: 'write approved record',                          exec_id: 'task_019de343', latency_ms: 18 },
  { id: '8',  time: '14:07:43', severity: 'info',    event_type: 'ReceiptSigned',       message: 'receipt issued · signed',                        exec_id: 'task_019de343' },
  { id: '9',  time: '14:07:43', severity: 'info',    event_type: 'ExecutionTerminated', message: 'chain · valid · 5 actions · 185 ms',             exec_id: 'task_019de343' },
  { id: '10', time: '14:07:44', severity: 'info',    event_type: 'ExecutionStarted',    message: 'task_019de421 started',                          exec_id: 'task_019de421' },
  { id: '11', time: '14:07:44', severity: 'info',    event_type: 'ToolCall',            message: 'read approved file',                             exec_id: 'task_019de421', latency_ms: 9 },
  { id: '12', time: '14:07:44', severity: 'info',    event_type: 'ToolCall',            message: 'call approved API · partner.sync',               exec_id: 'task_019de421', latency_ms: 31 },
  { id: '13', time: '14:07:44', severity: 'info',    event_type: 'ToolCall',            message: 'write approved record',                          exec_id: 'task_019de421', latency_ms: 14 },
  { id: '14', time: '14:07:45', severity: 'info',    event_type: 'ReceiptSigned',       message: 'receipt issued · signed',                        exec_id: 'task_019de421' },
]

const ALL_TRACES: TraceRow[] = [
  { id: 't1', time: '14:07:42', provider: 'anthropic', model: 'claude-sonnet-4-6',   status: 200, latency_ms: 892,  tokens: 2104, cost: 0.054, tag: null },
  { id: 't2', time: '14:07:41', provider: 'openai',    model: 'gpt-4o',              status: 200, latency_ms: 1240, tokens: 4318, cost: 0.073, tag: 'cache' },
  { id: 't3', time: '14:07:39', provider: 'anthropic', model: 'claude-haiku-4-5',    status: 200, latency_ms: 240,  tokens: 612,  cost: 0.003, tag: 'cache' },
  { id: 't4', time: '14:07:35', provider: 'openai',    model: 'gpt-4o-mini',         status: 200, latency_ms: 430,  tokens: 1002, cost: 0.008, tag: null },
  { id: 't5', time: '14:07:30', provider: 'openai',    model: 'gpt-4o',              status: 429, latency_ms: 120,  tokens: null, cost: null,  tag: null },
  { id: 't6', time: '14:07:28', provider: 'anthropic', model: 'claude-sonnet-4-6',   status: 200, latency_ms: 1410, tokens: 6442, cost: 0.108, tag: 'spec' },
  { id: 't7', time: '14:07:20', provider: 'anthropic', model: 'claude-opus-4-7',     status: 200, latency_ms: 980,  tokens: 3250, cost: 0.062, tag: null },
  { id: 't8', time: '14:07:14', provider: 'openai',    model: 'gpt-4o-mini',         status: 200, latency_ms: 312,  tokens: 904,  cost: 0.007, tag: 'cache' },
]

function sevLabel(s: Severity) {
  return s === 'critical' ? 'CRIT' : s.slice(0, 4).toUpperCase()
}
function sevTextClass(s: Severity) {
  return s === 'critical' ? 'text-red-500'
       : s === 'error'    ? 'text-orange-500'
       : s === 'warning'  ? 'text-yellow-600 dark:text-yellow-400'
       :                    'text-green-600 dark:text-green-500'
}
function sevBorderClass(s: Severity) {
  return s === 'critical' ? 'border-l-red-500'
       : s === 'error'    ? 'border-l-orange-500'
       : s === 'warning'  ? 'border-l-yellow-400'
       :                    'border-l-transparent'
}

type Tab = 'event_stream' | 'execution_timeline' | 'request_traces'

function ExecutionPreview() {
  const [tab, setTab] = useState<Tab>('event_stream')

  const tabs: { k: Tab; label: string }[] = [
    { k: 'event_stream',       label: 'Event Stream' },
    { k: 'execution_timeline', label: 'Execution Timeline' },
    { k: 'request_traces',     label: 'Request Traces' },
  ]

  const counts = {
    events:  ALL_EVENTS.length,
    warn:    ALL_EVENTS.filter((e) => e.severity === 'warning').length,
    err:     ALL_EVENTS.filter((e) => e.severity === 'error' || e.severity === 'critical').length,
    traces:  ALL_TRACES.length,
    fail:    ALL_TRACES.filter((t) => t.status !== 200).length,
  }

  return (
    <div
      className="bg-white dark:bg-[#0f0f0d] border border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden flex flex-col"
      style={{ fontFamily: MONO, minHeight: 560 }}
    >
      {/* ── Tabs + live indicator ─────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-black/[0.08] dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]">
        <div className="flex items-center gap-0.5">
          {tabs.map((t) => {
            const active = tab === t.k
            return (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={
                  active
                    ? 'px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-white/[0.06] text-gray-900 dark:text-[#f6f6f4] font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)] cursor-pointer'
                    : 'px-2.5 py-1 text-[11px] text-gray-500 dark:text-[#8a8a7a] hover:text-gray-900 dark:hover:text-[#f6f6f4] cursor-pointer transition-colors'
                }
                style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
                type="button"
              >
                {t.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-3 text-[10.5px] text-gray-400 dark:text-[#6a6a5e]">
          <span className="tabular-nums">
            {tab === 'request_traces' ? `${counts.traces} traces` : `${counts.events} events`}
          </span>
          <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            live
          </span>
          <span className="tabular-nums">14:07:45</span>
        </div>
      </div>

      {/* ── Tab content ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-0">
        {tab === 'event_stream' && <EventStreamView />}
        {tab === 'execution_timeline' && <TimelineView />}
        {tab === 'request_traces' && <TracesView />}
      </div>

      {/* ── Foot strip ────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-t border-black/[0.08] dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02] text-[10.5px] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
        {tab === 'request_traces' ? (
          <>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">{counts.traces} traces</span>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <span className="tabular-nums">{counts.fail} non-200</span>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <span className="tabular-nums">last hour</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 dark:text-[#6a6a5e]">export</span>
              <span className="text-blue-500/80 dark:text-blue-400/70">json</span>
              <span className="text-gray-400 dark:text-[#6a6a5e]">→</span>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="tabular-nums">{counts.events} events</span>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <span className="tabular-nums">{counts.warn} warnings</span>
              <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
              <span className="tabular-nums">{counts.err} errors</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-blue-500/80 dark:text-blue-400/70">2 executions</span>
              <span className="text-gray-400 dark:text-[#6a6a5e]">→</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab 1 · Event Stream                                          */
/* ────────────────────────────────────────────────────────────── */
function EventStreamView() {
  return (
    <div className="flex flex-col">
      {/* column header */}
      <div className="flex items-baseline px-4 py-2 border-b border-black/[0.08] dark:border-white/[0.08] text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-[#6a6a5e] font-medium" style={{ fontFamily: MONO }}>
        <span className="w-[68px] pr-3 flex-shrink-0">Time</span>
        <span className="w-[58px] pr-3 flex-shrink-0">Level</span>
        <span className="w-[176px] pr-3 flex-shrink-0">Event Type</span>
        <span className="flex-1">Message</span>
        <span className="w-[120px] text-right">Exec</span>
      </div>

      {/* rows */}
      <div>
        {ALL_EVENTS.map((e) => (
          <div
            key={e.id}
            className={`flex items-baseline gap-0 px-4 py-[5px] border-l-[3px] ${sevBorderClass(e.severity)} border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors cursor-default group`}
          >
            <span className="text-[11.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums whitespace-nowrap pr-3 w-[68px] flex-shrink-0 select-none">{e.time}</span>
            <span className={`text-[11px] font-bold uppercase pr-3 w-[58px] flex-shrink-0 select-none ${sevTextClass(e.severity)}`} style={{ letterSpacing: '0.06em' }}>{sevLabel(e.severity)}</span>
            <span className="text-[11.5px] text-violet-600 dark:text-violet-400 pr-3 w-[176px] flex-shrink-0 truncate select-none">{e.event_type}</span>
            <span className="text-[11.5px] text-gray-700 dark:text-[#c8c8b8] flex-1 min-w-0 break-words leading-[1.6]">{e.message}</span>
            <span className="text-[11px] text-blue-500/70 dark:text-blue-400/70 w-[120px] text-right flex-shrink-0 pl-3 opacity-50 group-hover:opacity-100 transition-opacity truncate select-none">
              {e.exec_id ? `${e.exec_id.slice(0, 14)}…` : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────── */
/*  Tab 2 · Execution Timeline                                    */
/* ────────────────────────────────────────────────────────────── */
function TimelineView() {
  // Group events by exec_id
  const groups = new Map<string, EventRow[]>()
  for (const e of ALL_EVENTS) {
    if (!e.exec_id) continue
    const arr = groups.get(e.exec_id) ?? []
    arr.push(e)
    groups.set(e.exec_id, arr)
  }

  return (
    <div className="flex flex-col gap-3 p-3">
      {Array.from(groups.entries()).map(([execId, evts]) => {
        const hasWarn = evts.some((e) => e.severity === 'warning')
        const firstT = evts[0]?.time
        const lastT  = evts[evts.length - 1]?.time
        return (
          <div key={execId} className="rounded-md border border-gray-200 dark:border-white/[0.06] overflow-hidden">
            {/* group header */}
            <div className="flex items-center justify-between gap-3 px-3 py-2 bg-gray-50 dark:bg-white/[0.03] border-b border-gray-100 dark:border-white/[0.04]">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500/70 flex-shrink-0" />
                <span className="text-[11.5px] text-blue-600 dark:text-blue-400 truncate" style={{ fontFamily: MONO }}>{execId}</span>
                {hasWarn && (
                  <span className="text-[10px] font-bold uppercase text-yellow-600 dark:text-yellow-400 tracking-wider">warn</span>
                )}
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 text-[10.5px] text-gray-400 dark:text-[#6a6a5e]">
                <span className="tabular-nums">{evts.length} events</span>
                {firstT && lastT && firstT !== lastT && (
                  <span className="tabular-nums">{firstT} → {lastT}</span>
                )}
              </div>
            </div>

            {/* group body */}
            <div className="divide-y divide-gray-100 dark:divide-white/[0.04]">
              {evts.map((e) => (
                <div key={e.id} className="flex items-baseline gap-0 px-3 py-[4px]">
                  <span className="text-[11px] text-gray-400 dark:text-[#6a6a5e] tabular-nums whitespace-nowrap pr-3 w-[68px] flex-shrink-0 select-none">{e.time}</span>
                  <span className={`text-[11px] font-bold uppercase pr-3 w-[52px] flex-shrink-0 select-none ${sevTextClass(e.severity)}`} style={{ letterSpacing: '0.06em' }}>{sevLabel(e.severity)}</span>
                  <span className="text-[11px] text-violet-600 dark:text-violet-400 pr-3 w-[160px] flex-shrink-0 truncate select-none">{e.event_type}</span>
                  <span className="text-[11.5px] text-gray-700 dark:text-[#c8c8b8] flex-1 min-w-0">{e.message}</span>
                  {e.latency_ms != null && (
                    <span className="text-[11px] text-gray-400 dark:text-[#6a6a5e] tabular-nums flex-shrink-0 pl-3 select-none">{e.latency_ms}ms</span>
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
/*  Tab 3 · Request Traces                                        */
/* ────────────────────────────────────────────────────────────── */
function TracesView() {
  function statusClass(s: number) {
    return s === 200 ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20'
         : s === 429 ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20'
         :             'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20'
  }
  const fmtLatency = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
  const fmtCost = (c: number | null) => c == null ? '—' : `$${c.toFixed(3)}`

  return (
    <div className="flex flex-col">
      {/* column header */}
      <div className="grid items-baseline px-4 py-2 border-b border-black/[0.08] dark:border-white/[0.08] text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-[#6a6a5e] font-medium"
        style={{ fontFamily: MONO, gridTemplateColumns: '80px 100px 1fr 64px 80px 80px 72px 64px' }}
      >
        <span>Time</span>
        <span>Provider</span>
        <span>Model</span>
        <span>Status</span>
        <span>Latency</span>
        <span>Tokens</span>
        <span>Cost</span>
        <span>Tag</span>
      </div>

      {/* rows */}
      <div>
        {ALL_TRACES.map((t) => (
          <div
            key={t.id}
            className="grid items-baseline px-4 py-[6px] border-b border-gray-100 dark:border-white/[0.04] hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors cursor-default"
            style={{ gridTemplateColumns: '80px 100px 1fr 64px 80px 80px 72px 64px' }}
          >
            <span className="text-[11.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums font-mono select-none">{t.time}</span>
            <span className="text-[11.5px] text-gray-800 dark:text-[#dadaca] truncate">{t.provider}</span>
            <span className="text-[11.5px] text-gray-600 dark:text-[#9a9a8a] truncate" title={t.model}>{t.model}</span>
            <span>
              <span className={`inline-flex px-1.5 py-px rounded text-[10.5px] font-medium border ${statusClass(t.status)}`}>
                {t.status}
              </span>
            </span>
            <span className="text-[11.5px] tabular-nums text-gray-600 dark:text-[#9a9a8a]">{fmtLatency(t.latency_ms)}</span>
            <span className="text-[11.5px] tabular-nums text-gray-600 dark:text-[#9a9a8a]">{t.tokens?.toLocaleString() ?? '—'}</span>
            <span className="text-[11.5px] tabular-nums text-gray-600 dark:text-[#9a9a8a]">{fmtCost(t.cost)}</span>
            <span>
              {t.tag === 'cache' && (
                <span className="inline-flex px-1 py-px rounded text-[10px] bg-sky-50 text-sky-600 border border-sky-200 dark:bg-sky-500/10 dark:text-sky-400 dark:border-sky-500/20">cache</span>
              )}
              {t.tag === 'spec' && (
                <span className="inline-flex px-1 py-px rounded text-[10px] bg-violet-50 text-violet-600 border border-violet-200 dark:bg-violet-500/10 dark:text-violet-400 dark:border-violet-500/20">spec</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}


export default function Products() {
  const sectionBorder = 'var(--section-border)'

  return (
    <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: sectionBorder }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: sectionBorder, borderRight: sectionBorder }}>

          {/* Section heading — eyebrow / title / subtext */}
          <div className="pt-20 md:pt-32 pb-10 md:pb-14">
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
                className="group inline-flex items-center gap-3 px-4 py-2.5 border border-gray-300 dark:border-[#3a3a32] hover:border-gray-900 dark:hover:border-[#f6f6f4] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all duration-200 text-[#000000] dark:text-[#f6f6f4]"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.22em' }}
              >
                READ&nbsp;THE&nbsp;DOCS
                <span aria-hidden>{'>'}</span>
              </Link>
            </div>
          </div>

          {/* Terminal */}
          <div className="pb-24 md:pb-32">
            <div className="flex items-baseline justify-between pb-4">
              <span className="text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
                FIG.1
              </span>
              <span className="text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: MONO }}>
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
