'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Home, LayoutDashboard, ListChecks, Zap, Box, Settings, type LucideIcon,
} from 'lucide-react'
import RunsConsole from './RunsConsole'
import ProductConsoleShell, { PRODUCT_SHOWCASE_URLS } from '../ui/ProductConsoleShell'
import { RunActivityMapConsole } from './OverviewConsole'
import {
  LANDING_PRODUCT_REVEAL_EVENT,
  LANDING_PRODUCT_TAB_EVENT,
  type ProductTab,
} from '../../lib/landing-sections'

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
  // HH:MM:SS.mmm log timestamp. Committed actions carry their signed time;
  // faults + the in-flight step are derived from run-start + cumulative
  // latency, exactly as console_helper#committed_log_times computes them.
  at: string
}

// Mirrors steps_for(Running) in
// web/apps/rails-console/app/services/igris/fixtures.rb so the hero renders the
// same committed-actions log as the rails-console Run detail page.
const STEPS: Step[] = [
  { id: 's01', kind: 'action', num: '01', name: 'http_call', detail: 'POST /v1/charges · 200 OK', latency: 45, status: 'committed', receipt: 'r₀₁', at: '14:07:42.218' },
  { id: 's02', kind: 'action', num: '02', name: 'http_call', detail: 'GET /v1/customers/cus_8821 · 200 OK', latency: 28, status: 'committed', receipt: 'r₀₂', at: '14:07:42.301' },
  { id: 's03', kind: 'action', num: '03', name: 'http_call', detail: 'POST /v1/payment_intents · 200 OK', latency: 52, status: 'committed', receipt: 'r₀₃', at: '14:07:42.481' },
  { id: 's04', kind: 'fault', name: 'rate_limit', detail: 'Stripe 429 · backoff 200ms · resumed', latency: 200, status: 'committed', at: '14:07:42.074' },
  { id: 's05', kind: 'action', num: '04', name: 'http_call', detail: 'POST /v1/payment_intents/pi_128/confirm · retry 2 of 3 · 200', latency: 62, status: 'committed', receipt: 'r₀₄', at: '14:07:43.014' },
  { id: 's06', kind: 'action', num: '05', name: 'http_call', detail: 'GET /v1/balance · 200 OK', latency: 15, status: 'committed', receipt: 'r₀₅', at: '14:07:43.140' },
  { id: 's07', kind: 'action', num: '06', name: 'http_call', detail: 'POST /v1/refunds · 200 OK', latency: 38, status: 'committed', receipt: 'r₀₆', at: '14:07:43.402' },
  { id: 's08', kind: 'action', num: '07', name: 'db_write', detail: 'transactions · r_7720', latency: 22, status: 'committed', receipt: 'r₀₇', at: '14:07:43.509' },
  { id: 's09', kind: 'action', num: '08', name: 'http_call', detail: 'POST /v1/invoices · 200 OK', latency: 41, status: 'committed', receipt: 'r₀₈', at: '14:07:43.612' },
  { id: 's10', kind: 'action', num: '09', name: 'http_call', detail: 'POST /webhooks/stripe · 202 Accepted', latency: 19, status: 'committed', receipt: 'r₀₉', at: '14:07:43.701' },
  { id: 's11', kind: 'fault', name: 'host_fault', detail: 'worker_a failed · checkpoint preserved · resumed on worker_b', latency: 120, status: 'committed', at: '14:07:42.500' },
  { id: 's12', kind: 'action', num: '10', name: 'http_call', detail: 'POST /webhooks/stripe · retry 1 of 3 · 202', latency: 24, status: 'committed', receipt: 'r₁₀', at: '14:07:44.012' },
  { id: 's13', kind: 'action', num: '11', name: 'http_call', detail: 'POST /v1/subscriptions · 200 OK', latency: 33, status: 'committed', receipt: 'r₁₁', at: '14:07:44.119' },
  { id: 's14', kind: 'action', num: '12', name: 'db_write', detail: 'ledger_sync · r_8421', status: 'running', at: '14:07:42.785' },
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

export type RunDetailSnippetVariant = 'actions' | 'proof' | 'routing' | 'policy'

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

// `frozen` renders the same run-detail surface in a static state — the
// committed-actions log shows all steps at once (no reveal/cycle animation), so
// the layout sits still on the full Execution profile. Used by the Recover tab.
export function ExecutionPreview({
  frozen = false,
  url = PRODUCT_SHOWCASE_URLS.run,
}: {
  frozen?: boolean
  url?: string
}) {
  const { resolvedTheme } = useTheme()
  // Read the resolved theme directly (no `mounted` gate): this panel only
  // mounts after the skeleton/intersection gate, so the theme is already known
  // — gating on a remount-reset `mounted` flag caused a one-frame dark flash.
  const isLight = resolvedTheme === 'light'
  const [query, setQuery] = useState('')
  return (
    <ProductConsoleShell url={url}>
      <div
        className={
          'igris-console ' + (isLight ? 'igris-console--light ' : '') +
          'relative overflow-hidden'
        }
        style={{ fontFamily: SANS, background: 'var(--landing-surface)', color: 'var(--ic-text)' }}
      >
        <ConsoleStyles />
        <div className="grid ic-shell">
          <IconRail />
          <Sidebar query={query} setQuery={setQuery} />
          <Main frozen={frozen} />
        </div>
      </div>
    </ProductConsoleShell>
  )
}

function ConsoleStyles() {
  return (
    <style>{`
      .igris-console {
        color-scheme: dark;
        --ic-bg: #161515;
        --ic-bg-rail: #161515;
        --ic-text: #b0ada5;
        --ic-text-bright: #d3d2c8;
        --ic-text-2: #a8a89e;
        --ic-text-3: #9a978f;
        --ic-text-4: #8a8a82;
        --ic-text-5: #7a7a72;
        --ic-text-6: #6a6a62;
        --ic-text-7: #5a5a52;
        --ic-text-8: #4a4a42;
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
        --ic-rail-active: #d3d2c8;
        --ic-dot-border: #161515;
        --ic-accent: #0f835c;
        --ic-emerald: #0f835c;
        --ic-emerald-dim: rgba(15,131,92,0.85);
        --ic-amber: #b45309;
        --ic-rose: #9d4b57;
        --ic-mono: ${MONO};
      }
      .igris-console.igris-console--light {
        color-scheme: light;
        --ic-bg: #f9f9fa;
        --ic-bg-rail: #f9f9fa;
        --ic-text: #1b1912;
        --ic-text-bright: #000000;
        --ic-text-2: #2a2820;
        --ic-text-3: #3a3830;
        --ic-text-4: #3a3830;
        --ic-text-5: #4a4740;
        --ic-text-6: #5a574e;
        --ic-text-7: #6e6b62;
        --ic-text-8: #84817a;
        --ic-text-9: #b0ada5;
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
        --ic-dot-border: #f9f9fa;
        --ic-accent: #047857;
        --ic-emerald: #047857;
        --ic-emerald-dim: #059669;
        --ic-amber: #b45309;
        --ic-rose: #be123c;
        --ic-mono: ${MONO};
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

      /* Dark mode: map all accent colors to dark emerald green */
      .igris-console .text-emerald-300,
      .igris-console .text-emerald-400,
      .igris-console .text-emerald-500,
      .igris-console .text-emerald-400\\/80 { color: #0f835c; }
      .igris-console .bg-emerald-400 { background-color: #0f835c; }
      .igris-console .bg-emerald-500,
      .igris-console .bg-emerald-500\\/80 { background-color: #0a6b4a; }
      .igris-console .bg-emerald-500\\/\\[0\\.12\\] { background-color: rgb(15 131 92 / 0.10); }
      .igris-console .bg-emerald-500\\/\\[0\\.14\\] { background-color: rgb(15 131 92 / 0.12); }
      .igris-console .hover\\:bg-emerald-500\\/\\[0\\.16\\]:hover { background-color: rgb(15 131 92 / 0.16); }
      .igris-console .hover\\:bg-emerald-500\\/\\[0\\.2\\]:hover { background-color: rgb(15 131 92 / 0.2); }
      .igris-console .border-emerald-500\\/20 { border-color: rgb(15 131 92 / 0.3); }
      .igris-console .border-emerald-500\\/25 { border-color: rgb(15 131 92 / 0.35); }

      .igris-console .text-rose-400,
      .igris-console .text-rose-400\\/60,
      .igris-console .text-rose-400\\/70 { color: #9d4b57; }
      .igris-console .bg-rose-500 { background-color: #9d4b57; }

      .igris-console .text-amber-400,
      .igris-console .text-amber-400\\/60,
      .igris-console .text-amber-400\\/70 { color: #b45309; }
      .igris-console .bg-amber-400 { background-color: #b45309; }

      /* Light mode: darken the emerald + amber + rose accents so they read on the warm-white surface */
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

      /* ── Ported from rails-console application.css so the Run detail port
            renders identically to runs/show + _inspector. ─────────────── */
      .igris-console .mono { font-family: var(--ic-mono); }

      .igris-console .ic-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; vertical-align: middle; }
      .igris-console .ic-chip--sm { font-size: 10px; padding: 0 5px; line-height: 15px; }
      .igris-console .ic-chip__icon { display: inline-flex; align-items: center; margin-right: 4px; color: var(--ic-text-5); vertical-align: middle; }
      .igris-console .ic-chip__logo { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; margin-right: 4px; color: var(--ic-text-3); vertical-align: middle; }
      .igris-console .ic-chip__logo svg,
      .igris-console .ic-chip__logo img { width: 100%; height: 100%; object-fit: contain; border-radius: 2px; }

      /* Pills */
      .igris-console .ig-pill { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; padding: 1px 7px; border-radius: 999px; background: var(--ic-overlay-3); border: 1px solid var(--ic-border); color: var(--ic-text-3); white-space: nowrap; }
      .igris-console .ig-pill--ok    { color: var(--ic-emerald); border-color: rgba(4,120,87,0.25); background: rgba(4,120,87,0.10); }
      .igris-console .ig-pill--warn  { color: var(--ic-amber);   border-color: rgba(251,191,36,0.25);  background: rgba(251,191,36,0.08); }
      .igris-console .ig-pill--bad   { color: var(--ic-rose);    border-color: rgba(244,63,94,0.25); background: rgba(244,63,94,0.08); }
      .igris-console .ig-pill--muted { color: var(--ic-text-4); }
      .igris-console--light .ig-pill--ok   { background: rgba(4,120,87,0.08); }

      /* Definition rows */
      .igris-console .ic-def { display: grid; grid-template-columns: 90px 1fr; column-gap: 24px; padding: 6px 0; align-items: center; }
      .igris-console .ic-def__label { font-size: 11px; color: var(--ic-text-5); }
      .igris-console .ic-def__value { font-size: 11px; color: var(--ic-text-2); display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
      .igris-console .ic-def__value.mono { font-family: var(--ic-mono); font-size: 11.5px; color: var(--ic-text-3); word-break: break-all; }
      .igris-console .ic-def__hint { color: var(--ic-text-6); }

      /* Evidence blocks */
      .igris-console .ic-evidence { border: 1px solid var(--ic-border); border-radius: 8px; background: var(--ic-overlay-bg); padding: 14px 16px 8px; margin-bottom: 16px; }
      .igris-console .ic-evidence--flat { padding: 0 0 8px; margin-bottom: 12px; }
      .igris-console .ic-evidence__head { font-size: 11px; letter-spacing: 0.06em; color: var(--ic-text-6); margin-bottom: 6px; }
      .igris-console .ic-evidence .ic-def { padding: 6px 0; }

      /* Narrative */
      .igris-console .ic-narrative { margin-top: 20px; font-size: 13px; color: var(--ic-text-3); line-height: 1.55; max-width: 60ch; }
      .igris-console .ic-narrative .mono { font-family: var(--ic-mono); }
      .igris-console .ic-narrative .accent { color: var(--ic-emerald); }

      /* Committed-actions panel */
      .igris-console .ic-panel { margin-top: 16px; margin-bottom: 16px; border-radius: 10px; border: 0.5px solid var(--ic-overlay-5); padding: 14px 16px; background: var(--ic-overlay-bg); box-shadow: inset 0 0 0 0.5px rgba(255,255,255,0.03); }
      .igris-console .ic-panel__head { display: flex; align-items: center; justify-content: space-between; font-size: 11.5px; color: var(--ic-text-4); }
      .igris-console .ic-panel__head-l { display: flex; align-items: center; gap: 10px; }
      .igris-console .ic-panel__head-r { display: flex; align-items: center; gap: 4px; }
      .igris-console .ic-panel__count-plus { color: var(--ic-emerald-dim); font-family: var(--ic-mono); }
      .igris-console .ic-panel__count-minus { color: rgba(251,113,133,0.6); font-family: var(--ic-mono); }

      .igris-console .ic-loggroup { margin-top: 6px; }
      .igris-console .ic-loggroup__head { cursor: default; list-style: none; padding: 4px 0; border-radius: 4px; }
      .igris-console .ic-loggroup__head .ic-panel__head-l { gap: 8px; }
      .igris-console .ic-loggroup__chev { width: 0; height: 0; border-top: 4px solid transparent; border-bottom: 4px solid transparent; border-left: 5px solid var(--ic-text-6); transform: rotate(0deg); transition: transform 160ms ease; }
      .igris-console .ic-loggroup__chev--open { transform: rotate(90deg); }
      .igris-console .ic-log__body { margin-top: 8px; padding: 2px 0; max-height: 440px; overflow-y: auto; scrollbar-width: none; }
      .igris-console .ic-log__body::-webkit-scrollbar { display: none; }
      .igris-console .ic-log__dur { font-size: 11px; color: var(--ic-text-6); font-variant-numeric: tabular-nums; }
      .igris-console .ic-log__status { display: inline-flex; align-items: center; gap: 5px; font-size: 11px; }
      .igris-console .ic-log__status--ok, .igris-console .ic-log__status--run { color: var(--ic-emerald); }
      .igris-console .ic-log__status--fail { color: var(--ic-rose); }

      .igris-console .ic-line { display: grid; grid-template-columns: 78px minmax(0,1fr) auto auto; align-items: center; column-gap: 9px; padding: 3px 12px; }
      .igris-console .ic-line:hover { background: var(--ic-overlay-1); }
      .igris-console .ic-line__ts { font-family: var(--ic-mono); font-size: 10px; color: var(--ic-text-6); font-variant-numeric: tabular-nums; white-space: nowrap; }
      .igris-console .ic-line__main { display: flex; align-items: baseline; gap: 8px; min-width: 0; }
      .igris-console .ic-line__name { font-family: var(--ic-mono); font-size: 11px; color: var(--ic-text-2); }
      .igris-console .ic-line__name--running { animation: ic-breathe 3.2s ease-in-out infinite; }
      .igris-console .ic-line__detail { font-size: 10.5px; color: var(--ic-text-5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .igris-console .ic-line__latency { font-family: var(--ic-mono); font-size: 10px; color: var(--ic-text-6); font-variant-numeric: tabular-nums; min-width: 40px; text-align: right; }
      .igris-console .ic-line__receipt { font-family: var(--ic-mono); font-size: 9.5px; }
      .igris-console .ic-line__receipt--ok { color: var(--ic-emerald); }
      .igris-console .ic-line__receipt--none { color: var(--ic-text-7); }
      .igris-console .ic-line__status { font-family: var(--ic-mono); font-size: 9.5px; letter-spacing: 0.06em; text-transform: lowercase; }
      .igris-console .ic-line__status--ok { color: var(--ic-emerald); }
      .igris-console .ic-line__status--run { color: var(--ic-emerald); }
      .igris-console .ic-panel--actions .ic-line { grid-template-columns: 68px minmax(0,1fr) auto auto; }
      .igris-console .ic-line--fault .ic-line__name { color: #fcd34d; }
      .igris-console--light .ic-line--fault .ic-line__name { color: #b45309; }
      .igris-console .ic-line--fault .ic-line__detail { color: var(--ic-fault-text); }
      .igris-console .ic-line--fault .ic-line__receipt { color: rgba(251,191,36,0.7); }
      .igris-console--light .ic-line--fault .ic-line__receipt { color: #b45309; }
      .igris-console .ic-bullet-dot { width: 6px; height: 6px; border-radius: 999px; }
      .igris-console .ic-bullet-dot--running { background: var(--ic-emerald); }
      .igris-console .ic-bullet-check { width: 12px; height: 12px; color: var(--ic-emerald); }

      .igris-console .ic-foot-time { margin: 12px 0 0; font-family: var(--ic-mono); font-size: 11px; color: var(--ic-text-8); font-variant-numeric: tabular-nums; }

      /* Run detail layout: evidence column + sticky execution-detail rail */
      .igris-console .ic-run-detail-layout { display: grid; grid-template-columns: minmax(0,1fr) 240px; gap: 16px; height: 100%; min-height: 0; }
      .igris-console .ic-run-detail-scroll { min-width: 0; min-height: 0; overflow-y: auto; overflow-x: hidden; padding-right: 2px; scrollbar-width: none; }
      .igris-console .ic-run-detail-scroll::-webkit-scrollbar { display: none; }
      .igris-console .ic-run-detail-rail { min-width: 0; align-self: stretch; position: sticky; top: 0; border-left: 1px solid var(--ic-border); padding-left: 14px; }
      .igris-console .ic-run-detail-rail .ic-summary { margin-bottom: 12px; padding: 0; border: 0; border-radius: 0; background: transparent; }
      .igris-console .ic-run-detail-rail .ic-summary__grid { grid-template-columns: 1fr; gap: 9px; }
      .igris-console .ic-run-detail-rail .ic-summary__cell--wide { grid-column: auto; }
      .igris-console .ic-run-detail-rail .ic-summary__head { font-size: 10px; margin-bottom: 10px; }
      .igris-console .ic-run-detail-rail .ic-summary__k { font-size: 9.5px; margin-bottom: 2px; }
      .igris-console .ic-run-detail-rail .ic-summary__v { font-size: 11px; }
      .igris-console .ic-run-detail-rail .ic-summary__v.mono { font-size: 10.5px; }
      .igris-console .ic-run-detail-rail .ic-nextstep { border: 0; border-radius: 0; background: transparent; padding: 0; flex-direction: column; align-items: flex-start; gap: 12px; }

      /* Execution-detail summary */
      .igris-console .ic-summary__head { font-size: 11px; letter-spacing: 0.06em; color: var(--ic-text-6); margin-bottom: 12px; }
      .igris-console .ic-summary__grid { display: grid; grid-template-columns: repeat(6, minmax(0,1fr)); gap: 12px; }
      .igris-console .ic-summary__cell { min-width: 0; }
      .igris-console .ic-summary__cell--wide { grid-column: span 2; }
      .igris-console .ic-summary__k { font-size: 10.5px; color: var(--ic-text-6); margin-bottom: 4px; }
      .igris-console .ic-summary__v { font-size: 12.5px; color: var(--ic-text-2); letter-spacing: -0.005em; min-width: 0; overflow-wrap: anywhere; }
      .igris-console .ic-summary__v.mono { font-family: var(--ic-mono); font-size: 12px; overflow: hidden; text-overflow: ellipsis; }
      .igris-console .ic-summary__note { font-size: 11.5px; color: var(--ic-text-6); margin: 12px 0 0; }

      /* What-to-do-next */
      .igris-console .ic-nextstep { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .igris-console .ic-nextstep__kicker { font-size: 10px; letter-spacing: 0.08em; color: var(--ic-emerald); margin-bottom: 4px; }
      .igris-console .ic-nextstep__title { font-size: 10.5px; font-weight: 500; color: var(--ic-text-bright); letter-spacing: -0.01em; }
      .igris-console .ic-nextstep__sub { font-size: 10.5px; color: var(--ic-text-5); margin: 3px 0 0; line-height: 1.5; max-width: 60ch; }
      .igris-console .ic-nextstep__cta { display: flex; flex-wrap: wrap; gap: 8px; flex-shrink: 0; }

      /* Run Inspector */
      .igris-console .ic-runinspector { width: 100%; }
      .igris-console .ic-runinspector__head { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 12px 16px 12px 0; border-bottom: 1px solid var(--ic-border); }
      .igris-console .ic-runinspector__head-l { display: flex; align-items: center; gap: 8px; min-width: 0; }
      .igris-console .ic-runinspector__title { font-size: 12.5px; font-weight: 600; color: var(--ic-text-bright); letter-spacing: -0.01em; }
      .igris-console .ic-runinspector__id { font-family: var(--ic-mono); font-size: 11px; color: var(--ic-text-5); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .igris-console .ic-runinspector__pills { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; padding: 10px 16px 10px 0; border-bottom: 1px solid var(--ic-border-soft); }
      .igris-console .ic-runinspector__scroll { padding: 6px 0 4px; }
      .igris-console .ic-runinspector__section { padding: 12px 16px 12px 0; border-bottom: 1px solid var(--ic-border-soft); }
      .igris-console .ic-runinspector__section--last { border-bottom: 0; }
      .igris-console .ic-runinspector__sechead { font-size: 11px; letter-spacing: 0.06em; color: var(--ic-text-6); margin-bottom: 8px; }
      .igris-console .ic-runinspector__rows .ic-def { grid-template-columns: 96px 1fr; padding: 4px 0; }
      .igris-console .ic-runinspector__hint { font-size: 11.5px; color: var(--ic-text-6); line-height: 1.5; margin: 0 0 8px; }
      .igris-console .ic-runinspector__note { font-size: 11px; color: var(--ic-text-6); line-height: 1.5; margin: 8px 0 0; }
      .igris-console .ic-runinspector__kv { display: flex; flex-direction: column; gap: 4px; }
      .igris-console .ic-runinspector__kvrow { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 3px 0; }
      .igris-console .ic-runinspector__kvk { font-size: 11px; color: var(--ic-text-5); }
      .igris-console .ic-runinspector__kvfoot { font-size: 10.5px; color: var(--ic-text-6); line-height: 1.5; margin: 9px 0 0; padding-top: 9px; border-top: 1px solid var(--ic-border-soft); }
      .igris-console .ic-runinspector__auditrows { display: flex; flex-direction: column; }
      .igris-console .ic-runinspector__auditrow { display: flex; flex-direction: column; gap: 3px; padding: 9px 0; border-top: 1px solid var(--ic-border-soft); }
      .igris-console .ic-runinspector__auditrow:first-child { border-top: 0; padding-top: 2px; }
      .igris-console .ic-runinspector__audittop { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
      .igris-console .ic-runinspector__auditlabel { font-size: 11px; color: var(--ic-text-5); letter-spacing: 0.02em; }
      .igris-console .ic-runinspector__auditvalue { font-size: 12px; font-weight: 500; color: var(--ic-text-2); text-align: right; word-break: break-word; }
      .igris-console .ic-runinspector__auditnote { font-size: 10.5px; color: var(--ic-text-6); line-height: 1.5; margin: 0; }
      .igris-console .ic-runinspector__empty-line { font-size: 12px; color: var(--ic-text-5); line-height: 1.55; margin: 2px 0 0; }

      /* Execution-profile waterfall */
      .igris-console .ic-wfall { display: flex; flex-direction: column; gap: 3px; margin-top: 8px; }
      .igris-console .ic-wfall__row { display: grid; grid-template-columns: 76px minmax(0,1fr) 48px; align-items: center; gap: 8px; border-radius: 4px; padding: 1px 0; }
      .igris-console .ic-wfall__row:hover { background: var(--ic-overlay-1); }
      .igris-console .ic-wfall__label { font-size: 10px; color: var(--ic-text-4); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: var(--ic-mono); }
      .igris-console .ic-wfall__track {
        display: flex; align-items: stretch; justify-content: space-between;
        height: 14px; padding: 0; background: transparent; width: 100%;
      }
      .igris-console .ic-wfall__track--timeline { margin-bottom: 10px; height: 16px; }
      .igris-console .ic-wfall__tick {
        flex: 0 0 1px; width: 1px; height: 100%; border-radius: 0;
        background: var(--ic-text-8); opacity: 0.28;
      }
      .igris-console .ic-wfall__tick--ok { opacity: 1; background: var(--ic-emerald); }
      .igris-console .ic-wfall__tick--warn { opacity: 1; background: var(--ic-amber); }
      .igris-console .ic-wfall__tick--bad { opacity: 1; background: var(--ic-rose); }
      .igris-console .ic-wfall__tick--muted { opacity: 1; background: var(--ic-text-6); }
      .igris-console .ic-wfall__val { font-size: 10px; color: var(--ic-text-5); font-variant-numeric: tabular-nums; text-align: right; font-family: var(--ic-mono); }
      .igris-console .ic-wfall__axis { display: grid; grid-template-columns: 76px minmax(0,1fr) 48px; gap: 8px; margin-top: 3px; }
      .igris-console .ic-wfall__scale { grid-column: 2; display: flex; justify-content: space-between; font-size: 9px; color: var(--ic-text-7); font-variant-numeric: tabular-nums; font-family: var(--ic-mono); }
      .igris-console .ic-wfall__scale-mid { color: var(--ic-text-8); letter-spacing: 0.04em; }

      /* Execution-profile reveal (Recover tab): rows fade in, ticks fill out. */
      @keyframes ic-wfall-row-in { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes ic-wfall-tick-in { from { opacity: 0.12; } to { opacity: 1; } }
      .igris-console .ic-wfall--animate .ic-wfall__row { animation: ic-wfall-row-in 880ms cubic-bezier(0.16,0.84,0.44,1) both; }
      .igris-console .ic-wfall--animate .ic-wfall__tick--ok,
      .igris-console .ic-wfall--animate .ic-wfall__tick--warn,
      .igris-console .ic-wfall--animate .ic-wfall__tick--bad,
      .igris-console .ic-wfall--animate .ic-wfall__tick--muted {
        animation: ic-wfall-tick-in 280ms cubic-bezier(0.16,0.84,0.44,1) both;
      }
      @media (prefers-reduced-motion: reduce) {
        .igris-console .ic-wfall--animate .ic-wfall__row,
        .igris-console .ic-wfall--animate .ic-wfall__tick--ok,
        .igris-console .ic-wfall--animate .ic-wfall__tick--warn,
        .igris-console .ic-wfall--animate .ic-wfall__tick--bad,
        .igris-console .ic-wfall--animate .ic-wfall__tick--muted { animation: none; }
      }

      /* Hero footer */
      .igris-console .ic-footer { border-top: 1px solid var(--ic-border); background: var(--ic-bg); }
      .igris-console .ic-footer__bar { display: flex; align-items: center; gap: 10px; padding: 10px 20px; font-size: 11.5px; color: var(--ic-text-4); }
      .igris-console .ic-footer__chip { display: inline-flex; align-items: center; gap: 6px; color: var(--ic-text-2); }
      .igris-console .ic-footer__chip .dot { display: inline-block; width: 6px; height: 6px; border-radius: 999px; background: var(--ic-emerald); }
      .igris-console .ic-footer__spacer { flex: 1; }

      /* Console shell: rail + sidebar + main on desktop; the sidebar drops
         out on tablets and the right evidence rail folds under on phones. */
      .igris-console .ic-shell { grid-template-columns: 40px 200px 1fr; height: 640px; }
      @media (max-width: 860px) {
        .igris-console .ic-shell { grid-template-columns: 40px 1fr; }
        .igris-console .ic-shell > aside { display: none; }
      }
      @media (max-width: 640px) {
        .igris-console .ic-shell { height: 560px; }
        .igris-console .ic-run-detail-layout { grid-template-columns: 1fr; }
        .igris-console .ic-run-detail-rail { display: none; }
        .igris-console .ic-summary__grid { grid-template-columns: repeat(3, minmax(0,1fr)); }
        .igris-console .ic-line { grid-template-columns: 64px minmax(0,1fr) auto auto; padding: 3px 8px; }
        .igris-console .ic-def { grid-template-columns: 80px 1fr; column-gap: 14px; }
      }
    `}</style>
  )
}

// ── Icon Rail ──────────────────────────────────────────────────────

function RailIcon({ Icon, active }: { Icon: LucideIcon; active?: boolean }) {
  return (
    <div className="relative flex items-center justify-center h-[30px] w-9">
      {active && (
        <span
          className="absolute rounded-[6px]"
          style={{
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 28,
            height: 24,
            background: 'var(--ic-overlay-3)',
            zIndex: 0,
          }}
        />
      )}
      <Icon className="relative h-[15px] w-[15px]" strokeWidth={1.5} style={{ color: active ? 'var(--ic-rail-active)' : 'var(--ic-text-6)' }} />
    </div>
  )
}

// active = highlighted lens index: Home 0, Overview 1, Actions 2, Runs 3,
// Runtimes 4, Settings 5 (mirrors shared/_icon_rail rail_items). Defaults to
// Runs (3) for the hero run-detail view.
function IconRail({ active = 3 }: { active?: number }) {
  const { resolvedTheme } = useTheme()
  const logoSrc = resolvedTheme === 'light' ? '/inertia.png' : '/inertiadm.png'
  const icons = [Home, LayoutDashboard, ListChecks, Zap, Box, Settings]
  return (
    <nav className="flex flex-col items-center py-2 border-r" style={{ background: 'var(--landing-surface)', borderColor: 'var(--ic-border)' }}>
      <div className="flex items-center justify-center h-9 w-9 mb-1">
        <img src={logoSrc} alt="" width={15} height={15} className="block select-none" draggable={false} />
      </div>
      <div className="flex flex-col items-center flex-1 gap-0.5">
        {icons.map((Icon, i) => <RailIcon key={i} Icon={Icon} active={i === active} />)}
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
    <aside className="flex flex-col border-r" style={{ background: 'var(--landing-surface)', borderColor: 'var(--ic-border)' }}>
      {/* search — filters the runs picker live */}
      <div className="px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5 px-2 h-[22px] rounded-md border-[0.5px] focus-within:border-[color:var(--ic-border)]" style={{ background: 'var(--landing-surface)', borderColor: 'var(--ic-border-soft)' }}>
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
  const [open, setOpen] = useState(group.name !== 'web-app' && group.name !== 'data-platform')
  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 w-full px-1.5 py-1 text-[12px] text-[var(--ic-text-3)] rounded hover:bg-[var(--ic-overlay-1)] transition-colors cursor-default text-left"
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" className={`text-[var(--ic-text-7)] transition-transform ${open ? 'rotate-90' : ''}`}>
          <path d="M9 6 L15 12 L9 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="text-[var(--ic-text-6)]">
          <path d="M4 20a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2Z" />
        </svg>
        <span className="flex-1 truncate" style={{ letterSpacing: '-0.005em' }}>{group.name}</span>
        <span className="text-[10px] text-[var(--ic-text-7)] tabular-nums">{group.runs.length}</span>
      </button>
      {open && (
        <div className="mt-px">
          {group.runs.map((r) => (
            <RunRowView key={r.id} run={r} />
          ))}
        </div>
      )}
    </div>
  )
}

function RunRowView({ run }: { run: RunRow }) {
  const stColor =
    run.status === 'running' ? 'text-emerald-400' :
    run.status === 'failed'  ? 'text-rose-400' :
    run.status === 'blocked' ? 'text-amber-400' :
                               'text-[var(--ic-text-7)]'
  return (
    <div
      className={
        `group grid items-center gap-2 pl-6 pr-3 ${run.active ? 'py-1.5' : 'py-2.5'} rounded transition-colors cursor-default ` +
        (run.active ? 'bg-[var(--ic-overlay-4)]' : 'hover:bg-[var(--ic-overlay-1)]')
      }
      style={{ gridTemplateColumns: 'minmax(0,1fr) auto auto' }}
    >
      <span className={'text-[11.5px] truncate ' + (run.active ? 'text-[var(--ic-text-bright)]' : 'text-[var(--ic-text-2)]')} style={{ fontFamily: MONO, letterSpacing: '-0.005em' }}>
        {run.action}
      </span>
      <span className={'text-[10.5px] ' + stColor}>{run.statusLabel}</span>
      <span className="text-[10.5px] text-[var(--ic-text-8)] tabular-nums flex-shrink-0 hidden md:inline">{run.when}</span>
    </div>
  )
}

// ── Main pane ──────────────────────────────────────────────────────
// Mirrors the rails-console Run detail page (runs/show.html.erb +
// _inspector.html.erb) for a single Running action_workflow execution.

const RUN = {
  action: 'charge_customer',
  id: 'run_01HGJ9N7P4D',
  project: 'payments-api',
  status: 'Running',
  runtimeId: 'rt_prod_01',
  started: '14:07:42 UTC',
  ago: '6 seconds ago',
}

function Main({ frozen = false }: { frozen?: boolean }) {
  return (
    <div className="flex flex-col min-h-0">
      <MainTopBar />
      <div className="ic-scroll flex-1 overflow-y-auto px-5 py-4 min-h-0">
        <div className="ic-run-detail-layout">
          <section className="ic-run-detail-scroll" aria-label="Run evidence and audit details">
            {frozen ? (
              // Recover surface: focus the evidence column on the Execution
              // profile alone — no long scroll through the full run detail.
              <div className="ic-runinspector">
                <ExecutionProfile animate />
              </div>
            ) : (
              <>
                <Evidence />
                <div className="ic-run-expand"><RunInspector /></div>
                <div className="ic-foot-time">14:07:42 <span style={{ color: 'var(--ic-emerald)' }}>live</span></div>
              </>
            )}
          </section>
          <ExecDetailRail />
        </div>
      </div>
      <MainFooter />
    </div>
  )
}

function MainTopBar() {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex items-center justify-between gap-3 h-11 px-5 border-b border-[color:var(--ic-border)]">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[11.5px] text-[var(--ic-text-6)]">Runs</span>
        <span className="text-[11.5px] text-[var(--ic-text-8)]">/</span>
        <span className="text-[11.5px] font-medium text-[var(--ic-text-bright)] truncate" style={{ letterSpacing: '-0.01em', fontFamily: MONO }}>
          {RUN.action}
        </span>
        <span className="text-[11.5px] text-[var(--ic-text-6)] truncate" style={{ fontFamily: MONO }}>{RUN.id}</span>
        <button
          type="button"
          onClick={() => { navigator.clipboard?.writeText(RUN.id); setCopied(true); setTimeout(() => setCopied(false), 1400) }}
          className="inline-flex items-center text-[11.5px] text-[var(--ic-text-6)] hover:text-[var(--ic-text-bright)] border border-[color:var(--ic-border-soft)] bg-[var(--ic-overlay-3)] rounded px-1.5 h-[20px]"
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
        <span className="ic-chip"><span className="ic-chip-icon" style={{ color: 'rgb(192,132,252)', verticalAlign: 'middle' }}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg></span>{RUN.project}</span>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <TopBtn label="Back to action" />
        <TopBtn label="Open runtime" />
      </div>
    </div>
  )
}

function TopBtn({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1.5 h-6 px-2 rounded-md text-[11px] transition-colors cursor-default bg-[var(--ic-overlay-3)] text-[var(--ic-text-2)] border border-[color:var(--ic-border)] hover:bg-[var(--ic-overlay-5)]"
    >
      <span>{label}</span>
    </button>
  )
}

// ── Reusable value renderers (mirror console_helper chip/pill helpers) ──

function Pill({ tone, label }: { tone: 'ok' | 'warn' | 'bad' | 'muted'; label: string }) {
  return <span className={`ig-pill ig-pill--${tone}`}>{label}</span>
}

// route_chips: token 0 = route type (globe icon for Hosted API), token 1+ = brand.
function RoutedVia() {
  return (
    <span className="ic-chips">
      <span className="ic-chip ic-chip--sm">
        <span className="ic-chip__icon" style={{ color: 'rgb(192,132,252)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>Hosted API
      </span>
      <span className="ic-chip ic-chip--sm">
        <span className="ic-chip__logo">
          {/* same Stripe brand mark as the Runs console RouteChips */}
          <svg viewBox="0 0 24 24" fill="#635BFF" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z" />
          </svg>
        </span>
        Stripe
      </span>
    </span>
  )
}

function FacetChips({ items }: { items: string[] }) {
  return (
    <span className="ic-chips">
      {items.map((t) => <span key={t} className="ic-chip ic-chip--sm">{t}</span>)}
    </span>
  )
}

function Evidence({
  compact = false,
  frozen = false,
  showNarrative = true,
  showReceipts = true,
  panelTitle,
}: {
  compact?: boolean
  frozen?: boolean
  showNarrative?: boolean
  showReceipts?: boolean
  panelTitle?: string
}) {
  const [visible, setVisible] = useState(frozen ? STEPS.length : 1)
  const [cycle, setCycle] = useState(0)
  const [fading, setFading] = useState(false)
  const [committedOpen, setCommittedOpen] = useState(true)

  useEffect(() => {
    if (frozen) {
      setVisible(STEPS.length)
      return
    }
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
    }, 1100)
    return () => { clearInterval(id); if (to) clearTimeout(to) }
  }, [frozen])

  const steps = STEPS.slice(0, visible)
  const committed = steps.filter((s) => s.kind === 'action' && s.status === 'committed').length
  const totalActions = STEPS.filter((s) => s.kind === 'action').length
  const running = steps.some((s) => s.status === 'running')

  return (
    <div className="min-w-0">
      {!compact && (
        <div className="ic-evidence--flat">
          <div className="ic-evidence__head">Demo context</div>
          <div className="ic-def">
            <span className="ic-def__label">Submitter</span>
            <div className="ic-def__value"><span className="ic-chip ic-chip--sm">mateo@acme.io</span><span className="ic-def__hint">engineer, integrations</span></div>
          </div>
          <div className="ic-def">
            <span className="ic-def__label">Region</span>
            <div className="ic-def__value"><span className="ic-chip ic-chip--sm">fra1</span><span className="ic-chip ic-chip--sm">prod</span><span className="ic-def__hint">eu-central, primary</span></div>
          </div>
          <div className="ic-def">
            <span className="ic-def__label">Worker</span>
            <div className="ic-def__value"><span className="ic-chip ic-chip--sm">worker_b</span><span className="ic-def__hint">recovered from</span><span className="ic-chip ic-chip--sm">worker_a</span></div>
          </div>
          <div className="ic-def">
            <span className="ic-def__label">Submitted</span>
            <div className="ic-def__value"><span className="ic-chip ic-chip--sm">{RUN.started}</span><span className="ic-def__hint">{RUN.ago}, action workflow</span></div>
          </div>
        </div>
      )}

      {showNarrative && (
        <p className="ic-narrative">
          The receipt chain is <span className="accent">valid</span> up to{' '}
          <span className="mono">action 11</span>. Action 12 (<span className="mono">ledger_sync</span>) is currently running.
        </p>
      )}

      {/* ── Committed actions panel ──────────────────────────────────── */}
      <div className={'ic-panel' + (showReceipts ? '' : ' ic-panel--actions')} id="evidence">
        <div className="ic-loggroup">
          <button
            type="button"
            onClick={() => setCommittedOpen((v) => !v)}
            className="w-full ic-panel__head ic-loggroup__head cursor-pointer text-left"
          >
            <div className="ic-panel__head-l">
              <span
                className={'ic-loggroup__chev' + (committedOpen ? ' ic-loggroup__chev--open' : '')}
                aria-hidden
              />
              <span>{panelTitle ?? `Committed actions (${totalActions})`}</span>
              <span className="ic-panel__count-plus">+{committed}</span>
              <span className="ic-panel__count-minus">−0</span>
            </div>
            <div className="ic-panel__head-r">
              <span className="ic-log__status ic-log__status--run">
                <span className="ic-bullet-dot ic-bullet-dot--running ic-breathing" />running
              </span>
            </div>
          </button>

          {committedOpen && (
            <div className={'ic-log__body ' + (fading ? 'ic-cycle-fade' : '')}>
              {steps.map((s) => {
                const isRunning = s.status === 'running'
                if (s.kind === 'fault') {
                  return (
                    <div key={`${cycle}-${s.id}`} className="ic-line ic-line--fault ic-step-in">
                      <span className="ic-line__ts mono">{s.at}</span>
                      <div className="ic-line__main">
                        <span className="ic-line__name">{s.name}</span>
                        <span className="ic-line__detail">{s.detail}</span>
                      </div>
                      <span className="ic-line__latency">{s.latency}ms</span>
                      <span className="ic-line__receipt">recovered</span>
                    </div>
                  )
                }
                return (
                  <div key={`${cycle}-${s.id}`} className="ic-line ic-step-in">
                    <span className="ic-line__ts mono">{s.at}</span>
                    <div className="ic-line__main">
                      <span className={'ic-line__name' + (isRunning ? ' ic-line__name--running' : '')}>{s.name}</span>
                      <span className="ic-line__detail">{s.detail}</span>
                    </div>
                    <span className="ic-line__latency">{s.latency != null ? `${s.latency}ms` : ''}</span>
                    {showReceipts ? (
                      s.receipt
                        ? <span className="ic-line__receipt ic-line__receipt--ok">{s.receipt}</span>
                        : <span className="ic-line__receipt ic-line__receipt--none">—</span>
                    ) : (
                      <span className={'ic-line__status' + (isRunning ? ' ic-line__status--run' : ' ic-line__status--ok')}>
                        {isRunning ? 'running' : 'committed'}
                      </span>
                    )}
                  </div>
                )
              })}
              {!running && visible >= STEPS.length ? null : null}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Run Inspector — server-rendered redacted quick-inspection, ported
// from runs/_inspector.html.erb for the Running action_workflow run. ──

function RunInspector() {
  return (
    <aside className="ic-runinspector" aria-label="Run Inspector">
      <div className="ic-runinspector__head">
        <div className="ic-runinspector__head-l">
          <span className="ic-runinspector__title">Run Inspector</span>
          <span className="ic-runinspector__id mono">{RUN.id}</span>
        </div>
      </div>
      <div className="ic-runinspector__pills">
        <Pill tone="muted" label="Running" />
        <Pill tone="warn" label="Pending" />
      </div>

      <div className="ic-runinspector__scroll">
        {/* Overview */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Overview</div>
          <div className="ic-runinspector__rows">
            <InspDef label="Action"><span className="mono">{RUN.action}</span></InspDef>
            <InspDef label="Status"><Pill tone="muted" label="Running" /></InspDef>
            <InspDef label="Routed via"><RoutedVia /></InspDef>
            <InspDef label="Policy"><FacetChips items={['Idempotent', '3 retries']} /></InspDef>
            <InspDef label="Recovery">In flight</InspDef>
            <InspDef label="Proof"><Pill tone="warn" label="Pending" /></InspDef>
            <InspDef label="Created">{RUN.started} <span className="ic-def__hint">{RUN.ago}</span></InspDef>
          </div>
        </section>

        {/* Agent request */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Agent request</div>
          <p className="ic-runinspector__empty-line">No prompt or request payload is available for this run.</p>
        </section>

        {/* Action input */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Action input</div>
          <div className="ic-runinspector__kv">
            <div className="ic-runinspector__kvrow">
              <span className="ic-runinspector__kvk">Target</span>
              <RoutedVia />
            </div>
          </div>
          <p className="ic-runinspector__kvfoot">Raw action input isn't shown here. Igris records safe identifiers and digests instead of payload contents.</p>
        </section>

        {/* Execution assessment */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Execution assessment</div>
          <div className="ic-runinspector__rows">
            <InspDef label="Action completed"><Pill tone="warn" label="Running" /></InspDef>
            <InspDef label="Policy followed"><Pill tone="ok" label="Allowed" /></InspDef>
            <InspDef label="Runtime path"><Pill tone="ok" label="Hosted API" /></InspDef>
            <InspDef label="Recovery"><Pill tone="ok" label="In flight" /></InspDef>
            <InspDef label="Proof"><Pill tone="muted" label="Not available" /></InspDef>
          </div>
        </section>

        {/* Audit interpretation */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Audit interpretation</div>
          <p className="ic-runinspector__hint">Plain-language reading of this run's evidence. Interpretation only, not a compliance certification.</p>
          <div className="ic-runinspector__auditrows">
            <AuditRow label="Control decision" value="Idempotent, 3 retries" note="Policy decision record: the policy preset Igris applied before allowing execution." />
            <AuditRow label="Execution record" value="Running" note="Tamper-evident record of what Igris did when the action was called." />
            <AuditRow label="Evidence receipt" value="No signed runtime evidence attached" note="A receipt is a signed, tamper-evident record that a runtime reported this execution event." />
            <AuditRow label="Verification status" value="Unsigned (not attached)" note="Signature shows the event was reported by a registered runtime key when available. Digest records prove data consistency without exposing raw input or output." />
            <AuditRow label="Recovery / replay status" value="In flight" note="Replay / recovery record: whether Igris retried or compensated the action." />
            <AuditRow label="Data exposure" value="Minimized" note="Raw inputs/outputs are not shown here; only safe identifiers and digests are displayed." />
          </div>
          <p className="ic-runinspector__note">Proof is unavailable when signed runtime evidence was not produced or attached to this run.</p>
        </section>

        {/* Evidence */}
        <section className="ic-runinspector__section">
          <div className="ic-runinspector__sechead">Evidence</div>
          <div className="ic-runinspector__rows">
            <InspDef label="Receipt hash"><span className="mono">—</span></InspDef>
            <InspDef label="Proof"><Pill tone="warn" label="Pending" /></InspDef>
            <InspDef label="Steps recorded">—</InspDef>
          </div>
          <p className="ic-runinspector__note">Open the full run for ordered step evidence.</p>
        </section>

        {/* Execution profile (waterfall) */}
        <ExecutionProfile />
      </div>
    </aside>
  )
}

function InspDef({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ic-def">
      <span className="ic-def__label">{label}</span>
      <div className="ic-def__value">{children}</div>
    </div>
  )
}

function AuditRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="ic-runinspector__auditrow">
      <div className="ic-runinspector__audittop">
        <span className="ic-runinspector__auditlabel">{label}</span>
        <span className="ic-runinspector__auditvalue">{value}</span>
      </div>
      <p className="ic-runinspector__auditnote">{note}</p>
    </div>
  )
}

const EXECUTION_PROFILE_TICKS = 256

type ProfileTone = 'ok' | 'warn' | 'bad' | 'muted'

interface ProfileRow {
  label: string
  ms: number
  start: number
  tone: ProfileTone
}

function executionProfileTickRange(start: number, ms: number, span: number, tickCount: number) {
  if (span <= 0 || tickCount <= 0) return { startIdx: 0, endIdx: 0 }
  const startIdx = Math.min(tickCount - 1, Math.floor((start / span) * tickCount))
  const endIdx = Math.max(startIdx + 1, Math.min(tickCount, Math.ceil(((start + ms) / span) * tickCount)))
  return { startIdx, endIdx }
}

function executionProfileToneAt(profile: ProfileRow[], span: number, tickIdx: number, tickCount: number): ProfileTone | null {
  if (span <= 0) return null
  const t = (tickIdx / tickCount) * span
  const step = profile.find((p) => t >= p.start && t < p.start + p.ms)
  return step?.tone ?? null
}

function ExecutionProfileTickTrack({
  profile,
  start,
  ms,
  span,
  tone,
  animate,
  rowDelay,
  timeline = false,
}: {
  profile?: ProfileRow[]
  start?: number
  ms?: number
  span: number
  tone?: ProfileTone
  animate: boolean
  rowDelay?: string
  timeline?: boolean
}) {
  const rowBaseDelay = parseInt(rowDelay ?? '0', 10) || 0
  return (
    <div
      className={'ic-wfall__track' + (timeline ? ' ic-wfall__track--timeline' : '')}
      aria-hidden={timeline ? undefined : true}
      aria-label={timeline ? 'Run timeline utilization' : undefined}
    >
      {Array.from({ length: EXECUTION_PROFILE_TICKS }, (_, tickIdx) => {
        let activeTone: ProfileTone | null = null
        if (timeline && profile) {
          activeTone = executionProfileToneAt(profile, span, tickIdx, EXECUTION_PROFILE_TICKS)
        } else if (start != null && ms != null && tone) {
          const { startIdx, endIdx } = executionProfileTickRange(start, ms, span, EXECUTION_PROFILE_TICKS)
          activeTone = tickIdx >= startIdx && tickIdx < endIdx ? tone : null
        }
        const tickDelay = animate && activeTone
          ? `${rowBaseDelay + tickIdx * 14}ms`
          : undefined
        return (
          <span
            key={tickIdx}
            className={'ic-wfall__tick' + (activeTone ? ` ic-wfall__tick--${activeTone}` : '')}
            style={tickDelay ? { animationDelay: tickDelay } : undefined}
          />
        )
      })}
    </div>
  )
}

// run_execution_profile(run): segmented timeline + tick-based utilization per
// step. The in-flight ledger_sync (no latency) is excluded — matching the rails
// helper.
function ExecutionProfile({
  animate = false,
  expanded = false,
  maxRows,
  showNote = true,
}: {
  animate?: boolean
  expanded?: boolean
  maxRows?: number
  showNote?: boolean
}) {
  let cursor = 0
  const profile = STEPS.filter((s) => s.latency != null).map((s) => {
    const ms = s.latency as number
    const row = { label: s.name, ms, start: cursor, tone: (s.kind === 'fault' ? 'warn' : 'ok') as ProfileTone }
    cursor += ms
    return row
  })
  const rows = maxRows != null ? profile.slice(0, maxRows) : profile
  const span = Math.max(...profile.map((p) => p.start + p.ms))
  const total = profile.reduce((n, p) => n + p.ms, 0)

  return (
    <section className={'ic-runinspector__section ic-runinspector__section--last' + (expanded ? ' ic-wfall--expanded' : '')}>
      <div className="ic-runinspector__sechead">Execution profile</div>
      <p className="ic-runinspector__hint">Time per step along the run timeline: {profile.length} steps over {total}ms total.</p>
      <div className={'ic-wfall' + (animate ? ' ic-wfall--animate' : '') + (expanded ? ' ic-wfall--expanded' : '')}>
        <ExecutionProfileTickTrack
          profile={profile}
          span={span}
          animate={animate}
          timeline
        />
        {rows.map((p, i) => {
          const delay = animate ? `${i * 200}ms` : undefined
          return (
            <div className="ic-wfall__row" key={i} style={{ animationDelay: delay }}>
              <span className="ic-wfall__label" title={p.label}>{p.label}</span>
              <ExecutionProfileTickTrack
                start={p.start}
                ms={p.ms}
                span={span}
                tone={p.tone}
                animate={animate}
                rowDelay={delay}
              />
              <span className="ic-wfall__val">{p.ms}ms</span>
            </div>
          )
        })}
        <div className="ic-wfall__axis">
          <span className="ic-wfall__scale">
            <span>0</span>
            <span className="ic-wfall__scale-mid">time</span>
            <span>{Math.round(span)}ms</span>
          </span>
        </div>
      </div>
      {showNote && (
        <p className="ic-runinspector__note">Each vertical tick is a time slice; filled ticks show when a step held the execution path.</p>
      )}
    </section>
  )
}

// ── Execution detail — sticky context rail, right side of the pane ──

function ExecDetailRail({ variant }: { variant?: RunDetailSnippetVariant }) {
  const next =
    variant === 'proof'
      ? {
          kicker: 'Inspect proof',
          title: 'Receipt chain is valid to action 11.',
          sub: 'Open the run to verify signed receipts and the ed25519 chain.',
          cta: 'View receipts',
        }
      : variant === 'policy'
        ? {
            kicker: 'Governed path',
            title: 'Policy allowed · recovery in flight.',
            sub: 'Igris retried rate limits and resumed on worker_b without losing checkpoint.',
            cta: 'Open recovery',
          }
        : {
            kicker: 'What to do next',
            title: 'Run is still in flight.',
            sub: 'Step evidence appears here as the run commits each action.',
            cta: 'Open action',
          }

  return (
    <aside className="ic-run-detail-rail" aria-label="Execution detail">
      <div className="ic-summary">
        <div className="ic-summary__head">Execution detail</div>
        <div className="ic-summary__grid">
          <div className="ic-summary__cell ic-summary__cell--wide">
            <div className="ic-summary__k">Action</div>
            <div className="ic-summary__v mono">{RUN.action}</div>
          </div>
          <div className="ic-summary__cell">
            <div className="ic-summary__k">Status</div>
            <div className="ic-summary__v"><Pill tone="muted" label="Running" /></div>
          </div>
          {variant !== 'proof' && (
            <div className="ic-summary__cell">
              <div className="ic-summary__k">Routed via</div>
              <div className="ic-summary__v"><RoutedVia /></div>
            </div>
          )}
          <div className="ic-summary__cell">
            <div className="ic-summary__k">Policy</div>
            <div className="ic-summary__v"><FacetChips items={['Idempotent', '3 retries']} /></div>
          </div>
          <div className="ic-summary__cell">
            <div className="ic-summary__k">Proof</div>
            <div className="ic-summary__v"><Pill tone="warn" label="Pending" /></div>
          </div>
          {variant === 'proof' && (
            <div className="ic-summary__cell ic-summary__cell--wide">
              <div className="ic-summary__k">Receipts</div>
              <div className="ic-summary__v mono">r₀₁ → r₁₁ signed · ed25519</div>
            </div>
          )}
          {variant === 'policy' && (
            <div className="ic-summary__cell">
              <div className="ic-summary__k">Recovery</div>
              <div className="ic-summary__v"><Pill tone="ok" label="In flight" /></div>
            </div>
          )}
          <div className="ic-summary__cell">
            <div className="ic-summary__k">Started</div>
            <div className="ic-summary__v">{RUN.started}</div>
          </div>
          <div className="ic-summary__cell">
            <div className="ic-summary__k">Duration</div>
            <div className="ic-summary__v">—</div>
          </div>
        </div>
        <p className="ic-summary__note">
          {variant === 'proof'
            ? 'Each committed step carries a signed receipt when runtime evidence is attached.'
            : 'Proof is available when signed runtime evidence exists.'}
        </p>
      </div>

      <div className="ic-nextstep">
        <div>
          <div className="ic-nextstep__kicker">{next.kicker}</div>
          <div className="ic-nextstep__title">{next.title}</div>
          <p className="ic-nextstep__sub">{next.sub}</p>
        </div>
        <div className="ic-nextstep__cta">
          <button type="button" className="inline-flex items-center h-6 px-2 rounded-md text-[11px] cursor-default bg-emerald-500/[0.14] text-emerald-300 border border-emerald-500/25">{next.cta}</button>
        </div>
      </div>
    </aside>
  )
}

function MainFooter() {
  return (
    <div className="ic-footer">
      <div className="ic-footer__bar">
        <span className="ic-footer__chip"><span className="dot" /><span>action_workflow v1</span></span>
        <span>Receipts ed25519</span>
      </div>
    </div>
  )
}

// ── Compact run-detail embed — cropped Run tab console for landing sections ──

const PROOF_RECEIPT_STEPS = STEPS.filter((s) => s.receipt)

function ActionsSnippet() {
  return (
    <Evidence
      compact
      showNarrative={false}
      showReceipts={false}
      panelTitle="Committed actions (12)"
    />
  )
}

function ProofAuditCell({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="wtu-proof-audit__cell">
      <div className="wtu-proof-audit__label">{label}</div>
      <div className="wtu-proof-audit__value">{value}</div>
      <p className="wtu-proof-audit__note">{note}</p>
    </div>
  )
}

function ProofSnippet() {
  return (
    <div className="wtu-proof-snippet">
      <div className="wtu-proof-snippet__summary">
        <div className="wtu-proof-snippet__summary-main">
          <span className="wtu-proof-snippet__title">Receipt chain</span>
          <p className="wtu-proof-snippet__lead">
            Valid to <span className="mono accent">action 11</span> ·{' '}
            {PROOF_RECEIPT_STEPS.length} signed · <span className="mono">ed25519</span>
          </p>
        </div>
        <div className="wtu-proof-snippet__summary-meta">
          <Pill tone="ok" label="Verified" />
          <span className="wtu-proof-snippet__pending mono">action 12 pending</span>
        </div>
      </div>

      <div className="wtu-proof-snippet__ledger ic-panel ic-panel--proof">
        <div className="wtu-proof-snippet__thead">
          <span>Time</span>
          <span>Action</span>
          <span>Detail</span>
          <span>Receipt</span>
          <span>Sig</span>
        </div>
        <div className="wtu-proof-snippet__tbody">
          {PROOF_RECEIPT_STEPS.map((s) => (
            <div key={s.id} className="wtu-proof-snippet__row">
              <span className="wtu-proof-snippet__ts mono">{s.at}</span>
              <span className="wtu-proof-snippet__action mono">{s.name}</span>
              <span className="wtu-proof-snippet__detail">{s.detail}</span>
              <span className="wtu-proof-snippet__receipt mono">{s.receipt}</span>
              <span className="wtu-proof-snippet__sig">ed25519</span>
            </div>
          ))}
        </div>
      </div>

      <div className="wtu-proof-snippet__audit">
        <div className="ic-runinspector__sechead">Audit interpretation</div>
        <div className="wtu-proof-audit__grid">
          <ProofAuditCell
            label="Evidence receipt"
            value="11 signed · 1 pending"
            note="Signed, tamper-evident record from the runtime."
          />
          <ProofAuditCell
            label="Verification"
            value="Valid to action 11"
            note="Registered runtime key when available."
          />
          <ProofAuditCell
            label="Data exposure"
            value="Minimized"
            note="Only safe identifiers and digests are shown."
          />
        </div>
      </div>
    </div>
  )
}

function RunSnippetStyles() {
  return (
    <style>{`
      .wtu-run-snippet {
        height: 100%;
        width: 100%;
        min-height: 0;
        display: flex;
        flex-direction: column;
        border-radius: 8px;
        overflow: hidden;
        background: var(--landing-surface);
      }
      .wtu-run-snippet__top {
        flex-shrink: 0;
        display: flex;
        align-items: center;
        gap: 6px;
        height: 32px;
        padding: 0 12px;
        border-bottom: 1px solid var(--ic-border);
      }
      .wtu-run-snippet__body {
        flex: 1;
        min-height: 0;
        overflow: auto;
        padding: 10px 12px 12px;
        scrollbar-width: none;
      }
      .wtu-run-snippet__body::-webkit-scrollbar { display: none; }
      .wtu-run-snippet .ic-run-detail-layout {
        height: 100%;
        min-height: 100%;
        grid-template-columns: minmax(0, 1fr) 188px;
        gap: 12px;
      }
      .wtu-run-snippet[data-variant="policy"] .ic-run-detail-layout {
        grid-template-columns: minmax(0, 1.14fr) minmax(0, 0.86fr);
      }
      .wtu-run-snippet .ic-run-detail-scroll {
        overflow: hidden;
      }
      .wtu-run-snippet .ic-panel {
        margin-top: 0;
      }
      .wtu-run-snippet .ic-narrative {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 11.5px;
        line-height: 1.5;
      }
      .wtu-run-snippet .ic-runinspector__section {
        padding-right: 0;
      }
      .wtu-run-snippet .ic-runinspector__section:first-child {
        padding-top: 0;
      }
      .wtu-run-snippet .ic-log__body {
        max-height: none;
      }
      .wtu-run-snippet .ic-line {
        grid-template-columns: 68px minmax(0,1fr) auto auto;
        padding: 3px 8px;
      }
      .wtu-proof-snippet {
        display: flex;
        flex-direction: column;
        gap: 12px;
        height: 100%;
        min-height: 0;
      }
      .wtu-proof-snippet__summary {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding-bottom: 10px;
        border-bottom: 1px solid var(--ic-border-soft);
        flex-shrink: 0;
      }
      .wtu-proof-snippet__title {
        display: block;
        font-size: 11px;
        letter-spacing: 0.06em;
        color: var(--ic-text-6);
        margin-bottom: 4px;
      }
      .wtu-proof-snippet__lead {
        margin: 0;
        font-size: 12px;
        line-height: 1.5;
        color: var(--ic-text-3);
      }
      .wtu-proof-snippet__lead .mono { font-family: var(--ic-mono); }
      .wtu-proof-snippet__lead .accent { color: var(--ic-emerald); }
      .wtu-proof-snippet__summary-meta {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        flex-shrink: 0;
      }
      .wtu-proof-snippet__pending {
        font-size: 9.5px;
        color: var(--ic-text-6);
        letter-spacing: 0.04em;
      }
      .wtu-proof-snippet__ledger {
        flex: 1;
        min-height: 0;
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 10px 12px 8px;
      }
      .wtu-proof-snippet__thead,
      .wtu-proof-snippet__row {
        display: grid;
        grid-template-columns: 72px 72px minmax(0, 1fr) 44px 52px;
        align-items: center;
        column-gap: 10px;
      }
      .wtu-proof-snippet__thead {
        font-size: 9.5px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--ic-text-6);
        padding: 0 4px 8px;
        border-bottom: 1px solid var(--ic-border-soft);
        flex-shrink: 0;
      }
      .wtu-proof-snippet__tbody {
        flex: 1;
        min-height: 0;
        overflow-y: auto;
        padding-top: 4px;
        scrollbar-width: none;
      }
      .wtu-proof-snippet__tbody::-webkit-scrollbar { display: none; }
      .wtu-proof-snippet__row {
        padding: 5px 4px;
        border-radius: 4px;
        font-size: 10.5px;
      }
      .wtu-proof-snippet__row:hover { background: var(--ic-overlay-1); }
      .wtu-proof-snippet__ts { color: var(--ic-text-6); font-variant-numeric: tabular-nums; }
      .wtu-proof-snippet__action { color: var(--ic-text-2); }
      .wtu-proof-snippet__detail {
        color: var(--ic-text-5);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 10px;
      }
      .wtu-proof-snippet__receipt { color: var(--ic-emerald); }
      .wtu-proof-snippet__sig {
        font-family: var(--ic-mono);
        font-size: 8.5px;
        letter-spacing: 0.08em;
        color: var(--ic-text-7);
        text-transform: uppercase;
      }
      .wtu-proof-snippet__audit {
        flex-shrink: 0;
        padding-top: 4px;
        border-top: 1px solid var(--ic-border-soft);
      }
      .wtu-proof-audit__grid {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 10px;
        margin-top: 8px;
      }
      .wtu-proof-audit__cell {
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid var(--ic-border-soft);
        background: var(--ic-overlay-bg);
      }
      .wtu-proof-audit__label {
        font-size: 9.5px;
        letter-spacing: 0.06em;
        color: var(--ic-text-6);
        margin-bottom: 4px;
      }
      .wtu-proof-audit__value {
        font-size: 11.5px;
        font-weight: 500;
        color: var(--ic-text-2);
        margin-bottom: 4px;
      }
      .wtu-proof-audit__note {
        margin: 0;
        font-size: 10px;
        line-height: 1.45;
        color: var(--ic-text-6);
      }
      .wtu-run-snippet__routing,
      .wtu-run-snippet__proof {
        height: 100%;
        min-height: 0;
      }
      .wtu-run-snippet__routing {
        display: flex;
        flex-direction: column;
        gap: 14px;
      }
      .wtu-routing-snippet__paths {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px 16px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--ic-border-soft);
      }
      .wtu-routing-snippet__path {
        min-width: 0;
      }
      .wtu-routing-snippet__path-k {
        font-size: 9.5px;
        letter-spacing: 0.08em;
        color: var(--ic-text-6);
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .wtu-routing-snippet__profile {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        padding-top: 2px;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded {
        gap: 7px;
        margin-top: 10px;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__row {
        grid-template-columns: 70px minmax(0, 1fr) 44px;
        gap: 14px;
        padding: 5px 0;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__axis {
        grid-template-columns: 70px minmax(0, 1fr) 44px;
        gap: 14px;
        margin-top: 6px;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__track {
        height: 20px;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__track--timeline {
        height: 24px;
        margin-bottom: 12px;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__tick {
        flex: 0 0 1px;
        width: 1px;
        min-height: 100%;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-runinspector__section--last {
        border-bottom: 0;
        padding-bottom: 0;
      }
      .wtu-run-snippet[data-variant="routing"] .ic-runinspector__hint {
        margin-bottom: 4px;
      }
      .wtu-policy-snippet .ic-runinspector__pills {
        padding: 0 0 10px;
        border-bottom: 1px solid var(--ic-border-soft);
      }
      .wtu-policy-snippet .ic-runinspector__section {
        padding: 10px 0;
      }
      .wtu-policy-snippet .ic-wfall {
        margin-top: 4px;
      }
      @media (max-width: 1023px) {
        .wtu-run-snippet .ic-run-detail-layout {
          grid-template-columns: minmax(0, 1fr) 148px;
          gap: 10px;
        }
        .wtu-run-snippet__body {
          padding: 8px 10px 10px;
        }
        .wtu-routing-snippet__paths {
          grid-template-columns: 1fr;
        }
        .wtu-proof-audit__grid {
          grid-template-columns: 1fr;
        }
        .wtu-proof-snippet__summary {
          flex-direction: column;
          align-items: flex-start;
        }
        .wtu-proof-snippet__summary-meta {
          flex-direction: row;
          align-items: center;
          width: 100%;
          justify-content: space-between;
        }
        .wtu-proof-snippet__thead,
        .wtu-proof-snippet__row {
          grid-template-columns: 58px 64px minmax(0, 1fr) 38px 44px;
          column-gap: 6px;
        }
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__row,
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__axis {
          grid-template-columns: 58px minmax(0, 1fr) 40px;
          gap: 10px;
        }
      }
      @media (max-width: 639px) {
        .wtu-run-snippet__top {
          flex-wrap: wrap;
          height: auto;
          min-height: 32px;
          row-gap: 4px;
          padding: 6px 10px;
        }
        .wtu-run-snippet__top .ml-auto {
          margin-left: 0;
          width: 100%;
        }
        .wtu-run-snippet .ic-run-detail-layout {
          grid-template-columns: 1fr;
          gap: 0;
        }
        .wtu-run-snippet .ic-run-detail-scroll {
          overflow: visible;
        }
        .wtu-run-snippet .ic-run-detail-rail {
          border-left: 0;
          padding-left: 0;
          border-top: 1px solid var(--ic-border);
          padding-top: 12px;
          margin-top: 4px;
        }
        .wtu-run-snippet .ic-line {
          grid-template-columns: 56px minmax(0,1fr) auto;
          column-gap: 6px;
          padding: 3px 4px;
        }
        .wtu-run-snippet .ic-panel--actions .ic-line__latency {
          display: none;
        }
        .wtu-proof-snippet__thead span:nth-child(3),
        .wtu-proof-snippet__thead span:nth-child(5),
        .wtu-proof-snippet__detail,
        .wtu-proof-snippet__sig {
          display: none;
        }
        .wtu-proof-snippet__thead,
        .wtu-proof-snippet__row {
          grid-template-columns: 54px minmax(0, 1fr) 40px;
        }
        .wtu-proof-snippet__ledger {
          padding: 8px 8px 6px;
        }
        .wtu-run-snippet[data-variant="policy"] .ic-wfall__row,
        .wtu-run-snippet[data-variant="policy"] .ic-wfall__axis {
          grid-template-columns: 52px minmax(0, 1fr) 36px;
          gap: 6px;
        }
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__row,
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__axis {
          grid-template-columns: 52px minmax(0, 1fr) 36px;
          gap: 8px;
        }
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__track {
          height: 16px;
        }
        .wtu-run-snippet[data-variant="routing"] .ic-wfall--expanded .ic-wfall__track--timeline {
          height: 18px;
        }
        .wtu-policy-snippet .ic-runinspector__pills {
          gap: 4px;
        }
        .wtu-policy-snippet .ic-runinspector__auditrow {
          padding: 8px 0;
        }
      }
    `}</style>
  )
}

function SnippetTopBar() {
  return (
    <div className="wtu-run-snippet__top">
      <span className="text-[10px] text-[var(--ic-text-6)]">Runs</span>
      <span className="text-[10px] text-[var(--ic-text-8)]">/</span>
      <span className="text-[10.5px] font-medium text-[var(--ic-text-bright)] truncate" style={{ letterSpacing: '-0.01em', fontFamily: MONO }}>
        {RUN.action}
      </span>
      <span className="text-[10px] text-[var(--ic-text-6)] truncate" style={{ fontFamily: MONO }}>{RUN.id}</span>
      <span className="ml-auto ic-chip" style={{ fontSize: '9.5px', padding: '0 5px', lineHeight: '16px' }}>
        <span className="ic-chip-icon" style={{ color: 'rgb(192,132,252)', verticalAlign: 'middle' }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          </svg>
        </span>
        {RUN.project}
      </span>
    </div>
  )
}

function RoutingSnippet() {
  return (
    <div className="wtu-routing-snippet">
      <div className="wtu-routing-snippet__paths">
        <div className="wtu-routing-snippet__path">
          <div className="wtu-routing-snippet__path-k">Cloud path</div>
          <RoutedVia />
        </div>
        <div className="wtu-routing-snippet__path">
          <div className="wtu-routing-snippet__path-k">Local / edge</div>
          <span className="ic-chips">
            <span className="ic-chip ic-chip--sm mono">{RUN.runtimeId}</span>
            <span className="ic-chip ic-chip--sm">worker_b</span>
            <span className="ic-chip ic-chip--sm">fra1</span>
          </span>
        </div>
      </div>
      <div className="wtu-routing-snippet__profile">
        <ExecutionProfile expanded maxRows={7} showNote={false} />
      </div>
    </div>
  )
}

function PolicySnippet() {
  return (
    <div className="ic-runinspector wtu-policy-snippet">
      <div className="ic-runinspector__pills">
        <Pill tone="muted" label="Running" />
        <Pill tone="ok" label="Policy allowed" />
        <Pill tone="ok" label="Recovery in flight" />
        <Pill tone="warn" label="Proof pending" />
      </div>

      <section className="ic-runinspector__section">
        <div className="ic-runinspector__sechead">Execution assessment</div>
        <div className="ic-runinspector__rows">
          <InspDef label="Action completed"><Pill tone="warn" label="Running" /></InspDef>
          <InspDef label="Policy followed"><Pill tone="ok" label="Allowed" /></InspDef>
          <InspDef label="Runtime path"><Pill tone="ok" label="Hosted API" /></InspDef>
          <InspDef label="Recovery"><Pill tone="ok" label="In flight" /></InspDef>
          <InspDef label="Proof"><Pill tone="muted" label="Not available" /></InspDef>
        </div>
      </section>

      <section className="ic-runinspector__section">
        <div className="ic-runinspector__sechead">Audit interpretation</div>
        <div className="ic-runinspector__auditrows">
          <AuditRow label="Control decision" value="Idempotent, 3 retries" note="Policy decision record: the policy preset Igris applied before allowing execution." />
          <AuditRow label="Execution record" value="Running" note="Tamper-evident record of what Igris did when the action was called." />
          <AuditRow label="Recovery / replay status" value="In flight" note="Replay / recovery record: whether Igris retried or compensated the action." />
        </div>
      </section>

      <ExecutionProfile maxRows={4} showNote={false} />
    </div>
  )
}

function RunDetailSnippetBody({ variant }: { variant: RunDetailSnippetVariant }) {
  if (variant === 'routing') {
    return (
      <div className="wtu-run-snippet__routing" aria-label="Hybrid routing and execution profile">
        <RoutingSnippet />
      </div>
    )
  }

  if (variant === 'proof') {
    return (
      <div className="wtu-run-snippet__proof" aria-label="Receipt trail and audit interpretation">
        <ProofSnippet />
      </div>
    )
  }

  return (
    <div className="ic-run-detail-layout">
      <section className="ic-run-detail-scroll" aria-label="Run evidence">
        {variant === 'actions' && <ActionsSnippet />}
        {variant === 'policy' && <PolicySnippet />}
      </section>
      <ExecDetailRail variant={variant} />
    </div>
  )
}

/** Cropped Run-tab console for landing embeds (no browser chrome / sidebar). */
export function RunDetailSnippet({ variant }: { variant: RunDetailSnippetVariant }) {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  return (
    <div
      className={'igris-console wtu-run-snippet ' + (isLight ? 'igris-console--light ' : '')}
      data-variant={variant}
      style={{ fontFamily: SANS, background: 'var(--landing-surface)', color: 'var(--ic-text)' }}
    >
      <ConsoleStyles />
      <RunSnippetStyles />
      <SnippetTopBar />
      <div className="wtu-run-snippet__body">
        <RunDetailSnippetBody variant={variant} />
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Products section
// ──────────────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────────────
// Product showcase tabs — a centered Run / Recover / Prove switcher above
// the product surface. Run shows the hero run-detail design (ExecutionPreview,
// animated); Recover shows the same surface frozen on the full Execution
// profile (ExecutionPreview frozen); Prove shows the runs-list console
// (RunsConsole). Only the active panel mounts so the consoles never collide.
// ──────────────────────────────────────────────────────────────────

type ShowcaseTab = 'run' | 'recover' | 'prove'

const SHOWCASE_TABS: { id: ShowcaseTab; label: string }[] = [
  { id: 'run', label: 'Run' },
  { id: 'recover', label: 'Recover' },
  { id: 'prove', label: 'Prove' },
]

function ProductShowcaseTabs() {
  const [tab, setTab] = useState<ShowcaseTab>('run')
  // `revealed` flips once the section first scrolls into view, so the panel
  // (and its internal reveal animations) mount only when it's actually seen.
  const [revealed, setRevealed] = useState(false)
  const [indicator, setIndicator] = useState<{ left: number; width: number }>({ left: 0, width: 0 })
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([])
  const holdUntilRef = useRef(0)
  const order: ShowcaseTab[] = ['run', 'recover', 'prove']
  // Slide the shared underline to the active tab; re-measure on resize.
  useEffect(() => {
    const measure = () => {
      const btn = btnRefs.current[order.indexOf(tab)]
      if (btn) setIndicator({ left: btn.offsetLeft, width: btn.offsetWidth })
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [tab])
  useEffect(() => {
    const id = setInterval(() => {
      if (Date.now() < holdUntilRef.current) return
      setTab((prev) => {
        const idx = order.indexOf(prev)
        return order[(idx + 1) % order.length]
      })
    }, 5000)
    return () => clearInterval(id)
  }, [])
  // Mount the panel when the section first enters the viewport.
  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const io = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) { setRevealed(true); io.disconnect() }
    }, { threshold: 0.2 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    const onReveal = () => setRevealed(true)
    const onTab = (event: Event) => {
      const next = (event as CustomEvent<ProductTab>).detail
      holdUntilRef.current = Date.now() + 15000
      setTab(next)
      setRevealed(true)
    }
    window.addEventListener(LANDING_PRODUCT_REVEAL_EVENT, onReveal)
    window.addEventListener(LANDING_PRODUCT_TAB_EVENT, onTab)
    return () => {
      window.removeEventListener(LANDING_PRODUCT_REVEAL_EVENT, onReveal)
      window.removeEventListener(LANDING_PRODUCT_TAB_EVENT, onTab)
    }
  }, [])
  const handleTab = (id: ShowcaseTab) => {
    holdUntilRef.current = Date.now() + 15000
    setTab(id)
  }
  return (
    <div>
      <div className="flex justify-center">
        <div
          role="tablist"
          aria-label="Product surfaces"
          className="relative flex w-full sm:w-auto items-center justify-between sm:justify-center gap-4 sm:gap-16"
        >
          {SHOWCASE_TABS.map((t, i) => {
            const active = t.id === tab
            return (
              <button
                key={t.id}
                ref={(el) => { btnRefs.current[i] = el }}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleTab(t.id)}
                className={
                  'relative flex flex-col items-center gap-3 min-w-0 flex-1 sm:flex-none sm:min-w-[280px] text-[13px] font-normal transition-colors duration-300 ' +
                  (active
                    ? 'text-gray-700 dark:text-[#c8c8b8]'
                    : 'text-gray-400 dark:text-[#7a7a72] hover:text-gray-600 dark:hover:text-[#a8a898]')
                }
                style={{ fontFamily: SANS, letterSpacing: '-0.01em', fontWeight: 400 }}
              >
                <span>{t.label}</span>
                {/* transparent spacer preserves the row height; the shared
                    underline below slides over this position */}
                <span aria-hidden className="h-px w-full" />
              </button>
            )
          })}
          {/* single sliding underline shared across tabs — transform-based
              (GPU-composited) for buttery motion between tabs */}
          <span
            aria-hidden
            className="absolute left-0 bottom-0 h-px rounded-full bg-gray-300 dark:bg-[rgba(246,246,244,0.28)] will-change-transform"
            style={{
              transform: `translateX(${indicator.left}px)`,
              width: indicator.width,
              transition: 'transform 420ms cubic-bezier(0.22,1,0.36,1), width 420ms cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        </div>
      </div>
      <div className="mt-8" ref={panelRef}>
        {revealed ? (
          // Keyed by tab so the panel's own reveal animations replay on switch.
          // No wrapper fade: it would paint the first frame at opacity 0 and
          // flash empty space (the "blink"). Instant swap, internal motion only.
          <div key={tab}>
            {tab === 'run' && <ExecutionPreview url={PRODUCT_SHOWCASE_URLS.run} />}
            {tab === 'recover' && (
              <ExecutionPreview frozen url={PRODUCT_SHOWCASE_URLS.recover} />
            )}
            {tab === 'prove' && <RunsConsole url={PRODUCT_SHOWCASE_URLS.prove} />}
          </div>
        ) : (
          // Reserve the framed console height so nothing jumps before reveal.
          <div aria-hidden style={{ height: 684 }} />
        )}
      </div>
    </div>
  )
}

export default function Products() {
  return (
    <>
      <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="px-0">
          <div className="px-0">
            <div className="pt-10 md:pt-14 pb-20 md:pb-32">
              <ProductShowcaseTabs />
            </div>
          </div>
        </div>
      </section>

      {/* Execution-matters + Run Activity Map */}
      <section id="overview" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="px-0">
          <div className="px-0">
            <div className="pb-20 md:pb-28">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 md:gap-8">
                <h2
                  className="text-gray-700 dark:text-[#c8c8b8] font-normal shrink-0 max-w-[34ch]"
                  style={{
                    fontFamily: SANS,
                    fontWeight: 400,
                    fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
                    lineHeight: 1.2,
                    letterSpacing: '-0.02em',
                  }}
                >
                  Execution matters as much as intelligence.
                </h2>
                <p
                  className="text-gray-600 dark:text-[#a8a898] max-w-[38ch] md:text-right"
                  style={{ fontFamily: SANS, fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)', lineHeight: 1.6 }}
                >
                  Outcomes from many runs in one view. Spot what is completing,
                  recovering, or stalling across your environment.
                </p>
              </div>

              {/* Run Activity Map — map surface only (no rail/topbar/panel) */}
              <div className="mt-12 md:mt-16">
                <RunActivityMapConsole />
              </div>
              <p
                className="mt-5 text-[0.95rem] text-gray-500 dark:text-[#8a8a7a] max-w-[52ch]"
                style={{ fontFamily: SANS, lineHeight: 1.5 }}
              >
                Each dot is one run. See what completed, recovered, failed, or was verified.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
