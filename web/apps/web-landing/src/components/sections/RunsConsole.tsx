'use client'

// ──────────────────────────────────────────────────────────────────
// RunsConsole — the product section showcase.
//
// A 1:1 port of the rails-console **Runs page** (runs/index.html.erb +
// _history.html.erb) rendered inside the same framed console chrome as the
// hero ExecutionPreview: icon rail + topbar + filter/search bar + the run
// list. Each run row carries the real route chips — route-type icon (globe
// for Hosted API, link for Webhook, box for Runtime) plus the routed brand
// mark (Stripe, Sentry, Vercel, GitHub, Linear, Cloudflare, Neon, Resend) —
// exactly like console_helper#route_chips. Not an invented mock: same markup,
// same --ic-* tokens, same row geometry as the real console.
// ──────────────────────────────────────────────────────────────────

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import {
  Home, LayoutDashboard, ListChecks, Zap, Box, Settings, type LucideIcon,
} from 'lucide-react'
import ProductConsoleShell, { PRODUCT_SHOWCASE_URLS } from '../ui/ProductConsoleShell'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

// ── Brand marks — inlined Simple-Icons SVGs (the same files in
//    rails-console/public/logos). Colored brands keep their hex fill;
//    monochrome marks use currentColor so they adapt to light/dark. ──
type RouteKind = 'hosted' | 'webhook' | 'runtime'

interface Brand {
  label: string
  path: string
  fill: string // a hex, or 'currentColor'
}

const BRANDS: Record<string, Brand> = {
  stripe: { label: 'Stripe', fill: '#635BFF', path: 'M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z' },
  resend: { label: 'Resend', fill: 'currentColor', path: 'M14.679 0c4.648 0 7.413 2.765 7.413 6.434s-2.765 6.434-7.413 6.434H12.33L24 24h-8.245l-8.88-8.44c-.636-.588-.93-1.273-.93-1.86 0-.831.587-1.565 1.713-1.883l4.574-1.224c1.737-.465 2.936-1.81 2.936-3.572 0-2.153-1.761-3.4-3.939-3.4H0V0z' },
  github: { label: 'GitHub', fill: 'currentColor', path: 'M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12' },
  linear: { label: 'Linear', fill: '#5E6AD2', path: 'M2.886 4.18A11.982 11.982 0 0 1 11.99 0C18.624 0 24 5.376 24 12.009c0 3.64-1.62 6.903-4.18 9.105L2.887 4.18ZM1.817 5.626l16.556 16.556c-.524.33-1.075.62-1.65.866L.951 7.277c.247-.575.537-1.126.866-1.65ZM.322 9.163l14.515 14.515c-.71.172-1.443.282-2.195.322L0 11.358a12 12 0 0 1 .322-2.195Zm-.17 4.862 9.823 9.824a12.02 12.02 0 0 1-9.824-9.824Z' },
  vercel: { label: 'Vercel', fill: 'currentColor', path: 'm12 1.608 12 20.784H0Z' },
  cloudflare: { label: 'Cloudflare', fill: '#F38020', path: 'M16.5088 16.8447c.1475-.5068.0908-.9707-.1553-1.3154-.2246-.3164-.6045-.499-1.0615-.5205l-8.6592-.1123a.1559.1559 0 0 1-.1333-.0713c-.0283-.042-.0351-.0986-.021-.1553.0278-.084.1123-.1484.2036-.1562l8.7359-.1123c1.0351-.0489 2.1601-.8868 2.5537-1.9136l.499-1.3013c.0215-.0561.0293-.1128.0147-.168-.5625-2.5463-2.835-4.4453-5.5499-4.4453-2.5039 0-4.6284 1.6177-5.3876 3.8614-.4927-.3658-1.1187-.5625-1.794-.499-1.2026.119-2.1665 1.083-2.2861 2.2856-.0283.31-.0069.6128.0635.894C1.5683 13.171 0 14.7754 0 16.752c0 .1748.0142.3515.0352.5273.0141.083.0844.1475.1689.1475h15.9814c.0909 0 .1758-.0645.2032-.1553l.12-.4268zm2.7568-5.5634c-.0771 0-.1611 0-.2383.0112-.0566 0-.1054.0415-.127.0976l-.3378 1.1744c-.1475.5068-.0918.9707.1543 1.3164.2256.3164.6055.498 1.0625.5195l1.8437.1133c.0557 0 .1055.0263.1329.0703.0283.043.0351.1074.0214.1562-.0283.084-.1132.1485-.204.1553l-1.921.1123c-1.041.0488-2.1582.8867-2.5527 1.914l-.1406.3585c-.0283.0713.0215.1416.0986.1416h6.5977c.0771 0 .1474-.0489.169-.126.1122-.4082.1757-.837.1757-1.2803 0-2.6025-2.125-4.727-4.7344-4.727' },
  neon: { label: 'Neon', fill: '#34D59A', path: 'M24 0V24l-9.365-8.045V24H0V0ZM2.942 21.087h8.751V9.563l9.365 8.204V2.919L2.942 2.914Z' },
  sentry: { label: 'Sentry', fill: '#7553FF', path: 'M13.91 2.505c-.873-1.448-2.972-1.448-3.844 0L6.904 7.92a15.478 15.478 0 0 1 8.53 12.811h-2.221A13.301 13.301 0 0 0 5.784 9.814l-2.926 5.06a7.65 7.65 0 0 1 4.435 5.848H2.194a.365.365 0 0 1-.298-.534l1.413-2.402a5.16 5.16 0 0 0-1.614-.913L.296 19.275a2.182 2.182 0 0 0 .812 2.999 2.24 2.24 0 0 0 1.086.288h6.983a9.322 9.322 0 0 0-3.845-8.318l1.11-1.922a11.47 11.47 0 0 1 4.95 10.24h5.915a17.242 17.242 0 0 0-7.885-15.28l2.244-3.845a.37.37 0 0 1 .504-.13c.255.14 9.75 16.708 9.928 16.9a.365.365 0 0 1-.327.543h-2.287c.029.612.029 1.223 0 1.831h2.297a2.206 2.206 0 0 0 1.922-3.31z' },
}

function BrandMark({ slug }: { slug: string }) {
  const b = BRANDS[slug]
  if (!b) return null
  return (
    <svg viewBox="0 0 24 24" fill={b.fill} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d={b.path} />
    </svg>
  )
}

// Route-type icon (lucide globe/link/box) + its accent color — mirrors
// console_helper#route_icon / #route_icon_color.
const ROUTE_META: Record<RouteKind, { label: string; color: string; icon: React.ReactNode }> = {
  hosted: {
    label: 'Hosted API', color: 'rgb(192,132,252)',
    icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  },
  webhook: {
    label: 'Webhook', color: 'rgb(96,165,250)',
    icon: <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></>,
  },
  runtime: {
    label: 'Runtime', color: 'rgb(59,130,246)',
    icon: <><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></>,
  },
}

// route_chips: token 0 = route type (icon chip), token 1 = brand mark or
// (for a runtime) the runtime id as a mono chip with no logo.
function RouteChips({ kind, brand, runtimeId }: { kind: RouteKind; brand?: string; runtimeId?: string }) {
  const meta = ROUTE_META[kind]
  return (
    <span className="ic-chips">
      <span className="ic-chip ic-chip--sm">
        <span className="ic-chip__icon" style={{ color: meta.color }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {meta.icon}
          </svg>
        </span>
        {meta.label}
      </span>
      {brand && BRANDS[brand] && (
        <span className="ic-chip ic-chip--sm">
          <span className="ic-chip__logo"><BrandMark slug={brand} /></span>
          {BRANDS[brand].label}
        </span>
      )}
      {runtimeId && (
        <span className="ic-chip ic-chip--sm mono">{runtimeId}</span>
      )}
    </span>
  )
}

// ── Run data — mirrors igris/fixtures.rb runs, with rich brand variety so
//    every routed provider mark shows up in the list. ──
type Tone = 'running' | 'failed' | 'blocked' | 'ok'

interface Run {
  action: string
  id: string
  tone: Tone
  status: string
  kind: RouteKind
  brand?: string
  runtimeId?: string
  proof: string
  recovery?: string
  dur: string
  when: string
}

const RUNS: Run[] = [
  { action: 'charge_customer',   id: 'run_01HGJ9N7P4D', tone: 'running', status: 'Running',   kind: 'hosted',  brand: 'stripe',     proof: 'Proof pending',     dur: '—',      when: 'just now' },
  { action: 'send_email',        id: 'run_01HGJ8K2Z9F', tone: 'ok',      status: 'Succeeded', kind: 'hosted',  brand: 'resend',     proof: 'Proof verified',                       dur: '312ms',  when: '4m ago' },
  { action: 'deploy_preview',    id: 'rdm_01',          tone: 'ok',      status: 'Succeeded', kind: 'hosted',  brand: 'vercel',     proof: 'Proof verified',                       dur: '441ms',  when: '8m ago' },
  { action: 'capture_exception', id: 'rdm_02',          tone: 'ok',      status: 'Succeeded', kind: 'hosted',  brand: 'sentry',     proof: 'Proof unavailable',                    dur: '87ms',   when: '12m ago' },
  { action: 'create_issue',      id: 'rdm_03',          tone: 'running', status: 'Running',   kind: 'hosted',  brand: 'linear',     proof: 'Proof pending',     dur: '—',      when: '15m ago' },
  { action: 'validate_policy',   id: 'rdm_04',          tone: 'ok',      status: 'Succeeded', kind: 'runtime', runtimeId: 'rt_prod_01', proof: 'Proof unavailable', recovery: 'Retried 2x',    dur: '1230ms', when: '22m ago' },
  { action: 'run_migration',     id: 'rdm_05',          tone: 'failed',  status: 'Failed',    kind: 'hosted',  brand: 'neon',       proof: 'Proof failed',                         dur: '5400ms', when: '28m ago' },
  { action: 'purge_cache',       id: 'rdm_06',          tone: 'blocked', status: 'Cancelled', kind: 'hosted',  brand: 'cloudflare', proof: 'Proof unavailable',                    dur: '—',      when: '33m ago' },
  { action: 'create_invoice',    id: 'run_01HGJ7Q4X1A', tone: 'ok',      status: 'Succeeded', kind: 'webhook', brand: 'stripe',     proof: 'Proof verified',    recovery: 'Retried 1x',    dur: '988ms',  when: '38m ago' },
  { action: 'open_pull_request', id: 'rdm_08',          tone: 'ok',      status: 'Succeeded', kind: 'hosted',  brand: 'github',     proof: 'Proof unavailable',                    dur: '356ms',  when: '47m ago' },
  { action: 'export_ledger',     id: 'run_01HGJ3R6T7E', tone: 'ok',      status: 'Succeeded', kind: 'runtime', runtimeId: 'rt_prod_01', proof: 'Proof verified',                   dur: '1740ms', when: '52m ago' },
  { action: 'refund_charge',     id: 'run_01HGJ5W0M3B', tone: 'failed',  status: 'Failed',    kind: 'hosted',  brand: 'stripe',     proof: 'Proof failed',      recovery: 'Awaiting review', dur: '4120ms', when: '2h ago' },
]

const STATUS_CLASS: Record<Tone, string> = {
  running: 'running', failed: 'failed', blocked: 'warn', ok: 'ok',
}

function searchHay(r: Run): string {
  return [r.action, r.id, ROUTE_META[r.kind].label, r.brand ? BRANDS[r.brand]?.label : '', r.runtimeId, r.status]
    .filter(Boolean).join(' ').toLowerCase()
}

// ── Icon rail — port of IconRail() (Runs lens active). ──
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
  const logoSrc = resolvedTheme === 'light' ? '/inertia.png' : '/inertiadm.png'
  const icons = [Home, LayoutDashboard, ListChecks, Zap, Box, Settings]
  return (
    <nav className="flex flex-col items-center py-2 border-r" style={{ background: 'var(--landing-surface)', borderColor: 'var(--ic-border)' }}>
      <div className="flex items-center justify-center h-9 w-9 mb-1">
        <img src={logoSrc} alt="" width={15} height={15} className="block select-none" draggable={false} />
      </div>
      <div className="flex flex-col items-center flex-1 gap-0.5">
        {/* Runs is the active lens (index 3). */}
        {icons.map((Icon, i) => <RailIcon key={i} Icon={Icon} active={i === 3} />)}
      </div>
      <div className="relative h-6 w-6 mt-1 mb-1 rounded-full overflow-hidden select-none" style={{ background: 'var(--ic-avatar-bg)' }}>
        <img src="/emeralds.jpg" alt="" width={24} height={24} className="block h-full w-full object-cover" draggable={false} />
        <span className="absolute -bottom-[1px] -right-[1px] h-1 w-1 rounded-full border" style={{ background: 'var(--ic-accent)', borderColor: 'var(--ic-dot-border)' }} />
      </div>
    </nav>
  )
}

// ── Topbar (runs/index.html.erb) ──
function RunsTopBar({ count }: { count: number }) {
  return (
    <div className="ic-topbar">
      <div className="ic-topbar__group">
        <span className="ic-topbar__title">Runs</span>
        <span className="ic-chip">payments-api</span>
        <span className="ic-chip">{count} runs</span>
      </div>
      <div className="ic-topbar__group">
        <span className="ic-btn ic-btn--accent">Create action</span>
        <span className="ic-btn">Open Actions</span>
      </div>
    </div>
  )
}

// ── Filter + search bar (ic-filters + ic-dropdown + ic-runsearch) ──
function FilterButton({ label }: { label: string }) {
  return (
    <span className="ic-dropdown__btn">
      <span className="ic-dropdown__value">{label}</span>
      <svg className="ic-dropdown__chev" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  )
}

function RunsFilters({ query, setQuery }: { query: string; setQuery: (v: string) => void }) {
  return (
    <div className="ic-filters">
      <FilterButton label="All statuses" />
      <FilterButton label="All routes" />
      <FilterButton label="All time" />
      <span className="ic-runsearch">
        <svg className="ic-runsearch__ico" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search runs"
          aria-label="Search runs"
          className="ic-input ic-runsearch__input"
        />
      </span>
    </div>
  )
}

// ── One run row (runs/_history.html.erb .ic-run-row) ──
function RunRowView({ run, index = 0 }: { run: Run; index?: number }) {
  const tcls = STATUS_CLASS[run.tone]
  return (
    <div className="ic-run-row" style={{ animationDelay: `${index * 140}ms` }}>
      <span className="ic-run-row__open">
        <span className="ic-run-row__title">{run.action}</span>
        <span className="ic-run-row__id-group">
          <span className="ic-run-row__id-row">
            <span className={`ic-run-row__dot ic-run-row__dot--${tcls} ${run.tone === 'running' ? 'ic-live-dot' : ''}`} />
            <span className="ic-run-row__id mono">{run.id}</span>
          </span>
          <span className={`ic-run-row__status ic-run-row__status--${tcls}`}>{run.status}</span>
        </span>
        <span className="ic-run-row__sub">
          <RouteChips kind={run.kind} brand={run.brand} runtimeId={run.runtimeId} />
        </span>
        <span className="ic-run-row__sub">
          {run.proof}
          {run.recovery && run.recovery !== 'Not needed' && (
            <span className="ic-chip ic-chip--sm">{run.recovery}</span>
          )}
        </span>
        <span className="ic-run-row__time">
          {run.dur}
          <br />
          <span style={{ color: 'var(--ic-text-7)' }}>{run.when}</span>
        </span>
      </span>
    </div>
  )
}

function RunsPage() {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const rows = q ? RUNS.filter((r) => searchHay(r).includes(q)) : RUNS
  return (
    <div className="flex flex-col min-h-0">
      <RunsTopBar count={RUNS.length} />
      <RunsFilters query={query} setQuery={setQuery} />
      <div className="ic-scroll flex-1 overflow-y-auto px-5 py-3 min-h-0">
        {rows.length > 0 ? (
          <div className="ic-runs-list">
            {rows.map((r, i) => <RunRowView key={r.id} run={r} index={i} />)}
          </div>
        ) : (
          <div className="ic-runs-empty">
            <div className="ic-runs-empty__title">No runs match your search</div>
            <p className="ic-runs-empty__sub">Nothing in the loaded window matches “{query}”.</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function RunsConsole({ url = PRODUCT_SHOWCASE_URLS.prove }: { url?: string }) {
  const { resolvedTheme } = useTheme()
  const isLight = resolvedTheme === 'light'
  return (
    <ProductConsoleShell url={url}>
      <div
        className={
          'igris-console ' + (isLight ? 'igris-console--light ' : '') +
          'relative overflow-hidden'
        }
        style={{ fontFamily: SANS, background: 'var(--landing-surface)', color: 'var(--ic-text)' }}
      >
        <RunsConsoleStyles />
        <div className="grid" style={{ gridTemplateColumns: '40px 1fr', height: 640 }}>
          <IconRail />
          <RunsPage />
        </div>
      </div>
    </ProductConsoleShell>
  )
}

function RunsConsoleStyles() {
  return (
    <style>{`
      .igris-console {
        color-scheme: dark;
        --ic-bg: #161515; --ic-bg-rail: #161515;
        --ic-text: #b0ada5; --ic-text-bright: #d3d2c8; --ic-text-2: #a8a89e;
        --ic-text-3: #9a978f; --ic-text-4: #8a8a82; --ic-text-5: #7a7a72;
        --ic-text-6: #6a6a62; --ic-text-7: #5a5a52; --ic-text-8: #4a4a42; --ic-text-9: #3a3a32;
        --ic-avatar-bg: #2a2a25;
        --ic-border: rgba(255,255,255,0.05); --ic-border-soft: rgba(255,255,255,0.04);
        --ic-overlay-1: rgba(255,255,255,0.02); --ic-overlay-2: rgba(255,255,255,0.025);
        --ic-overlay-3: rgba(255,255,255,0.03); --ic-overlay-4: rgba(255,255,255,0.045);
        --ic-overlay-5: rgba(255,255,255,0.06); --ic-overlay-bg: rgba(255,255,255,0.015);
        --ic-rail-active: #d3d2c8; --ic-dot-border: #161515;
        --ic-accent: #0f835c; --ic-emerald: #0f835c; --ic-amber: #cf9a45; --ic-rose: #9d4b57;
        --ic-mono: ${MONO};
      }
      .igris-console.igris-console--light {
        color-scheme: light;
        --ic-bg: #f9f9fa; --ic-bg-rail: #f9f9fa;
        --ic-text: #1b1912; --ic-text-bright: #000000; --ic-text-2: #2a2820;
        --ic-text-3: #3a3830; --ic-text-4: #3a3830; --ic-text-5: #4a4740;
        --ic-text-6: #5a574e; --ic-text-7: #6e6b62; --ic-text-8: #84817a; --ic-text-9: #b0ada5;
        --ic-avatar-bg: #d8d5cc;
        --ic-border: rgba(0,0,0,0.08); --ic-border-soft: rgba(0,0,0,0.06);
        --ic-overlay-1: rgba(0,0,0,0.025); --ic-overlay-2: rgba(0,0,0,0.03);
        --ic-overlay-3: rgba(0,0,0,0.035); --ic-overlay-4: rgba(0,0,0,0.05);
        --ic-overlay-5: rgba(0,0,0,0.07); --ic-overlay-bg: rgba(0,0,0,0.02);
        --ic-rail-active: #1b1912; --ic-dot-border: #f9f9fa;
        --ic-accent: #047857; --ic-emerald: #047857; --ic-amber: #b45309; --ic-rose: #be123c;
        --ic-mono: ${MONO};
      }

      .igris-console .ic-scroll { scrollbar-width: none; -ms-overflow-style: none; }
      .igris-console .ic-scroll::-webkit-scrollbar { display: none; }
      .igris-console .mono { font-family: var(--ic-mono); }

      /* Chips + brand marks */
      .igris-console .ic-chip {
        font-family: var(--ic-mono); font-size: 11.5px; padding: 1px 6px; border-radius: 4px;
        background: var(--ic-overlay-4); color: var(--ic-text-2); border: 1px solid var(--ic-border-soft); white-space: nowrap;
      }
      .igris-console .ic-chips { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 4px; min-width: 0; vertical-align: middle; }
      .igris-console .ic-chip--sm { font-size: 10px; padding: 0 5px; line-height: 15px; display: inline-flex; align-items: center; }
      .igris-console .ic-chip__icon { display: inline-flex; align-items: center; margin-right: 4px; vertical-align: middle; }
      .igris-console .ic-chip__logo { display: inline-flex; align-items: center; justify-content: center; width: 12px; height: 12px; margin-right: 4px; color: var(--ic-text-3); vertical-align: middle; }
      .igris-console .ic-chip__logo svg { width: 100%; height: 100%; object-fit: contain; }

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

      /* Filters + search */
      .igris-console .ic-filters {
        display: flex; flex-wrap: wrap; align-items: center; gap: 6px;
        padding: 10px 20px; border-bottom: 1px solid var(--ic-border); background: var(--ic-bg); flex-shrink: 0;
      }
      .igris-console .ic-dropdown__btn {
        display: inline-flex; align-items: center; gap: 8px; height: 28px; padding: 0 10px;
        font-size: 11.5px; color: var(--ic-text-3); background: var(--ic-overlay-3);
        border: 1px solid var(--ic-border); border-radius: 5px; white-space: nowrap; cursor: pointer; user-select: none;
      }
      .igris-console .ic-dropdown__btn:hover { background: var(--ic-overlay-4); }
      .igris-console .ic-dropdown__value { color: var(--ic-text-6); }
      .igris-console .ic-dropdown__chev { width: 12px; height: 12px; color: var(--ic-text-7); flex: none; }
      .igris-console .ic-runsearch { flex: 1 1 240px; min-width: 180px; position: relative; display: flex; align-items: center; }
      .igris-console .ic-runsearch__ico { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: var(--ic-text-7); pointer-events: none; }
      .igris-console .ic-runsearch__input {
        width: 100%; height: 28px; padding: 0 10px 0 34px; border-radius: 5px;
        border: 1px solid var(--ic-border); background: var(--ic-overlay-3); color: var(--ic-text);
        font-size: 11.5px; font-family: inherit; outline: none;
      }
      .igris-console .ic-runsearch__input:focus { border-color: var(--ic-text-6); }
      .igris-console .ic-runsearch__input::placeholder { color: var(--ic-text-7); }
      .igris-console .ic-runsearch__input::-webkit-search-cancel-button { -webkit-appearance: none; }

      /* Runs list */
      .igris-console .ic-runs-list {
        display: flex; flex-direction: column; border: 1px solid var(--ic-border);
        border-radius: 8px; background: var(--ic-overlay-bg); overflow: hidden; min-width: 660px;
      }
      .igris-console .ic-run-row {
        display: flex; align-items: center; position: relative;
        border-bottom: 1px solid var(--ic-border-soft); transition: background 120ms ease;
        animation: ic-run-row-in 860ms cubic-bezier(0.16,0.84,0.44,1) both;
      }
      @keyframes ic-run-row-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      @media (prefers-reduced-motion: reduce) { .igris-console .ic-run-row { animation: none; } }
      .igris-console .ic-run-row:last-child { border-bottom: 0; }
      .igris-console .ic-run-row:hover { background: var(--ic-overlay-2); }
      .igris-console .ic-run-row:hover .ic-run-row__title { color: var(--ic-emerald); }
      .igris-console .ic-run-row__open {
        flex: 1; min-width: 0; display: grid; align-items: center; column-gap: 10px;
        padding: 7px 14px 7px 8px; text-decoration: none; color: inherit;
        grid-template-columns: minmax(140px, 1fr) minmax(96px, 148px) minmax(150px, 210px) minmax(150px, 1.1fr) 76px;
        cursor: default;
      }
      .igris-console .ic-run-row__title { font-size: 12px; color: var(--ic-text-bright); letter-spacing: -0.005em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .igris-console .ic-run-row__id-group { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
      .igris-console .ic-run-row__id-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .igris-console .ic-run-row__dot { width: 6px; height: 6px; border-radius: 999px; flex: none; }
      .igris-console .ic-run-row__dot--ok { background: var(--ic-text-9); }
      .igris-console .ic-run-row__dot--running { background: var(--ic-emerald); }
      .igris-console .ic-run-row__dot--failed { background: var(--ic-rose); }
      .igris-console .ic-run-row__dot--warn { background: var(--ic-amber); }
      .igris-console .ic-run-row__id { font-family: var(--ic-mono); font-size: 11px; color: var(--ic-text-3); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .igris-console .ic-run-row__status { font-size: 10px; letter-spacing: -0.005em; white-space: nowrap; }
      .igris-console .ic-run-row__status--ok { color: var(--ic-text-7); }
      .igris-console .ic-run-row__status--running { color: var(--ic-emerald); }
      .igris-console .ic-run-row__status--failed { color: var(--ic-rose); }
      .igris-console .ic-run-row__status--warn { color: var(--ic-amber); }
      .igris-console .ic-run-row__sub { display: flex; align-items: center; gap: 4px; min-width: 0; font-size: 11px; color: var(--ic-text-6); overflow: hidden; white-space: nowrap; }
      .igris-console .ic-run-row__sub .ic-chips { flex-wrap: nowrap; min-width: 0; overflow: hidden; }
      .igris-console .ic-run-row__time { font-size: 10px; color: var(--ic-text-8); font-variant-numeric: tabular-nums; font-family: var(--ic-mono); text-align: right; white-space: nowrap; line-height: 1.4; }

      /* Mobile: collapse to action · id/status · time */
      @media (max-width: 640px) {
        .igris-console .ic-run-row__open { grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr) auto; }
        .igris-console .ic-run-row__sub { display: none; }
      }

      /* Empty state */
      .igris-console .ic-runs-empty { padding: 40px 16px; text-align: center; }
      .igris-console .ic-runs-empty__title { font-size: 12.5px; color: var(--ic-text-2); }
      .igris-console .ic-runs-empty__sub { font-size: 11.5px; color: var(--ic-text-6); margin: 6px 0 0; }

      @keyframes ic-runs-dot { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      .igris-console .ic-live-dot { animation: ic-runs-dot 2.4s ease-in-out infinite; }
    `}</style>
  )
}
