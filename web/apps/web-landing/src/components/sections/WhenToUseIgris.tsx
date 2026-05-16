'use client'

import React from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

const cards = [
  {
    number: '01',
    title: 'Tool actions',
    body: 'Agents reading files, calling APIs, and updating records through controlled execution paths.',
    detailLines: ['file reads', 'API calls', 'record updates'],
  },
  {
    number: '02',
    title: 'Recovery-sensitive work',
    body: 'Multi-step tasks where restarting from zero could repeat an action or leave work half-finished.',
    detailLines: ['recorded progress', 'clean-host recovery', 'no replay of committed actions'],
  },
  {
    number: '03',
    title: 'Proof-required operations',
    body: 'Runs where teams need signed receipts, chain validation, and evidence they can verify later.',
    detailLines: ['signed receipts', 'chain valid', 'verification state'],
  },
  {
    number: '04',
    title: 'Operator-reviewed systems',
    body: 'Workflows where humans need a clear record of what happened without exposing raw payloads.',
    detailLines: ['safe summaries', 'runtime handoff visible', 'operator-ready record'],
  },
]

export default function WhenToUseIgris() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12">
          <div className="pt-20 md:pt-32 pb-10 md:pb-14">
            <div
              className="pb-5 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: MONO }}
            >
              03&nbsp;·&nbsp;WHEN&nbsp;TO&nbsp;USE&nbsp;IGRIS
            </div>
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(1.5rem, 2.6vw, 2.25rem)',
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                maxWidth: '24ch',
              }}
            >
              Use Igris when agent actions cannot fail silently.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Igris is for tasks where an agent touches real systems, committed actions must not be replayed, and your team needs verifiable evidence after the run.
            </p>
          </div>

          <div
            className="hidden md:flex items-center justify-between gap-4 pb-8 text-[10px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO }}
          >
            <span>USE&nbsp;CASE&nbsp;FIT</span>
            <span className="text-emerald-700 dark:text-emerald-400">ACTION&nbsp;·&nbsp;RECOVERY&nbsp;·&nbsp;PROOF</span>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ borderTop: borderStyle, borderLeft: borderStyle }}
          >
            {cards.map((card) => (
              <article
                key={card.number}
                className="flex min-h-[460px] flex-col px-7 md:px-8 py-7 md:py-8"
                style={{ borderRight: borderStyle, borderBottom: borderStyle }}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className="text-gray-400 dark:text-[#5a5a52]"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    {card.number}
                  </span>
                  <span
                    className="text-gray-500 dark:text-[#8a8a7a] text-right"
                    style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
                  >
                    FIT
                  </span>
                </div>

                <h3
                  className="mt-10 text-[#000000] dark:text-[#f6f6f4]"
                  style={{
                    fontFamily: SANS,
                    fontSize: 'clamp(1.15rem, 1.5vw, 1.35rem)',
                    fontWeight: 500,
                    lineHeight: 1.15,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  className="mt-4 text-gray-700 dark:text-[#c8c8b8]"
                  style={{ fontFamily: SANS, fontSize: '0.925rem', lineHeight: 1.55 }}
                >
                  {card.body}
                </p>

                <ol className="mt-auto pt-8 flex flex-col gap-y-2">
                  {card.detailLines.map((line, index) => (
                    <li
                      key={line}
                      className="grid items-baseline text-gray-600 dark:text-[#a8a898]"
                      style={{ gridTemplateColumns: '28px 1fr', gap: '8px' }}
                    >
                      <span
                        className={index === card.detailLines.length - 1 ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-400 dark:text-[#5a5a52]'}
                        style={{ fontFamily: MONO, fontSize: '11px', fontVariantNumeric: 'tabular-nums' }}
                      >
                        {card.number}.{index + 1}
                      </span>
                      <span style={{ fontFamily: SANS, fontSize: '0.85rem', lineHeight: 1.45 }}>
                        {line}
                      </span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>

          <div
            className="py-8 md:py-10 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO }}
          >
            Not&nbsp;for&nbsp;every&nbsp;prompt.&nbsp;Built&nbsp;for&nbsp;agent&nbsp;actions&nbsp;that&nbsp;touch&nbsp;real&nbsp;systems.
          </div>
        </div>
      </div>
    </section>
  )
}
