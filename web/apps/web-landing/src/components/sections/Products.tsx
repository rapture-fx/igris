import React from 'react'
import Link from 'next/link'

const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

// Mirrors the actual web-console Event Stream view (history/logs/page.tsx).
// Real EventTypes (CamelCase), real severity levels, real column layout.

type Severity = 'info' | 'warning' | 'error' | 'critical'
type EventType =
  | 'ExecutionStarted'
  | 'ToolCall'
  | 'ReceiptSigned'
  | 'ExecutionTerminated'

interface EventRow {
  id: string
  time: string       // hh:mm:ss
  severity: Severity
  event_type: EventType
  message: string
}

const EVENTS: EventRow[] = [
  { id: 'e1', time: '14:07:42', severity: 'info', event_type: 'ExecutionStarted',    message: 'task_019de343 started' },
  { id: 'e2', time: '14:07:42', severity: 'info', event_type: 'ToolCall',            message: 'read approved file' },
  { id: 'e3', time: '14:07:42', severity: 'info', event_type: 'ToolCall',            message: 'call approved API' },
  { id: 'e4', time: '14:07:42', severity: 'info', event_type: 'ToolCall',            message: 'write approved record' },
  { id: 'e5', time: '14:07:42', severity: 'info', event_type: 'ReceiptSigned',       message: 'chain assembled · signed' },
  { id: 'e6', time: '14:07:42', severity: 'info', event_type: 'ExecutionTerminated', message: 'chain · valid · 3 actions · 185 ms' },
]

function severityLabel(s: Severity) {
  return s === 'critical' ? 'CRIT' : s.slice(0, 4).toUpperCase()
}

function severityTextClass(s: Severity) {
  return s === 'critical' ? 'text-red-500'
       : s === 'error'    ? 'text-orange-500'
       : s === 'warning'  ? 'text-yellow-500'
       :                    'text-green-600 dark:text-green-500'
}

function severityBorderClass(s: Severity) {
  return s === 'critical' ? 'border-l-red-500'
       : s === 'error'    ? 'border-l-orange-500'
       : s === 'warning'  ? 'border-l-yellow-500'
       :                    'border-l-transparent'
}

function ExecutionPreview() {
  return (
    <div
      className="bg-white dark:bg-[#0f0f0d] border border-black/[0.08] dark:border-white/[0.08] rounded-lg overflow-hidden"
      style={{ fontFamily: MONO }}
    >
      <style>{`
        @keyframes igris-evt-in {
          from { opacity: 0; transform: translateY(2px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .igris-evt { opacity: 0; animation: igris-evt-in 240ms cubic-bezier(.22,.61,.36,1) both; }
      `}</style>

      {/* ── Tabs + live indicator (mimics console chrome) ─────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-b border-black/[0.08] dark:border-white/[0.08] bg-gray-50/60 dark:bg-white/[0.02]"
      >
        <div className="flex items-center gap-0.5">
          {[
            { k: 'event_stream',       label: 'Event Stream',       active: true },
            { k: 'execution_timeline', label: 'Execution Timeline', active: false },
            { k: 'request_traces',     label: 'Request Traces',     active: false },
          ].map((t) => (
            <span
              key={t.k}
              className={
                t.active
                  ? 'px-2.5 py-1 text-[11px] rounded-md bg-white dark:bg-white/[0.06] text-gray-900 dark:text-[#f6f6f4] font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)]'
                  : 'px-2.5 py-1 text-[11px] text-gray-500 dark:text-[#8a8a7a]'
              }
              style={{ fontFamily: 'inherit', letterSpacing: '0.02em' }}
            >
              {t.label}
            </span>
          ))}
        </div>

        <div className="flex items-center gap-3 text-[10.5px] text-gray-400 dark:text-[#6a6a5e]">
          <span className="tabular-nums">{EVENTS.length} events</span>
          <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            live
          </span>
          <span className="tabular-nums">14:07:42</span>
        </div>
      </div>

      {/* ── Column header row (TIME / LEVEL / EVENT TYPE / MESSAGE) ─ */}
      <div
        className="flex items-baseline px-4 py-2 border-b border-black/[0.08] dark:border-white/[0.08]
                   text-[10px] uppercase tracking-[0.18em] text-gray-500 dark:text-[#6a6a5e]
                   font-medium"
        style={{ fontFamily: MONO }}
      >
        <span className="w-[68px] pr-3 flex-shrink-0">Time</span>
        <span className="w-[58px] pr-3 flex-shrink-0">Level</span>
        <span className="w-[180px] pr-3 flex-shrink-0">Event Type</span>
        <span className="flex-1">Message</span>
        <span className="w-[100px] text-right">Exec ID</span>
      </div>

      {/* ── Event rows (mirrors history/logs Event Stream) ─────────── */}
      <div>
        {EVENTS.map((e, i) => (
          <div
            key={e.id}
            className={`igris-evt flex items-baseline gap-0 px-4 py-[5px] border-l-[3px] ${severityBorderClass(e.severity)}
                        border-b border-gray-100 dark:border-white/[0.04]
                        hover:bg-gray-50 dark:hover:bg-white/[0.025] transition-colors cursor-default group`}
            style={{ animationDelay: `${80 + i * 80}ms` }}
          >
            {/* time */}
            <span className="text-[11.5px] text-gray-400 dark:text-[#6a6a5e] tabular-nums whitespace-nowrap pr-3 w-[68px] flex-shrink-0 select-none">
              {e.time}
            </span>

            {/* severity */}
            <span
              className={`text-[11px] font-bold uppercase pr-3 w-[58px] flex-shrink-0 select-none ${severityTextClass(e.severity)}`}
              style={{ letterSpacing: '0.06em' }}
            >
              {severityLabel(e.severity)}
            </span>

            {/* event type — violet, matches console */}
            <span className="text-[11.5px] text-violet-600 dark:text-violet-400 pr-3 w-[180px] flex-shrink-0 truncate select-none">
              {e.event_type}
            </span>

            {/* message */}
            <span className="text-[11.5px] text-gray-700 dark:text-[#c8c8b8] flex-1 min-w-0 break-words leading-[1.6]">
              {e.message}
            </span>

            {/* exec id — revealed on hover, like console */}
            <span className="text-[11px] text-blue-500/70 dark:text-blue-400/70 w-[100px] text-right flex-shrink-0 pl-3 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap select-none">
              task_019de…
            </span>
          </div>
        ))}
      </div>

      {/* ── Foot strip — counts + drill-in ────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-2 border-t border-black/[0.08] dark:border-white/[0.08]
                   bg-gray-50/60 dark:bg-white/[0.02]
                   text-[10.5px] text-gray-500 dark:text-[#8a8a7a]"
        style={{ fontFamily: MONO }}
      >
        <div className="flex items-center gap-3">
          <span className="tabular-nums">{EVENTS.length} events</span>
          <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
          <span className="tabular-nums">0 warnings</span>
          <span className="text-gray-300 dark:text-[#3a3a32]">·</span>
          <span className="tabular-nums">0 errors</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-blue-500/80 dark:text-blue-400/70">task_019de343</span>
          <span className="text-gray-400 dark:text-[#6a6a5e]">→</span>
        </div>
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
              Submit work once. Igris makes it durable.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[58ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Your app sends a task to Igris. The work runs in the configured
              execution environment, progress is recorded as actions commit, and
              your team gets a verifiable result through the API or console.
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
