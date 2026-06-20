'use client'

import React, { useEffect, useRef, useState } from 'react'
import { RunDetailSnippet, type RunDetailSnippetVariant } from './Products'
import { LandingPillarHeader } from '../ui/LandingPillarSection'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace'

const cards = [
  {
    id: 'side-effects',
    title: 'Change data',
    body: 'Create invoices, update records, call APIs, or trigger workflows without giving agents direct access.',
    fig: 'RUN · COMMITTED ACTIONS',
    snippet: 'actions' as RunDetailSnippetVariant,
  },
  {
    id: 'proof',
    title: 'Prove it',
    body: 'Keep a receipt for every action: what ran, what failed, what recovered, and what was approved.',
    fig: 'RUN · RECEIPT TRAIL',
    snippet: 'proof' as RunDetailSnippetVariant,
  },
  {
    id: 'hybrid',
    title: 'Run privately',
    body: 'Use workers when actions need internal APIs, files, databases, local systems, or edge access.',
    fig: 'RUN · ROUTED VIA',
    snippet: 'routing' as RunDetailSnippetVariant,
  },
  {
    id: 'boundaries',
    title: 'Recover safely',
    body: 'Resume from checkpoints when something fails instead of blindly starting over.',
    fig: 'RUN · POLICY & RECOVERY',
    snippet: 'policy' as RunDetailSnippetVariant,
  },
] as const

const CARD_BASE =
  'flex w-full max-w-none flex-col p-2 text-left transition-colors duration-300 sm:p-3 md:max-w-md md:p-4'

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
        <div id="when-to-use-heading">
          <LandingPillarHeader
            title="Agent Work"
            description="Igris is built for agent actions your team needs to trust."
            titleAsPixel
          />
        </div>

        <div className="mt-8 sm:mt-12 md:mt-16">
          <div className="wtu-detail-layout p-4 sm:p-6 lg:p-10">
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
                      ' cursor-pointer ' +
                      (isActive
                        ? 'border-l-2 border-emerald-700/60 dark:border-emerald-400/60'
                        : 'border-l-2 border-transparent hover:border-gray-200 dark:hover:border-white/[0.12]')
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