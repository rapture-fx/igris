'use client'

// ──────────────────────────────────────────────────────────────────
// OverviewConsole — the Recover surface of the product showcase.
//
// A 1:1 port of the rails-console **Overview workspace's Run Activity Map**
// (home/index.html.erb → shared/_run_activity_map.html.erb + console_helper
// #run_activity_points / #run_activity_band), rendered inside the same framed
// console chrome as the hero and Runs showcases: icon rail + topbar + the
// diverging-outcome activity map. Each dot is one run, placed by time (x) and
// outcome band (y); hovering a dot opens the same evidence tooltip. Not an
// invented mock: same markup, same --ic-* tokens, same band logic as the real
// console.
// ──────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Home, LayoutDashboard, ListChecks, Zap, Box, Settings, type LucideIcon,
} from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

// ── Outcome bands — best → worst, mirrors console_helper::RUN_ACTIVITY_BANDS. ──
type Band = 'verified' | 'completed' | 'recovered' | 'waiting' | 'blocked' | 'failed'

const BANDS: { key: Band; label: string }[] = [
  { key: 'verified',  label: 'Verified' },
  { key: 'completed', label: 'Completed' },
  { key: 'recovered', label: 'Recovered' },
  { key: 'waiting',   label: 'Waiting' },
  { key: 'blocked',   label: 'Blocked' },
  { key: 'failed',    label: 'Failed' },
]

const BAND_LABEL = (b: Band): string => BANDS.find((x) => x.key === b)?.label ?? 'Run'

// ── Run window — mirrors igris/fixtures.rb run summaries, newest-first. Only
//    the already-normalized, already-redacted fields the map reads. ──
interface ActRun {
  action: string
  status: string
  proof: string
  recovery?: string
  via: string
  runtimeId?: string
  when: string
}

const ACT_RUNS: ActRun[] = [
  { action: 'charge_customer',    status: 'Running',   proof: 'Proof pending',     via: 'Hosted API · Stripe',     when: 'just now' },
  { action: 'send_email',         status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Resend',     when: '1m ago' },
  { action: 'deploy_preview',     status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Vercel',     when: '3m ago' },
  { action: 'capture_exception',  status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · Sentry',     when: '4m ago' },
  { action: 'create_issue',       status: 'Running',   proof: 'Proof pending',     via: 'Hosted API · Linear',     when: '6m ago' },
  { action: 'validate_policy',    status: 'Succeeded', proof: 'Proof unavailable', recovery: 'Retried 2x',         via: 'Runtime', runtimeId: 'rt_prod_01', when: '7m ago' },
  { action: 'run_migration',      status: 'Failed',    proof: 'Proof failed',      via: 'Hosted API · Neon',       when: '9m ago' },
  { action: 'purge_cache',        status: 'Cancelled', proof: 'Proof unavailable', via: 'Hosted API · Cloudflare', when: '11m ago' },
  { action: 'create_invoice',     status: 'Succeeded', proof: 'Proof verified',    recovery: 'Retried 1x',         via: 'Webhook · Stripe',        when: '12m ago' },
  { action: 'open_pull_request',  status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · GitHub',     when: '14m ago' },
  { action: 'export_ledger',      status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_01', when: '15m ago' },
  { action: 'refund_charge',      status: 'Failed',    proof: 'Proof failed',      recovery: 'Awaiting review',    via: 'Hosted API · Stripe',     when: '17m ago' },
  { action: 'sync_inventory',     status: 'Succeeded', proof: 'Proof unavailable', recovery: 'Resumed',            via: 'Runtime', runtimeId: 'rt_prod_02', when: '18m ago' },
  { action: 'notify_webhook',     status: 'Blocked',   proof: 'Proof unavailable', via: 'Webhook · Stripe',        when: '20m ago' },
  { action: 'rotate_keys',        status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_01', when: '21m ago' },
  { action: 'reconcile_ledger',   status: 'Running',   proof: 'Proof pending',     via: 'Hosted API · Stripe',     when: '23m ago' },
  { action: 'send_receipt',       status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Resend',     when: '24m ago' },
  { action: 'provision_tenant',   status: 'Succeeded', proof: 'Proof unavailable', via: 'Runtime', runtimeId: 'rt_prod_03', when: '26m ago' },
  { action: 'charge_customer',    status: 'Succeeded', proof: 'Proof verified',    recovery: 'Retried 1x',         via: 'Hosted API · Stripe',     when: '27m ago' },
  { action: 'index_documents',    status: 'Failed',    proof: 'Proof failed',      via: 'Runtime', runtimeId: 'rt_prod_02', when: '29m ago' },
  { action: 'deploy_preview',     status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Vercel',     when: '31m ago' },
  { action: 'flush_cdn',          status: 'Cancelled', proof: 'Proof unavailable', via: 'Hosted API · Cloudflare', when: '33m ago' },
  { action: 'create_issue',       status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · Linear',     when: '35m ago' },
  { action: 'capture_exception',  status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · Sentry',     when: '36m ago' },
  { action: 'sync_subscriptions', status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Stripe',     when: '38m ago' },
  { action: 'export_ledger',      status: 'Running',   proof: 'Proof pending',     via: 'Runtime', runtimeId: 'rt_prod_01', when: '40m ago' },
  { action: 'run_migration',      status: 'Succeeded', proof: 'Proof verified',    recovery: 'Resumed',            via: 'Hosted API · Neon',       when: '41m ago' },
  { action: 'open_pull_request',  status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · GitHub',     when: '43m ago' },
  { action: 'send_email',         status: 'Failed',    proof: 'Proof failed',      recovery: 'Awaiting review',    via: 'Hosted API · Resend',     when: '45m ago' },
  { action: 'reconcile_ledger',   status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Stripe',     when: '46m ago' },
  { action: 'rotate_keys',        status: 'Blocked',   proof: 'Proof unavailable', via: 'Runtime', runtimeId: 'rt_prod_03', when: '48m ago' },
  { action: 'create_invoice',     status: 'Succeeded', proof: 'Proof verified',    via: 'Webhook · Stripe',        when: '50m ago' },
  { action: 'validate_policy',    status: 'Succeeded', proof: 'Proof unavailable', via: 'Runtime', runtimeId: 'rt_prod_01', when: '51m ago' },
  { action: 'purge_cache',        status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Cloudflare', when: '53m ago' },
  { action: 'notify_webhook',     status: 'Succeeded', proof: 'Proof unavailable', recovery: 'Retried 3x',         via: 'Webhook · Stripe',        when: '55m ago' },
  { action: 'provision_tenant',   status: 'Failed',    proof: 'Proof failed',      via: 'Runtime', runtimeId: 'rt_prod_02', when: '57m ago' },
  { action: 'sync_inventory',     status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_02', when: '58m ago' },
  { action: 'charge_customer',    status: 'Running',   proof: 'Proof pending',     via: 'Hosted API · Stripe',     when: '1h ago' },
  { action: 'index_documents',    status: 'Succeeded', proof: 'Proof unavailable', recovery: 'Resumed',            via: 'Runtime', runtimeId: 'rt_prod_02', when: '1h ago' },
  { action: 'deploy_preview',     status: 'Failed',    proof: 'Proof failed',      via: 'Hosted API · Vercel',     when: '1h ago' },
  { action: 'send_receipt',       status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Resend',     when: '1h ago' },
  { action: 'capture_exception',  status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · Sentry',     when: '1h ago' },
  { action: 'flush_cdn',          status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Cloudflare', when: '1h ago' },
  { action: 'create_issue',       status: 'Blocked',   proof: 'Proof unavailable', via: 'Hosted API · Linear',     when: '1h ago' },
  { action: 'refund_charge',      status: 'Succeeded', proof: 'Proof verified',    recovery: 'Retried 1x',         via: 'Hosted API · Stripe',     when: '2h ago' },
  { action: 'export_ledger',      status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_01', when: '2h ago' },
  { action: 'run_migration',      status: 'Failed',    proof: 'Proof failed',      recovery: 'Awaiting review',    via: 'Hosted API · Neon',       when: '2h ago' },
  { action: 'sync_subscriptions', status: 'Succeeded', proof: 'Proof unavailable', via: 'Hosted API · Stripe',     when: '2h ago' },
  { action: 'open_pull_request',  status: 'Running',   proof: 'Proof pending',     via: 'Hosted API · GitHub',     when: '2h ago' },
  { action: 'rotate_keys',        status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_03', when: '2h ago' },
  { action: 'notify_webhook',     status: 'Succeeded', proof: 'Proof unavailable', via: 'Webhook · Stripe',        when: '3h ago' },
  { action: 'reconcile_ledger',   status: 'Succeeded', proof: 'Proof verified',    recovery: 'Resumed',            via: 'Hosted API · Stripe',     when: '3h ago' },
  { action: 'provision_tenant',   status: 'Succeeded', proof: 'Proof unavailable', via: 'Runtime', runtimeId: 'rt_prod_03', when: '3h ago' },
  { action: 'send_email',         status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Resend',     when: '3h ago' },
  { action: 'purge_cache',        status: 'Cancelled', proof: 'Proof unavailable', via: 'Hosted API · Cloudflare', when: '3h ago' },
  { action: 'index_documents',    status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_02', when: '4h ago' },
  { action: 'charge_customer',    status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Stripe',     when: '4h ago' },
  { action: 'validate_policy',    status: 'Failed',    proof: 'Proof failed',      via: 'Runtime', runtimeId: 'rt_prod_01', when: '4h ago' },
  { action: 'deploy_preview',     status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Vercel',     when: '5h ago' },
  { action: 'create_invoice',     status: 'Succeeded', proof: 'Proof unavailable', recovery: 'Retried 2x',         via: 'Webhook · Stripe',        when: '5h ago' },
  { action: 'sync_inventory',     status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_02', when: '5h ago' },
  { action: 'capture_exception',  status: 'Blocked',   proof: 'Proof unavailable', via: 'Hosted API · Sentry',     when: '6h ago' },
  { action: 'export_ledger',      status: 'Succeeded', proof: 'Proof verified',    via: 'Runtime', runtimeId: 'rt_prod_01', when: '6h ago' },
  { action: 'send_receipt',       status: 'Succeeded', proof: 'Proof verified',    via: 'Hosted API · Resend',     when: '6h ago' },
]

// Map a normalized run to its outcome band — mirrors console_helper#run_activity_band.
function bandFor(r: ActRun): Band {
  const status = r.status.toLowerCase()
  const proof = r.proof.toLowerCase()
  const recovery = (r.recovery ?? '').toLowerCase()

  if (/running|awaiting|pending|in.?flight/.test(status)) return 'waiting'
  if (/recovery failed/.test(recovery) || /denied|blocked|cancel/.test(status)) return 'blocked'
  if (/failed|error/.test(status)) return 'failed'
  if (/verified/.test(proof)) return 'verified'
  if (/retr|compensat|resum|replay/.test(recovery)) return 'recovered'
  if (/succeeded|success|completed/.test(status)) return 'completed'
  return 'waiting'
}

interface Point {
  run: ActRun
  band: Band
  col: number // 1-based grid column (col 1 = band labels)
  row: number // 1-based grid row
}

// ── Icon rail — Overview lens active (index 1). ──
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
        {/* Overview is the active lens (index 1). */}
        {icons.map((Icon, i) => <RailIcon key={i} Icon={Icon} active={i === 1} />)}
      </div>
      <div className="relative h-6 w-6 mt-1 mb-1 rounded-full overflow-hidden select-none" style={{ background: 'var(--ic-avatar-bg)' }}>
        <img src="/emeralds.jpg" alt="" width={24} height={24} className="block h-full w-full object-cover" draggable={false} />
        <span className="absolute -bottom-[1px] -right-[1px] h-1 w-1 rounded-full border" style={{ background: 'var(--ic-accent)', borderColor: 'var(--ic-dot-border)' }} />
      </div>
    </nav>
  )
}

function OverviewTopBar() {
  return (
    <div className="ic-topbar">
      <div className="ic-topbar__group">
        <span className="ic-topbar__title">Overview</span>
        <span className="ic-chip">payments-api</span>
        <span className="ic-chip">{ACT_RUNS.length} runs</span>
      </div>
      <div className="ic-topbar__group">
        <span className="ic-btn ic-btn--accent">Create action</span>
        <span className="ic-btn">View all runs</span>
      </div>
    </div>
  )
}

// ── Workspace context panel — port of the right-hand aside in
//    home/index.html.erb (.ic-workspace-panel). Plain column, not a card. ──
function WorkspacePanel() {
  return (
    <aside className="ic-workspace-panel" aria-label="Workspace summary">
      <div className="ic-workspace-panel__id">
        <span className="ic-ws-avatar">
          <img src="/emeralds.jpg" alt="" width={28} height={28} draggable={false} />
        </span>
        <div>
          <div className="ic-workspace-panel__name">payments-api</div>
          <span className="ic-status__pill is-ok">Connected</span>
        </div>
      </div>

      <div className="ic-wsrows">
        <div className="ic-wsrow">
          <span className="ic-wsrow__k">Actions ready</span>
          <span className="ic-wsrow__v">8 / 9</span>
        </div>
        <div className="ic-wsrow">
          <span className="ic-wsrow__k">Last run</span>
          <span className="ic-wsrow__v">just now <span style={{ color: 'var(--ic-text-7)' }}>(charge_customer)</span></span>
        </div>
        <div className="ic-wsrow">
          <span className="ic-wsrow__k">Runtime status</span>
          <span className="ic-wsrow__v">3 healthy / 3</span>
        </div>
        <div className="ic-wsrow">
          <span className="ic-wsrow__k">Igris API</span>
          <span className="ic-wsrow__v">Connected</span>
        </div>
      </div>

      <div className="ic-workspace-panel__actions">
        <span className="ic-btn ic-btn--accent">Create action</span>
        <span className="ic-btn">Connect runtime</span>
        <span className="ic-btn">View runs</span>
      </div>
    </aside>
  )
}

// Hovered dot anchor, relative to the map. Final placement is derived from
// this in an effect (once the tooltip's real size is measurable).
interface TipAnchor {
  run: ActRun
  band: Band
  cx: number   // dot center x, relative to the map
  top: number  // dot top, relative to the map
  h: number    // dot height
}

interface TipPos { left: number; top: number; below: boolean; caret: number }

function RunActivityMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const tipRef = useRef<HTMLDivElement>(null)
  const [tip, setTip] = useState<TipAnchor | null>(null)
  const [pos, setPos] = useState<TipPos | null>(null)

  const points: Point[] = ACT_RUNS.slice(0, 80).reverse().map((run, i) => {
    const band = bandFor(run)
    const row = BANDS.findIndex((b) => b.key === band) + 1
    return { run, band, col: i + 2, row: row || BANDS.length }
  })
  const n = points.length
  const counts = points.reduce<Record<Band, number>>((acc, p) => {
    acc[p.band] = (acc[p.band] ?? 0) + 1
    return acc
  }, { verified: 0, completed: 0, recovered: 0, waiting: 0, blocked: 0, failed: 0 })

  // Record the hovered dot's anchor (relative to the map). Placement happens in
  // the effect below, after the tooltip content renders.
  function showTip(e: React.MouseEvent<HTMLAnchorElement> | React.FocusEvent<HTMLAnchorElement>, p: Point) {
    const map = mapRef.current
    if (!map) return
    const r = e.currentTarget.getBoundingClientRect()
    const m = map.getBoundingClientRect()
    setTip({ run: p.run, band: p.band, cx: r.left - m.left + r.width / 2, top: r.top - m.top, h: r.height })
  }
  function hideTip() { setTip(null); setPos(null) }

  // Position the tooltip once its content is in the DOM, so offsetWidth/Height
  // are accurate (fixes first-hover mispositioning) and clamp it to the map.
  useEffect(() => {
    if (!tip) { setPos(null); return }
    const map = mapRef.current
    const tipEl = tipRef.current
    if (!map || !tipEl) return
    const m = map.getBoundingClientRect()
    const tw = tipEl.offsetWidth
    const th = tipEl.offsetHeight
    let left = tip.cx - tw / 2
    left = Math.max(6, Math.min(left, m.width - tw - 6))
    let top = tip.top - th - 9
    const below = top < 4
    if (below) top = tip.top + tip.h + 9
    const caret = Math.max(10, Math.min(tip.cx - left, tw - 10))
    setPos({ left, top, below, caret })
  }, [tip])

  return (
    <section className="ic-runmap ic-runmap--flush" aria-label="Run Activity Map" ref={mapRef}>
      <div className="ic-runmap__head">
        <div className="ic-runmap__heading">
          <span className="ic-runmap__title">Run Activity Map</span>
          <span className="ic-runmap__sub">Recent run events grouped by outcome. Each dot is one run; hover a dot to open its evidence.</span>
        </div>
        <span className="ic-runmap__viewall">View all</span>
      </div>

      <div className="ic-runmap__legend" aria-label="Run outcome legend">
        {BANDS.map((b) => (
          <span key={b.key} className="ic-runmap__legend-item">
            <span className={`ic-runmap__legend-dot ic-runmap__dot--${b.key}`} aria-hidden="true" />
            <span>{b.label}</span>
            <span className="ic-runmap__legend-count">{counts[b.key]}</span>
          </span>
        ))}
      </div>

      <div className="ic-runmap__time-head">
        <span>Outcome</span>
        <span>Older runs</span>
        <span>Newer runs</span>
      </div>
      <div className="ic-runmap__scroll">
        <div
          className="ic-runmap__grid"
          style={{ gridTemplateColumns: `minmax(82px, max-content) repeat(${n}, minmax(0, 1fr))` }}
        >
          {BANDS.map((b, ri) => (
            <React.Fragment key={b.key}>
              <span className="ic-runmap__band" style={{ gridColumn: 1, gridRow: ri + 1 }}>
                {b.label}
                <span className="ic-runmap__band-count">{counts[b.key]}</span>
              </span>
              <i className="ic-runmap__lane" style={{ gridColumn: '2 / -1', gridRow: ri + 1 }} aria-hidden="true" />
            </React.Fragment>
          ))}
          {points.map((p, i) => (
            <a
              key={i}
              className={`ic-runmap__dot ic-runmap__dot--${p.band}`}
              style={{ gridColumn: p.col, gridRow: p.row }}
              aria-label={`Action ${p.run.action}, ${BAND_LABEL(p.band)}, ${p.run.proof}, ${p.run.when}`}
              onMouseEnter={(e) => showTip(e, p)}
              onMouseLeave={hideTip}
              onFocus={(e) => showTip(e, p)}
              onBlur={hideTip}
              tabIndex={0}
            />
          ))}
        </div>
      </div>

      {/* Floating evidence tooltip — populated from the hovered dot. */}
      <div
        ref={tipRef}
        className={'ic-runmap__tip' + (pos ? ' is-on' : '') + (pos?.below ? ' ic-runmap__tip--below' : '')}
        role="tooltip"
        aria-hidden={pos ? 'false' : 'true'}
        style={pos ? { left: pos.left, top: pos.top, ['--tip-caret' as string]: `${pos.caret}px` } : undefined}
      >
        {tip && (
          <>
            <div className="ic-runmap__tip-head">
              <span className={`ic-runmap__tip-dot ic-runmap__dot--${tip.band}`} />
              <span className="ic-runmap__tip-action">{tip.run.action}</span>
              <span className="ic-runmap__tip-status">{BAND_LABEL(tip.band)}</span>
            </div>
            <dl className="ic-runmap__tip-meta">
              <div className="ic-runmap__tip-row"><dt>Routed</dt><dd>{tip.run.via}</dd></div>
              <div className="ic-runmap__tip-row"><dt>Proof</dt><dd>{tip.run.proof}</dd></div>
              <div className="ic-runmap__tip-row"><dt>When</dt><dd>{tip.run.when}</dd></div>
            </dl>
            <div className="ic-runmap__tip-hint">Click to open run evidence</div>
          </>
        )}
      </div>

      <div className="ic-runmap__axis">
        <span>{points[0]?.run.when}</span>
        <span className="ic-runmap__axis-mid">Showing latest {n} run{n !== 1 ? 's' : ''}</span>
        <span>{points[n - 1]?.run.when}</span>
      </div>
    </section>
  )
}

// Run Activity Map on its own — the framed surface + styles, but without the
// icon rail, topbar, or workspace side panel. Used in the landing copy section.
export function RunActivityMapConsole() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  // Render only after mount so the resolved theme is known. This surface isn't
  // behind a scroll-reveal gate like the showcase, so without this it would
  // paint with the default ("dark") theme before next-themes resolves.
  if (!mounted) return <div aria-hidden style={{ height: 360 }} />
  const isLight = resolvedTheme === 'light'
  // Same two-layer frame wrapper as the product-section consoles, but the
  // inner igris-console element generates no box (`display: contents`) — so the
  // only card inside the frame is the map itself (no solid dark screen layer).
  return (
    <div className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
      <div className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
        <div
          className={'igris-console ' + (isLight ? 'igris-console--light ' : '')}
          style={{ display: 'contents', fontFamily: SANS, color: 'var(--ic-text)' }}
        >
          <OverviewConsoleStyles />
          <RunActivityMap />
        </div>
      </div>
    </div>
  )
}

export default function OverviewConsole() {
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
          <OverviewConsoleStyles />
          <div className="grid" style={{ gridTemplateColumns: '40px 1fr', height: 640 }}>
            <IconRail />
            <div className="flex flex-col min-h-0">
              <OverviewTopBar />
              <div className="ic-scroll flex-1 overflow-y-auto px-5 py-4 min-h-0">
                <div className="ic-workspace-layout">
                  <div className="ic-workspace-feed">
                    <RunActivityMap />
                  </div>
                  <WorkspacePanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function OverviewConsoleStyles() {
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
        --ic-menu-border: rgba(255,255,255,0.1);
        --ic-overlay-1: rgba(255,255,255,0.02); --ic-overlay-2: rgba(255,255,255,0.025);
        --ic-overlay-3: rgba(255,255,255,0.03); --ic-overlay-4: rgba(255,255,255,0.045);
        --ic-overlay-5: rgba(255,255,255,0.06); --ic-overlay-bg: rgba(255,255,255,0.015);
        --ic-rail-active: #d3d2c8; --ic-dot-border: #070707;
        --ic-accent: #0f835c; --ic-emerald: #0f835c; --ic-amber: #cf9a45; --ic-rose: #9d4b57;
        --ic-mono: ${MONO};
        --ic-rm-verified: #4f9bd9; --ic-rm-completed: #5cb85c; --ic-rm-recovered: #9fce6a;
        --ic-rm-waiting: #8f8a7e; --ic-rm-blocked: #e89a44; --ic-rm-failed: #d6543f;
      }
      .igris-console.igris-console--light {
        color-scheme: light;
        --ic-bg: #f7f7f5; --ic-bg-rail: #f2f1ee;
        --ic-text: #1b1912; --ic-text-bright: #000000; --ic-text-2: #2a2820;
        --ic-text-3: #3a3830; --ic-text-4: #3a3830; --ic-text-5: #4a4740;
        --ic-text-6: #5a574e; --ic-text-7: #6e6b62; --ic-text-8: #84817a; --ic-text-9: #b0ada5;
        --ic-avatar-bg: #d8d5cc;
        --ic-border: rgba(0,0,0,0.08); --ic-border-soft: rgba(0,0,0,0.06);
        --ic-menu-border: rgba(0,0,0,0.12);
        --ic-overlay-1: rgba(0,0,0,0.025); --ic-overlay-2: rgba(0,0,0,0.03);
        --ic-overlay-3: rgba(0,0,0,0.035); --ic-overlay-4: rgba(0,0,0,0.05);
        --ic-overlay-5: rgba(0,0,0,0.07); --ic-overlay-bg: rgba(0,0,0,0.02);
        --ic-rail-active: #1b1912; --ic-dot-border: #f2f1ee;
        --ic-accent: #047857; --ic-emerald: #047857; --ic-amber: #b45309; --ic-rose: #be123c;
        --ic-mono: ${MONO};
        --ic-rm-verified: #3f8fd0; --ic-rm-completed: #5cb85c; --ic-rm-recovered: #b6df7e;
        --ic-rm-waiting: #b7b1a4; --ic-rm-blocked: #f4a64c; --ic-rm-failed: #e0503a;
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
      .igris-console .ic-btn {
        display: inline-flex; align-items: center; gap: 6px; height: 24px; padding: 0 8px;
        border-radius: 6px; font-size: 11px; color: var(--ic-text-2);
        background: var(--ic-overlay-3); border: 1px solid var(--ic-border); cursor: pointer;
      }
      .igris-console .ic-btn--accent { background: rgba(15,131,92,0.14); color: var(--ic-emerald); border-color: rgba(15,131,92,0.28); }
      .igris-console--light .ic-btn--accent { background: rgba(4,120,87,0.12); color: #047857; border-color: rgba(4,120,87,0.25); }

      /* ── Workspace layout — feed + context column (home/index.html.erb).
            Capped + centred so the map content doesn't stretch full-width. ── */
      .igris-console .ic-workspace-layout {
        display: grid; grid-template-columns: minmax(0, 1fr) 220px; gap: 28px; align-items: start;
        width: 100%; margin: 0 auto;
      }
      @media (max-width: 820px) { .igris-console .ic-workspace-layout { grid-template-columns: 1fr; gap: 20px; } }
      .igris-console .ic-workspace-feed { min-width: 0; }

      /* Workspace context panel (right-hand aside) */
      .igris-console .ic-workspace-panel { min-width: 0; }
      .igris-console .ic-workspace-panel__id { display: flex; align-items: center; gap: 10px; margin-top: 2px; }
      .igris-console .ic-ws-avatar { width: 28px; height: 28px; border-radius: 999px; flex-shrink: 0; overflow: hidden; }
      .igris-console .ic-ws-avatar > img { width: 28px; height: 28px; border-radius: 999px; object-fit: cover; display: block; user-select: none; }
      .igris-console .ic-workspace-panel__name { font-size: 14px; font-weight: 500; color: var(--ic-text-bright); letter-spacing: -0.01em; margin-bottom: 4px; }
      .igris-console .ic-status__pill {
        display: inline-flex; align-items: center; font-size: 11px; padding: 1px 8px; border-radius: 999px;
        border: 1px solid var(--ic-border); background: var(--ic-overlay-2); color: var(--ic-text-3); font-weight: 400;
      }
      .igris-console .ic-status__pill.is-ok { color: var(--ic-emerald); border-color: rgba(4,120,87,0.25); background: rgba(4,120,87,0.10); }
      .igris-console .ic-status__pill.is-warn { color: var(--ic-amber); border-color: rgba(180,83,9,0.25); background: rgba(180,83,9,0.08); }
      .igris-console .ic-status__pill.is-bad { color: var(--ic-rose); border-color: rgba(190,18,60,0.25); background: rgba(190,18,60,0.08); }
      .igris-console .ic-wsrows { margin: 16px 0 16px; border-top: 1px dashed var(--ic-border-soft); }
      .igris-console .ic-wsrow {
        display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 0;
        font-size: 12px; border-bottom: 1px dashed var(--ic-border-soft);
      }
      .igris-console .ic-wsrow__k { color: var(--ic-text-6); }
      .igris-console .ic-wsrow__v { color: var(--ic-text-2); text-align: right; }
      .igris-console .ic-workspace-panel__actions { display: flex; flex-wrap: wrap; gap: 6px; }
      .igris-console .ic-workspace-panel__actions .ic-btn { height: 24px; padding: 0 8px; font-size: 10.5px; gap: 5px; border-radius: 5px; }

      /* ── Run Activity Map (ported from application.css) ── */
      .igris-console .ic-runmap {
        position: relative; margin: 14px 12px 6px; padding: 16px 18px 16px;
        background: var(--ic-overlay-1); border: 1px solid var(--ic-border); border-radius: 10px;
      }
      /* Map-only surface: use the same solid console background as the product
         section design (var(--ic-bg)) instead of the translucent overlay, so it
         doesn't look darker/grey in light mode. */
      .igris-console .ic-runmap--flush { margin: 0; background: var(--ic-bg); }
      .igris-console .ic-runmap__head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
      .igris-console .ic-runmap__title { display: block; font-size: 13px; font-weight: 600; color: var(--ic-text); letter-spacing: .01em; }
      .igris-console .ic-runmap__sub { display: block; margin-top: 3px; font-size: 11.5px; color: var(--ic-text-5); max-width: 64ch; line-height: 1.5; }
      .igris-console .ic-runmap__viewall { flex: none; white-space: nowrap; font-size: 11.5px; color: var(--ic-text-4); text-decoration: none; cursor: pointer; }
      .igris-console .ic-runmap__viewall:hover { color: var(--ic-text-bright); text-decoration: underline; }
      .igris-console .ic-runmap__legend { display: flex; flex-wrap: wrap; gap: 5px 10px; margin: 0 0 12px; }
      .igris-console .ic-runmap__legend-item {
        display: inline-flex; align-items: center; gap: 6px; padding: 2px 8px; font-size: 10.5px;
        color: var(--ic-text-5); white-space: nowrap; background: var(--ic-overlay-3);
        border-radius: 999px; box-shadow: inset 0 0 0 1px var(--ic-border-soft);
      }
      .igris-console .ic-runmap__legend-dot { width: 7px; height: 7px; border-radius: 999px; display: inline-block; }
      .igris-console .ic-runmap__legend-count { font-family: var(--ic-mono); color: var(--ic-text-8); }
      .igris-console .ic-runmap__time-head {
        display: grid; grid-template-columns: minmax(82px, max-content) 1fr auto; gap: 10px;
        margin-bottom: 10px; font-size: 9.5px; color: var(--ic-text-7); letter-spacing: .06em;
      }
      .igris-console .ic-runmap__scroll { overflow-x: hidden; padding-bottom: 2px; flex: 1; min-width: 0; }
      .igris-console .ic-runmap__grid { display: grid; gap: 6px 3px; align-items: center; width: 100%; min-width: 0; }
      .igris-console .ic-runmap__band {
        display: inline-flex; align-items: center; gap: 6px; justify-self: end; padding-right: 8px;
        font-size: 10px; color: var(--ic-text-6); white-space: nowrap;
      }
      .igris-console .ic-runmap__band-count {
        min-width: 15px; text-align: center; font-family: var(--ic-mono); font-size: 9px;
        color: var(--ic-text-8); background: var(--ic-overlay-2); border-radius: 999px; padding: 0 4px;
      }
      .igris-console .ic-runmap__lane { align-self: center; height: 0; border-top: 1px dashed var(--ic-border-soft); opacity: .8; }
      .igris-console .ic-runmap__dot {
        align-self: center; justify-self: center; width: 7px; height: 7px; border-radius: 999px;
        display: block; opacity: .9; transition: transform .12s ease, opacity .12s ease; cursor: pointer;
      }
      .igris-console .ic-runmap__dot:hover { transform: scale(1.65); opacity: 1; z-index: 2; }
      .igris-console .ic-runmap__dot:focus-visible { outline: 2px solid var(--ic-accent); outline-offset: 2px; z-index: 2; }

      .igris-console .ic-runmap__dot--verified  { background: var(--ic-rm-verified); }
      .igris-console .ic-runmap__dot--completed { background: var(--ic-rm-completed); }
      .igris-console .ic-runmap__dot--recovered { background: var(--ic-rm-recovered); }
      .igris-console .ic-runmap__dot--waiting   { background: var(--ic-rm-waiting); }
      .igris-console .ic-runmap__dot--blocked   { background: var(--ic-rm-blocked); }
      .igris-console .ic-runmap__dot--failed    { background: var(--ic-rm-failed); }

      /* Tooltip */
      .igris-console .ic-runmap__tip {
        --tip-caret: 50%; position: absolute; z-index: 20; left: 0; top: 0; width: max-content;
        max-width: 248px; padding: 9px 11px 8px; border-radius: 9px; color: var(--ic-text-2);
        background: var(--ic-bg); border: 1px solid var(--ic-menu-border);
        box-shadow: 0 4px 12px rgba(0,0,0,0.14), 0 1px 2px rgba(0,0,0,0.1);
        pointer-events: none; opacity: 0; transform: translateY(3px) scale(0.98);
        transform-origin: bottom center; transition: opacity .13s ease, transform .13s ease;
      }
      .igris-console .ic-runmap__tip.is-on { opacity: 1; transform: translateY(0) scale(1); }
      .igris-console .ic-runmap__tip--below { transform-origin: top center; }
      .igris-console .ic-runmap__tip-head { display: flex; align-items: center; gap: 7px; margin-bottom: 7px; }
      .igris-console .ic-runmap__tip-dot { flex: none; width: 7px; height: 7px; border-radius: 999px; background: var(--ic-text-6); }
      .igris-console .ic-runmap__tip-action {
        font-size: 12px; font-weight: 600; letter-spacing: -0.01em; color: var(--ic-text);
        font-family: var(--ic-mono); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .igris-console .ic-runmap__tip-status {
        flex: none; margin-left: auto; font-size: 9.5px; font-weight: 600; text-transform: uppercase;
        letter-spacing: 0.04em; color: var(--ic-text-5); padding: 1px 6px; border-radius: 999px;
        background: var(--ic-overlay-4); border: 1px solid var(--ic-border-soft);
      }
      .igris-console .ic-runmap__tip-meta { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0; }
      .igris-console .ic-runmap__tip-row { display: contents; }
      .igris-console .ic-runmap__tip-row dt { font-size: 10.5px; color: var(--ic-text-6); }
      .igris-console .ic-runmap__tip-row dd {
        margin: 0; font-size: 10.5px; color: var(--ic-text-3); text-align: right;
        font-variant-numeric: tabular-nums; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
      }
      .igris-console .ic-runmap__tip-hint {
        margin-top: 7px; padding-top: 6px; border-top: 1px solid var(--ic-border-soft);
        font-size: 10px; color: var(--ic-text-6);
      }
      .igris-console .ic-runmap__tip::after {
        content: ""; position: absolute; left: var(--tip-caret); margin-left: -5px; width: 0; height: 0;
        border: 5px solid transparent; top: 100%; border-top-color: var(--ic-bg);
        filter: drop-shadow(0 1px 0 var(--ic-menu-border));
      }
      .igris-console .ic-runmap__tip--below::after {
        top: auto; bottom: 100%; border-top-color: transparent; border-bottom-color: var(--ic-bg);
      }

      .igris-console .ic-runmap__axis {
        display: flex; justify-content: space-between; align-items: center; margin-top: 12px;
        font-size: 10.5px; color: var(--ic-text-6);
      }
      .igris-console .ic-runmap__axis-mid { color: var(--ic-text-5); }
    `}</style>
  )
}
