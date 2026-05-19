'use client'

import React from 'react'

const SANS  = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO  = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'
const borderStyle = 'var(--capabilities-border)'

type Criterion = {
  num: string
  title: string
  body: string
  bullets: string[]
  wide?: boolean
}

const criteria: Criterion[] = [
  {
    num: '03.1',
    title: 'Touches real systems',
    body: 'Use Igris when agents read files, call APIs, update records, trigger workflows, or touch deployment paths. Side effects need to be counted, attributed, and bounded — not just generated.',
    bullets: ['files', 'APIs', 'databases', 'workflows', 'deployments'],
  },
  {
    num: '03.2',
    title: 'Cannot replay blindly',
    body: 'Use Igris when restarting a failed run from zero could repeat a committed action or leave the task half-finished. Recovery continues from recorded progress, not from the beginning.',
    bullets: ['recorded progress', 'clean-host recovery', 'no replay of committed actions'],
  },
  {
    num: '03.3',
    title: 'Needs proof after the run',
    body: 'Use Igris when operators or auditors need signed receipts, chain validation, and safe evidence summaries that survive recovery boundaries and remain verifiable without trusting any single dashboard.',
    bullets: ['signed receipts', 'chain validation', 'operator-readable evidence', 'no raw payloads'],
    wide: true,
  },
]

export default function WhenToUseIgris() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="px-0">
        <div className="px-0">

          <div className="pt-10 md:pt-14 pb-6 md:pb-8">
            <div
              className="pb-4 text-[10px] md:text-[11px] tracking-[0.22em] text-gray-500 dark:text-[#8a8a7a]"
              style={{ fontFamily: PIXEL }}
            >
              03&nbsp;·&nbsp;WHEN&nbsp;TO&nbsp;USE&nbsp;IGRIS
            </div>
            <h2
              className="text-[#000000] dark:text-[#f6f6f4]"
              style={{
                fontFamily: PIXEL,
                fontWeight: 500,
                fontSize: 'clamp(1.4rem, 2.6vw, 2rem)',
                lineHeight: 1.15,
                letterSpacing: '-0.005em',
                maxWidth: '28ch',
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
              Not every prompt needs durable execution. Use Igris when an agent
              touches real systems, failed retries can duplicate work, or your
              team needs proof after the run. Any one of the three criteria
              below is sufficient.
            </p>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ borderTop: borderStyle, borderLeft: borderStyle }}
          >
            {criteria.map((c) => (
              <article
                key={c.num}
                className={`flex flex-col px-7 md:px-9 py-8 md:py-10 ${c.wide ? 'md:col-span-2' : ''}`}
                style={{ borderRight: borderStyle, borderBottom: borderStyle }}
              >
                <div
                  className="text-gray-400 dark:text-[#5a5a52]"
                  style={{ fontFamily: PIXEL, fontSize: '11px', letterSpacing: '0.18em', fontVariantNumeric: 'tabular-nums' }}
                >
                  {c.num}
                </div>

                <h3
                  className="mt-3 text-[#000000] dark:text-[#f6f6f4]"
                  style={{
                    fontFamily: PIXEL,
                    fontSize: 'clamp(1.05rem, 1.4vw, 1.25rem)',
                    fontWeight: 500,
                    lineHeight: 1.2,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {c.title}
                </h3>

                <p
                  className="mt-3 text-gray-700 dark:text-[#c8c8b8] max-w-[62ch]"
                  style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
                >
                  {c.body}
                </p>

                <ul
                  className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-gray-600 dark:text-[#a8a898]"
                  style={{ fontFamily: MONO, fontSize: '12px', letterSpacing: '0.02em' }}
                >
                  {c.bullets.map((b) => (
                    <li key={b}>- {b}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>

          <div className="pb-6 md:pb-10" />

          </div>
      </div>
    </section>
  )
}
