'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { LineSpinner } from 'ldrs/react'
import 'ldrs/react/LineSpinner.css'
import {
  Home, LayoutDashboard, ListChecks, Zap, Box, Settings, type LucideIcon,
} from 'lucide-react'

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

interface RunRow {
  id: string
  action: string
  status: 'running' | 'completed' | 'failed' | 'blocked'
  statusLabel: string
  when: string
  active?: boolean
}

interface ProjectGroup {
  name: string
  runs: RunRow[]
}

// Mirrors the rails-console runs picker: runs grouped into projects by their
// target, action name leading each row. The active run drives the detail pane.
const PROJECTS: ProjectGroup[] = [
  {
    name: 'web-app',
    runs: [
      { id: 'rdm_01', action: 'deploy_preview',    status: 'completed', statusLabel: 'Succeeded', when: '8m ago' },
      { id: 'rdm_08', action: 'open_pull_request', status: 'completed', statusLabel: 'Succeeded', when: '47m ago' },
      { id: 'rdm_06', action: 'purge_cache',       status: 'blocked',   statusLabel: 'Cancelled', when: '33m ago' },
      { id: 'rdm_09', action: 'deploy_preview',    status: 'failed',    statusLabel: 'Failed',    when: '54m ago' },
    ],
  },
  {
    name: 'payments-api',
    runs: [
      { id: 'run_01HGJ9N7P4D', action: 'charge_customer', status: 'running',   statusLabel: 'Running',   when: 'just now', active: true },
      { id: 'rdm_37',          action: 'charge_customer', status: 'completed', statusLabel: 'Succeeded', when: '2d ago' },
      { id: 'rdm_12',          action: 'refund_charge',   status: 'blocked',   statusLabel: 'Denied',    when: '1h ago' },
    ],
  },
  {
    name: 'data-platform',
    runs: [
      { id: 'rdm_05', action: 'run_migration',     status: 'failed',    statusLabel: 'Failed',    when: '28m ago' },
      { id: 'rdm_04', action: 'validate_policy',   status: 'completed', statusLabel: 'Succeeded', when: '22m ago' },
      { id: 'rdm_02', action: 'capture_exception', status: 'completed', statusLabel: 'Succeeded', when: '12m ago' },
    ],
  },
  {
    name: 'growth-ops',
    runs: [
      { id: 'rdm_03', action: 'create_issue', status: 'running',   statusLabel: 'Running',   when: '15m ago' },
      { id: 'rdm_07', action: 'send_email',   status: 'completed', statusLabel: 'Succeeded', when: '41m ago' },
    ],
  },
]

// ──────────────────────────────────────────────────────────────────

export function ExecutionPreview() {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  const [query, setQuery] = useState('')
  return (
    <div
      className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]"
    >
      <div
        className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]"
      >
        <div
          className={
            'igris-console ' + (isLight ? 'igris-console--light ' : '') +
            'relative overflow-hidden rounded-[10px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]'
          }
          style={{ fontFamily: SANS, background: 'var(--ic-bg)', color: 'var(--ic-text)' }}
        >
          <ConsoleStyles />
          <div className="grid" style={{ gridTemplateColumns: '40px 236px 1fr', height: 640 }}>
            <IconRail />
            <Sidebar query={query} setQuery={setQuery} />
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
      .igris-console {
        color-scheme: dark;
        --ic-bg: #0e0e0c;
        --ic-bg-rail: #070707;
        --ic-text: #e8e7df;
        --ic-text-bright: #f0efe8;
        --ic-text-2: #d3d2c8;
        --ic-text-3: #c8c7be;
        --ic-text-4: #a8a89e;
        --ic-text-5: #8a8a82;
        --ic-text-6: #7a7a72;
        --ic-text-7: #6a6a62;
        --ic-text-8: #5a5a52;
        --ic-text-9: #3a3a32;
        --ic-avatar-bg: #2a2a25;
        --ic-fault-text: #9a9a8e;
        --ic-border: rgba(255,255,255,0.05);
        --ic-border-soft: rgba(255,255,255,0.04);
        --ic-overlay-1: rgba(255,255,255,0.02);
        --ic-overlay-2: rgba(255,255,255,0.025);
        --ic-overlay-3: rgba(255,255,255,0.03);
        --ic-overlay-4: rgba(255,255,255,0.045);
        --ic-overlay-5: rgba(255,255,255,0.06);
        --ic-overlay-bg: rgba(255,255,255,0.015);
        --ic-rail-active: #f0efe8;
        --ic-dot-border: #070707;
        --ic-accent: #34d399;
      }
      .igris-console.igris-console--light {
        color-scheme: light;
        --ic-bg: #f7f7f5;
        --ic-bg-rail: #f2f1ee;
        --ic-text: #1b1912;
        --ic-text-bright: #000000;
        --ic-text-2: #2a2820;
        --ic-text-3: #3a3830;
        --ic-text-4: #555248;
        --ic-text-5: #6e6b62;
        --ic-text-6: #84817a;
        --ic-text-7: #9a978f;
        --ic-text-8: #b0ada5;
        --ic-text-9: #d6d3cb;
        --ic-avatar-bg: #d8d5cc;
        --ic-fault-text: #5a574e;
        --ic-border: rgba(0,0,0,0.08);
        --ic-border-soft: rgba(0,0,0,0.06);
        --ic-overlay-1: rgba(0,0,0,0.025);
        --ic-overlay-2: rgba(0,0,0,0.03);
        --ic-overlay-3: rgba(0,0,0,0.035);
        --ic-overlay-4: rgba(0,0,0,0.05);
        --ic-overlay-5: rgba(0,0,0,0.07);
        --ic-overlay-bg: rgba(0,0,0,0.02);
        --ic-rail-active: #1b1912;
        --ic-dot-border: #f2f1ee;
        --ic-accent: #047857;
      }

      .igris-console .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-console .ic-scroll::-webkit-scrollbar { display: none; }

      .igris-console .ic-chip {
        font-family: ${MONO};
        font-size: 11.5px;
        padding: 1px 6px;
        border-radius: 4px;
        background: var(--ic-overlay-4);
        color: var(--ic-text-2);
        border: 1px solid var(--ic-border-soft);
        white-space: nowrap;
      }
      .igris-console .ic-kbd {
        font-family: ${MONO};
        font-size: 10px;
        padding: 1px 5px;
        border-radius: 3px;
        background: var(--ic-border);
        color: var(--ic-text-5);
        border: 1px solid var(--ic-border-soft);
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
        color: var(--ic-text-5);
      }

      /* Light mode: darken the emerald + amber + rose accents so they read on the warm-white surface */
      /* Light mode: darken the emerald + amber + rose accents and drop opacity so the +1 / −0 counters read properly */
      .igris-console--light .text-emerald-300,
      .igris-console--light .text-emerald-400,
      .igris-console--light .text-emerald-500,
      .igris-console--light .text-emerald-400\\/80 { color: #047857; }
      .igris-console--light .bg-emerald-400 { background-color: #059669; }
      .igris-console--light .bg-emerald-500,
      .igris-console--light .bg-emerald-500\\/80 { background-color: #047857; }
      .igris-console--light .bg-emerald-500\\/\\[0\\.12\\] { background-color: rgb(4 120 87 / 0.10); }
      .igris-console--light .bg-emerald-500\\/\\[0\\.14\\] { background-color: rgb(4 120 87 / 0.12); }
      .igris-console--light .hover\\:bg-emerald-500\\/\\[0\\.16\\]:hover { background-color: rgb(4 120 87 / 0.16); }
      .igris-console--light .hover\\:bg-emerald-500\\/\\[0\\.2\\]:hover { background-color: rgb(4 120 87 / 0.2); }
      .igris-console--light .border-emerald-500\\/20 { border-color: rgb(4 120 87 / 0.3); }
      .igris-console--light .border-emerald-500\\/25 { border-color: rgb(4 120 87 / 0.35); }

      .igris-console--light .text-rose-400,
      .igris-console--light .text-rose-400\\/60,
      .igris-console--light .text-rose-400\\/70 { color: #be123c; }
      .igris-console--light .bg-rose-500 { background-color: #be123c; }

      .igris-console--light .text-amber-300,
      .igris-console--light .text-amber-400,
      .igris-console--light .text-amber-400\\/60,
      .igris-console--light .text-amber-400\\/70 { color: #b45309; }
      .igris-console--light .bg-amber-400 { background-color: #b45309; }

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

// ── Icon Rail ──────────────────────────────────────────────────────

function RailIcon({ Icon, active }: { Icon: LucideIcon; active?: boolean }) {
  return (
    <div
      className="relative flex items-center justify-center h-9 w-9 rounded-md"
      style={{ background: active ? 'var(--ic-overlay-5)' : 'transparent' }}
    >
      {active && <span className="absolute left-0 top-1.5 bottom-1.5 w-[2px] rounded-r" style={{ background: 'var(--ic-rail-active)' }} />}
      <Icon className="h-[15px] w-[15px]" strokeWidth={1.5} style={{ color: active ? 'var(--ic-rail-active)' : 'var(--ic-text-6)' }} />
    </div>
  )
}

function IconRail() {
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'light' ? '/inertia.png' : '/inertiadm.png'
  return (
    <nav className="flex flex-col items-center py-2 border-r" style={{ background: 'var(--ic-bg-rail)', borderColor: 'var(--ic-border)' }}>
      <div className="flex items-center justify-center h-9 w-9 mb-1">
        <img src={logoSrc} alt="" width={15} height={15} className="block select-none" draggable={false} />
      </div>
      <div className="flex flex-col items-center flex-1 gap-0.5">
        <RailIcon Icon={Home} />
        <RailIcon Icon={LayoutDashboard} />
        <RailIcon Icon={ListChecks} />
        <RailIcon Icon={Zap} active />
        <RailIcon Icon={Box} />
        <RailIcon Icon={Settings} />
      </div>
      {/* Profile avatar */}
      <div className="relative h-6 w-6 mt-1 mb-1 rounded-full overflow-hidden select-none" style={{ background: 'var(--ic-avatar-bg)' }}>
        <img src="/emeralds.jpg" alt="" width={24} height={24} className="block h-full w-full object-cover" draggable={false} />
        <span className="absolute -bottom-[1px] -right-[1px] h-1 w-1 rounded-full border" style={{ background: 'var(--ic-accent)', borderColor: 'var(--ic-dot-border)' }} />
      </div>
    </nav>
  )
}

// ── Sidebar ────────────────────────────────────────────────────────

function Sidebar({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  const q = query.trim().toLowerCase()
  const groups = PROJECTS
    .map((g) => ({
      name: g.name,
      runs: g.runs.filter((r) => !q || (r.action + ' ' + r.statusLabel + ' ' + r.id).toLowerCase().includes(q)),
    }))
    .filter((g) => g.runs.length > 0)
  const total = PROJECTS.reduce((n, g) => n + g.runs.length, 0)

  return (
    <aside className="flex flex-col border-r" style={{ background: 'var(--ic-bg-rail)', borderColor: 'var(--ic-border)' }}>
      {/* search — filters the runs picker live */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 px-2 h-[22px] rounded-md border-[0.5px] focus-within:border-[color:var(--ic-border)]" style={{ background: 'var(--ic-bg)', borderColor: 'var(--ic-border-soft)' }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" style={{ color: 'var(--ic-text-7)' }}>
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search runs"
            aria-label="Search runs"
            className="flex-1 min-w-0 bg-transparent border-0 outline-none text-[10.5px] placeholder:text-[var(--ic-text-7)]"
            style={{ color: 'var(--ic-text-2)' }}
          />
        </div>
      </div>

      {/* section header */}
      <div className="flex items-center justify-between px-4 mt-1 mb-1">
        <span className="text-[11px] text-[var(--ic-text-6)]">Recent runs</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[10.5px] text-[var(--ic-text-7)] tabular-nums">{total}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-8)]">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* project groups */}
      <div className="ic-scroll flex-1 overflow-y-auto px-2 pb-2">
        {groups.length > 0 ? (
          groups.map((g) => <ProjectGroupView key={g.name} group={g} />)
        ) : (
          <p className="text-[11px] text-[var(--ic-text-7)] px-2.5 py-2.5">No runs match your search.</p>
        )}
      </div>
    </aside>
  )
}

function ProjectGroupView({ group }: { group: { name: string; runs: RunRow[] } }) {
  return (
    <div className="mt-1">
      <div className="flex items-center gap-1.5 w-full px-1.5 py-1 text-[12px] text-[var(--ic-text-3)] rounded">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-7)] rotate-90">
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ic-text-6)]">
          <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
        </svg>
        <span className="flex-1 truncate" style={{ letterSpacing: '-0.005em' }}>{group.name}</span>
        <span className="text-[10px] text-[var(--ic-text-7)] tabular-nums">{group.runs.length}</span>
      </div>
      <div className="mt-px">
        {group.runs.map((r) => (
          <RunRowView key={r.id} run={r} />
        ))}
      </div>
    </div>
  )
}

function RunRowView({ run }: { run: RunRow }) {
  const dotColor =
    run.status === 'running' ? 'bg-emerald-400 ic-live-dot' :
    run.status === 'failed'  ? 'bg-rose-500' :
    run.status === 'blocked' ? 'bg-amber-400' :
                               'bg-[var(--ic-text-9)]'
  const stColor =
    run.status === 'running' ? 'text-emerald-400' :
    run.status === 'failed'  ? 'text-rose-400' :
    run.status === 'blocked' ? 'text-amber-400' :
                               'text-[var(--ic-text-7)]'
  return (
    <div
      className={
        'group grid items-center gap-2 pl-7 pr-2 py-1.5 rounded transition-colors cursor-default ' +
        (run.active ? 'bg-[var(--ic-overlay-4)]' : 'hover:bg-[var(--ic-overlay-1)]')
      }
      style={{ gridTemplateColumns: '10px minmax(0,1fr) auto auto' }}
    >
      <span className="flex items-center justify-center">
        <span className={'block w-1.5 h-1.5 rounded-full ' + dotColor} />
      </span>
      <span className={'text-[11.5px] truncate ' + (run.active ? 'text-[var(--ic-text-bright)]' : 'text-[var(--ic-text-2)]')} style={{ fontFamily: MONO, letterSpacing: '-0.005em' }}>
        {run.action}
      </span>
      <span className={'text-[10.5px] ' + stColor}>{run.statusLabel}</span>
      <span className="text-[10.5px] text-[var(--ic-text-8)] tabular-nums flex-shrink-0 hidden md:inline">{run.when}</span>
    </div>
  )
}

// ── Main pane ──────────────────────────────────────────────────────

function Main() {
  return (
    <div className="flex flex-col min-h-0">
      <MainTopBar />
      <div className="ic-scroll flex-1 overflow-y-auto px-5 py-4 min-h-0">
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'minmax(0,1fr) 260px' }}>
          <Evidence />
          <ExecDetailRail />
        </div>
      </div>
      <MainFooter />
    </div>
  )
}

function MainTopBar() {
  return (
    <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-[color:var(--ic-border)]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[12px] text-[var(--ic-text-6)]">Runs</span>
        <span className="text-[var(--ic-text-8)]">/</span>
        <span className="text-[13px] font-medium text-[var(--ic-text-bright)] truncate" style={{ letterSpacing: '-0.01em', fontFamily: MONO }}>
          charge_customer
        </span>
        <span className="text-[11px] text-[var(--ic-text-6)] truncate" style={{ fontFamily: MONO }}>run_01HGJ9N7P4D</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-7)] flex-shrink-0">
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="ic-chip">payments-api</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TopBtn label="Back to action" iconCaret />
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
          : 'bg-[var(--ic-overlay-3)] text-[var(--ic-text-2)] border border-[color:var(--ic-border)] hover:bg-[var(--ic-overlay-5)]')
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

function Evidence() {
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
    <div className="min-w-0">
      {/* definition rows — Submitter / Region / Worker / Submitted / Mode */}
      <DefRow label="Submitter" value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M3 7l9 6 9-6M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V7M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>mateo@acme.io</span> <span className="text-[var(--ic-text-6)]">engineer, integrations</span></>} />
      <DefRow label="Region"    value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>fra1·prod</span> <span className="text-[var(--ic-text-6)]">eu-central, primary</span></>} />
      <DefRow label="Worker"    value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>worker_b</span> <span className="text-[var(--ic-text-6)]">recovered from </span><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="2"/><path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg></span>worker_a</span></>} />
      <DefRow label="Submitted" value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>14:07:42 UTC</span> <span className="text-[var(--ic-text-6)]">12 seconds ago, action workflow</span></>} />
      <DefRow label="Mode"      value={<><span className="ic-chip"><span className="ic-chip-icon"><svg width="9" height="9" viewBox="0 0 24 24" fill="none"><path d="M8 6l-5 6 5 6M16 6l5 6-5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></span>action_workflow</span> <span className="text-[var(--ic-text-6)]">4 controlled tools, recovery enabled</span></>} />

      {/* narrative */}
      <p className="mt-5 text-[13px] text-[var(--ic-text-3)] leading-relaxed max-w-[60ch]">
        The receipt chain is <span className="text-emerald-400">valid</span> up to <span style={{ fontFamily: MONO }}>action 03</span>.
        Action 04 (<span style={{ fontFamily: MONO }}>db_write</span>) is currently running. No replays were
        needed across the host fault.
      </p>

      {/* committed actions section */}
      <div
        className="mt-7 rounded-lg border-[0.5px] border-[color:var(--ic-overlay-5)] px-4 py-3"
        style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 0 0 0.5px rgba(255,255,255,0.03)' }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11.5px] text-[var(--ic-text-4)]">
            <span>Committed actions ({total})</span>
            <span className="text-emerald-400/80" style={{ fontFamily: MONO }}>+{committed}</span>
            <span className="text-rose-400/60" style={{ fontFamily: MONO }}>−0</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="text-[11px] text-[var(--ic-text-6)] hover:text-[var(--ic-text-2)] px-2 py-1 rounded">Collapse all</button>
            <button className="text-[11px] text-[var(--ic-text-6)] hover:text-[var(--ic-text-2)] px-2 py-1 rounded">View receipts</button>
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
      </div>

      <div className="mt-4 text-[11px] text-[var(--ic-text-8)] tabular-nums" style={{ fontFamily: MONO }}>
        14:07:42 · live
      </div>
    </div>
  )
}

function DefRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-x-6 py-1.5" style={{ gridTemplateColumns: '90px 1fr' }}>
      <span className="text-[12px] text-[var(--ic-text-5)]">{label}</span>
      <div className="text-[12.5px] text-[var(--ic-text-2)] flex items-center gap-1.5 flex-wrap">{value}</div>
    </div>
  )
}

function Tree({ title, icon, children }: { title: string; icon: 'bolt' | 'box'; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-[12px] text-[var(--ic-text-4)]">
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-7)] rotate-90">
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {icon === 'bolt' ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-6)]">
            <path d="M13 2 L4 14 L11 14 L11 22 L20 10 L13 10 Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="text-[var(--ic-text-6)]">
            <path d="M4 7 L12 3 L20 7 L20 17 L12 21 L4 17 Z M4 7 L12 11 L20 7 M12 11 L12 21" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        )}
        <span style={{ fontFamily: MONO }}>{title}</span>
      </div>
      <div className="mt-1 pl-5 border-l border-[color:var(--ic-border)] ml-1">{children}</div>
    </div>
  )
}

function ActionLoader() {
  const { resolvedTheme } = useTheme()
  const color = resolvedTheme === 'light' ? 'rgb(4, 120, 87)' : 'rgb(52, 211, 153)'
  return (
    <span className="inline-flex items-center justify-center" aria-hidden>
      <LineSpinner size="14" stroke="1.4" speed="0.9" color={color} />
    </span>
  )
}

function ActionLine({ step, running, isLatest }: { step: Step; running: boolean; isLatest: boolean }) {
  const loading = isLatest && !running
  return (
    <div className="grid items-center gap-x-3 py-1.5 px-2 -ml-2 rounded hover:bg-[var(--ic-overlay-1)]"
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
      <span className="text-[11px] text-[var(--ic-text-8)] tabular-nums" style={{ fontFamily: MONO }}>{step.num}</span>
      <div className="min-w-0 flex items-baseline gap-2">
        <span className={'text-[12.5px] text-[var(--ic-text)] ' + (running ? 'ic-breathing' : '')} style={{ fontFamily: MONO }}>
          {step.name}
        </span>
        <span className="text-[12px] text-[var(--ic-text-6)] truncate">{step.detail}</span>
      </div>
      <span className="text-[11px] text-[var(--ic-text-8)] tabular-nums min-w-[42px] text-right" style={{ fontFamily: MONO }}>
        {step.latency != null ? `${step.latency}ms` : ''}
      </span>
      {step.receipt ? (
        <span className="text-[10.5px] text-emerald-400" style={{ fontFamily: MONO }}>{step.receipt}</span>
      ) : (
        <span className="text-[10.5px] text-[var(--ic-text-8)]" style={{ fontFamily: MONO }}>—</span>
      )}
      <span className="text-[10.5px] tabular-nums" style={{ fontFamily: MONO }}>
        {running ? (
          <span className="text-[var(--ic-text-8)]">· · ·</span>
        ) : (
          <>
            <span className="text-emerald-400/80">+1</span>
            <span className="text-[var(--ic-text-8)]"> / </span>
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
        <span className="text-[12px] text-[var(--ic-fault-text)] truncate">{step.detail}</span>
      </div>
      <span className="text-[11px] text-[var(--ic-text-8)] tabular-nums min-w-[42px] text-right" style={{ fontFamily: MONO }}>
        {step.latency}ms
      </span>
      <span className="text-[10.5px] text-amber-400/70">recovered</span>
      <span className="text-[10.5px] text-[var(--ic-text-8)]" style={{ fontFamily: MONO }}>0 replays</span>
    </div>
  )
}

// ── Execution detail rail (right side of the main pane) ────────────

function ExecDetailRail() {
  return (
    <aside className="flex flex-col gap-3 min-w-0">
      <div className="rounded-lg border-[0.5px] px-3.5 py-3" style={{ borderColor: 'var(--ic-overlay-5)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="text-[10px] uppercase tracking-wide text-[var(--ic-text-6)] mb-2.5">Execution detail</div>
        <div className="flex flex-col gap-2.5">
          <RailCell k="Action"><span className="text-[11px] text-[var(--ic-text-2)]" style={{ fontFamily: MONO }}>charge_customer</span></RailCell>
          <RailCell k="Status"><Pill tone="ok" label="Running" /></RailCell>
          <RailCell k="Routed via"><span className="inline-flex items-center gap-1.5"><StripeMark /><span className="text-[11px] text-[var(--ic-text-2)]">Stripe</span></span></RailCell>
          <RailCell k="Policy"><span className="ic-chip">Idempotent</span> <span className="ic-chip">3 retries</span></RailCell>
          <RailCell k="Proof"><Pill tone="muted" label="Pending" /></RailCell>
          <RailCell k="Started"><span className="text-[11px] text-[var(--ic-text-2)]">14:07:42 UTC</span></RailCell>
          <RailCell k="Duration"><span className="text-[11px] text-[var(--ic-text-2)]">—</span></RailCell>
        </div>
        <p className="mt-3 text-[10.5px] text-[var(--ic-text-6)] leading-relaxed">Proof is available when signed runtime evidence exists.</p>
      </div>

      <div className="rounded-lg border-[0.5px] px-3.5 py-3" style={{ borderColor: 'var(--ic-overlay-5)', background: 'rgba(255,255,255,0.015)' }}>
        <div className="text-[10px] uppercase tracking-wide text-[var(--ic-text-6)] mb-1">What to do next</div>
        <div className="text-[12px] text-[var(--ic-text-2)]">Run is still in flight.</div>
        <p className="mt-1 text-[11px] text-[var(--ic-text-5)] leading-relaxed">Step evidence appears here as the run commits each step.</p>
      </div>
    </aside>
  )
}

function RailCell({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[9.5px] text-[var(--ic-text-6)] mb-0.5">{k}</div>
      <div className="flex items-center gap-1.5 flex-wrap">{children}</div>
    </div>
  )
}

function Pill({ tone, label }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string }) {
  const cls =
    tone === 'ok'   ? 'text-emerald-400 border-emerald-500/25 bg-emerald-500/[0.12]' :
    tone === 'bad'  ? 'text-rose-400 border-rose-500/25 bg-rose-500/[0.12]' :
    tone === 'warn' ? 'text-amber-300 border-amber-500/25 bg-amber-500/[0.12]' :
                      'text-[var(--ic-text-4)] border-[color:var(--ic-border)] bg-[var(--ic-overlay-3)]'
  return <span className={'inline-flex items-center h-[18px] px-1.5 rounded text-[10.5px] border ' + cls}>{label}</span>
}

// Genuine Stripe mark (Simple Icons), brand-coloured to match the rails console
// runs-detail "Routed via" chip.
function StripeMark() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#635BFF" d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
    </svg>
  )
}

function MainFooter() {
  return (
    <div className="border-t border-[color:var(--ic-border)]">
      {/* input row */}
      <div className="px-5 py-3">
        <div className="text-[12px] text-[var(--ic-text-8)]">Submit a follow-up task or ask for a re-run with different params…</div>
      </div>
      {/* bottom bar */}
      <div className="flex items-center gap-3 px-5 py-2.5 border-t border-[color:var(--ic-border)]">
        <button className="inline-flex items-center gap-1.5 text-[11.5px] text-[var(--ic-text-2)] hover:text-[var(--ic-text-bright)]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          <span>action_workflow v1</span>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
            <path d="M6 10 L12 16 L18 10" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[var(--ic-text-9)]">·</span>
        <span className="text-[11.5px] text-[var(--ic-text-4)]">Recovery on</span>
        <span className="text-[var(--ic-text-9)]">·</span>
        <span className="text-[11.5px] text-[var(--ic-text-4)]">Receipts ed25519</span>

        <div className="ml-auto flex items-center gap-3">
          <span className="text-[11.5px] text-[var(--ic-text-6)]">tier <span className="text-[var(--ic-text-2)]">horizon</span></span>
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
              className="text-[#000000] dark:text-[#f6f6f4] font-normal"
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                maxWidth: '22ch',
              }}
            >
              Built for AI systems operating in the real world.
            </h2>
            <div
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[78ch] space-y-5"
              style={{ fontFamily: SANS, fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)', lineHeight: 1.6 }}
            >
              <p>
                Igris sits between AI and the actions it wants to perform. When
                your AI needs to read a file, call an API, update a database, or
                trigger a workflow, Igris runs that action safely, records what
                happened, and gives your team proof afterward. If execution
                breaks mid-run, Igris resumes from the last recorded step
                instead of starting from zero.
              </p>
              <p>
                AI systems should be able to operate in real environments
                without becoming unreliable, hard to understand, or impossible
                to trust.{' '}
                <span className="bg-purple-200/70 dark:bg-purple-400/20 text-gray-900 dark:text-purple-100 px-1 rounded-sm">
                  As agents begin interacting with infrastructure, APIs, files,
                  workflows, and eventually physical systems, execution
                  reliability becomes as important as intelligence itself.
                </span>
              </p>

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
                className="hidden dark:block pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-t from-transparent to-dark-bg"
              />
              <div
                aria-hidden
                className="hidden dark:block pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-b from-transparent to-dark-bg"
              />
            </div>
            <div className="mt-8 px-4 md:px-6 text-gray-600 dark:text-[#a8a898] space-y-5 md:max-w-[50%] md:ml-auto"
              style={{ fontFamily: SANS, fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)', lineHeight: 1.6 }}
            >
              <p>
                Igris is infrastructure for AI actions. It helps{' '}
                <span className="underline decoration-dashed underline-offset-[5px] decoration-gray-400 dark:decoration-[#7a7a72]">
                  AI systems execute work with recovery, operational boundaries,
                  and verifiable execution records built in
                </span>
                . Instead of relying on retries and scattered logs, Igris gives
                operators a clear view of what happened, what failed, what
                recovered, and how each action was executed.
              </p>
              <p>
                Tasks run with checkpointed recovery, replay safety,
                runtime-aware boundaries, and execution verification. Install
                Igris with{' '}
                <code
                  className="inline-flex items-baseline rounded-md px-2 py-0.5 border bg-white dark:bg-white/[0.08] border-gray-300 dark:border-white/[0.18] text-gray-900 dark:text-[#f6f6f4] align-baseline whitespace-nowrap shadow-[0_1px_2px_rgba(0,0,0,0.08),0_2px_8px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.5),0_2px_10px_rgba(0,0,0,0.4)]"
                  style={{ fontFamily: MONO, fontSize: '0.85em' }}
                >
                  {INSTALL_CMD}
                </code>
                {' '}to start running agent actions with recovery and proof
                built in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
