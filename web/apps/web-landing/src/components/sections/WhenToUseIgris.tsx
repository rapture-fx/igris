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
  visual?: 'cube-network'
}

const cards: Card[] = [
  {
    number: '01',
    title: 'Tool actions',
    body: 'Agents reading files, calling APIs, and updating records through controlled execution paths.',
    detailLines: ['file reads', 'API calls', 'record updates'],
    visual: 'cube-network',
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

function IsoCube({
  x,
  y,
  size = 44,
  fill = 'transparent',
  stroke = 'rgba(255,255,255,0.55)',
  glow = false,
  label,
  dot = true,
}: {
  x: number
  y: number
  size?: number
  fill?: string
  stroke?: string
  glow?: boolean
  label?: string
  dot?: boolean
}) {
  // Isometric projection: 30deg angles
  const w = size
  const h = size * 0.5
  const d = size * 0.5
  // Top face vertices (diamond)
  const top = [
    [x, y - h],
    [x + w, y],
    [x, y + h],
    [x - w, y],
  ]
  // Front-left face
  const left = [
    [x - w, y],
    [x, y + h],
    [x, y + h + d * 2],
    [x - w, y + d * 2],
  ]
  // Front-right face
  const right = [
    [x, y + h],
    [x + w, y],
    [x + w, y + d * 2],
    [x, y + h + d * 2],
  ]
  const poly = (pts: number[][]) => pts.map((p) => p.join(',')).join(' ')
  const topFill = fill === 'transparent' ? 'rgba(20,20,28,0.85)' : fill
  const leftFill = fill === 'transparent' ? 'rgba(14,14,20,0.9)' : fill
  const rightFill = fill === 'transparent' ? 'rgba(28,28,38,0.85)' : fill
  return (
    <g style={glow ? { filter: 'drop-shadow(0 0 14px rgba(120,110,255,0.55))' } : undefined}>
      <polygon points={poly(left)} fill={leftFill} stroke={stroke} strokeWidth={1} />
      <polygon points={poly(right)} fill={rightFill} stroke={stroke} strokeWidth={1} />
      <polygon points={poly(top)} fill={topFill} stroke={stroke} strokeWidth={1} />
    </g>
  )
}

function CubeNetworkVisual() {
  return (
    <div
      className="mt-6"
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        maxWidth: 320,
        margin: '0 auto',
      }}
    >
      <svg viewBox="0 0 300 300" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
        {/* Dashed connector lines from center cube outward */}
        <g stroke="rgba(170,170,190,0.45)" strokeWidth={0.8} strokeDasharray="3 3" fill="none">
          {/* center to top-left */}
          <line x1={150} y1={110} x2={80} y2={70} />
          {/* center to top-right */}
          <line x1={150} y1={110} x2={220} y2={70} />
          {/* center to mid-left */}
          <line x1={150} y1={130} x2={80} y2={170} />
          {/* center to mid-right */}
          <line x1={150} y1={130} x2={220} y2={170} />
          {/* center vertical axis */}
          <line x1={150} y1={70} x2={150} y2={30} />
          <line x1={150} y1={170} x2={150} y2={260} />
          {/* bottom small cubes */}
          <line x1={150} y1={230} x2={105} y2={235} />
          <line x1={150} y1={230} x2={195} y2={235} />
        </g>

        {/* Arrow tips on vertical axis */}
        <g fill="rgba(170,170,190,0.6)">
          <polygon points="150,28 147,34 153,34" />
          <polygon points="150,262 147,256 153,256" />
        </g>

        {/* Top-left cube */}
        <IsoCube x={80} y={70} size={22} />
        {/* Top-right cube */}
        <IsoCube x={220} y={70} size={22} />
        {/* Mid-left larger cube */}
        <IsoCube x={70} y={170} size={24} />
        {/* Mid-right larger cube */}
        <IsoCube x={230} y={170} size={24} />
        {/* Bottom small cubes */}
        <IsoCube x={105} y={235} size={11} />
        <IsoCube x={195} y={235} size={11} />

        {/* Center highlighted cube (purple) */}
        <IsoCube
          x={150}
          y={120}
          size={28}
          fill="#6e5cff"
          stroke="rgba(180,170,255,0.9)"
          glow
        />
      </svg>
    </div>
  )
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

                {card.visual === 'cube-network' && <CubeNetworkVisual />}

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
