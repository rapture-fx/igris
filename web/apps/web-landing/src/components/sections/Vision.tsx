'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Footer from './Footer'
import { PRICING_TIERS, getTierBilling } from '../../lib/pricing'
import type { BillingInterval } from '../../lib/pricing'
import { BillingToggle, TierPriceDisplay } from './Pricing'
import Faq from './Faq'
import { BookOpen, ChevronDown, Workflow, Copy, Code } from 'lucide-react'
import { MermaidChart } from '../MermaidChart'
import VisionChangesPanel from './VisionChangesPanel'
import AgentSetupLogos from './AgentSetupLogos'
import RunHistoryRail, { VISION_SECTION_IDS } from './RunHistoryRail'
import { DOCS_LINKS } from '../../lib/docs-urls'
import { preloadMermaid } from '../../lib/mermaid-loader'
import { CODING_AGENT_PROMPT } from '../../lib/coding-agent-prompt'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const LINE_1_CONT = ' to call APIs, trigger workflows, access files, and run tasks through one controlled path'
const LINE_2_CONT = ' across cloud, webhooks, MCP, and connected workers, with policy, recovery, and receipts built in'
const LINE_3_CONT = ' that records what happened, recovers from failure, and leaves evidence your team can inspect'

const PRICING_VISION_SUBTEXT =
  'Open Source: self-host Igris for free. Use Igris Cloud when you want hosted infrastructure, managed retention, team access, and support.'

const TITLE_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.045em',
}

const VISION_CONT_EASE = [0.16, 1, 0.3, 1] as const
const VISION_CONT_ENTER = { duration: 0.45, ease: VISION_CONT_EASE }
const VISION_CONT_EXIT = { duration: 0.14, ease: VISION_CONT_EASE }

// Continuation appears inline in grey — no black flash on enter or exit.
function HoverPhrase({
  base,
  cont,
  endPunct,
}: {
  base: ReactNode
  cont: string
  endPunct?: string
}) {
  const [hovered, setHovered] = useState(false)
  const [contVisible, setContVisible] = useState(false)
  const reduceMotion = useReducedMotion()
  const displayCont = cont.replace(/[.,]+$/, '')

  return (
    <span
      className="cursor-default"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
    >
      <span>{base}</span>
      {endPunct && !contVisible ? endPunct : null}
      <AnimatePresence
        onExitComplete={() => setContVisible(false)}
      >
        {hovered ? (
          <motion.span
            key="cont"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{
              opacity: 1,
              transition: reduceMotion ? { duration: 0 } : VISION_CONT_ENTER,
            }}
            exit={{
              opacity: 0,
              transition: reduceMotion ? { duration: 0 } : VISION_CONT_EXIT,
            }}
            onAnimationStart={() => setContVisible(true)}
            className="inline font-normal text-[#8f8f8f]"
          >
            {displayCont}
          </motion.span>
        ) : null}
      </AnimatePresence>
    </span>
  )
}

type Block =
  | { type: 'kicker'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'section'; text: string }
  | { type: 'sub'; text: string }
  | { type: 'lead'; text: string }
  | { type: 'p'; text: string }
  | { type: 'code'; text: string }
  | { type: 'code-card'; label: string; code: string }
  | { type: 'divider' }
  | { type: 'p-badges'; text: string }
  | { type: 'p-code-inline'; text: string }
  | { type: 'p-with-resources'; text: string }
  | { type: 'how-it-works' }
  | { type: 'changes-panel' }
  | { type: 'agent-setup' }

const HOW_IT_WORKS_CHART = `---
config:
  layout: elk
  theme: base
  look: classic
---
flowchart TB
    subgraph request["Request"]
        A["Agent request<br/><span style='font-size:11px;color:#71717a'>API · SDK · MCP</span>"]
    end

    subgraph execute["Execute"]
        B["Policy and limits<br/><span style='font-size:11px;color:#71717a'>Capability gates</span>"]
        C["Run action<br/><span style='font-size:11px;color:#71717a'>Hosted or runtime path</span>"]
        R["Recovery<br/><span style='font-size:11px;color:#be123c'>Retry · resume · escalate</span>"]
        B --> C
        C -.->|on fault| R
        R -.->|resume| C
    end

    subgraph verify["Verify"]
        D["Signed receipt<br/><span style='font-size:11px;color:#047857'>Metadata · hash · chain</span>"]
        E["Team review<br/><span style='font-size:11px;color:#047857'>Console or API</span>"]
        D --> E
    end

    A --> B
    C --> D

    style request fill:#fafafa,stroke:#ebebeb,stroke-width:1px,color:#8f8f8f
    style execute fill:#fafafa,stroke:#ebebeb,stroke-width:1px,color:#8f8f8f
    style verify fill:#fafafa,stroke:#ebebeb,stroke-width:1px,color:#8f8f8f

    classDef stage fill:#ffffff,stroke:#d4d4d4,color:#171717,stroke-width:1px
    classDef proof fill:#ecf5ed,stroke:#b8dfc4,color:#047857,stroke-width:1px
    classDef fault fill:#fdf4f4,stroke:#f0c4c4,color:#be123c,stroke-width:1px

    class A,B,C stage
    class D,E proof
    class R fault`

const HOW_IT_WORKS_LEGEND = [
  { label: 'Request', swatch: 'bg-[#fafafa] border-[#d4d4d4]' },
  { label: 'Execute', swatch: 'bg-white border-[#d4d4d4]' },
  { label: 'Proof', swatch: 'bg-[#ecf5ed] border-[#b8dfc4]' },
  { label: 'Recovery', swatch: 'bg-[#fdf4f4] border-[#f0c4c4]' },
] as const

const ARTICLE: Block[] = [
  { type: 'h2', text: 'Action layer' },
  { type: 'lead', text: 'Agents already do useful work. Igris makes it safer to trust.' },
  { type: 'p', text: 'Agents can still plan, decide, and request work in their own way. Igris starts when that request becomes an action your team needs to govern.' },

  { type: 'section', text: 'From request to review' },
  { type: 'p', text: 'Direct calls are easy to start, but they become harder to manage once agents begin taking actions across workflows your team depends on. A request can succeed and still leave important questions unanswered: who requested it, whether it was allowed, whether approval was needed, what failed, what recovered, and what record exists after the action finished.' },
  { type: 'p', text: 'Igris gives each action the same path from request to review. The flow, example call, and run record below show what that looks like in practice.' },
  { type: 'how-it-works' },
  { type: 'code-card', label: 'Agent call', code: 'await fetch("https://overture.igrisinertial.com/v1/actions/create_invoice/run", {\n  method: "POST",\n  headers: {\n    Authorization: `Bearer ${IGRIS_API_KEY}`,\n    "Content-Type": "application/json",\n  },\n  body: JSON.stringify({\n    input: {\n      title: "Review failed payment",\n      priority: "high",\n    },\n    idempotency_key: "payment-review-2026-06",\n  }),\n});' },
  { type: 'p', text: 'This gives agents useful capabilities without handing them direct access to every tool, credential, workflow, or endpoint.' },

  { type: 'section', text: 'What Igris adds' },
  { type: 'p', text: 'Beyond routing, Igris leaves a run record your team can open later: who triggered the action, what changed, what failed, what recovered, and the signed receipt attached to the run.' },
  { type: 'changes-panel' },
  { type: 'p-with-resources', text: 'That matters once agents can trigger work, change data, call services, open tasks, or perform operational steps your team depends on.' },

  { type: 'section', text: 'Get started' },
  { type: 'p', text: 'Install Igris and connect your first agent.' },
  { type: 'code', text: 'curl -fsSL https://igrisinertial.com/install | bash' },
  { type: 'agent-setup' },
  { type: 'p', text: 'After installation, log in, connect an agent, register an action, run it, and review the result in the console.' },
]

const SECTION_TITLE_STYLE: CSSProperties = {
  ...TITLE_STYLE,
  fontSize: 'clamp(1.5rem, 3.4vw, 2rem)',
}

function formatTierFeatures(features: string[]): string {
  if (features.length === 0) return ''
  if (features.length === 1) return `${features[0]}.`
  return `${features.slice(0, -1).join(', ')}, and ${features[features.length - 1]}.`
}

function PricingTierRow({
  tier,
  interval,
  isLast,
}: {
  tier: (typeof PRICING_TIERS)[number]
  interval: BillingInterval
  isLast: boolean
}) {
  const billing = getTierBilling(tier, interval)

  return (
    <div className={isLast ? '' : 'pb-10 mb-10 border-b border-dashed border-[#d4d4d4]'}>
      <div className="flex w-full items-baseline justify-between gap-8">
        <span
          className="text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.4, letterSpacing: '-0.01em' }}
        >
          {tier.name}
        </span>
        <div className="shrink-0">
          <TierPriceDisplay
            billing={billing}
            tierKey={tier.key}
            interval={interval}
            variant="inline"
            summary
            stableLayout
          />
        </div>
      </div>

      <div className="pt-6">
        <p
          className="text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {tier.description}
        </p>
        <p
          className="mt-5 text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {formatTierFeatures(tier.features)}
        </p>
        <div className="pt-7">
          <a
            href={billing.checkoutUrl}
            target={billing.checkoutUrl.startsWith('mailto:') ? undefined : '_blank'}
            rel={billing.checkoutUrl.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
            className="inline-flex items-center justify-center h-10 px-4 text-[14px] font-medium rounded-[20px] transition-colors border border-[rgba(0,0,0,0.1)] dark:border-white/[0.12] bg-white dark:bg-transparent text-[#171717] dark:text-[#f6f6f4] hover:bg-[#fafafa] dark:hover:bg-white/[0.06] hover:border-[rgba(0,0,0,0.15)]"
            style={{ fontFamily: SANS }}
          >
            {billing.cta}
          </a>
        </div>
      </div>
    </div>
  )
}

function VisionPricingBlock({
  interval,
  onIntervalChange,
}: {
  interval: BillingInterval
  onIntervalChange: (next: BillingInterval) => void
}) {
  const [open, setOpen] = useState(false)

  return (
    <div id="vision-pricing" className="mt-10 mb-8 scroll-mt-28">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="mb-2 flex w-full items-center gap-2 text-left text-black transition-colors hover:text-[#52525b] cursor-pointer"
        style={SECTION_TITLE_STYLE}
        aria-expanded={open}
      >
        <span>Pricing</span>
        <ChevronDown
          size={18}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <p
        className="mb-5 text-[#27272a]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
      >
        {PRICING_VISION_SUBTEXT}
      </p>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          {open ? (
            <div>
              <BillingToggle
                interval={interval}
                onChange={onIntervalChange}
                rounded="pill"
                align="left"
                showSavingsLabel={false}
                layoutId="billing-toggle-pill-vision"
              />
              <div className="flex flex-col pt-2">
                {PRICING_TIERS.map((tier, index) => (
                  <PricingTierRow
                    key={tier.key}
                    tier={tier}
                    interval={interval}
                    isLast={index === PRICING_TIERS.length - 1}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function HowItWorksBlock() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    preloadMermaid()
  }, [])

  return (
    <figure className="mb-8" aria-label="How Igris works">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <Workflow size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>How it works</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4" aria-hidden={!open}>
            <div className="overflow-hidden rounded-[12px] border border-[#ebebeb] bg-white">
              <MermaidChart chart={HOW_IT_WORKS_CHART} variant="featured" animateIn={false} />
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[#ebebeb] px-5 py-3 sm:px-6">
                {HOW_IT_WORKS_LEGEND.map((item) => (
                  <span
                    key={item.label}
                    className="inline-flex items-center gap-2 text-[12px] text-[#52525b]"
                    style={{ fontFamily: SANS }}
                  >
                    <span className={`size-2.5 shrink-0 rounded-[3px] border ${item.swatch}`} aria-hidden />
                    {item.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  )
}

function CodeCardBlock({ label, code }: { label: string; code: string }) {
  const [open, setOpen] = useState(false)

  const summary = 'POST /v1/actions/create_invoice/run'

  return (
    <div className="mb-7">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <Code size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>{label}</span>
        <span className="text-[#8f8f8f]" style={{ fontFamily: MONO, fontSize: '1.125rem' }}>
          {summary}
        </span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="pt-4">
          <div className="border border-[#ebebeb] rounded-[10px] bg-white overflow-hidden">
            <div className="px-5 py-4">
              <code
                className="whitespace-pre"
                style={{ fontFamily: MONO, fontWeight: 400, fontSize: '1.125rem', lineHeight: 1.6 }}
              >
                <HighlightCode code={code} />
              </code>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function CodeBlockWithCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-7 border border-[#ebebeb] rounded-[10px] bg-white overflow-hidden">
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <code
          className="text-[#27272a] whitespace-pre shrink-0"
          style={{ fontFamily: MONO, fontWeight: 400, fontSize: '1.125rem', lineHeight: 1.65 }}
        >
          {text}
        </code>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#8f8f8f] hover:text-[#171717] transition-colors shrink-0 mt-0.5"
          style={{ fontFamily: SANS }}
        >
          <Copy size={14} strokeWidth={1.5} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

const KEYWORDS = new Set([
  'await', 'async', 'const', 'let', 'var', 'function', 'return', 'new',
  'import', 'export', 'from', 'default', 'if', 'else', 'for', 'of', 'in',
  'while', 'do', 'switch', 'case', 'break', 'continue',
  'true', 'false', 'null', 'undefined', 'throw', 'try', 'catch', 'finally',
  'typeof', 'instanceof', 'class', 'extends', 'super', 'this', 'yield',
  'delete', 'void', 'with', 'debugger',
])

const GLOBALS = new Set([
  'fetch', 'console', 'JSON', 'Promise', 'Math', 'Date', 'Array', 'Object',
  'Map', 'Set', 'WeakMap', 'WeakSet', 'Reflect', 'Proxy', 'Symbol', 'Error',
  'RegExp', 'String', 'Number', 'Boolean', 'BigInt', 'parseInt', 'parseFloat',
  'isNaN', 'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'structuredClone', 'crypto',
])

type TokenType =
  | 'keyword' | 'global' | 'string' | 'template' | 'template-expr'
  | 'number' | 'object-key' | 'method' | 'punctuation' | 'operator'
  | 'comment' | 'text' | 'property'

type Token = { text: string; type: TokenType }

const COLORS: Record<TokenType, string> = {
  keyword:       '#cf222e',
  global:        '#8250df',
  string:        '#0a3069',
  template:      '#0a3069',
  'template-expr':'#953800',
  number:        '#0550ae',
  'object-key':  '#0550ae',
  method:        '#8250df',
  punctuation:   '#636c76',
  operator:      '#cf222e',
  comment:       '#6e7781',
  text:          '#24292f',
  property:      '#0550ae',
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < code.length) {
    const ch = code[i]

    // Whitespace
    if (/^\s$/.test(ch)) {
      let ws = ''
      while (i < code.length && /^\s$/.test(code[i])) { ws += code[i]; i++ }
      tokens.push({ text: ws, type: 'text' })
      continue
    }

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      let c = ''
      while (i < code.length && code[i] !== '\n') { c += code[i]; i++ }
      tokens.push({ text: c, type: 'comment' })
      continue
    }

    // Template literal
    if (ch === '`') {
      let tpl = '`'; i++
      while (i < code.length) {
        if (code[i] === '\\' && i + 1 < code.length) { tpl += code[i] + code[i + 1]; i += 2; continue }
        if (code[i] === '`') { tpl += '`'; i++; break }
        if (code[i] === '$' && code[i + 1] === '{') {
          if (tpl) tokens.push({ text: tpl, type: 'template' })
          tokens.push({ text: '${', type: 'template-expr' }); i += 2
          let depth = 1; let expr = ''
          while (i < code.length && depth > 0) {
            if (code[i] === '{') depth++
            if (code[i] === '}') depth--
            if (depth > 0) expr += code[i]; i++
          }
          tokens.push(...tokenize(expr))
          tokens.push({ text: '}', type: 'template-expr' })
          tpl = ''
          continue
        }
        tpl += code[i]; i++
      }
      if (tpl) tokens.push({ text: tpl, type: 'template' })
      continue
    }

    // String (double or single quote)
    if (ch === '"' || ch === "'") {
      const q = ch; let s = q; i++
      while (i < code.length) {
        if (code[i] === '\\' && i + 1 < code.length) { s += code[i] + code[i + 1]; i += 2; continue }
        if (code[i] === q) { s += q; i++; break }
        s += code[i]; i++
      }
      tokens.push({ text: s, type: 'string' })
      continue
    }

    // Number
    if (/^[\d]$/.test(ch)) {
      let n = ''
      while (i < code.length && /^[\d.]$/.test(code[i])) { n += code[i]; i++ }
      tokens.push({ text: n, type: 'number' })
      continue
    }

    // Word
    if (/^\w$/.test(ch)) {
      let word = ''
      while (i < code.length && /^\w$/.test(code[i])) { word += code[i]; i++ }

      // Look ahead for what follows
      let j = i
      while (j < code.length && /^\s$/.test(code[j])) j++
      const next = code[j]

      if (KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' })
      } else if (next === '(') {
        tokens.push({ text: word, type: GLOBALS.has(word) ? 'global' : 'method' })
      } else if (next === ':') {
        tokens.push({ text: word, type: 'object-key' })
      } else if (GLOBALS.has(word)) {
        tokens.push({ text: word, type: 'global' })
      } else {
        tokens.push({ text: word, type: 'text' })
      }
      continue
    }

    // Two-char operators
    if (i + 1 < code.length) {
      const two = ch + code[i + 1]
      if (/^(==|===|!=|!==|<=|>=|&&|\|\||=>|\+\+|--|\*\*|\+=|-=|\*=|%=|&=|\|=|\^=|<<|>>|\?\?)$/.test(two)) {
        tokens.push({ text: two, type: 'operator' }); i += 2; continue
      }
    }

    // Single-char operators
    if (/^[=+\-*/%&|^~!<>?]$/.test(ch)) {
      tokens.push({ text: ch, type: 'operator' }); i++; continue
    }

    // Property access (dot then word)
    if (ch === '.') {
      tokens.push({ text: '.', type: 'punctuation' }); i++
      let word = ''
      while (i < code.length && /^\w$/.test(code[i])) { word += code[i]; i++ }
      if (word) tokens.push({ text: word, type: 'property' })
      continue
    }

    // Punctuation
    if (/^[{}()\[\],;:]$/.test(ch)) {
      tokens.push({ text: ch, type: 'punctuation' }); i++; continue
    }

    tokens.push({ text: ch, type: 'text' }); i++
  }
  return tokens
}

function HighlightCode({ code }: { code: string }) {
  const tokens = tokenize(code)
  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: COLORS[t.type] }}>{t.text}</span>
      ))}
    </span>
  )
}

function ArticleBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'kicker':
      return (
        <p
          className="mb-4 text-xs font-medium uppercase text-[#8f8f8f]"
          style={{ fontFamily: SANS, letterSpacing: '0.18em' }}
        >
          {block.text}
        </p>
      )
    case 'h2':
      return (
        <h3
          className="mb-5 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: 'clamp(2.5rem, 6vw, 4rem)', lineHeight: 1.05, letterSpacing: '-0.045em' }}
        >
          {block.text}
        </h3>
      )
    case 'section': {
      const sectionId = VISION_SECTION_IDS[block.text]
      return (
        <h4
          id={sectionId}
          className="mb-5 mt-10 scroll-mt-28 text-black"
          style={SECTION_TITLE_STYLE}
        >
          {block.text}
        </h4>
      )
    }
    case 'sub':
      return (
        <h5
          className="mb-3 mt-12 text-[#171717]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        >
          {block.text}
        </h5>
      )
    case 'lead':
      return (
        <p
          className="mb-8 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: 'clamp(1.5rem, 2.8vw, 1.875rem)', lineHeight: 1.45, letterSpacing: '-0.02em' }}
        >
          {block.text}
        </p>
      )
    case 'p':
      return (
        <p
          className="mb-6 text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {block.text}
        </p>
      )
    case 'code':
      return <CodeBlockWithCopy text={block.text} />
    case 'code-card':
      return <CodeCardBlock label={block.label} code={block.code} />
    case 'p-badges': {
      const badgeWords = ['policy', 'recovery', 'proof', 'review']
      const regex = new RegExp(`(${badgeWords.join('|')})`, 'gi')
      const parts = block.text.split(regex)
      return (
        <p
          className="mb-6 text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {parts.map((part, i) =>
            badgeWords.includes(part.toLowerCase()) ? (
              <span
                key={i}
                className="inline-flex items-center rounded-[8px] bg-[#f0f0f0] dark:bg-white/[0.08] px-2 py-0.5 text-[0.85em] font-medium text-[#171717]"
              >
                {part}
              </span>
            ) : (
              <span key={i}>{part}</span>
            )
          )}
        </p>
      )
    }
    case 'p-code-inline':
    case 'p-with-resources': {
      const codeWords = ['control', 'inspect', 'recover', 'improve']
      const regex = new RegExp(`\\b(${codeWords.join('|')})\\b`, 'gi')
      const parts = block.text.split(regex)
      return (
        <>
          <p
            className="mb-3 text-[#27272a]"
            style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
          >
            {parts.map((part, i) =>
              codeWords.includes(part.toLowerCase()) ? (
                <code
                  key={i}
                  className="rounded-[6px] bg-[#f0f0f0] px-1.5 py-0.5 text-[0.875em] font-normal text-[#171717]"
                  style={{ fontFamily: MONO }}
                >
                  {part}
                </code>
              ) : (
                <span key={i}>{part}</span>
              )
            )}
          </p>
          {block.type === 'p-with-resources' && (
            <Link
              href={DOCS_LINKS.home}
              className="inline-flex items-center gap-2 mb-8 text-[#171717] transition-colors hover:text-[#52525b]"
              style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
            >
              <BookOpen size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
              <span>Read the docs</span>
            </Link>
          )}
        </>
      )
    }
    case 'divider':
      return <hr className="my-14 border-0 border-t border-[#ececec]" />
    case 'how-it-works':
      return <HowItWorksBlock />
    case 'changes-panel':
      return <VisionChangesPanel />
    case 'agent-setup':
      return <AgentSetupLogos />
    default:
      return null
  }
}

export default function Vision() {
  // ARTICLE[0] is the "Action layer" title, now rendered as the hero below.
  const bodyBlocks = ARTICLE.slice(1)
  const [interval, setBillingInterval] = useState<BillingInterval>('yearly')
  const [promptCopied, setPromptCopied] = useState(false)

  useEffect(() => {
    preloadMermaid()
  }, [])

  const copySetupPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CODING_AGENT_PROMPT)
      setPromptCopied(true)
      setTimeout(() => setPromptCopied(false), 2000)
    } catch {
      setPromptCopied(false)
    }
  }

  return (
    <section
      aria-labelledby="vision-heading"
      className="bg-white text-[#171717]"
    >
      <h2 id="vision-heading" className="sr-only">Vision</h2>
      <RunHistoryRail />
      <div className="mx-auto max-w-[1200px] px-4 pt-24 pb-52 sm:px-6 lg:px-8 md:pt-36 md:pb-72">
        <article className="mx-auto max-w-[920px]">
          <h3 id="vision-hero" className="mb-4 mt-3 scroll-mt-28 text-black" style={TITLE_STYLE}>
            Action layer{' '}
            <HoverPhrase
              base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">for AI agents</span>}
              cont={LINE_1_CONT}
            />
            <br />
            <HoverPhrase
              base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">Run actions safely</span>}
              cont={LINE_2_CONT}
            />
            ,{' '}
            <br />
            with{' '}
            <HoverPhrase
              base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">proof from every run</span>}
              cont={LINE_3_CONT}
              endPunct="."
            />
          </h3>

          {bodyBlocks.length > 0 && <ArticleBlock block={bodyBlocks[0]} />}

          <div className="flex flex-wrap items-center gap-4 mb-12">
            <Link
              href="/auth?mode=signup"
              prefetch={false}
              className="inline-flex h-12 items-center justify-center rounded-[20px] px-6 bg-[#171717] text-white text-[15px] hover:bg-[#383838] transition-colors"
              style={{ fontFamily: SANS, fontWeight: 500 }}
            >
              Get API Key
            </Link>
            <button
              type="button"
              onClick={copySetupPrompt}
              className="inline-flex h-12 items-center justify-center gap-1.5 rounded-[20px] border border-[rgba(0,0,0,0.1)] dark:border-white/[0.12] bg-white dark:bg-transparent px-6 text-[15px] text-[#171717] dark:text-[#f6f6f4] hover:bg-[#fafafa] dark:hover:bg-white/[0.06] hover:border-[rgba(0,0,0,0.15)] transition-colors"
              style={{ fontFamily: SANS, fontWeight: 500 }}
            >
              <Copy size={15} strokeWidth={1.5} className="text-[#8f8f8f]" />
              {promptCopied ? 'Copied' : 'Copy setup prompt'}
            </button>
          </div>

          <img src="/pkrllgol.png" alt="" className="w-full mb-14 rounded-[10px]" />

          {bodyBlocks.slice(1).map((block, index) => (
            <ArticleBlock key={index + 1} block={block} />
          ))}

          <VisionPricingBlock interval={interval} onIntervalChange={setBillingInterval} />

          <div id="vision-questions" className="mt-20 mb-8 scroll-mt-28">
            <h4 className="mb-5 text-black" style={SECTION_TITLE_STYLE}>
              Questions
            </h4>
            <Faq simple />
          </div>

        </article>
      </div>
      <Footer />
    </section>
  )
}