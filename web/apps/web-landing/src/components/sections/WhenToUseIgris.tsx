'use client'

import React from 'react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const cards = [
  {
    title: 'Real side effects',
    body: 'Use Igris when agents need to perform actions with business impact: creating invoices, calling APIs, triggering workflows, writing to databases, or changing state.',
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

const CARD_CLASS =
  'landing-surface-card flex w-fit max-w-md flex-col rounded-xl border p-6 md:p-8 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] backdrop-blur-[2px] transition-colors duration-200 dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]'

export default function WhenToUseIgris() {
  return (
    <section
      id="when-to-use"
      aria-labelledby="when-to-use-heading"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="pt-10 md:pt-14 pb-20 md:pb-32">
        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between md:gap-8">
          <h2
            id="when-to-use-heading"
            className="shrink-0 text-gray-700 dark:text-[#c8c8b8]"
            style={{
              fontFamily: SANS,
              fontWeight: 400,
              fontSize: 'clamp(1.2rem, 2.6vw, 2rem)',
              lineHeight: 1.2,
              letterSpacing: '-0.02em',
              maxWidth: '28ch',
            }}
          >
            Use Igris when the action matters.
          </h2>
          <p
            className="max-w-[42ch] text-gray-600 dark:text-[#a8a898] md:text-right"
            style={{
              fontFamily: SANS,
              fontSize: 'clamp(1.05rem, 1.25vw, 1.2rem)',
              lineHeight: 1.6,
            }}
          >
            Igris is most useful when agent actions have consequences and your team
            needs control, recovery, and proof around execution.
          </p>
        </div>

        <div className="relative mt-12 overflow-hidden rounded-xl md:mt-16">
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-cover"
            style={{ backgroundImage: 'url(/pkrllgol.png)' }}
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-white/55 dark:bg-[#110f0f]/50"
            aria-hidden
          />
          <div className="relative z-10 flex flex-col items-start gap-3 p-6 md:gap-4 md:p-10">
          {cards.map((card, index) => (
            <article key={card.title} className={CARD_CLASS}>
              <p
                className="text-gray-400 dark:text-[#7a7a72]"
                style={{
                  fontFamily: MONO,
                  fontSize: '11px',
                  letterSpacing: '0.06em',
                }}
              >
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3
                className="mt-3 text-gray-700 dark:text-[#c8c8b8]"
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(1.05rem, 1.2vw, 1.15rem)',
                  fontWeight: 500,
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}
              >
                {card.title}
              </h3>
              <p
                className="mt-3 text-gray-600 dark:text-[#a8a898]"
                style={{
                  fontFamily: SANS,
                  fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                  lineHeight: 1.65,
                }}
              >
                {card.body}
              </p>
            </article>
          ))}
          </div>
        </div>
      </div>
    </section>
  )
}