'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { Copy } from 'lucide-react'
import Footer from './Footer'
import RunHistoryRail from './RunHistoryRail'
import OutcomeStatesPanel from './OutcomeStatesPanel'
import RunProofPanel from './RunProofPanel'
import { DOCS_LINKS } from '../../lib/docs-urls'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const TITLE_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.045em',
}

const SECTION_TITLE_STYLE: CSSProperties = {
  ...TITLE_STYLE,
  fontSize: 'clamp(1.5rem, 3.4vw, 2rem)',
}

const BODY_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: '1.375rem',
  lineHeight: 1.75,
}

const LEAD_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(1.5rem, 2.8vw, 1.875rem)',
  lineHeight: 1.45,
  letterSpacing: '-0.02em',
}

const SDK_EXAMPLE = `from igris import IgrisDurableClient

client = IgrisDurableClient.from_env()

run = client.run(
    "deploy.release",
    input={"service": "payments", "version": "1.4.2"},
    idempotency_key="deploy-payments-1.4.2",
    contract_hash=contract.contract_hash,
)

status = run.wait(timeout=60.0)
proof = run.proof()
print(status.status, proof.statuses)`

const HOW_STEPS = [
  {
    title: 'One durable execution boundary',
    body: 'The agent submits a consequential action once. Igris owns the run identity, progress, and outcome.',
  },
  {
    title: 'Normal actions complete transparently',
    body: 'When the effect finishes cleanly, the run completes and the agent moves on with a clear result.',
  },
  {
    title: 'Infrastructure failures recover when safe',
    body: 'Timeouts, worker crashes, and transient outages can resume without inventing a second effect.',
  },
  {
    title: 'Uncertain effects stop rather than guess',
    body: 'If Igris cannot tell whether an external effect already happened, the run stops for inspection instead of blindly retrying.',
  },
]

const USE_CASES = [
  {
    title: 'Coding agents',
    subtitle: 'Deployments and releases',
    body: 'Ship code, cut releases, and roll changes without duplicating a deploy when a worker dies mid-run.',
  },
  {
    title: 'Infrastructure agents',
    subtitle: 'Provisioning and configuration',
    body: 'Create resources and apply config changes with a durable boundary around actions that mutate real environments.',
  },
  {
    title: 'Operational agents',
    subtitle: 'Database and external API actions',
    body: 'Run refunds, schema changes, and third-party API calls where a timeout is not the same as a safe retry.',
  },
]

const PROBLEM_POINTS = [
  {
    title: 'Agents are starting to change real systems',
    body: 'Coding, infrastructure, and operational agents no longer stop at drafts. They deploy, provision, and call APIs that have consequences.',
  },
  {
    title: 'A timeout does not tell you what happened',
    body: 'When a worker dies or a request times out, ordinary tools leave you unsure whether the external effect already landed.',
  },
  {
    title: 'Blind retries can duplicate consequential actions',
    body: 'Retrying the same deploy, refund, or provision call can create a second effect. Ordinary retries were built for read-mostly work, not irreversible side effects.',
  },
]

const PY_KEYWORDS = new Set([
  'from', 'import', 'as', 'def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while',
  'with', 'try', 'except', 'finally', 'raise', 'pass', 'break', 'continue', 'lambda',
  'yield', 'async', 'await', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is',
  'print',
])

type TokenType = 'keyword' | 'string' | 'number' | 'method' | 'punctuation' | 'operator' | 'comment' | 'text' | 'property'

type Token = { text: string; type: TokenType }

const COLORS: Record<TokenType, string> = {
  keyword: '#cf222e',
  string: '#0a3069',
  number: '#0550ae',
  method: '#8250df',
  punctuation: '#636c76',
  operator: '#cf222e',
  comment: '#6e7781',
  text: '#24292f',
  property: '#0550ae',
}

function tokenizePython(code: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < code.length) {
    const ch = code[i]

    if (/^\s$/.test(ch)) {
      let ws = ''
      while (i < code.length && /^\s$/.test(code[i])) {
        ws += code[i]
        i++
      }
      tokens.push({ text: ws, type: 'text' })
      continue
    }

    if (ch === '#') {
      let c = ''
      while (i < code.length && code[i] !== '\n') {
        c += code[i]
        i++
      }
      tokens.push({ text: c, type: 'comment' })
      continue
    }

    if (ch === '"' || ch === "'") {
      const q = ch
      let s = q
      i++
      while (i < code.length) {
        if (code[i] === '\\' && i + 1 < code.length) {
          s += code[i] + code[i + 1]
          i += 2
          continue
        }
        if (code[i] === q) {
          s += q
          i++
          break
        }
        s += code[i]
        i++
      }
      tokens.push({ text: s, type: 'string' })
      continue
    }

    if (/^[\d]$/.test(ch)) {
      let n = ''
      while (i < code.length && /^[\d.]$/.test(code[i])) {
        n += code[i]
        i++
      }
      tokens.push({ text: n, type: 'number' })
      continue
    }

    if (/^\w$/.test(ch)) {
      let word = ''
      while (i < code.length && /^[\w]$/.test(code[i])) {
        word += code[i]
        i++
      }
      let j = i
      while (j < code.length && /^\s$/.test(code[j])) j++
      const next = code[j]
      if (PY_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' })
      } else if (next === '(') {
        tokens.push({ text: word, type: 'method' })
      } else {
        tokens.push({ text: word, type: 'text' })
      }
      continue
    }

    if (ch === '.') {
      tokens.push({ text: '.', type: 'punctuation' })
      i++
      let word = ''
      while (i < code.length && /^\w$/.test(code[i])) {
        word += code[i]
        i++
      }
      if (word) tokens.push({ text: word, type: 'property' })
      continue
    }

    if (/^[=+\-*/%<>!]$/.test(ch)) {
      tokens.push({ text: ch, type: 'operator' })
      i++
      continue
    }

    if (/^[{}()\[\],:]$/.test(ch)) {
      tokens.push({ text: ch, type: 'punctuation' })
      i++
      continue
    }

    tokens.push({ text: ch, type: 'text' })
    i++
  }
  return tokens
}

function HighlightPython({ code }: { code: string }) {
  const tokens = tokenizePython(code)
  return (
    <span>
      {tokens.map((t, i) => (
        <span key={i} style={{ color: COLORS[t.type] }}>{t.text}</span>
      ))}
    </span>
  )
}

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h4 id={id} className="mb-5 mt-10 scroll-mt-28 text-black" style={SECTION_TITLE_STYLE}>
      {children}
    </h4>
  )
}

function Body({ children, className = 'mb-6' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`${className} text-[#27272a]`} style={BODY_STYLE}>
      {children}
    </p>
  )
}

function SdkExampleCard() {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(SDK_EXAMPLE)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="mb-8 border border-[#ebebeb] rounded-[10px] bg-white overflow-hidden">
      <div className="flex items-center justify-between gap-4 border-b border-[#ebebeb] px-5 py-3">
        <span className="text-[#8f8f8f]" style={{ fontFamily: MONO, fontSize: '0.875rem' }}>
          Python · IgrisDurableClient
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[12px] text-[#8f8f8f] hover:text-[#171717] transition-colors"
          style={{ fontFamily: SANS }}
        >
          <Copy size={14} strokeWidth={1.5} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="px-5 py-4 overflow-x-auto">
        <code
          className="whitespace-pre"
          style={{ fontFamily: MONO, fontWeight: 400, fontSize: '1.05rem', lineHeight: 1.65 }}
        >
          <HighlightPython code={SDK_EXAMPLE} />
        </code>
      </div>
    </div>
  )
}

function CtaPair({ primaryHref = '/auth?mode=signup' }: { primaryHref?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <Link
        href={primaryHref}
        prefetch={false}
        className="inline-flex h-12 items-center justify-center rounded-[20px] px-6 bg-[#171717] text-white text-[15px] hover:bg-[#383838] transition-colors"
        style={{ fontFamily: SANS, fontWeight: 500 }}
      >
        Get started
      </Link>
      <a
        href={DOCS_LINKS.home}
        className="inline-flex h-12 items-center justify-center rounded-[20px] border border-[rgba(0,0,0,0.1)] bg-white px-6 text-[15px] text-[#171717] hover:bg-[#fafafa] hover:border-[rgba(0,0,0,0.15)] transition-colors"
        style={{ fontFamily: SANS, fontWeight: 500 }}
      >
        Read the docs
      </a>
    </div>
  )
}

export default function Vision() {
  return (
    <section aria-labelledby="vision-heading" className="bg-white text-[#171717]">
      <h2 id="vision-heading" className="sr-only">
        Reliable execution for AI agents
      </h2>
      <RunHistoryRail />
      <div className="mx-auto max-w-[1200px] px-4 pt-24 pb-52 sm:px-6 lg:px-8 md:pt-36 md:pb-72">
        <article className="mx-auto max-w-[920px]">
          {/* Hero */}
          <h3 id="vision-hero" className="mb-5 mt-3 scroll-mt-28 text-black" style={TITLE_STYLE}>
            Reliable execution for AI agents.
          </h3>
          <p className="mb-8 text-[#171717]" style={LEAD_STYLE}>
            Run consequential actions durably. Recover from infrastructure failures. Stop when the outcome is uncertain.
          </p>
          <div className="mb-12">
            <CtaPair />
          </div>
          <img
            src="/pkrllgol.png"
            alt="Igris run timeline showing durable agent execution"
            className="w-full mb-14 rounded-[10px]"
          />

          {/* Problem */}
          <SectionHeading id="vision-problem">The problem</SectionHeading>
          <Body>
            Engineers building coding, infrastructure, and operational agents need more than model quality.
            Once an agent can change a real system, execution reliability becomes the product risk.
          </Body>
          <div className="mb-8 space-y-8">
            {PROBLEM_POINTS.map((point) => (
              <div key={point.title}>
                <h5
                  className="mb-2 text-[#171717]"
                  style={{ fontFamily: SANS, fontWeight: 500, fontSize: '1.375rem', lineHeight: 1.45, letterSpacing: '-0.01em' }}
                >
                  {point.title}
                </h5>
                <Body className="mb-0">{point.body}</Body>
              </div>
            ))}
          </div>

          {/* How Igris works */}
          <SectionHeading id="vision-how-it-works">How Igris works</SectionHeading>
          <Body>
            Igris gives agents one durable execution boundary for consequential actions.
            The agent still decides what to do. Igris makes the resulting effect safe to run, recover, or stop.
          </Body>
          <ol className="mb-8 space-y-7">
            {HOW_STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-4">
                <span
                  className="mt-1 shrink-0 text-[#8f8f8f] tabular-nums"
                  style={{ fontFamily: MONO, fontSize: '0.95rem' }}
                  aria-hidden
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h5
                    className="mb-2 text-[#171717]"
                    style={{ fontFamily: SANS, fontWeight: 500, fontSize: '1.375rem', lineHeight: 1.45, letterSpacing: '-0.01em' }}
                  >
                    {step.title}
                  </h5>
                  <Body className="mb-0">{step.body}</Body>
                </div>
              </li>
            ))}
          </ol>

          {/* Completed vs Recovered vs Uncertain */}
          <SectionHeading id="vision-outcomes">Completed, recovered, or uncertain</SectionHeading>
          <Body>
            Every durable run ends in a clear operational state. That is the difference between a timeout and an outcome you can trust.
          </Body>
          <OutcomeStatesPanel />

          {/* SDK example */}
          <SectionHeading id="vision-sdk">A short durable run</SectionHeading>
          <Body>
            Start an explicit durable run with a business idempotency key and the bound contract hash, wait for the terminal state, then inspect the proof.
          </Body>
          <SdkExampleCard />
          <Body>
            The example assumes the action is already synced and bound, so <code className="rounded-[6px] bg-[#f0f0f0] px-1.5 py-0.5 text-[0.875em]" style={{ fontFamily: MONO }}>contract</code> is in scope. It shows the public API shape, not an install command.
          </Body>

          {/* Use cases */}
          <SectionHeading id="vision-use-cases">Built for agents that change systems</SectionHeading>
          <Body>
            Igris is for engineers whose agents can deploy software, mutate infrastructure, or call APIs that affect production state.
          </Body>
          <div className="mb-8 grid gap-6 sm:grid-cols-1">
            {USE_CASES.map((useCase) => (
              <div key={useCase.title} className="border-t border-[#ebebeb] pt-6 first:border-t-0 first:pt-0">
                <h5
                  className="mb-1 text-[#171717]"
                  style={{ fontFamily: SANS, fontWeight: 500, fontSize: '1.375rem', lineHeight: 1.45, letterSpacing: '-0.01em' }}
                >
                  {useCase.title}
                </h5>
                <p
                  className="mb-2 text-[#8f8f8f]"
                  style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.125rem', lineHeight: 1.5 }}
                >
                  {useCase.subtitle}
                </p>
                <Body className="mb-0">{useCase.body}</Body>
              </div>
            ))}
          </div>

          {/* Run proof */}
          <SectionHeading id="vision-run-proof">Runs remain inspectable</SectionHeading>
          <Body>
            After the fact, your team can open the run and see what was requested, what completed, what recovered, and what stopped as uncertain.
          </Body>
          <RunProofPanel />

          {/* Final CTA */}
          <div id="vision-cta" className="mt-16 mb-4 scroll-mt-28">
            <h4 className="mb-5 text-black" style={SECTION_TITLE_STYLE}>
              Start with durable execution
            </h4>
            <Body>
              Give your agents a reliable boundary for consequential actions — before ordinary retries create a second effect.
            </Body>
            <CtaPair />
          </div>
        </article>
      </div>
      <Footer />
    </section>
  )
}
