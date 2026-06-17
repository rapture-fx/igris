'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RunDetailSnippet, type RunDetailSnippetVariant } from './Products'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'

const cards = [
  {
    id: 'side-effects',
    title: 'Real side effects',
    body: 'Use Igris when agents need to perform actions with business impact: creating invoices, calling APIs, triggering workflows, writing to databases, or changing state.',
    fig: 'RUN · COMMITTED ACTIONS',
    snippet: 'actions' as RunDetailSnippetVariant,
  },
  {
    id: 'proof',
    title: 'Auditability and proof',
    body: 'Use Igris when your team needs a clear record of what the agent actually did, not just logs, screenshots, or a final answer.',
    fig: 'RUN · RECEIPT TRAIL',
    snippet: 'proof' as RunDetailSnippetVariant,
  },
  {
    id: 'hybrid',
    title: 'Hybrid execution',
    body: 'Use Igris when some actions run through cloud endpoints and others need private, local, edge, or internal execution with the same governance model.',
    fig: 'RUN · ROUTED VIA',
    snippet: 'routing' as RunDetailSnippetVariant,
  },
  {
    id: 'boundaries',
    title: 'Opinionated execution',
    body: 'Use Igris when you want stronger boundaries, recovery, and proof than a general workflow engine usually provides.',
    fig: 'RUN · POLICY & RECOVERY',
    snippet: 'policy' as RunDetailSnippetVariant,
  },
] as const

const CARD_BASE =
  'landing-surface-card flex w-full max-w-none flex-col rounded-xl border p-5 text-left transition-all duration-300 sm:p-6 md:max-w-md md:p-8 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] backdrop-blur-[2px] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]'

/** Fixed rail width — height stretches to match the stacked card column. */
const RAIL_WIDTH_PX = 520
const RAIL_HEAD_HEIGHT_PX = 28
const RAIL_STAGE_MIN_HEIGHT_PX = 520

function VisualRail({ activeIndex }: { activeIndex: number }) {
  return (
    <aside className="wtu-detail-rail" aria-live="polite" aria-atomic="true" aria-label="Run console preview">
      <div className="wtu-detail-rail__panel landing-surface-card flex h-full min-h-0 flex-col rounded-xl border border-[var(--landing-surface-border)] bg-[var(--landing-surface)]/92 shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.04)] backdrop-blur-md dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]">
        <div className="wtu-detail-rail__head">
          <p
            className="truncate text-gray-400 dark:text-[#5a5a52]"
            style={{ fontFamily: MONO, fontSize: '10px', letterSpacing: '0.22em' }}
          >
            {cards[activeIndex].fig}
          </p>
        </div>
        <div className="wtu-detail-rail__stage">
          <div key={cards[activeIndex].id} className="wtu-detail-rail__layer wtu-detail-rail__layer--enter">
            <RunDetailSnippet variant={cards[activeIndex].snippet} />
          </div>
        </div>
      </div>
    </aside>
  )
}

export default function WhenToUseIgris() {
  const [activeIndex, setActiveIndex] = useState(0)
  const cardRefs = useRef<(HTMLElement | null)[]>([])
  const clickLockRef = useRef(false)
  const clickLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const observers: IntersectionObserver[] = []

    cardRefs.current.forEach((el, index) => {
      if (!el) return
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting && !clickLockRef.current) {
            setActiveIndex(index)
          }
        },
        { rootMargin: '-22% 0px -28% 0px', threshold: 0.2 },
      )
      observer.observe(el)
      observers.push(observer)
    })

    return () => observers.forEach((observer) => observer.disconnect())
  }, [])

  useEffect(() => {
    return () => {
      if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current)
    }
  }, [])

  const activateCard = (index: number) => {
    setActiveIndex(index)
    clickLockRef.current = true
    if (clickLockTimerRef.current) clearTimeout(clickLockTimerRef.current)
    clickLockTimerRef.current = setTimeout(() => {
      clickLockRef.current = false
    }, 900)
  }

  return (
    <section
      id="when-to-use"
      aria-labelledby="when-to-use-heading"
      className="overflow-x-hidden bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <style>{`
        /* Two columns: cards + console preview, equal height */
        .wtu-detail-layout {
          display: grid;
          grid-template-columns: minmax(0, 1fr) minmax(${RAIL_WIDTH_PX}px, 1.15fr);
          gap: 2rem;
          align-items: stretch;
        }
        .wtu-detail-scroll {
          height: 100%;
        }
        .wtu-detail-rail {
          width: 100%;
          max-width: 100%;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 100%;
          position: sticky;
          top: 6rem;
          align-self: stretch;
        }
        .wtu-detail-rail__panel {
          flex: 1;
          padding: 1rem 1.25rem 1.25rem;
        }
        .wtu-detail-rail__head {
          height: ${RAIL_HEAD_HEIGHT_PX}px;
          display: flex;
          align-items: center;
          margin-bottom: 1rem;
          flex-shrink: 0;
        }
        .wtu-detail-rail__stage {
          position: relative;
          flex: 1;
          min-height: ${RAIL_STAGE_MIN_HEIGHT_PX}px;
          overflow: hidden;
        }
        .wtu-detail-rail__layer {
          position: absolute;
          inset: 0;
        }
        @keyframes wtu-rail-fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .wtu-detail-rail__layer--enter {
          animation: wtu-rail-fade-in 420ms ease-out both;
        }
        @media (prefers-reduced-motion: reduce) {
          .wtu-detail-rail__layer--enter { animation: none; }
        }
        @media (max-width: 1023px) {
          .wtu-detail-layout {
            grid-template-columns: 1fr;
            gap: 1.25rem;
          }
          .wtu-detail-scroll {
            order: -1;
            width: 100%;
            align-items: stretch;
          }
          .wtu-detail-rail {
            position: static;
            width: 100%;
            min-height: 0;
          }
          .wtu-detail-rail__panel {
            padding: 0.875rem 1rem 1rem;
          }
          .wtu-detail-rail__stage {
            min-height: clamp(320px, 58vh, 460px);
          }
        }
        @media (max-width: 639px) {
          #when-to-use .wtu-detail-layout {
            gap: 1rem;
          }
          .wtu-detail-rail__head {
            margin-bottom: 0.75rem;
          }
          .wtu-detail-rail__head p {
            font-size: 9px !important;
            letter-spacing: 0.18em !important;
          }
          .wtu-detail-rail__stage {
            min-height: clamp(280px, 50vh, 400px);
          }
        }
      `}</style>

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

        <div className="relative mt-8 overflow-hidden rounded-xl sm:mt-12 md:mt-16">
          <div
            className="absolute inset-0 bg-center bg-no-repeat bg-cover"
            style={{ backgroundImage: 'url(/pkrllgol.png)' }}
            aria-hidden
          />
          <div className="absolute inset-0 bg-white/55 dark:bg-[#110f0f]/50" aria-hidden />

          <div className="relative z-10 wtu-detail-layout p-4 sm:p-6 lg:p-10">
            <div className="wtu-detail-scroll flex min-w-0 w-full flex-col items-stretch gap-3 md:items-start md:gap-4">
              {cards.map((card, index) => {
                const isActive = activeIndex === index
                return (
                  <article
                    key={card.id}
                    ref={(el) => {
                      cardRefs.current[index] = el
                    }}
                    role="button"
                    tabIndex={0}
                    aria-pressed={isActive}
                    onClick={() => activateCard(index)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        activateCard(index)
                      }
                    }}
                    className={
                      CARD_BASE +
                      ' cursor-pointer hover:border-[var(--landing-surface-border-strong)] ' +
                      (isActive
                        ? 'border-emerald-700/35 bg-white/85 ring-1 ring-emerald-700/20 dark:border-emerald-400/35 dark:bg-[#161515]/90 dark:ring-emerald-400/20'
                        : 'border-[var(--landing-surface-border)] bg-[var(--landing-surface)]/88')
                    }
                  >
                    <p
                      className="text-gray-400 dark:text-[#7a7a72]"
                      style={{ fontFamily: MONO, fontSize: '11px', letterSpacing: '0.06em' }}
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
                )
              })}
            </div>

            <VisualRail activeIndex={activeIndex} />
          </div>
        </div>
      </div>
    </section>
  )
}