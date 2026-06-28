'use client'

import { useEffect, useRef, useState } from 'react'
import { CATEGORY_LABELS, FAQ_DATA, type FaqCategory, type FaqEntry } from '../../lib/faq'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const CATEGORY_ORDER: FaqCategory[] = [
  'getting-started',
  'pricing-billing',
  'execution-verification',
  'open-source',
  'deployment-security',
]

const THINKING_DELAY_MS = 750

export default function Faq({ simple = false }: { simple?: boolean }) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('getting-started')
  const [selected, setSelected] = useState<FaqEntry | null>(null)
  const [thinking, setThinking] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    entries: FAQ_DATA.filter((e) => e.category === cat),
  }))

  const switchCategory = (cat: FaqCategory) => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }
    setActiveCategory(cat)
    setSelected(null)
    setThinking(false)
    setShowAnswer(false)
  }

  const ask = (entry: FaqEntry) => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
    }
    setSelected(entry)
    setThinking(true)
    setShowAnswer(false)

    thinkingTimerRef.current = setTimeout(() => {
      setThinking(false)
      setShowAnswer(true)
      thinkingTimerRef.current = null
    }, THINKING_DELAY_MS)
  }

  useEffect(() => {
    return () => {
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current)
      }
    }
  }, [])

  return (
    <section id="faq" className={simple ? '' : 'bg-white text-[#171717]'}>
      <div className="flex flex-wrap gap-2 mb-6">
        {grouped.map((g) => (
          <button
            key={g.category}
            type="button"
            onClick={() => switchCategory(g.category)}
            className={`px-3 py-1.5 rounded-[8px] text-[14px] transition-colors ${
              activeCategory === g.category
                ? 'bg-[#f0f0f0] text-[#171717]'
                : 'text-[#8f8f8f] hover:text-[#52525b] hover:bg-[#fafafa]'
            }`}
            style={{ fontFamily: SANS, fontWeight: 400 }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {grouped
        .filter((g) => g.category === activeCategory)
        .map((g) => (
          <div key={g.category} className="flex flex-wrap gap-2 mb-6">
            {g.entries.map((entry) => {
              const isSelected = selected?.id === entry.id
              return (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => ask(entry)}
                  className={`text-left px-4 py-2.5 rounded-[10px] border text-[15px] leading-snug transition-colors ${
                    isSelected
                      ? 'border-[#d4d4d4] bg-white text-[#171717]'
                      : 'border-[#ebebeb] bg-white text-[#27272a] hover:border-[#d4d4d4]'
                  }`}
                  style={{ fontFamily: SANS, fontWeight: 400 }}
                  aria-pressed={isSelected}
                >
                  {entry.question}
                </button>
              )
            })}
          </div>
        ))}

      <div
        className="max-h-[400px] overflow-y-auto"
        aria-live="polite"
        aria-label="FAQ answer"
      >
        {!selected ? (
          <p
            className="text-[#a1a1aa] text-[1rem]"
            style={{ fontFamily: SANS, fontWeight: 400 }}
          >
            Click a question above to see the answer.
          </p>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <p
                className="max-w-[80%] text-[#171717] text-[1.375rem] text-right"
                style={{ fontFamily: SANS, fontWeight: 400, lineHeight: 1.75 }}
              >
                {selected.question}
              </p>
            </div>

            <div className="flex justify-start">
              {thinking ? (
                <p
                  className="text-[#8f8f8f] text-[1.375rem]"
                  style={{ fontFamily: SANS, fontWeight: 400, lineHeight: 1.75 }}
                >
                  Thinking…
                </p>
              ) : showAnswer ? (
                <p
                  className="max-w-[88%] text-[#27272a] text-[1.375rem]"
                  style={{ fontFamily: SANS, fontWeight: 400, lineHeight: 1.75 }}
                >
                  {selected.answer}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}