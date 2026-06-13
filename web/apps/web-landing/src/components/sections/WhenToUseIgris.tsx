'use client'

import React from 'react'
import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const borderStyle = 'var(--capabilities-border)'

const copyStyle: CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
  lineHeight: 1.6,
  letterSpacing: '-0.01em',
}

const cards = [
  {
    title: 'Real side effects',
    body: 'Use Igris when agents need to perform actions with business impact — creating invoices, calling APIs, triggering workflows, writing to databases, or changing state.',
  },
  {
    title: 'Auditability and proof',
    body: 'Use Igris when your team needs a clear record of what the agent actually did, not just logs, screenshots, or a final answer.',
  },
  {
    title: 'Hybrid execution',
    body: 'Use Igris when some actions run through cloud endpoints and others need private, local, edge, or internal execution with the same governance model.',
  },
  {
    title: 'Opinionated execution',
    body: 'Use Igris when you want stronger boundaries, recovery, and proof than a general workflow engine usually provides.',
  },
] as const

const chainSteps = ['Reasoning framework', 'Igris action', 'Receipt / proof'] as const

export default function WhenToUseIgris() {
  return (
    <section
      id="when-to-use"
      aria-labelledby="when-to-use-heading"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="px-0">
        <div className="px-0">
          <div style={{ borderTop: borderStyle, borderLeft: borderStyle }}>
            <div
              className="px-7 md:px-9 pt-10 md:pt-14 pb-6 md:pb-8"
              style={{ borderRight: borderStyle, borderBottom: borderStyle }}
            >
              <h2
                id="when-to-use-heading"
                className="text-gray-600 dark:text-[#a8a898] max-w-[78ch]"
                style={copyStyle}
              >
                Use Igris when the action matters.
              </h2>
              <p
                className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[78ch]"
                style={copyStyle}
              >
                Igris is most useful when agent actions have consequences and your team
                needs control, recovery, and proof around execution.
              </p>
            </div>

          <div className="grid grid-cols-1 sm:grid-cols-2">
            {cards.map((card) => (
              <article
                key={card.title}
                className="flex flex-col px-7 md:px-9 py-8 md:py-10"
                style={{ borderRight: borderStyle, borderBottom: borderStyle }}
              >
                <p className="text-gray-600 dark:text-[#a8a898] max-w-[52ch]" style={copyStyle}>
                  <span className="text-gray-600 dark:text-[#a8a898]">{card.title}. </span>
                  {card.body}
                </p>
              </article>
            ))}
          </div>
          </div>

          <aside
            className="mt-6 md:mt-8 px-7 md:px-9 py-6 md:py-7 rounded-lg border border-gray-200 dark:border-[rgba(246,246,244,0.12)] bg-gray-50/80 dark:bg-[#161515]/60"
            aria-label="Works alongside your agent stack"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
              <div className="max-w-[62ch]">
                <p className="text-gray-600 dark:text-[#a8a898]" style={copyStyle}>
                  Fits into your agent stack. Use your agent framework for reasoning and planning.
                  Use Igris for the final actions that need policy, recovery, and receipts.
                </p>
              </div>

              <div
                className="flex flex-wrap items-center gap-2 text-gray-500 dark:text-[#8a8a7a] shrink-0"
                style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em' }}
                aria-hidden
              >
                {chainSteps.map((step, i) => (
                  <React.Fragment key={step}>
                    <span className="px-2.5 py-1 rounded border border-gray-200 dark:border-[rgba(246,246,244,0.1)] text-gray-600 dark:text-[#a8a898]">
                      {step}
                    </span>
                    {i < chainSteps.length - 1 && (
                      <ArrowRight className="w-3 h-3 opacity-40" strokeWidth={1.5} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </aside>

          <div className="pb-6 md:pb-8" />
        </div>
      </div>
    </section>
  )
}