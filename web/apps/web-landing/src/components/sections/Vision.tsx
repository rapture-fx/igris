'use client'

import { useState } from 'react'

const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

const LINE_1 = 'For AI agents'
const LINE_1_CONT = ' to call APIs, trigger workflows, access files, and run tasks through one controlled action layer.'

const LINE_2 = 'To execute safely'
const LINE_2_CONT = ' in Cloud, webhooks, MCP, and connected workers, with policy, recovery, and receipts built in.'

const LINE_3 = 'Proven by runs'
const LINE_3_CONT = ' that record what happened, recover from failures, and leave evidence your team can inspect.'

const BASE_SIZE = 'clamp(2rem, 6vw, 4.5rem)'

function HoverLine({
  base,
  cont,
  hovered,
  onHover,
}: {
  base: string
  cont: string
  hovered: boolean
  onHover: (v: boolean) => void
}) {
  return (
    <div
      className="cursor-default"
      style={{ fontFamily: PIXEL, fontWeight: 400, fontSize: BASE_SIZE, lineHeight: 1.2, letterSpacing: '-0.01em' }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <p className="text-gray-700 dark:text-[#c8c8b8] m-0">
        {base}
        <span
          className="text-gray-400 dark:text-[#7a7a72]"
          style={{
            opacity: hovered ? 1 : 0,
            transition: 'opacity 700ms cubic-bezier(0.4, 0, 0.2, 1)',
            display: hovered ? 'inline' : 'none',
          }}
        >
          {cont}
        </span>
      </p>
    </div>
  )
}

export default function Vision() {
  const [hovered1, setHovered1] = useState(false)
  const [hovered2, setHovered2] = useState(false)
  const [hovered3, setHovered3] = useState(false)

  return (
    <section
      aria-labelledby="vision-heading"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="mx-auto flex min-h-[80vh] max-w-[1400px] flex-col justify-center px-4 sm:px-6 lg:px-8 py-24 md:py-40 lg:py-48">
        <h2 id="vision-heading" className="sr-only">Vision</h2>
        <div className="flex flex-col gap-4 md:gap-6 lg:gap-8">
          <HoverLine base={LINE_1} cont={LINE_1_CONT} hovered={hovered1} onHover={setHovered1} />
          <HoverLine base={LINE_2} cont={LINE_2_CONT} hovered={hovered2} onHover={setHovered2} />
          <HoverLine base={LINE_3} cont={LINE_3_CONT} hovered={hovered3} onHover={setHovered3} />
        </div>
      </div>
    </section>
  )
}
