'use client'

import React, { useEffect, useState } from 'react'
import { LineSpinner } from 'ldrs/react'
import 'ldrs/react/LineSpinner.css'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

// ──────────────────────────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────────────────────────

type Kind = 'action' | 'fault'
type Status = 'committed' | 'running' | 'pending'

interface Step {
  id: string
  kind: Kind
  num?: string
  name: string
  detail: string
  latency?: number
  status: Status
  receipt?: string
  signed_at?: string
}

const STEPS: Step[] = [
  { id: 's1', kind: 'action', num: '01', name: 'read_file', detail: '/uploads/policy-v3.pdf · 1.2KB digest',                        latency: 12, status: 'committed', receipt: 'r₀₁', signed_at: '14:07:42.218' },
  { id: 's2', kind: 'action', num: '02', name: 'http_call', detail: 'POST /v3/sync · 200 OK',                                        latency: 38, status: 'committed', receipt: 'r₀₂', signed_at: '14:07:42.481' },
  { id: 's3', kind: 'fault',             name: 'host_fault', detail: 'worker_a failed · checkpoint preserved · resumed on worker_b', latency: 31, status: 'committed' },
  { id: 's4', kind: 'action', num: '03', name: 'http_call', detail: 'retry 2 of 3 succeeded',                                        latency: 42, status: 'committed', receipt: 'r₀₃', signed_at: '14:07:43.014' },
  { id: 's5', kind: 'action', num: '04', name: 'db_write',  detail: 'orders_fulfilled · r_8421',                                                 status: 'running' },
]

interface SidebarTask {
  id: string
  status: 'completed' | 'running' | 'failed'
  title: string
  when: string
  active?: boolean
}

interface SidebarGroup {
  id: string
  name: string
  collapsed?: boolean
  tasks: SidebarTask[]
}

const SIDEBAR: SidebarGroup[] = [
  {
    id: 'acme-orders',
    name: 'acme-orders',
    tasks: [
      { id: 't-now', status: 'running',   title: 'Fulfill order — policy v3',   when: 'just now', active: true },
      { id: 't-1',   status: 'completed', title: 'Reconcile inventory snapshot', when: '4m ago' },
      { id: 't-2',   status: 'completed', title: 'Sync customer accounts',       when: '12m ago' },
    ],
  },
  {
    id: 'enterprise-sync',
    name: 'enterprise-sync',
    tasks: [
      { id: 't-3', status: 'completed', title: 'Rotate signing keys',       when: '1h ago' },
      { id: 't-4', status: 'completed', title: 'Reindex catalog',           when: '2h ago' },
      { id: 't-5', status: 'completed', title: 'Replay overnight backlog',  when: '6h ago' },
    ],
  },
  {
    id: 'mateo-pipeline',
    name: "mateo's-pipeline",
    collapsed: true,
    tasks: [
      { id: 't-6', status: 'failed', title: 'Webhook retry', when: '1d ago' },
    ],
  },
]

// ──────────────────────────────────────────────────────────────────

export function ExecutionPreview() {
  return (
    <div
      className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]"
    >
      <div
        className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]"
      >
        <div
          className="igris-console relative overflow-hidden rounded-[10px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]"
          style={{ fontFamily: SANS, background: '#0e0e0c', color: '#e8e7df' }}
        >
          <ConsoleStyles />
          <div className="grid" style={{ gridTemplateColumns: '236px 1fr', height: 640 }}>
            <Sidebar />
            <Main />
          </div>
        </div>
      </div>
    </div>
  )
}

function ConsoleStyles() {
  return (
    <style>{`
      .igris-console { color-scheme: dark; }

      .igris-console .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-console .ic-scroll::-webkit-scrollbar { display: none; }

      .igris-console .ic-chip {
        font-family: ${MONO};
        font-size: 11.5px;
        padding: 1px 6px;
        border-radius: 4px;
        background: rgba(255,255,255,0.045);
        color: #d3d2c8;
        border: 1px solid rgba(255,255,255,0.04);
        white-space: nowrap;
      }
      .igris-console .ic-kbd {
        font-family: ${MONO};
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 3px;
        background: rgba(255,255,255,0.05);
        color: #8a8a82;
        border: 1px solid rgba(255,255,255,0.04);
      }
      .igris-console .ic-kbd--sm {
        font-size: 8.5px;
        padding: 0 4px;
        line-height: 14px;
        border-radius: 2.5px;
      }
      .igris-console .ic-chip-icon {
        display: inline-flex;
        align-items: center;
        margin-right: 4px;
        color: #8a8a82;
      }

      @keyframes ic-step-in {
        from { opacity: 0; transform: translateY(3px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .igris-console .ic-step-in { animation: ic-step-in 620ms cubic-bezier(0.16, 0.84, 0.44, 1) both; }

      @keyframes ic-breathe {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.45; }
      }
      .igris-console .ic-breathing { animation: ic-breathe 3.2s ease-in-out infinite; }

      @keyframes ic-cycle-fade {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
      .igris-console .ic-cycle-fade { animation: ic-cycle-fade 480ms ease-out both; }

      @keyframes ic-dot {
        0%, 100% { opacity: 1; }
        50%      { opacity: 0.4; }
      }
      .igris-console .ic-live-dot { animation: ic-dot 2.4s ease-in-out infinite; }
    `}</style>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside className="flex flex-col border-r border-white/[0.05]" style={{ background: '#070707' }}>
      {/* brand */}
      <div className="flex items-center gap-2 h-11 px-4 border-b border-white/[0.05]">
        <img
          src="/inertiadm.png"
          alt="Igris"
          width={18}
          height={18}
          className="block select-none"
          draggable={false}
        />
      </div>

      {/* search */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 px-2 h-[22px] rounded-md bg-white/[0.025] border-[0.5px] border-white/[0.04]">
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-[#6a6a62]">
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="flex-1 text-[10.5px] text-[#6a6a62]">Search</span>
          <span className="ic-kbd ic-kbd--sm">⌘K</span>
        </div>
      </div>

      {/* section header */}
      <div className="flex items-center justify-between px-4 mt-1 mb-1">
        <span className="text-[11px] text-[#7a7a72]">Tasks</span>
        <div className="flex items-center gap-1.5">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#5a5a52] hover:text-[#a8a89e] cursor-pointer">
            <path d="M7 8 L17 8 M7 16 L17 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M14 5 L17 8 L14 11 M10 13 L7 16 L10 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[#5a5a52] hover:text-[#a8a89e] cursor-pointer">
            <path d="M12 5 L12 19 M5 12 L19 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* groups */}
      <div className="ic-scroll flex-1 overflow-y-auto px-2 pb-2">
        {SIDEBAR.map((g) => (
          <SidebarGroupView key={g.id} group={g} />
        ))}
        <button className="w-full text-left text-[11px] text-[#5a5a52] hover:text-[#a8a89e] px-2 py-1.5 mt-1">
          Show more
        </button>
      </div>

      {/* settings */}
      <div className="flex items-center gap-2 px-4 h-9 border-t border-white/[0.05] text-[#7a7a72]">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.8a7 7 0 0 0-2.1-1.2L14 3h-4l-.4 2.5a7 7 0 0 0-2.1 1.2l-2.4-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.8a7 7 0 0 0 2.1 1.2L10 21h4l.4-2.5a7 7 0 0 0 2.1-1.2l2.4.8 2-3.4-2-1.5c0-.4.1-.8.1-1.2z"
            stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
          />
        </svg>
        <span className="text-[11.5px]">Settings</span>
      </div>
    </aside>
  )
}

function SidebarGroupView({ group }: { group: SidebarGroup }) {
  const expanded = !group.collapsed
  return (
    <div className="mt-1">
      <button className="flex items-center gap-1.5 w-full px-1.5 py-1 text-left text-[12px] text-[#c8c7be] hover:bg-white/[0.025] rounded">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className={'text-[#6a6a62] transition-transform ' + (expanded ? 'rotate-90' : '')}>
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="flex items-center justify-center w-3.5 h-3.5">
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-500/80" />
        </span>
        <span className="truncate" style={{ letterSpacing: '-0.005em' }}>{group.name}</span>
      </button>
      {expanded && (
        <div className="mt-px">
          {group.tasks.map((t) => (
            <SidebarTaskView key={t.id} task={t} />
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarTaskView({ task }: { task: SidebarTask }) {
  const dotColor =
    task.status === 'running'  ? 'bg-emerald-400' :
    task.status === 'failed'   ? 'bg-rose-500'    :
                                 'bg-[#3a3a32]'
  const label =
    task.status === 'running'   ? 'Running'   :
    task.status === 'failed'    ? 'Failed'    :
                                  'Completed'
  const labelColor =
    task.status === 'running'   ? 'text-emerald-400' :
    task.status === 'failed'    ? 'text-rose-400'    :
                                  'text-[#6a6a62]'

  return (
    <div
      className={
        'group flex items-center gap-2 pl-7 pr-2 py-1.5 rounded transition-colors cursor-default ' +
        (task.active ? 'bg-white/[0.045]' : 'hover:bg-white/[0.02]')
      }
    >
      <span className="flex items-center justify-center w-2.5">
        <span className={'block w-1.5 h-1.5 rounded-full ' + dotColor + (task.status === 'running' ? ' ic-live-dot' : '')} />
      </span>
      <span className={'text-[10.5px] tracking-[0.04em] flex-shrink-0 w-[58px] ' + labelColor}>{label}</span>
      <span className={'text-[11.5px] truncate flex-1 ' + (task.active ? 'text-[#f0efe8]' : 'text-[#a8a89e]')} style={{ letterSpacing: '-0.005em' }}>
        {task.title}
      </span>
      <span className="text-[10.5px] text-[#5a5a52] tabular-nums flex-shrink-0 hidden md:inline">{task.when}</span>
    </div>
  )
}

// ── Main pane ──────────────────────────────────────────────────────

function Main() {
  return (
    <div className="flex flex-col min-h-0">
      <MainTopBar />
      <MainBody />
      <MainFooter />
    </div>
  )
}

function MainTopBar() {
  return (
    <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-white/[0.05]">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="text-[13px] font-medium text-[#f0efe8] truncate" style={{ letterSpacing: '-0.01em' }}>
          Fulfill order — policy v3
        </span>
        <span className="ic-chip">acme-orders</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TopBtn label="Re-run" iconPlus />
        <TopBtn label="Inspect" iconCaret />
        <TopBtn label="Verify chain" iconCaret accent />
      </div>
    </div>
  )
}

function TopBtn({ label, iconPlus, iconCaret, accent }: { label: string; iconPlus?: boolean; iconCaret?: boolean; accent?: boolean }) {
  return (
    <button
      type="button"
      className={
        'inline-flex items-center gap-1.5 h-7 px-2.5 rounded-md text-[11.5px] transition-colors cursor-default ' +
        (accent
          ? 'bg-emerald-500/[0.12] text-emerald-300 border border-emerald-500/20 hover:bg-emerald-500/[0.16]'
          : 'bg-white/[0.04] text-[#d3d2c8] border border-white/[0.05] hover:bg-white/[0.06]')
      }
    >
      {iconPlus && (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
          <path d="M12 5 L12 19 M5 12 L19 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
      <span>{label}</span>
      {iconCaret && (
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
          <path d="M6 10 L12 16 L18 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}

function MainBody() {
  const [visible, setVisible] = useState(1)
  const [cycle, setCycle] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduced) { setVisible(STEPS.length); return }
    let to: ReturnType<typeof setTimeout> | null = null
    const id = setInterval(() => {
      setVisible((c) => {
        if (c >= STEPS.length) {
          setFading(true)
          to = setTimeout(() => {
            setFading(false)
            setCycle((k) => k + 1)
            setVisible(1)
          }, 480)
          return c
        }
        return c + 1
      })
    }, 1600)
    return () => { clearInterval(id); if (to) clearTimeout(to) }
  }, [])

  const steps = STEPS.slice(0, visible)
  const committed = steps.filter((s) => s.kind === 'action' && s.status === 'committed').length
  const total = STEPS.filter((s) => s.kind === 'action').length

  return (
    <div className="ic-scroll flex-1 overflow-y-auto px-7 pt-6 pb-2">
      {/* definition rows — Submitter / Region / Worker / Submitted / Mode */}
      <DefRow label="Submitter" value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>mateo@acme.io</span> <span className="text-[#7a7a72]">engineer, integrations</span></>} />
      <DefRow label="Region"    value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>fra1·prod</span> <span className="text-[#7a7a72]">eu-central, primary</span></>} />
      <DefRow label="Worker"    value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>worker_b</span> <span className="text-[#7a7a72]">recovered from </span><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>worker_a</span></>} />
      <DefRow label="Submitted" value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>14:07:42 UTC</span> <span className="text-[#7a7a72]">12 seconds ago, action workflow</span></>} />
      <DefRow label="Mode"      value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>action_workflow</span> <span className="text-[#7a7a72]">4 controlled tools, recovery enabled</span></>} />

      {/* narrative */}
      <p className="mt-5 text-[13px] text-[#c8c7be] leading-relaxed max-w-[60ch]">
        The receipt chain is <span className="text-emerald-400">valid</span> up to <span style={{ fontFamily: MONO }}>action 03</span>.
        Action 04 (<span style={{ fontFamily: MONO }}>db_write</span>) is currently running. No replays were
        needed across the host fault.
      </p>

      {/* committed actions section */}
      <div className="mt-7 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[11.5px] text-[#a8a89e]">
          <span>Committed actions ({total})</span>
          <span className="text-emerald-400/80" style={{ fontFamily: MONO }}>+{committed}</span>
          <span className="text-rose-400/60" style={{ fontFamily: MONO }}>−0</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[11px] text-[#7a7a72] hover:text-[#d3d2c8] px-2 py-1 rounded">Collapse all</button>
          <button className="text-[11px] text-[#7a7a72] hover:text-[#d3d2c8] px-2 py-1 rounded">View receipts</button>
        </div>
      </div>

      <div className={'mt-3 ' + (fading ? 'ic-cycle-fade' : '')}>
        <Tree title="actions" icon="bolt">
          {steps.map((s, i) => {
            const isLatest = i === steps.length - 1
            return (
              <div key={`${cycle}-${s.id}`} className="ic-step-in">
                {s.kind === 'fault' ? (
                  <FaultLine step={s} />
                ) : (
                  <ActionLine step={s} running={s.status === 'running'} isLatest={isLatest} />
                )}
              </div>
            )
          })}
        </Tree>
      </div>

      <div className="mt-4 text-[11px] text-[#5a5a52] tabular-nums" style={{ fontFamily: MONO }}>
        14:07:42 · live
      </div>
    </div>
  )
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 py-1.5" style={{ gridTemplateColumns: '90px 1fr' }}>
      <span className="text-[12px] text-[#8a8a82]">{label}</span>
      <div className="text-[12.5px] text-[#d3d2c8] flex items-center gap-1.5 flex-wrap">{value}</div>
    </div>
  )
}

function Tree({ title, icon, children }: { title: string; icon: 'bolt' | 'box'; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-[#a8a89e]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-[#6a6a62] rotate-90">
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {icon === 'bolt' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#7a7a72]">
            <path d="M13 2 L4 14 L11 14 L11 22 L20 10 L13 10 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[#7a7a72]">
            <path d="M4 7 L12 3 L20 7 L20 17 L12 21 L4 17 Z M4 7 L12 11 L20 7 M12 11 L12 21" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        )}
        <span style={{ fontFamily: MONO }}>{title}</span>
      </div>
      <div className="mt-1 pl-5 border-l border-white/[0.05] ml-1">{children}</div>
    </div>
  )
}

function ActionLoader() {
  return (
    <span className="inline-flex items-center justify-center" aria-hidden>
      <LineSpinner size="14" stroke="1.4" speed="0.9" color="rgb(52, 211, 153)" />
    </span>
  )
}

function ActionLine({ step, running, isLatest }: { step: Step; running: boolean; isLatest: boolean }) {
  const loading = isLatest && !running
  return (
    <div className="grid items-center gap-x-3 py-1.5 px-2 -ml-2 rounded hover:bg-white/[0.02]"
         style={{ gridTemplateColumns: '14px 24px 1fr auto auto auto' }}>
      <span className="inline-flex items-center justify-center">
        {running ? (
          <span className="block w-1.5 h-1.5 rounded-full bg-emerald-400 ic-breathing" />
        ) : loading ? (
          <ActionLoader />
        ) : (
          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" className="text-emerald-500">
            <path d="M5 12.5 L10 17 L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="text-[11px] text-[#5a5a52] tabular-nums" style={{ fontFamily: MONO }}>{step.num}</span>
      <div className="min-w-0 flex items-baseline gap-2">
        <span className={'text-[12.5px] text-[#e8e7df] ' + (running ? 'ic-breathing' : '')} style={{ fontFamily: MONO }}>
          {step.name}
        </span>
        <span className="text-[12px] text-[#7a7a72] truncate">{step.detail}</span>
      </div>
      <span className="text-[11px] text-[#5a5a52] tabular-nums min-w-[42px] text-right" style={{ fontFamily: MONO }}>
        {step.latency != null ? `${step.latency}ms` : ''}
      </span>
      {step.receipt ? (
        <span className="text-[10.5px] text-emerald-400" style={{ fontFamily: MONO }}>{step.receipt}</span>
      ) : (
        <span className="text-[10.5px] text-[#5a5a52]" style={{ fontFamily: MONO }}>—</span>
      )}
      <span className="text-[10.5px] tabular-nums" style={{ fontFamily: MONO }}>
        {running ? (
          <span className="text-[#5a5a52]">· · ·</span>
        ) : (
          <>
            <span className="text-emerald-400/80">+1</span>
            <span className="text-[#5a5a52]"> / </span>
            <span className="text-rose-400/70">−0</span>
          </>
        )}
      </span>
    </div>
  )
}

function FaultLine({ step }: { step: Step }) {
  return (
    <div className="grid items-center gap-x-3 py-1.5 px-2 -ml-2 rounded"
         style={{ gridTemplateColumns: '14px 24px 1fr auto auto auto' }}>
      <span className="inline-flex items-center justify-center">
        <span className="block w-1 h-1 rounded-full bg-amber-400" />
      </span>
      <span className="text-[11px] text-amber-400/60 tabular-nums" style={{ fontFamily: MONO }}>!!</span>
      <div className="min-w-0 flex items-baseline gap-2">
        <span className="text-[12.5px] text-amber-300" style={{ fontFamily: MONO }}>{step.name}</span>
        <span className="text-[12px] text-[#9a9a8e] truncate">{step.detail}</span>
      </div>
      <span className="text-[11px] text-[#5a5a52] tabular-nums min-w-[42px] text-right" style={{ fontFamily: MONO }}>
        {step.latency}ms
      </span>
      <span className="text-[10.5px] text-amber-400/70">recovered</span>
      <span className="text-[10.5px] text-[#5a5a52]" style={{ fontFamily: MONO }}>0 replays</span>
    </div>
  )
}

function MainFooter() {
  return (
    <div className="border-t border-white/[0.05]">
      {/* input row */}
      <div className="px-5 py-3">
        <div className="text-[12px] text-[#5a5a52]">Submit a follow-up task or ask for a re-run with different params…</div>
      </div>
      {/* bottom bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-t border-white/[0.05]">
        <button className="inline-flex items-center gap-1.5 text-[11.5px] text-[#d3d2c8] hover:text-[#f0efe8]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>action_workflow v1</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path d="M6 10 L12 16 L18 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[#3a3a32]">·</span>
        <span className="text-[11.5px] text-[#a8a89e]">Recovery on</span>
        <span className="text-[#3a3a32]">·</span>
        <span className="text-[11.5px] text-[#a8a89e]">Receipts ed25519</span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-[#7a7a72]">tier <span className="text-[#d3d2c8]">horizon</span></span>
          <button className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-500/[0.14] text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/[0.2]">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
              <path d="M5 12 L19 12 M13 6 L19 12 L13 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Products section
// ──────────────────────────────────────────────────────────────────

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

function InstallCommand() {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div
      className="inline-flex items-center gap-3 rounded-md px-3 py-2.5 border bg-gray-50 dark:bg-white/[0.04] border-gray-200 dark:border-[rgba(246,246,244,0.12)] text-gray-800 dark:text-[#c8c8b8] max-w-full overflow-hidden"
      style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.02em' }}
    >
      <span className="select-all truncate">{INSTALL_CMD}</span>
      <button
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy install command'}
        className="shrink-0 text-gray-500 dark:text-[#8a8a7a] hover:text-[#000000] dark:hover:text-[#f6f6f4] transition-colors"
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        )}
      </button>
    </div>
  )
}

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
              Built for AI systems operating in the real world.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[78ch]"
              style={{ fontFamily: SANS, fontSize: 'clamp(0.95rem, 1.05vw, 1rem)', lineHeight: 1.6 }}
            >
              AI systems should be able to operate in real environments without
              becoming difficult to understand, unreliable, or impossible to
              trust. As agents begin interacting with infrastructure, APIs,
              files, workflows, and eventually physical systems, execution
              reliability becomes as important as intelligence itself. Igris is
              building infrastructure for AI actions - helping AI systems
              execute work with recovery, operational boundaries, and verifiable
              execution records built in. Instead of relying on retries and
              scattered logs, Igris gives operators visibility into what
              happened, what failed, what recovered, and how actions were
              executed across runtimes and environments. Tasks execute with
              checkpointed recovery, replay safety, runtime-aware boundaries,
              and execution verification, allowing teams to inspect failures,
              validate execution paths, and operate AI systems with real
              operational control as agents begin handling more critical work.
            </p>
            <div className="mt-8">
              <InstallCommand />
            </div>
            <div className="mt-10 relative left-1/2 -translate-x-1/2 w-screen max-w-[100vw]">
              <img
                src="/rohzf.png"
                alt=""
                className="block w-full h-auto select-none"
                draggable={false}
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-white dark:to-dark-bg"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
