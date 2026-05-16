'use client'

import React from 'react'

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'
const borderStyle = 'var(--section-border)'

type Card = {
  number: string
  title: string
  body: string
  detailLines: string[]
  accentWords: string[]
  fullWidth?: boolean
}

const cards: Card[] = [
  {
    number: '01',
    title: 'Touches real systems',
    body: 'Use Igris when agents read files, call APIs, update records, trigger workflows, or touch deployment paths.',
    detailLines: ['files', 'APIs', 'databases', 'workflows', 'deployments'],
    accentWords: ['real systems'],
  },
  {
    number: '02',
    title: 'Cannot replay blindly',
    body: 'Use Igris when restarting from zero could repeat a committed action or leave work half-finished.',
    detailLines: ['recorded progress', 'clean-host recovery', 'no replay of committed actions'],
    accentWords: ['no replay'],
  },
  {
    number: '03',
    title: 'Needs proof after the run',
    body: 'Use Igris when operators need signed receipts, chain validation, safe evidence summaries, and a clear record of what happened.',
    detailLines: ['signed receipts', 'chain validation', 'operator-readable evidence', 'no raw payloads exposed'],
    accentWords: ['signed receipts', 'chain validation'],
    fullWidth: true,
  },
]

function highlightAccents(text: string, accents: string[]) {
  if (!accents.length) return text
  const escaped = accents.map((a) => a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(`(${escaped.join('|')})`, 'gi')
  const parts = text.split(re)
  return parts.map((part, i) => {
    const isAccent = accents.some((a) => a.toLowerCase() === part.toLowerCase())
    return isAccent ? (
      <span key={i} className="text-emerald-700 dark:text-emerald-400">
        {part}
      </span>
    ) : (
      <React.Fragment key={i}>{part}</React.Fragment>
    )
  })
}

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
              Use Igris when the action matters.
            </h2>
            <p
              className="mt-5 text-gray-600 dark:text-[#a8a898] max-w-[62ch]"
              style={{
                fontFamily: SANS,
                fontSize: 'clamp(0.95rem, 1.05vw, 1rem)',
                lineHeight: 1.6,
              }}
            >
              Not every prompt needs durable execution. Use Igris when an agent touches real systems, failed retries can duplicate work, or your team needs proof after the run.
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
                className={`flex flex-col px-7 md:px-8 py-7 md:py-8 ${
                  card.fullWidth ? 'md:col-span-2 min-h-[260px]' : 'min-h-[300px]'
                }`}
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
                  className="mt-8 text-[#000000] dark:text-[#f6f6f4]"
                  style={{
                    fontFamily: SANS,
                    fontSize: 'clamp(1.1rem, 1.4vw, 1.25rem)',
                    fontWeight: 500,
                    lineHeight: 1.15,
                  }}
                >
                  {card.title}
                </h3>
                <p
                  className="mt-3 text-gray-700 dark:text-[#c8c8b8] max-w-[62ch]"
                  style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.55 }}
                >
                  {highlightAccents(card.body, card.accentWords)}
                </p>

                <ul
                  className={`mt-auto pt-6 flex flex-wrap gap-x-5 gap-y-2 text-gray-600 dark:text-[#a8a898]`}
                  style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.04em' }}
                >
                  {card.detailLines.map((line, index) => {
                    const isAccent = card.accentWords.some(
                      (a) => a.toLowerCase() === line.toLowerCase(),
                    )
                    return (
                      <li key={line} className="flex items-baseline gap-2">
                        <span
                          className="text-gray-400 dark:text-[#5a5a52]"
                          style={{ fontVariantNumeric: 'tabular-nums' }}
                        >
                          {card.number}.{index + 1}
                        </span>
                        <span
                          className={isAccent ? 'text-emerald-700 dark:text-emerald-400' : ''}
                        >
                          {line}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </article>
            ))}
          </div>

          <div
            className="py-8 md:py-10 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: MONO }}
          >
            Not&nbsp;for&nbsp;every&nbsp;prompt.&nbsp;Built&nbsp;for&nbsp;agent&nbsp;actions&nbsp;with&nbsp;consequences.
          </div>
        </div>
      </div>
    </section>
  )
}
