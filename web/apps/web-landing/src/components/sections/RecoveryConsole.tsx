'use client'

// ──────────────────────────────────────────────────────────────────
// RecoveryConsole — the Recover surface of the product showcase.
//
// A checkpoint timeline: one action_workflow run that hits faults mid-flight,
// preserves its checkpoint, retries / resumes on another worker, and recovers
// without repeating committed work. Rendered inside the same framed console
// chrome as the other showcase tabs (icon rail + topbar). The step data mirrors
// the committed-actions log in igris/fixtures.rb — same fault/retry lines, just
// reframed around recovery rather than the full run detail.
// ──────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Home, LayoutDashboard, ListChecks, Zap, Box, Settings, type LucideIcon,
} from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

type RowState = 'ok' | 'fault' | 'retry' | 'recovered'

interface TLRow {
  kind: 'step' | 'fault' | 'checkpoint' | 'summary'
  num?: string
  name: string
  detail: string
  ms?: number
  state: RowState
  badge?: string
}

// One run's recovery story. Committed steps + two faults (host crash, rate
// limit) that Igris resumes from a preserved checkpoint — no work repeated.
const ROWS: TLRow[] = [
  { kind: 'step',       num: '01', name: 'http_call',  detail: 'POST /v1/charges · 200 OK',                ms: 45,  state: 'ok',        badge: 'r01' },
  { kind: 'step',       num: '02', name: 'db_write',   detail: 'transactions · r_7720',                    ms: 22,  state: 'ok',        badge: 'r02' },
  { kind: 'step',       num: '03', name: 'http_call',  detail: 'POST /v1/payment_intents · 200 OK',        ms: 52,  state: 'ok',        badge: 'r03' },
  { kind: 'fault',                 name: 'host_fault', detail: 'worker_a failed mid-step',                 ms: 120, state: 'fault' },
  { kind: 'checkpoint',            name: 'checkpoint', detail: 'state preserved at step 03 · resumed on worker_b', state: 'recovered' },
  { kind: 'step',       num: '04', name: 'http_call',  detail: 'POST /v1/payment_intents/pi_128/confirm',  ms: 62,  state: 'retry',     badge: 'r04' },
  { kind: 'step',       num: '05', name: 'http_call',  detail: 'GET /v1/balance · 200 OK',                 ms: 15,  state: 'ok',        badge: 'r05' },
  { kind: 'fault',                 name: 'rate_limit', detail: 'Stripe 429 · backoff 200ms · resumed',     ms: 200, state: 'fault' },
  { kind: 'step',       num: '06', name: 'db_write',   detail: 'ledger_sync · r_8421',                     ms: 22,  state: 'ok',        badge: 'r06' },
  { kind: 'summary',               name: 'recovered',  detail: 'Run recovered → completed · resumed from step 03 · 0 committed steps repeated', state: 'recovered' },
]

const MAX_MS = Math.max(...ROWS.filter((r) => r.ms != null).map((r) => r.ms as number))

// ── Icon rail — Runs lens active (index 3). ──
function RailIcon({ Icon, active }: { Icon: LucideIcon; active?: boolean }) {
  return (
    <div className="relative flex items-center justify-center h-[30px] w-9">
      {active && (
        <span
          className="absolute rounded-[6px]"
          style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 28, height: 24, background: 'var(--ic-overlay-3)', zIndex: 0 }}
        />
      )}
      <Icon className="relative h-[15px] w-[15px]" strokeWidth={1.5} style={{ color: active ? 'var(--ic-rail-active)' : 'var(--ic-text-6)' }} />
    </div>
  )
}

function IconRail() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const logoSrc = mounted && resolvedTheme === 'light' ? '/inertia.png' : '/inertiadm.png'
  const icons = [Home, LayoutDashboard, ListChecks, Zap, Box, Settings]
  return (
    <nav className="flex flex-col items-center py-2 border-r" style={{ background: 'var(--ic-bg-rail)', borderColor: 'var(--ic-border)' }}>
      <div className="flex items-center justify-center h-9 w-9 mb-1">
        <img src={logoSrc} alt="" width={15} height={15} className="block select-none" draggable={false} />
      </div>
      <div className="flex flex-col items-center flex-1 gap-0.5">
        {icons.map((Icon, i) => <RailIcon key={i} Icon={Icon} active={i === 3} />)}
      </div>
      <div className="relative h-6 w-6 mt-1 mb-1 rounded-full overflow-hidden select-none" style={{ background: 'var(--ic-avatar-bg)' }}>
        <img src="/emeralds.jpg" alt="" width={24} height={24} className="block h-full w-full object-cover" draggable={false} />
        <span className="absolute -bottom-[1px] -right-[1px] h-1 w-1 rounded-full border" style={{ background: 'var(--ic-accent)', borderColor: 'var(--ic-dot-border)' }} />
      </div>
    </nav>
  )
}

function RecoveryTopBar() {
  return (
    <div className="ic-topbar">
      <div className="ic-topbar__group">
        <span className="ic-topbar__title">Recovery</span>
        <span className="ic-chip mono">charge_customer</span>
        <span className="ic-chip">run_01HGJ9N7P4D</span>
      </div>
      <div className="ic-topbar__group">
        <span className="ic-rtl-pill ic-rtl-pill--ok">Recovered</span>
      </div>
    </div>
  )
}

function CheckIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function FaultIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  )
}

function RecoveryTimeline() {
  return (
    <div className="ic-rtl">
      <div className="ic-rtl__intro">
        <div className="ic-rtl__title">When a step fails, Igris resumes — it doesn’t start over.</div>
        <p className="ic-rtl__sub">
          Each committed step is checkpointed. On a host crash or rate limit, the run resumes from the
          last checkpoint on another worker, retries the failed step, and finishes — repeating no work.
        </p>
      </div>

      <div className="ic-rtl__stats">
        <span className="ic-rtl-pill"><b>2</b> faults handled</span>
        <span className="ic-rtl-pill"><b>2</b> resumes</span>
        <span className="ic-rtl-pill"><b>1</b> retry</span>
        <span className="ic-rtl-pill ic-rtl-pill--ok"><b>0</b> committed steps repeated</span>
      </div>

      <div className="ic-rtl__rows" role="list">
        {ROWS.map((r, i) => {
          if (r.kind === 'checkpoint') {
            return (
              <div className="ic-rtl-cp" key={i} role="listitem">
                <span className="ic-rtl-cp__rail" aria-hidden />
                <span className="ic-rtl-cp__dot" aria-hidden />
                <span className="ic-rtl-cp__label">{r.name}</span>
                <span className="ic-rtl-cp__detail">{r.detail}</span>
              </div>
            )
          }
          if (r.kind === 'summary') {
            return (
              <div className="ic-rtl-sum" key={i} role="listitem">
                <span className="ic-rtl-sum__icon"><CheckIcon /></span>
                <span className="ic-rtl-sum__text">{r.detail}</span>
              </div>
            )
          }
          const isFault = r.kind === 'fault'
          const width = r.ms != null ? Math.max((r.ms / MAX_MS) * 100, 6) : 0
          return (
            <div className={'ic-rtl-row' + (isFault ? ' ic-rtl-row--fault' : '')} key={i} role="listitem">
              <span className={'ic-rtl-row__num ic-rtl-row__num--' + r.state}>
                {isFault ? <FaultIcon /> : r.num}
              </span>
              <span className="ic-rtl-row__main">
                <span className="ic-rtl-row__name">{r.name}</span>
                <span className="ic-rtl-row__detail">{r.detail}</span>
                {r.state === 'retry' && <span className="ic-rtl-tag ic-rtl-tag--retry">retry 2 of 3</span>}
              </span>
              <span className="ic-rtl-row__track">
                <span className={'ic-rtl-row__bar ic-rtl-row__bar--' + r.state} style={{ width: `${width}%` }} />
              </span>
              <span className="ic-rtl-row__ms">{r.ms != null ? `${r.ms}ms` : ''}</span>
              <span className="ic-rtl-row__end">
                {isFault
                  ? <span className="ic-rtl-row__recovered">recovered</span>
                  : <span className={'ic-rtl-row__receipt ic-rtl-row__receipt--' + r.state}>{r.badge}</span>}
              </span>
            </div>
          )
        })}
      </div>

      <p className="ic-rtl__foot">
        Recovery is driven by signed step receipts — the run knows exactly which steps committed, so it
        never re-runs a side effect that already happened.
      </p>
    </div>
  )
}

export default function RecoveryConsole() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isLight = mounted && resolvedTheme === 'light'
  return (
    <div className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
      <div className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
        <div
          className={
            'igris-console ' + (isLight ? 'igris-console--light ' : '') +
            'relative overflow-hidden rounded-[10px] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]'
          }
          style={{ fontFamily: SANS, background: 'var(--ic-bg)', color: 'var(--ic-text)' }}
        >
          <RecoveryConsoleStyles />
          <div className="grid" style={{ gridTemplateColumns: '40px 1fr', height: 640 }}>
            <IconRail />
            <div className="flex flex-col min-h-0">
              <RecoveryTopBar />
              <div className="ic-scroll flex-1 overflow-y-auto px-5 py-5 min-h-0">
                <RecoveryTimeline />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RecoveryConsoleStyles() {
  return (
    <style>{`
      .igris-console {
        color-scheme: dark;
        --ic-bg: #0e0e0c; --ic-bg-rail: #070707;
        --ic-text: #b0ada5; --ic-text-bright: #d3d2c8; --ic-text-2: #a8a89e;
        --ic-text-3: #9a978f; --ic-text-4: #8a8a82; --ic-text-5: #7a7a72;
        --ic-text-6: #6a6a62; --ic-text-7: #5a5a52; --ic-text-8: #4a4a42; --ic-text-9: #3a3a32;
        --ic-avatar-bg: #2a2a25;
        --ic-border: rgba(255,255,255,0.05); --ic-border-soft: rgba(255,255,255,0.04);
        --ic-overlay-1: rgba(255,255,255,0.02); --ic-overlay-2: rgba(255,255,255,0.025);
        --ic-overlay-3: rgba(255,255,255,0.03); --ic-overlay-4: rgba(255,255,255,0.045);
        --ic-overlay-5: rgba(255,255,255,0.06); --ic-overlay-bg: rgba(255,255,255,0.015);
        --ic-rail-active: #d3d2c8; --ic-dot-border: #070707;
        --ic-accent: #0f835c; --ic-emerald: #0f835c; --ic-amber: #cf9a45; --ic-rose: #cf5a68;
        --ic-mono: ${MONO};
      }
      .igris-console.igris-console--light {
        color-scheme: light;
        --ic-bg: #f7f7f5; --ic-bg-rail: #f2f1ee;
        --ic-text: #1b1912; --ic-text-bright: #000000; --ic-text-2: #2a2820;
        --ic-text-3: #3a3830; --ic-text-4: #3a3830; --ic-text-5: #4a4740;
        --ic-text-6: #5a574e; --ic-text-7: #6e6b62; --ic-text-8: #84817a; --ic-text-9: #b0ada5;
        --ic-avatar-bg: #d8d5cc;
        --ic-border: rgba(0,0,0,0.08); --ic-border-soft: rgba(0,0,0,0.06);
        --ic-overlay-1: rgba(0,0,0,0.025); --ic-overlay-2: rgba(0,0,0,0.03);
        --ic-overlay-3: rgba(0,0,0,0.035); --ic-overlay-4: rgba(0,0,0,0.05);
        --ic-overlay-5: rgba(0,0,0,0.07); --ic-overlay-bg: rgba(0,0,0,0.02);
        --ic-rail-active: #1b1912; --ic-dot-border: #f2f1ee;
        --ic-accent: #047857; --ic-emerald: #047857; --ic-amber: #b45309; --ic-rose: #be123c;
        --ic-mono: ${MONO};
      }

      .igris-console .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-console .ic-scroll::-webkit-scrollbar { display: none; }
      .igris-console .mono { font-family: var(--ic-mono); }

      .igris-console .ic-chip {
        font-family: var(--ic-mono); font-size: 11.5px; padding: 1px 6px; border-radius: 4px;
        background: var(--ic-overlay-4); color: var(--ic-text-2); border: 1px solid var(--ic-border-soft); white-space: nowrap;
      }

      /* Topbar */
      .igris-console .ic-topbar {
        display: flex; align-items: center; justify-content: space-between; gap: 12px;
        min-height: 44px; padding: 7px 20px; border-bottom: 1px solid var(--ic-border);
        background: var(--ic-bg); flex-shrink: 0; flex-wrap: wrap;
      }
      .igris-console .ic-topbar__group { display: flex; align-items: center; gap: 8px; min-width: 0; flex-wrap: wrap; }
      .igris-console .ic-topbar__title { font-size: 12px; font-weight: 500; color: var(--ic-text-bright); letter-spacing: -0.01em; }
      .igris-console .ic-topbar .ic-chip { font-size: 10px; padding: 1px 5px; }

      /* Pills */
      .igris-console .ic-rtl-pill {
        display: inline-flex; align-items: center; gap: 5px; font-size: 11px; padding: 2px 9px;
        border-radius: 999px; color: var(--ic-text-4); background: var(--ic-overlay-2);
        border: 1px solid var(--ic-border); white-space: nowrap;
      }
      .igris-console .ic-rtl-pill b { color: var(--ic-text-2); font-weight: 600; font-family: var(--ic-mono); }
      .igris-console .ic-rtl-pill--ok { color: var(--ic-emerald); border-color: rgba(15,131,92,0.3); background: rgba(15,131,92,0.10); }
      .igris-console .ic-rtl-pill--ok b { color: var(--ic-emerald); }
      .igris-console--light .ic-rtl-pill--ok { background: rgba(4,120,87,0.09); border-color: rgba(4,120,87,0.28); }

      /* Timeline container */
      .igris-console .ic-rtl { max-width: 760px; margin: 0 auto; }
      .igris-console .ic-rtl__intro { margin-bottom: 18px; }
      .igris-console .ic-rtl__title { font-size: 15px; font-weight: 600; color: var(--ic-text-bright); letter-spacing: -0.01em; }
      .igris-console .ic-rtl__sub { margin: 7px 0 0; font-size: 12px; color: var(--ic-text-5); line-height: 1.55; max-width: 64ch; }
      .igris-console .ic-rtl__stats { display: flex; flex-wrap: wrap; gap: 7px; margin-bottom: 16px; }

      /* Rows */
      .igris-console .ic-rtl__rows {
        border: 1px solid var(--ic-border); border-radius: 10px; background: var(--ic-overlay-bg);
        padding: 4px 0; overflow: hidden;
      }
      .igris-console .ic-rtl-row {
        display: grid; grid-template-columns: 26px minmax(0,1fr) 120px 50px 64px;
        align-items: center; gap: 12px; padding: 7px 16px;
      }
      .igris-console .ic-rtl-row:hover { background: var(--ic-overlay-1); }
      .igris-console .ic-rtl-row__num {
        display: inline-flex; align-items: center; justify-content: center; width: 18px; height: 18px;
        font-family: var(--ic-mono); font-size: 10px; color: var(--ic-text-6);
        border-radius: 5px; background: var(--ic-overlay-2);
      }
      .igris-console .ic-rtl-row__num--retry { color: var(--ic-amber); background: rgba(207,154,69,0.12); }
      .igris-console .ic-rtl-row--fault .ic-rtl-row__num { color: var(--ic-rose); background: rgba(207,90,104,0.14); }
      .igris-console .ic-rtl-row__main { display: flex; align-items: baseline; gap: 9px; min-width: 0; }
      .igris-console .ic-rtl-row__name { font-family: var(--ic-mono); font-size: 11.5px; color: var(--ic-text-2); white-space: nowrap; }
      .igris-console .ic-rtl-row--fault .ic-rtl-row__name { color: var(--ic-amber); }
      .igris-console .ic-rtl-row__detail { font-size: 11px; color: var(--ic-text-5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .igris-console .ic-rtl-tag { font-size: 9.5px; font-family: var(--ic-mono); padding: 0 5px; line-height: 15px; border-radius: 3px; white-space: nowrap; flex: none; }
      .igris-console .ic-rtl-tag--retry { color: var(--ic-amber); background: rgba(207,154,69,0.14); border: 1px solid rgba(207,154,69,0.2); }
      .igris-console .ic-rtl-row__track { position: relative; height: 9px; border-radius: 3px; background: var(--ic-overlay-2); }
      .igris-console .ic-rtl-row__bar {
        position: absolute; top: 0; bottom: 0; left: 0; min-width: 3px; border-radius: 3px;
        background-image: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0));
      }
      .igris-console .ic-rtl-row__bar--ok { background-color: var(--ic-emerald); }
      .igris-console .ic-rtl-row__bar--retry { background-color: var(--ic-amber); }
      .igris-console .ic-rtl-row__bar--fault { background-color: var(--ic-rose); }
      .igris-console .ic-rtl-row__ms { font-family: var(--ic-mono); font-size: 10px; color: var(--ic-text-6); text-align: right; font-variant-numeric: tabular-nums; }
      .igris-console .ic-rtl-row__end { text-align: right; }
      .igris-console .ic-rtl-row__receipt { font-family: var(--ic-mono); font-size: 9.5px; color: var(--ic-emerald); }
      .igris-console .ic-rtl-row__receipt--retry { color: var(--ic-amber); }
      .igris-console .ic-rtl-row__recovered { font-family: var(--ic-mono); font-size: 9.5px; color: var(--ic-amber); }

      /* Checkpoint marker */
      .igris-console .ic-rtl-cp {
        display: flex; align-items: center; gap: 8px; padding: 6px 16px 6px 20px;
        position: relative;
      }
      .igris-console .ic-rtl-cp__rail {
        position: absolute; left: 25px; top: -6px; bottom: -6px; width: 0;
        border-left: 1px dashed rgba(15,131,92,0.5);
      }
      .igris-console .ic-rtl-cp__dot { width: 7px; height: 7px; border-radius: 999px; background: var(--ic-emerald); flex: none; z-index: 1; box-shadow: 0 0 0 3px var(--ic-bg); }
      .igris-console .ic-rtl-cp__label { font-family: var(--ic-mono); font-size: 10.5px; color: var(--ic-emerald); flex: none; }
      .igris-console .ic-rtl-cp__detail { font-size: 11px; color: var(--ic-text-5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

      /* Recovered summary */
      .igris-console .ic-rtl-sum {
        display: flex; align-items: center; gap: 9px; margin: 4px 12px 4px; padding: 9px 12px;
        border-radius: 8px; background: rgba(15,131,92,0.08); border: 1px solid rgba(15,131,92,0.22);
      }
      .igris-console--light .ic-rtl-sum { background: rgba(4,120,87,0.07); border-color: rgba(4,120,87,0.22); }
      .igris-console .ic-rtl-sum__icon { display: inline-flex; color: var(--ic-emerald); flex: none; }
      .igris-console .ic-rtl-sum__text { font-size: 11.5px; color: var(--ic-emerald); letter-spacing: -0.005em; }

      .igris-console .ic-rtl__foot { margin: 16px 0 0; font-size: 11px; color: var(--ic-text-6); line-height: 1.55; max-width: 64ch; }
    `}</style>
  )
}
