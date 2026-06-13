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

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Globe, Webhook, Server, Plug, type LucideIcon } from 'lucide-react'

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

const WORKS_WITH_CHIPS: Chip[] = [
  { label: 'APIs' },
  { label: 'Webhooks' },
  { label: 'Databases' },
  { label: 'Files' },
  { label: 'Internal tools' },
  { label: 'SaaS apps' },
  { label: 'Runtimes' },
]

const WORKER_INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

const WORKER_COPY_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
  lineHeight: 1.6,
}

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
      'curl -X POST https://api.igrisinertial.com/v1/actions/send_invoice/run \\',
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
      '    "https://api.igrisinertial.com/v1/actions/send_invoice/run",',
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
      '    "https://api.igrisinertial.com/v1/actions/send_invoice/run",',
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
      'client.post("https://api.igrisinertial.com/v1/actions/send_invoice/run")',
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
      <div className="pt-10 md:pt-14 pb-20 md:pb-32">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 md:gap-8">
          <h2
            className="text-gray-700 dark:text-[#c8c8b8] font-normal shrink-0 max-w-[28ch]"
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
            }}
          >
            One endpoint for every agent action.
          </h2>
          <p
            className="text-gray-600 dark:text-[#a8a898] max-w-[42ch] md:text-right"
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
              lineHeight: 1.6,
            }}
          >
            One action, many clients. Compare how the same call looks in the
            language or tool your team already uses.
          </p>
        </div>

        <CodeWindow />
        <WorkerInstallCallout />

        <ConnectPanel />
      </div>
    </section>
  )
}

function ConnectPanel() {
  return (
    <div className="mt-10 md:mt-12 flex flex-col gap-6 md:gap-7">
      <ChipGroup label="Run through" items={ROUTE_CHIPS} />
      <ChipGroup label="Works with" items={WORKS_WITH_CHIPS} />
    </div>
  )
}

function ChipGroup({ label, items }: { label: string; items: Chip[] }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6 md:gap-10">
      <p
        className="text-gray-700 dark:text-[#c8c8b8] shrink-0 sm:w-[108px] md:w-[124px]"
        style={{
          fontFamily: SANS,
          fontSize: '0.95rem',
          fontWeight: 500,
          lineHeight: 1.4,
          letterSpacing: '-0.01em',
        }}
      >
        {label}
      </p>
      <div className="flex flex-1 flex-wrap gap-2 min-w-0">
        {items.map((c) => (
          <ChipView key={c.label} chip={c} />
        ))}
      </div>
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
    <span
      className="ae-chip inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-black/[0.08] dark:border-white/[0.08] bg-white/70 dark:bg-white/[0.03] text-gray-600 dark:text-[#a8a898] transition-colors hover:border-black/[0.14] dark:hover:border-white/[0.14] hover:bg-white dark:hover:bg-white/[0.05]"
      style={{ fontFamily: SANS, fontSize: '12px', letterSpacing: '-0.01em' }}
    >
      <LogoMark chip={chip} />
      {chip.label}
    </span>
  )
}

function WorkerInstallCallout() {
  const [copied, setCopied] = useState(false)

  const copyInstallCmd = () => {
    navigator.clipboard?.writeText(WORKER_INSTALL_CMD)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1400)
  }

  return (
    <aside className="ae-worker-callout" aria-label="Optional worker install for private access">
      <div className="ae-worker-copy">
        <p className="ae-worker-body text-gray-600 dark:text-[#a8a898]" style={WORKER_COPY_STYLE}>
          Start in Cloud. Add a worker when needed. Hosted APIs and webhooks can run through
          Igris Cloud. Install a worker only when an action needs access to private files,
          internal APIs, databases, or local runtimes.
        </p>
        <p className="ae-worker-note" style={{ fontFamily: MONO }}>
          No worker is required for hosted API or webhook actions.
        </p>
      </div>

      <div className="ae-worker-terminal">
        <div className="ae-worker-code">
          <code className="ae-worker-line" style={{ fontFamily: MONO }}>
            <span className="ae-worker-prompt" aria-hidden>$ </span>
            {highlightCurl(WORKER_INSTALL_CMD)}
          </code>
          <button
            type="button"
            onClick={copyInstallCmd}
            className="ae-worker-copy-btn"
            style={{ fontFamily: MONO }}
            title={copied ? 'Copied' : 'Copy'}
            aria-label={copied ? 'Copied install command' : 'Copy install command'}
          >
            {copied ? '// copied' : '// copy'}
          </button>
        </div>
      </div>
    </aside>
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
    <div className="ae-window-wrap mt-16 md:mt-20">
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
              <LangDropdown lang={lang} onChange={setLang} />
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

// Custom language dropdown — styled to the window palette instead of the
// native browser select. Closes on outside click and Escape.
function LangDropdown({ lang, onChange }: { lang: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const active = LANGS.find((l) => l.id === lang) ?? LANGS[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="ae-lang" ref={ref}>
      <button
        type="button"
        className="ae-lang-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Code example language"
        onClick={() => setOpen((o) => !o)}
        style={{ fontFamily: MONO }}
      >
        {active.label}
        <svg
          className={'ae-lang-chev' + (open ? ' is-open' : '')}
          width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <ul className="ae-lang-menu" role="listbox" aria-label="Code example language" style={{ fontFamily: MONO }}>
          {LANGS.map((l) => (
            <li key={l.id} role="option" aria-selected={l.id === lang}>
              <button
                type="button"
                className={'ae-lang-opt' + (l.id === lang ? ' is-active' : '')}
                onClick={() => { onChange(l.id); setOpen(false) }}
              >
                {l.label}
              </button>
            </li>
          ))}
        </ul>
      )}
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
      /* ── Code window (inner panel inside the layered bezel) ── */
      .ae-window-wrap { margin-top: 0; }
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
        overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: left;
      }

      /* Language dropdown (top-right, custom — not the browser select) */
      .ae-lang { position: relative; flex: none; display: inline-flex; align-items: center; }
      .ae-lang-btn {
        display: inline-flex; align-items: center; gap: 7px;
        font-size: 11.5px; line-height: 1;
        padding: 6px 9px 6px 11px;
        border-radius: 7px; border: 1px solid var(--p-border-soft);
        background: var(--p-overlay); color: var(--p-text);
        cursor: pointer; outline: none;
        transition: border-color .2s ease;
      }
      .ae-lang-btn:hover { border-color: var(--p-border); }
      .ae-lang-btn:focus-visible { border-color: var(--p-emerald); }
      .ae-lang-chev { flex: none; color: var(--p-faint); transition: transform .15s ease; }
      .ae-lang-chev.is-open { transform: rotate(180deg); }
      .ae-lang-menu {
        position: absolute; top: calc(100% + 6px); right: 0; z-index: 20;
        margin: 0; padding: 4px; list-style: none; min-width: 124px;
        border-radius: 9px; border: 1px solid var(--p-border);
        background: var(--p-panel);
        box-shadow: 0 8px 24px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08);
      }
      html.dark .ae-lang-menu { box-shadow: 0 8px 24px rgba(0,0,0,0.5), 0 1px 3px rgba(0,0,0,0.4); }
      .ae-lang-opt {
        display: block; width: 100%; text-align: left;
        font-size: 11.5px; line-height: 1; font-family: inherit;
        padding: 7px 10px; border: 0; border-radius: 6px;
        background: transparent; color: var(--p-dim);
        cursor: pointer; outline: none;
        transition: background-color .15s ease, color .15s ease;
      }
      .ae-lang-opt:hover, .ae-lang-opt:focus-visible { background: var(--p-overlay); color: var(--p-text); }
      .ae-lang-opt.is-active { color: var(--p-emerald); background: var(--p-emerald-bg); }

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

      .ae-chip { white-space: nowrap; line-height: 1.2; }
      .ae-chip-ic { flex: none; width: 14px; height: 14px; opacity: 0.8; }

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

      /* ── Optional worker install callout (below code window) ── */
      .ae-worker-callout {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding: 24px 28px;
        border-radius: 12px;
        border: 1px solid var(--landing-surface-border);
        background: var(--landing-surface);
        text-align: left;
      }
      .ae-worker-copy {
        max-width: none;
      }
      html.dark .ae-worker-callout {
        background: rgba(22, 21, 21, 0.55);
        border-color: rgba(246, 246, 244, 0.1);
      }
      .ae-worker-heading { margin: 0; }
      .ae-worker-body { margin: 0; }
      .ae-worker-note {
        margin: 12px 0 0;
        font-size: 10.5px;
        letter-spacing: 0.03em;
        color: #9ca3af;
      }
      html.dark .ae-worker-note { color: #6a6a62; }
      .ae-worker-terminal {
        display: flex;
        flex-direction: column;
        min-width: 0;
        width: 100%;
        border-radius: 10px;
        border: 1px solid rgba(0, 0, 0, 0.08);
        background: #f7f7f5;
        overflow: hidden;
      }
      html.dark .ae-worker-terminal {
        border-color: rgba(255, 255, 255, 0.07);
        background: #0e0e0c;
      }
      .ae-worker-code {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 14px;
        padding: 14px 16px;
        font-size: 12.5px;
        line-height: 1.6;
        color: #1b1912;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
      }
      html.dark .ae-worker-code { color: #b0ada5; }
      .ae-worker-line {
        display: block;
        min-width: 0;
        flex: 1;
        white-space: nowrap;
        overflow-x: auto;
      }
      .ae-worker-prompt {
        display: inline-block;
        margin-right: 8px;
        color: #9ca3af;
        user-select: none;
      }
      html.dark .ae-worker-prompt { color: #5a5a52; }
      .ae-worker-copy-btn {
        flex: none;
        border: 0;
        background: transparent;
        padding: 0;
        font-size: 12px;
        letter-spacing: 0.02em;
        color: #6b7280;
        cursor: pointer;
        transition: color .15s ease;
      }
      .ae-worker-copy-btn:hover,
      .ae-worker-copy-btn:focus-visible {
        color: #1b1912;
        outline: none;
      }
      html.dark .ae-worker-copy-btn { color: #8a8a82; }
      html.dark .ae-worker-copy-btn:hover,
      html.dark .ae-worker-copy-btn:focus-visible { color: #f6f6f4; }

      @media (max-width: 720px) {
        .ae-worker-callout {
          gap: 16px;
          padding: 20px 18px;
        }
        .ae-worker-code {
          flex-direction: column;
          align-items: flex-start;
          gap: 10px;
          padding: 14px 14px 16px;
          font-size: 12px;
        }
        .ae-worker-line { white-space: pre-wrap; word-break: break-word; }
      }

      @media (max-width: 640px) {
        .ae-code { font-size: 12px; padding: 18px 16px 18px 14px; }
        .ae-gutter { font-size: 11.5px; min-width: 36px; padding-right: 10px; padding-top: 18px; padding-bottom: 18px; }
        .ae-pane--req { min-height: 300px; }
        .ae-bar-label { display: none; }
      }
      @media (max-width: 420px) {
        .ae-code { font-size: 11px; }
      }
    `}</style>
  )
}
