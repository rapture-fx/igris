'use client'

import { useEffect, useRef, useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import { CATEGORY_LABELS, FAQ_DATA, type FaqCategory, type FaqEntry } from '../../lib/faq'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const CATEGORY_ORDER: FaqCategory[] = [
  'getting-started',
  'pricing-billing',
  'execution-verification',
  'open-source',
  'deployment-security',
]

const THINKING_MIN_MS = 2000
const THINKING_MAX_MS = 6000

const CHAT_TEXT_STYLE = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: '14px',
  lineHeight: 1.55,
} as const

const THINKING_LABEL_STYLE = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: '14px',
  lineHeight: 1.4,
} as const

const SOURCE_LINK_STYLE = {
  fontFamily: SANS,
  fontWeight: 400,
  fontSize: '12px',
  lineHeight: 1.4,
} as const

function getThinkingDelayMs(answer: string[]): number {
  const len = answer.join('').length
  const minLen = 200
  const maxLen = 1400
  const t = Math.min(1, Math.max(0, (len - minLen) / (maxLen - minLen)))
  const seconds = Math.round((THINKING_MIN_MS + t * (THINKING_MAX_MS - THINKING_MIN_MS)) / 1000)
  return seconds * 1000
}

function formatThoughtLabel(delayMs: number): string {
  const seconds = Math.round(delayMs / 1000)
  return `Thought for ${seconds}s`
}

function FaqCategoryMenu({
  value,
  onChange,
}: {
  value: FaqCategory
  onChange: (category: FaqCategory) => void
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={menuRef} className="relative mb-6 w-full max-w-[22rem]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="FAQ category"
        className={`flex w-full items-center justify-between gap-3 rounded-[10px] border bg-white px-4 py-2.5 text-left transition-colors ${
          open
            ? 'border-[#d4d4d4] bg-[#fafafa]'
            : 'border-[#ebebeb] hover:border-[#d4d4d4] hover:bg-[#fafafa]'
        }`}
        style={CHAT_TEXT_STYLE}
      >
        <span className="text-[#171717]">{CATEGORY_LABELS[value]}</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {open && (
        <ul
          role="listbox"
          aria-label="FAQ categories"
          className="absolute left-0 right-0 z-20 mt-1.5 rounded-[10px] border border-[#ebebeb] bg-white p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
        >
          {CATEGORY_ORDER.map((category) => {
            const selected = category === value
            return (
              <li key={category} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(category)
                    setOpen(false)
                  }}
                  className={`w-full rounded-[8px] px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'bg-[#f4f4f5] text-[#171717]'
                      : 'text-[#27272a] hover:bg-[#fafafa]'
                  }`}
                  style={CHAT_TEXT_STYLE}
                >
                  {CATEGORY_LABELS[category]}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default function Faq({ simple = false }: { simple?: boolean }) {
  const [activeCategory, setActiveCategory] = useState<FaqCategory>('getting-started')
  const [selected, setSelected] = useState<FaqEntry | null>(null)
  const [thinking, setThinking] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)
  const [thoughtLabel, setThoughtLabel] = useState('')
  const thinkingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: CATEGORY_LABELS[cat],
    entries: FAQ_DATA.filter((e) => e.category === cat),
  }))

  const clearThinkingTimer = () => {
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current)
      thinkingTimerRef.current = null
    }
  }

  const switchCategory = (cat: FaqCategory) => {
    clearThinkingTimer()
    setActiveCategory(cat)
    setSelected(null)
    setThinking(false)
    setShowAnswer(false)
    setThoughtLabel('')
  }

  const ask = (entry: FaqEntry) => {
    clearThinkingTimer()
    const delayMs = getThinkingDelayMs(entry.answer)

    setSelected(entry)
    setThinking(true)
    setShowAnswer(false)
    setThoughtLabel(formatThoughtLabel(delayMs))

    thinkingTimerRef.current = setTimeout(() => {
      setThinking(false)
      setShowAnswer(true)
      thinkingTimerRef.current = null
    }, delayMs)
  }

  useEffect(() => {
    return () => clearThinkingTimer()
  }, [])

  return (
    <section id="faq" className={simple ? '' : 'bg-white text-[#171717]'}>
      <FaqCategoryMenu value={activeCategory} onChange={switchCategory} />

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
                  className={`text-left rounded-full border px-4 py-2 transition-colors ${
                    isSelected
                      ? 'border-[#d4d4d4] bg-[#f4f4f5] text-[#171717]'
                      : 'border-[#ebebeb] bg-white text-[#27272a] hover:border-[#d4d4d4] hover:bg-[#fafafa]'
                  }`}
                  style={CHAT_TEXT_STYLE}
                  aria-pressed={isSelected}
                >
                  {entry.question}
                </button>
              )
            })}
          </div>
        ))}

      <div
        className="faq-chat-frame h-[38rem] overflow-y-auto overscroll-y-contain rounded-[12px] border border-[#ebebeb] bg-white px-6 py-6 sm:px-7 sm:py-7"
        aria-live="polite"
        aria-label="FAQ answer"
      >
        <div className="mx-auto w-full max-w-[44rem]">
          {!selected ? (
            <div className="flex min-h-[calc(38rem-3.5rem)] items-center justify-center">
              <p
                className="text-center text-[#a1a1aa] text-[14px]"
                style={{ fontFamily: SANS, fontWeight: 400, lineHeight: 1.55 }}
              >
                Click a question above to see the answer.
              </p>
            </div>
          ) : (
            <div className="space-y-6 pt-10 sm:pt-12">
              <div className="flex justify-end">
                <p
                  className="max-w-[85%] rounded-[18px] rounded-br-[6px] border border-[#e4e4e7] bg-[#f4f4f5] px-4 py-3 text-[#171717] text-right"
                  style={CHAT_TEXT_STYLE}
                >
                  {selected.question}
                </p>
              </div>

              <div className="flex justify-start">
                {thinking ? (
                  <p className="faq-thinking-shimmer" style={CHAT_TEXT_STYLE} aria-live="polite">
                    Thinking…
                  </p>
                ) : showAnswer ? (
                  <div className="max-w-[92%] space-y-2">
                    <p className="text-[#a1a1aa]" style={THINKING_LABEL_STYLE}>
                      {thoughtLabel}
                    </p>
                    <div className="space-y-3">
                      {selected.answer.map((paragraph, index) => {
                        const isLast = index === selected.answer.length - 1
                        return (
                          <p key={index} className="text-[#27272a]" style={CHAT_TEXT_STYLE}>
                            {paragraph}
                            {isLast ? (
                              <>
                                {' '}
                                <a
                                  href={selected.source.href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 align-baseline text-[#a1a1aa] no-underline transition-colors hover:text-[#52525b]"
                                  style={SOURCE_LINK_STYLE}
                                >
                                  <BookOpen size={11} strokeWidth={1.75} className="shrink-0" aria-hidden />
                                  <span>{selected.source.label}</span>
                                </a>
                              </>
                            ) : null}
                          </p>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}