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
  { type: 'section', id: 'vision-request-review', label: 'From request to review' },
  EVENT,
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-what-igris-adds', label: 'What Igris adds' },
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-get-started', label: 'Get started' },
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-pricing', label: 'Pricing' },
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-questions', label: 'Ask about Igris' },
  EVENT,
  EVENT,
  { type: 'section', id: 'vision-footer', label: 'Footer' },
]

export const VISION_SECTION_IDS: Record<string, string> = {
  'From request to review': 'vision-request-review',
  'What Igris adds': 'vision-what-igris-adds',
  'Get started': 'vision-get-started',
}

const SCROLL_OFFSET = 140

const SECTION_LINE = 'w-3'
const EVENT_LINE = 'w-2'

function lineClass(active: boolean, hovered: boolean, isSection: boolean): string {
  const size = isSection ? SECTION_LINE : EVENT_LINE
  if (active) return `${size} bg-[#171717]`
  if (hovered) return `${size} bg-[#52525b]`
  return `${size} bg-[#d4d4d4]`
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
      <ul className="pointer-events-auto flex flex-col items-end gap-px">
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
                  className="flex h-2 w-8 cursor-pointer items-center justify-end rounded-sm outline-none transition-opacity hover:opacity-90 focus-visible:opacity-90"
                >
                  <span
                    className={`block h-[1.5px] rounded-full transition-colors duration-200 ${lineClass(active, hovered, true)}`}
                  />
                </button>
              ) : (
                <div
                  role="presentation"
                  onMouseEnter={() => setHoveredKey(itemKey)}
                  onMouseLeave={() => setHoveredKey(null)}
                  className="flex h-2 w-8 items-center justify-end"
                >
                  <span
                    className={`block h-px rounded-full transition-colors duration-200 ${lineClass(false, hovered, false)}`}
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