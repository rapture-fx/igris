'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import Link from 'next/link'
import Footer from './Footer'
import { PRICING_TIERS, getTierBilling } from '../../lib/pricing'
import type { BillingInterval } from '../../lib/pricing'
import { BillingToggle, TierPriceDisplay } from './Pricing'
import Faq from './Faq'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const LINE_1_CONT = ' to call APIs, trigger workflows, access files, and run tasks through one controlled action layer.'
const LINE_2_CONT = ' in Cloud, webhooks, MCP, and connected workers, with policy, recovery, and receipts built in.'
const LINE_3_CONT = ' that record what happened, recover from failures, and leave evidence your team can inspect.'

const TITLE_STYLE: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(2rem, 5vw, 3.2rem)',
  lineHeight: 1.12,
  letterSpacing: '-0.045em',
}

const VISION_CONT_EASE = [0.16, 1, 0.3, 1] as const
const VISION_CONT_TRANSITION = { duration: 0.45, ease: VISION_CONT_EASE }

// Continuation appears inline at full opacity (no blank gap), then eases into gray.
function HoverPhrase({ base, cont }: { base: ReactNode; cont: string }) {
  const [hovered, setHovered] = useState(false)
  const reduceMotion = useReducedMotion()

  return (
    <span
      className="cursor-default"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span>{base}</span>
      <AnimatePresence>
        {hovered && (
          <motion.span
            key="cont"
            initial={{ color: '#171717' }}
            animate={{ color: '#8f8f8f' }}
            exit={{ color: '#171717' }}
            transition={reduceMotion ? { duration: 0 } : VISION_CONT_TRANSITION}
            className="inline font-normal"
          >
            {cont}
          </motion.span>
        )}
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
  | { type: 'divider' }
  | { type: 'p-badges'; text: string }

const ARTICLE: Block[] = [
  { type: 'h2', text: 'Action layer' },
  { type: 'lead', text: 'Agents are already doing useful work. Igris makes that work safer to trust by routing important actions through one controlled path, where each request can be checked, executed, recovered if it fails, and recorded with proof your team can inspect later.' },
  { type: 'p', text: 'Agents can still plan, decide, and request work in their own way. Igris starts when that request becomes an action, giving the team a place to check what is allowed, require approval when needed, handle failure, and keep a record of what happened.' },

  { type: 'section', text: 'Why direct calls become hard to trust' },
  { type: 'p', text: 'Direct calls are easy to start, but they become harder to manage once agents begin taking actions across workflows your team depends on. A request can succeed and still leave important questions unanswered: who requested it, whether it was allowed, whether approval was needed, what happened when it failed, what was recovered, and what record exists after the action finished.' },
  { type: 'p', text: 'Igris gives those actions a controlled path from request to review. Instead of spreading responsibility across tool logs, scripts, credentials, and one-off integrations, Igris gives the team one place to check actions, run them, handle failure, and understand what happened afterward.' },

  { type: 'section', text: 'How Igris works' },
  { type: 'p', text: 'The Igris model has three simple parts. Agents request work, actions define what those agents are allowed to do, and execution paths decide where and how the work runs. An agent connects to Igris once, then asks Igris to run registered actions instead of calling every tool, workflow, credential, or endpoint directly.' },
  { type: 'p', text: 'An action can represent any useful operation a team wants to make available to an agent, such as changing a record, creating a task, sending a request, calling a service, triggering a workflow, or running work in a private runtime. Igris keeps that action visible, so the team can understand what agents can do, how the work was handled, and what happened after the request was made.' },

  { type: 'section', text: 'What Igris adds' },
  { type: 'p-badges', text: 'Igris adds policy, recovery, proof, and review around agent actions. Policy decides whether an action can run, needs approval, or should be blocked. Recovery makes failure visible when services return errors, runtimes go offline, or requests break. Proof gives the team a record after the action runs, so they are not relying only on the agent’s own explanation.' },
  { type: 'p', text: 'This matters when agents do more than answer questions. If an agent can trigger work, change data, call services, open tasks, or perform operational steps, the action needs a path the team can control, inspect, recover, and improve over time.' },

  { type: 'section', text: 'Get started' },
  { type: 'p', text: 'Install Igris and connect your first agent.' },
  { type: 'code', text: 'curl -fsSL https://igrisinertial.com/install | bash' },
  { type: 'p', text: 'After installation, log in, connect an agent, register an action, run it, and review the result in the console. The first setup should be simple: connect the agent once, route actions through Igris, and use the console to understand what happened.' },
]

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
    case 'section':
      return (
        <h4
          className="mb-5 mt-16 text-black"
          style={{ ...TITLE_STYLE, fontSize: 'clamp(1.5rem, 3.4vw, 2rem)' }}
        >
          {block.text}
        </h4>
      )
    case 'sub':
      return (
        <h5
          className="mb-3 mt-12 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 600, fontSize: '1.0625rem', lineHeight: 1.4, letterSpacing: '-0.01em' }}
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
      return (
        <p
          className="mb-7 whitespace-pre-line text-[#27272a]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
        >
          {block.text}
        </p>
      )
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
    case 'divider':
      return <hr className="my-14 border-0 border-t border-[#ececec]" />
    default:
      return null
  }
}

export default function Vision() {
  // ARTICLE[0] is the "Action layer" title, now rendered as the hero below.
  const bodyBlocks = ARTICLE.slice(1)
  const [interval, setInterval] = useState<BillingInterval>('yearly')

  return (
    <section
      aria-labelledby="vision-heading"
      className="bg-white text-[#171717]"
    >
      <h2 id="vision-heading" className="sr-only">Vision</h2>
      <div className="mx-auto max-w-[1200px] px-4 pt-24 pb-8 sm:px-6 lg:px-8 md:pt-36 md:pb-12 ">
        <article className="mx-auto max-w-[820px]">
          <div className="max-w-[640px]">
            <h3 className="mb-4 mt-3 text-black" style={TITLE_STYLE}>
              <HoverPhrase base={<>Action layer <span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">for AI agents</span></>} cont={LINE_1_CONT} />
              <br />
              <HoverPhrase base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">To execute safely</span>} cont={LINE_2_CONT} />
              {' and '}
              <HoverPhrase base={<span className="underline underline-offset-4 decoration-[#d4d4d4] decoration-2">proven by runs</span>} cont={LINE_3_CONT} />
            </h3>

          </div>

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
            <Link
              href="/auth?mode=signin"
              prefetch={false}
              className="inline-flex h-12 items-center justify-center rounded-[20px] border border-[rgba(0,0,0,0.1)] dark:border-white/[0.12] bg-white dark:bg-transparent px-6 text-[15px] text-[#171717] dark:text-[#f6f6f4] hover:bg-[#fafafa] dark:hover:bg-white/[0.06] hover:border-[rgba(0,0,0,0.15)] transition-colors"
              style={{ fontFamily: SANS, fontWeight: 500 }}
            >
              Setup an Agent
            </Link>
          </div>

          <img src="/pkrllgol.png" alt="" className="w-full mb-14 rounded-lg" />

          {bodyBlocks.slice(1).map((block, index) => (
            <ArticleBlock key={index + 1} block={block} />
          ))}

          <div className="mt-20 pt-12">
            <h4
              className="mb-5 mt-16 text-[#171717]"
          style={{ fontFamily: SANS, fontWeight: 400, fontSize: 'clamp(1.5rem, 3.4vw, 2rem)', lineHeight: 1.12, letterSpacing: '-0.045em' }}
            >
              Pricing
            </h4>
            <BillingToggle interval={interval} onChange={setInterval} rounded="pill" align="left" />
            <div className="flex flex-col border border-[#ebebeb] divide-y divide-[#ebebeb]">
              {PRICING_TIERS.map((tier) => {
                const billing = getTierBilling(tier, interval)
                return (
                  <div key={tier.key} className="flex flex-col p-6">
                    <div className="flex items-baseline justify-between gap-6">
                      <h5
                        className="text-[#171717]"
                        style={{ fontFamily: SANS, fontWeight: 600, fontSize: '1.5rem', lineHeight: 1.4, letterSpacing: '-0.01em' }}
                      >
                        {tier.name}
                      </h5>
                      <div className="shrink-0 text-right [&>div:first-child]:mt-0">
                        <TierPriceDisplay billing={billing} tierKey={tier.key} interval={interval} />
                      </div>
                    </div>
                    <p
                      className="mt-2 text-[#27272a]"
                      style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
                    >
                      {tier.description}
                    </p>
                    <p
                      className="mt-4 text-[#27272a]"
                      style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75 }}
                    >
                      {tier.features.join(', ')}
                    </p>
                    <div className="pt-5">
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
                )
              })}
            </div>
          </div>

          <div className="mt-20">
            <Faq simple />
          </div>
        </article>
      </div>
      <Footer />
    </section>
  )
}