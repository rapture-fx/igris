'use client'

// ──────────────────────────────────────────────────────────────────
// ExecutionPath — "One endpoint for every agent action" (Action endpoint)
//
// A developer-integration moment that sits *after* the Products
// (Run / Recover / Prove) showcase. The anchor is a tall code-editor
// window — wrapped in the same layered bezel the Products console uses —
// showing how the same Igris action endpoint is called from different
// languages (chosen via a dropdown in the title bar). Below it: what the
// call can route *through* (Igris concepts, lucide icons) and connect *to*
// (real product logos, colour-on-hover).
//
// Honesty notes:
//  • TypeScript uses the real igris-javascript-sdk method
//    igris.actions.run(name, input, { idempotencyKey }).
//  • Python / Go / Rust / cURL call the real POST /v1/actions/:name/run
//    route over plain HTTP — those SDKs do NOT expose an action gateway,
//    so we show raw HTTP rather than invent an SDK surface.
//  • Brand logos are bundled locally in /public/logos (no runtime/CDN
//    fetch); monochrome by default, full brand colour on hover.
// ──────────────────────────────────────────────────────────────────

import { useState } from 'react'
import { Globe, Webhook, Server, Plug, Network, type LucideIcon } from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

interface Chip {
  label: string
  Icon?: LucideIcon
  logo?: string
  invertOnDark?: boolean // near-black marks (GitHub/Resend) need inverting on dark
}

const ROUTE_CHIPS: Chip[] = [
  { label: 'Hosted API', Icon: Globe },
  { label: 'Webhook', Icon: Webhook },
  { label: 'Connected Worker', Icon: Server },
  { label: 'MCP', Icon: Plug },
]

const TARGET_CHIPS: Chip[] = [
  { label: 'Stripe', logo: '/logos/stripe.svg' },
  { label: 'Polar', logo: '/logos/polar.png', invertOnDark: true },
  { label: 'Resend', logo: '/logos/resend.svg', invertOnDark: true },
  { label: 'GitHub', logo: '/logos/github.svg', invertOnDark: true },
  { label: 'Linear', logo: '/logos/linear.svg' },
  { label: 'Notion', logo: '/logos/notion.svg', invertOnDark: true },
  { label: 'Shopify', logo: '/logos/shopify.svg' },
  { label: 'HubSpot', logo: '/logos/hubspot.svg' },
  { label: 'Sentry', logo: '/logos/sentry.svg' },
  { label: 'Datadog', logo: '/logos/datadog.svg' },
  { label: 'Cloudflare', logo: '/logos/cloudflare.svg' },
  { label: 'Vercel', logo: '/logos/vercel.svg', invertOnDark: true },
  { label: 'Postgres', logo: '/logos/postgresql.svg' },
  { label: 'Neon', logo: '/logos/neon.svg' },
  { label: 'PlanetScale', logo: '/logos/planetscale.svg', invertOnDark: true },
  { label: 'MongoDB', logo: '/logos/mongodb.svg' },
  { label: 'Snowflake', logo: '/logos/snowflake.svg' },
  { label: 'Internal API', Icon: Network },
]

interface Lang {
  id: string
  label: string
  file: string
  lines: string[]
}

const LANGS: Lang[] = [
  {
    id: 'curl',
    label: 'cURL',
    file: 'POST /v1/actions/send_invoice/run',
    lines: [
      'curl -X POST https://overture.igrisinertial.com/v1/actions/send_invoice/run \\',
      '  -H "Authorization: Bearer $IGRIS_API_KEY" \\',
      '  -H "Content-Type: application/json" \\',
      '  -d \'{',
      '    "input": { "customer_id": "cus_8821", "amount": 4200 },',
      '    "idempotency_key": "invoice-8821-2026-06"',
      '  }\'',
    ],
  },
  {
    id: 'ts',
    label: 'TypeScript',
    file: 'src/actions/send-invoice.ts',
    lines: [
      'await igris.actions.run("send_invoice", {',
      '  customer_id: "cus_8821",',
      '  amount: 4200',
      '}, {',
      '  idempotencyKey: "invoice-8821-2026-06"',
      '})',
    ],
  },
  {
    id: 'python',
    label: 'Python',
    file: 'send_invoice.py',
    lines: [
      'import os, requests',
      '',
      'requests.post(',
      '    "https://overture.igrisinertial.com/v1/actions/send_invoice/run",',
      '    headers={"Authorization": f"Bearer {os.environ[\'IGRIS_API_KEY\']}"},',
      '    json={',
      '        "input": {"customer_id": "cus_8821", "amount": 4200},',
      '        "idempotency_key": "invoice-8821-2026-06",',
      '    },',
      ')',
    ],
  },
  {
    id: 'go',
    label: 'Go',
    file: 'send_invoice.go',
    lines: [
      'body, _ := json.Marshal(map[string]any{',
      '    "input": map[string]any{"customer_id": "cus_8821", "amount": 4200},',
      '    "idempotency_key": "invoice-8821-2026-06",',
      '})',
      '',
      'req, _ := http.NewRequest("POST",',
      '    "https://overture.igrisinertial.com/v1/actions/send_invoice/run",',
      '    bytes.NewReader(body))',
      'req.Header.Set("Authorization", "Bearer "+os.Getenv("IGRIS_API_KEY"))',
      '',
      'http.DefaultClient.Do(req)',
    ],
  },
  {
    id: 'rust',
    label: 'Rust',
    file: 'send_invoice.rs',
    lines: [
      'let client = reqwest::Client::new();',
      '',
      'client.post("https://overture.igrisinertial.com/v1/actions/send_invoice/run")',
      '    .bearer_auth(std::env::var("IGRIS_API_KEY")?)',
      '    .json(&serde_json::json!({',
      '        "input": { "customer_id": "cus_8821", "amount": 4200 },',
      '        "idempotency_key": "invoice-8821-2026-06"',
      '    }))',
      '    .send()',
      '    .await?;',
    ],
  },
]

// Dependency-free syntax highlighters. `HL` handles code (TS/Python/Go/
// Rust) — comments, strings, constants, keywords, function calls, types,
// properties and numbers. `HL_CURL` handles the shell/curl snippet — its
// command, URL, HTTP method, flags, line continuations, strings, numbers.
const HL = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|\b(true|false|null|None|nil|undefined)\b|\b(await|async|import|from|export|const|let|var|func|fn|def|package|return|use|mut|new|if|else|for|in|while|match|struct|type|interface|class|pub|require|range|go|defer|with|as|lambda|public|static|void)\b|([A-Za-z_]\w*(?=\s*\())|(\.[A-Za-z_]\w*(?!\s*\())|\b([A-Z][A-Za-z0-9_]*)\b|(\b0x[0-9a-fA-F]+\b|\b\d[\d_]*(?:\.\d+)?\b)/g
const HL_CURL = /(#.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(https?:\/\/[^\s'"\\]+)|(\bcurl\b)|\b(POST|GET|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|(\B-{1,2}[A-Za-z][\w-]*)|(\\\s*$)|(\b\d[\d_]*(?:\.\d+)?\b)/g

function highlightCode(line: string) {
  const out: Array<string | JSX.Element> = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  HL.lastIndex = 0
  while ((m = HL.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index))
    if (m[1]) out.push(<span key={k++} className="c-cmt">{m[1]}</span>)
    else if (m[2]) out.push(<span key={k++} className="c-str">{m[2]}</span>)
    else if (m[3]) out.push(<span key={k++} className="c-const">{m[3]}</span>)
    else if (m[4]) out.push(<span key={k++} className="c-kw">{m[4]}</span>)
    else if (m[5]) out.push(<span key={k++} className="c-fn">{m[5]}</span>)
    else if (m[6]) out.push(<span key={k++} className="c-prop">{m[6]}</span>)
    else if (m[7]) out.push(<span key={k++} className="c-type">{m[7]}</span>)
    else if (m[8]) out.push(<span key={k++} className="c-num">{m[8]}</span>)
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

function highlightCurl(line: string) {
  const out: Array<string | JSX.Element> = []
  let last = 0
  let k = 0
  let m: RegExpExecArray | null
  HL_CURL.lastIndex = 0
  while ((m = HL_CURL.exec(line)) !== null) {
    if (m.index > last) out.push(line.slice(last, m.index))
    if (m[1]) out.push(<span key={k++} className="c-cmt">{m[1]}</span>)
    else if (m[2]) out.push(<span key={k++} className="c-str">{m[2]}</span>)
    else if (m[3]) out.push(<span key={k++} className="c-url">{m[3]}</span>)
    else if (m[4]) out.push(<span key={k++} className="c-fn">{m[4]}</span>)
    else if (m[5]) out.push(<span key={k++} className="c-kw">{m[5]}</span>)
    else if (m[6]) out.push(<span key={k++} className="c-flag">{m[6]}</span>)
    else if (m[7]) out.push(<span key={k++} className="c-cmt">{m[7]}</span>)
    else if (m[8]) out.push(<span key={k++} className="c-num">{m[8]}</span>)
    last = m.index + m[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

function highlight(line: string, lang: string) {
  if (line === '') return ' '
  return lang === 'curl' ? highlightCurl(line) : highlightCode(line)
}

export default function ExecutionPath() {
  return (
    <section
      id="action-endpoint"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <EndpointStyles />
      <div className="pt-16 md:pt-32 pb-24 md:pb-40">
        <div className="ae-inner mx-auto" style={{ maxWidth: 860 }}>
          {/* ── Centered header ─────────────────────────────────────── */}
          <div className="text-center">
            <h2
              className="ae-headline mx-auto text-gray-700 dark:text-[#c8c8b8]"
              style={{ fontFamily: SANS }}
            >
              One endpoint for every agent action.
            </h2>
            <p
              className="ae-sub mx-auto text-gray-600 dark:text-[#a8a898]"
              style={{ fontFamily: SANS }}
            >
              Create an action in Igris, then call it from your agent, app, workflow,
              or MCP client. Igris handles policy, routing, recovery, and proof behind
              the endpoint.
            </p>
          </div>

          {/* ── Code window (anchor) ────────────────────────────────── */}
          <CodeWindow />

          {/* ── Route + target chips ────────────────────────────────── */}
          <div className="ae-connect">
            <ChipGroup label="Run through" items={ROUTE_CHIPS} />
            <ChipGroup label="Connect to" items={TARGET_CHIPS} table />
          </div>
        </div>
      </div>
    </section>
  )
}

function ChipGroup({ label, items, table }: { label: string; items: Chip[]; table?: boolean }) {
  return (
    <div className="ae-group">
      <div className="ae-group-label" style={{ fontFamily: SANS }}>{label}</div>
      {table ? (
        <div className="ae-grid-table">
          {items.map((c) => (
            <div key={c.label} className="ae-cell" style={{ fontFamily: MONO }}>
              <LogoMark chip={c} />
              <span className="ae-cell-label">{c.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="ae-chips--row">
          {items.map((c) => <ChipView key={c.label} chip={c} />)}
        </div>
      )}
    </div>
  )
}

function LogoMark({ chip }: { chip: Chip }) {
  if (chip.logo) {
    return (
      <span className="ae-logo">
        <span className="ae-logo-mono" style={{ ['--logo' as string]: `url(${chip.logo})` }} aria-hidden />
        <img
          className={'ae-logo-color' + (chip.invertOnDark ? ' ae-logo-color--invert' : '')}
          src={chip.logo}
          alt=""
          aria-hidden
        />
      </span>
    )
  }
  if (chip.Icon) return <chip.Icon className="ae-chip-ic" size={14} strokeWidth={1.7} aria-hidden />
  return null
}

function ChipView({ chip }: { chip: Chip }) {
  return (
    <span className="ae-chip" style={{ fontFamily: MONO }}>
      <LogoMark chip={chip} />
      {chip.label}
    </span>
  )
}

// ──────────────────────────────────────────────────────────────────
// Code window — layered bezel (matching the Products console frame) →
// editor window with a language dropdown (top-right) and a tall code pane.
// ──────────────────────────────────────────────────────────────────

function CodeWindow() {
  const [lang, setLang] = useState('curl')
  const active = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  return (
    <div className="ae-window-wrap">
      {/* Layered bezel — same treatment as the Products ExecutionPreview */}
      <div className="relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
        <div className="relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]">
          <div className="ae-window shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]">
            {/* Title bar: window dots · active filename · language dropdown */}
            <div className="ae-bar">
              <div className="ae-dots" aria-hidden>
                <span className="ae-dot" /><span className="ae-dot" /><span className="ae-dot" />
              </div>
              <span className="ae-bar-label" style={{ fontFamily: MONO }}>{active.file}</span>
              <div className="ae-lang">
                <select
                  className="ae-lang-select"
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  aria-label="Code example language"
                  style={{ fontFamily: MONO }}
                >
                  {LANGS.map((l) => (
                    <option key={l.id} value={l.id}>{l.label}</option>
                  ))}
                </select>
                <svg className="ae-lang-chev" width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>

            {/* Code pane — tall editor surface */}
            <div className="ae-pane ae-pane--req">
              <Gutter count={active.lines.length} />
              <pre className="ae-code" style={{ fontFamily: MONO }} tabIndex={0} aria-label={`${active.label} example`}>
                <code>
                  {active.lines.map((ln, i) => (
                    <span key={i} className="ae-ln">{highlight(ln, active.id)}</span>
                  ))}
                </code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Fixed line-number gutter — stays put while the code scrolls horizontally.
function Gutter({ count }: { count: number }) {
  return (
    <div className="ae-gutter" aria-hidden style={{ fontFamily: MONO }}>
      {Array.from({ length: count }, (_, i) => (
        <span key={i}>{i + 1}</span>
      ))}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Scoped styles. Header follows the page surface; the code window carries
// the dark/light igris-console palette (emerald accent, mono).
// ──────────────────────────────────────────────────────────────────

function EndpointStyles() {
  return (
    <style>{`
      /* ── Header ── */
      .ae-headline {
        margin-top: 0; max-width: 18ch;
        font-weight: 400; letter-spacing: -0.02em; line-height: 1.08;
        font-size: clamp(1.2rem, 2.6vw, 2rem);
      }
      .ae-sub {
        margin-top: 18px; max-width: 56ch;
        font-size: clamp(1rem, 1.2vw, 1.14rem); line-height: 1.6;
      }

      /* ── Code window (inner panel inside the layered bezel) ── */
      .ae-window-wrap { margin-top: 44px; }
      .ae-window {
        --p-panel: #f7f7f5;
        --p-bar: #f2f1ee;
        --p-border: rgba(0,0,0,0.09);
        --p-border-soft: rgba(0,0,0,0.06);
        --p-text: #1b1912;
        --p-dim: #6e6b62;
        --p-faint: #8a8780;
        --p-gutter: #b3b0a8;
        --p-emerald: #047857;
        --p-emerald-bg: rgba(4,120,87,0.08);
        --p-overlay: rgba(0,0,0,0.025);
        --p-dot: rgba(0,0,0,0.16);
        position: relative; overflow: hidden;
        border-radius: 10px;
        background: var(--p-panel);
      }
      html.dark .ae-window {
        --p-panel: #0e0e0c;
        --p-bar: #070707;
        --p-border: rgba(255,255,255,0.07);
        --p-border-soft: rgba(255,255,255,0.045);
        --p-text: #b0ada5;
        --p-dim: #9a978f;
        --p-faint: #6a6a62;
        --p-gutter: #4a4a42;
        --p-emerald: #2faa7e;
        --p-emerald-bg: rgba(15,131,92,0.14);
        --p-overlay: rgba(255,255,255,0.025);
        --p-dot: rgba(255,255,255,0.14);
      }

      .ae-bar {
        display: flex; align-items: center; gap: 12px;
        padding: 10px 12px 10px 15px;
        border-bottom: 1px solid var(--p-border-soft);
        background: var(--p-bar);
      }
      .ae-dots { display: flex; gap: 6px; flex: none; }
      .ae-dot { width: 9px; height: 9px; border-radius: 50%; background: var(--p-dot); }
      .ae-bar-label {
        flex: 1; min-width: 0; font-size: 11.5px; color: var(--p-dim);
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;
      }

      /* Language dropdown (top-right) */
      .ae-lang { position: relative; flex: none; display: inline-flex; align-items: center; }
      .ae-lang-select {
        appearance: none; -webkit-appearance: none;
        font-size: 11.5px; line-height: 1;
        padding: 6px 26px 6px 11px;
        border-radius: 7px; border: 1px solid var(--p-border-soft);
        background: var(--p-overlay); color: var(--p-text);
        cursor: pointer; outline: none;
        transition: border-color .2s ease;
      }
      .ae-lang-select:hover { border-color: var(--p-border); }
      .ae-lang-select:focus-visible { border-color: var(--p-emerald); }
      html.dark .ae-lang-select { color-scheme: dark; }
      .ae-lang-chev { position: absolute; right: 9px; pointer-events: none; color: var(--p-faint); }

      /* Pane: fixed line-number gutter + scrollable code */
      .ae-pane { display: grid; grid-template-columns: auto minmax(0, 1fr); }
      .ae-pane--req { min-height: 360px; }
      .ae-gutter {
        display: flex; flex-direction: column;
        padding: 22px 14px 22px 0;
        text-align: right; user-select: none;
        font-size: 12.5px; line-height: 1.85; color: var(--p-gutter);
        border-right: 1px solid var(--p-border-soft);
        min-width: 44px;
      }
      .ae-code {
        margin: 0;
        font-size: 13px; line-height: 1.85; color: var(--p-text);
        padding: 22px 22px 22px 18px;
        overflow-x: auto; white-space: pre;
        -webkit-overflow-scrolling: touch;
      }
      .ae-code:focus-visible { outline: 2px solid var(--p-emerald); outline-offset: -2px; }
      .ae-code .ae-ln { display: block; }
      .c-kw { color: #9d4b57; } html.dark .c-kw { color: #c08793; }
      .c-fn { color: var(--p-emerald); }
      .c-str { color: #4d7c5f; } html.dark .c-str { color: #7faf93; }
      .c-num { color: #b45309; } html.dark .c-num { color: #d08a4a; }
      .c-const { color: #b45309; } html.dark .c-const { color: #d08a4a; }
      .c-type { color: #5a67d8; } html.dark .c-type { color: #8b95e6; }
      .c-prop { color: var(--p-text); }
      .c-cmt { color: var(--p-faint); font-style: italic; }
      .c-flag { color: #0d7a8a; } html.dark .c-flag { color: #4fb3c4; }
      .c-url { color: #0d7a8a; text-decoration: underline; text-decoration-color: rgba(13,122,138,0.3); text-underline-offset: 2px; }
      html.dark .c-url { color: #4fb3c4; text-decoration-color: rgba(79,179,196,0.3); }

      /* ── Chip groups (route row + target table), aligned to the card ── */
      .ae-connect {
        margin: 44px 0 0;
        display: flex; flex-direction: column; gap: 24px;
      }
      .ae-group-label {
        font-size: 12px; letter-spacing: 0.01em; color: #6b7280; margin-bottom: 12px;
      }
      html.dark .ae-group-label { color: #8a8a82; }

      .ae-chips--row { display: flex; flex-wrap: wrap; gap: 8px; }
      .ae-chip {
        display: inline-flex; align-items: center; gap: 8px;
        font-size: 11.5px; line-height: 1; padding: 9px 12px;
        border-radius: 9px; border: 1px solid var(--landing-surface-border);
        background: var(--landing-surface); color: #4b5563; white-space: nowrap;
        transition: border-color .2s ease, background-color .2s ease;
      }
      .ae-chip:hover { border-color: var(--landing-surface-border-strong); }
      html.dark .ae-chip { color: #a8a898; }
      .ae-chip-ic { flex: none; opacity: 0.9; }

      /* Visible table grid (Connect to). 18 cells; the column counts divide
         18 exactly (6 / 3 / 2) so no empty cell shows through the gridlines.
         Gridlines = 1px gap revealing the container's border-colour bg. */
      .ae-grid-table {
        display: grid; grid-template-columns: repeat(6, 1fr);
        gap: 1px; background: var(--landing-surface-border);
        border: 1px solid var(--landing-surface-border);
        border-radius: 12px; overflow: hidden;
      }
      .ae-cell {
        display: flex; align-items: center; gap: 9px;
        padding: 13px 14px; min-width: 0;
        font-size: 11.5px; color: #4b5563;
        background: var(--landing-surface);
        transition: background-color .2s ease;
      }
      html.dark .ae-cell { color: #a8a898; }
      .ae-cell-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
      .ae-cell:hover { background: rgba(0,0,0,0.02); }
      html.dark .ae-cell:hover { background: rgba(255,255,255,0.025); }
      .ae-cell:hover .ae-logo-mono { opacity: 0; }
      .ae-cell:hover .ae-logo-color { opacity: 1; }
      html.dark .ae-cell:hover .ae-logo-color--invert { filter: invert(1) brightness(1.7); }

      /* Brand logo: monochrome by default, full brand colour on hover */
      .ae-logo { position: relative; flex: none; width: 14px; height: 14px; display: inline-block; }
      .ae-logo-mono {
        position: absolute; inset: 0;
        background-color: currentColor; opacity: 0.82;
        -webkit-mask: var(--logo) center / contain no-repeat;
        mask: var(--logo) center / contain no-repeat;
        transition: opacity .18s ease;
      }
      .ae-logo-color {
        position: absolute; inset: 0; width: 100%; height: 100%;
        object-fit: contain; opacity: 0; transition: opacity .18s ease;
      }
      .ae-chip:hover .ae-logo-mono { opacity: 0; }
      .ae-chip:hover .ae-logo-color { opacity: 1; }
      html.dark .ae-chip:hover .ae-logo-color--invert { filter: invert(1) brightness(1.7); }

      @media (max-width: 640px) {
        .ae-code { font-size: 12px; padding: 18px 16px 18px 14px; }
        .ae-gutter { font-size: 11.5px; min-width: 36px; padding-right: 10px; padding-top: 18px; padding-bottom: 18px; }
        .ae-pane--req { min-height: 300px; }
        .ae-grid-table { grid-template-columns: repeat(3, 1fr); }
        .ae-bar-label { display: none; }
      }
      @media (max-width: 420px) {
        .ae-code { font-size: 11px; }
        .ae-grid-table { grid-template-columns: repeat(2, 1fr); }
      }
    `}</style>
  )
}
