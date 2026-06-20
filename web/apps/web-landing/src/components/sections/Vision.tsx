'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const LINE_1 = 'For AI agents'
const LINE_1_CONT = ' to call APIs, trigger workflows, access files, and run tasks through one controlled action layer.'

const LINE_2 = 'To execute safely'
const LINE_2_CONT = ' in Cloud, webhooks, MCP, and connected workers, with policy, recovery, and receipts built in.'

const LINE_3 = 'Proven by runs'
const LINE_3_CONT = ' that record what happened, recover from failures, and leave evidence your team can inspect.'

const BASE_SIZE = 'clamp(1.5rem, 4.5vw, 3rem)'
const MOTION_EASE = [0.22, 1, 0.36, 1] as const
const TRANSITION = { duration: 0.45, ease: MOTION_EASE }

const LINES = [
  { base: LINE_1, cont: LINE_1_CONT },
  { base: LINE_2, cont: LINE_2_CONT },
  { base: LINE_3, cont: LINE_3_CONT },
] as const

const LINE_STYLE: React.CSSProperties = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: BASE_SIZE,
  lineHeight: 1.2,
  letterSpacing: '-0.03em',
}

function HoverLine({
  base,
  cont,
  active,
  onActivate,
}: {
  base: string
  cont: string
  active: boolean
  onActivate: () => void
}) {
  const collapsedRef = useRef<HTMLParagraphElement>(null)
  const expandedRef = useRef<HTMLParagraphElement>(null)
  const [heights, setHeights] = useState({ collapsed: 0, expanded: 0 })
  const reducedMotion = useReducedMotion()

  useLayoutEffect(() => {
    const measure = () => {
      setHeights({
        collapsed: collapsedRef.current?.offsetHeight ?? 0,
        expanded: expandedRef.current?.offsetHeight ?? 0,
      })
    }

    measure()

    const observer = new ResizeObserver(measure)
    if (collapsedRef.current) observer.observe(collapsedRef.current)
    if (expandedRef.current) observer.observe(expandedRef.current)

    return () => observer.disconnect()
  }, [base, cont])

  const targetHeight = active ? heights.expanded : heights.collapsed

  return (
    <motion.div
      layout="position"
      transition={{ layout: TRANSITION }}
      className="relative cursor-default py-2 md:py-3"
      onMouseEnter={onActivate}
    >
      <div className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden" aria-hidden>
        <p ref={collapsedRef} className="m-0" style={LINE_STYLE}>
          {base}
        </p>
        <p ref={expandedRef} className="m-0" style={LINE_STYLE}>
          {base}
          <span className="text-gray-500 dark:text-[#8a8a7a]" style={{ fontFamily: SANS }}>{cont}</span>
        </p>
      </div>

      <motion.div
        initial={false}
        animate={{ height: targetHeight }}
        transition={reducedMotion ? { duration: 0 } : TRANSITION}
        className="overflow-hidden"
      >
        <p className="relative m-0 text-gray-900 dark:text-[#f6f6f4]" style={LINE_STYLE}>
          <span>{base}</span>
          <span
            className="text-gray-500 dark:text-[#8a8a7a]"
            style={
              active
                ? {
                    opacity: 1,
                    transition: reducedMotion ? 'none' : 'opacity 0.35s ease 0.1s',
                    fontFamily: SANS,
                    fontWeight: 400,
                  }
                : {
                    position: 'absolute',
                    width: 0,
                    height: 0,
                    overflow: 'hidden',
                    opacity: 0,
                    fontFamily: SANS,
                    fontWeight: 400,
                  }
            }
          >
            {cont}
          </span>
        </p>
      </motion.div>
    </motion.div>
  )
}

export default function Vision() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  return (
    <section
      aria-labelledby="vision-heading"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="mx-auto flex min-h-[80vh] max-w-[800px] flex-col justify-center px-4 sm:px-6 lg:px-8 py-24 md:py-40 lg:py-48">
        <h2 id="vision-heading" className="sr-only">Vision</h2>
        <motion.div
          layout
          className="flex flex-col gap-4 md:gap-6 lg:gap-8"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {LINES.map((line, index) => (
            <HoverLine
              key={line.base}
              base={line.base}
              cont={line.cont}
              active={activeIndex === index}
              onActivate={() => setActiveIndex(index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}