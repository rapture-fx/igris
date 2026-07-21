'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

export type RunRailSection = {
  type: 'section'
  id: string
  label: string
}

export type RunRailEvent = {
  type: 'event'
}

export type RunRailItem = RunRailSection | RunRailEvent

const EVENT = { type: 'event' } as const satisfies RunRailEvent

export const VISION_RAIL_ITEMS: RunRailItem[] = [
  { type: 'section', id: 'vision-hero', label: 'Hero' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-problem', label: 'Problem' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-how-it-works', label: 'How Igris works' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-outcomes', label: 'Outcomes' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-sdk', label: 'SDK' },
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-use-cases', label: 'Use cases' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-run-proof', label: 'Run proof' },
  EVENT,
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-cta', label: 'Get started' },
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-footer', label: 'Footer' },
]

export const VISION_SECTION_IDS: Record<string, string> = {
  Problem: 'vision-problem',
  'How Igris works': 'vision-how-it-works',
  Outcomes: 'vision-outcomes',
  SDK: 'vision-sdk',
  'Use cases': 'vision-use-cases',
  'Run proof': 'vision-run-proof',
  'Get started': 'vision-cta',
}

const SCROLL_OFFSET = 140

const STANDBY_LINE = 'w-3.5 bg-[#d4d4d4]'

function lineClass(active: boolean, hovered: boolean): string {
  if (active) return 'w-10 bg-[#171717]'
  if (hovered) return 'w-8 bg-[#52525b]'
  return STANDBY_LINE
}

export default function RunHistoryRail({ items = VISION_RAIL_ITEMS }: { items?: RunRailItem[] }) {
  const sections = useMemo(
    () => items.filter((item): item is RunRailSection => item.type === 'section'),
    [items],
  )

  const [activeId, setActiveId] = useState(sections[0]?.id ?? '')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  const updateActive = useCallback(() => {
    let current = sections[0]?.id ?? ''
    for (const section of sections) {
      const el = document.getElementById(section.id)
      if (!el) continue
      if (el.getBoundingClientRect().top <= SCROLL_OFFSET) {
        current = section.id
      }
    }
    setActiveId(current)
  }, [sections])

  useEffect(() => {
    updateActive()
    window.addEventListener('scroll', updateActive, { passive: true })
    window.addEventListener('resize', updateActive)
    return () => {
      window.removeEventListener('scroll', updateActive)
      window.removeEventListener('resize', updateActive)
    }
  }, [updateActive])

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <nav
      aria-label="Page sections"
      className="pointer-events-none fixed right-5 top-1/2 z-30 hidden -translate-y-1/2 lg:block xl:right-8"
    >
      <ul className="pointer-events-auto flex flex-col items-end gap-[3px]">
        {items.map((item, index) => {
          const itemKey = item.type === 'section' ? item.id : `event-${index}`
          const isSection = item.type === 'section'
          const active = isSection && activeId === item.id
          const hovered = hoveredKey === itemKey
          const showLabel = isSection && hovered

          return (
            <li key={itemKey} className="group relative flex items-center justify-end">
              {showLabel && (
                <span
                  className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 whitespace-nowrap text-[13px] font-medium text-[#171717]"
                  style={{ fontFamily: 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  aria-hidden
                >
                  {item.label}
                </span>
              )}
              {isSection ? (
                <button
                  type="button"
                  onClick={() => scrollTo(item.id)}
                  onMouseEnter={() => setHoveredKey(itemKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  onFocus={() => setHoveredKey(itemKey)}
                  onBlur={() => setHoveredKey(null)}
                  aria-label={item.label}
                  aria-current={active ? 'true' : undefined}
                  className="flex h-3 w-10 cursor-pointer items-center justify-end rounded-sm outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
                >
                  <span
                    className={`block h-[2px] rounded-full transition-all duration-200 ${lineClass(active, hovered)}`}
                  />
                </button>
              ) : (
                <div
                  role="presentation"
                  onMouseEnter={() => setHoveredKey(itemKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className="flex h-3 w-10 items-center justify-end"
                >
                  <span
                    className={`block h-[2px] rounded-full transition-all duration-200 ${lineClass(false, hovered)}`}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
