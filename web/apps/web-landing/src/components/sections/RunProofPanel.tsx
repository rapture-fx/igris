'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown, FileDiff } from 'lucide-react'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const MONO = 'var(--font-geist-mono), ui-monospace, "SF Mono", monospace'

const LOG_LINE_INTERVAL_MS = 90
const LOG_REPLAY_START_MS = 140

type ProofStep = {
  index: number
  name: string
  detail: string
  status: 'completed' | 'recovered' | 'uncertain' | 'info'
}

const DEMO_STEPS: ProofStep[] = [
  { index: 1, name: 'run_accepted', detail: 'deploy.release · idempotency deploy-payments-1.4.2', status: 'info' },
  { index: 2, name: 'action_started', detail: 'release pipeline for payments@1.4.2', status: 'info' },
  { index: 3, name: 'worker_fault', detail: 'host lost mid-step · progress preserved', status: 'recovered' },
  { index: 4, name: 'action_resumed', detail: 'continued from last safe checkpoint', status: 'recovered' },
  { index: 5, name: 'effect_committed', detail: 'release published · no duplicate deploy', status: 'completed' },
  { index: 6, name: 'run_terminal', detail: 'status=completed · inspectable afterward', status: 'completed' },
]

const STATUS_COLOR: Record<ProofStep['status'], string> = {
  completed: '#047857',
  recovered: '#2563eb',
  uncertain: '#be123c',
  info: '#52525b',
}

function statusLabel(status: ProofStep['status']) {
  switch (status) {
    case 'completed':
      return 'completed'
    case 'recovered':
      return 'recovered'
    case 'uncertain':
      return 'uncertain'
    default:
      return 'recorded'
  }
}

export default function RunProofPanel() {
  const [open, setOpen] = useState(false)
  const [visibleCount, setVisibleCount] = useState(0)
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    if (!open) {
      setVisibleCount(0)
      return
    }

    if (reduceMotion) {
      setVisibleCount(DEMO_STEPS.length)
      return
    }

    setVisibleCount(0)
    const timers: number[] = []
    const start = window.setTimeout(() => {
      DEMO_STEPS.forEach((_, index) => {
        timers.push(
          window.setTimeout(() => {
            setVisibleCount(index + 1)
          }, index * LOG_LINE_INTERVAL_MS),
        )
      })
    }, LOG_REPLAY_START_MS)

    return () => {
      window.clearTimeout(start)
      timers.forEach((timer) => window.clearTimeout(timer))
    }
  }, [open, reduceMotion])

  return (
    <div className="mb-8">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-2 text-[#171717] transition-colors hover:text-[#52525b]"
        style={{ fontFamily: SANS, fontWeight: 400, fontSize: '1.375rem', lineHeight: 1.75, letterSpacing: '-0.01em' }}
        aria-expanded={open}
      >
        <FileDiff size={18} strokeWidth={1.75} className="shrink-0 text-[#52525b]" aria-hidden />
        <span>Inspect a run</span>
        <ChevronDown
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 text-[#8f8f8f] transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pt-4" aria-hidden={!open}>
            <div className="overflow-hidden rounded-[10px] border border-[#ebebeb] bg-white">
              <div className="border-b border-[#ebebeb] px-5 py-3">
                <p className="text-[#8f8f8f]" style={{ fontFamily: MONO, fontSize: '0.875rem' }}>
                  run_id · run_7f2c · deploy.release
                </p>
              </div>
              <div className="px-5 py-4 space-y-3 min-h-[220px]">
                <AnimatePresence initial={false}>
                  {DEMO_STEPS.slice(0, visibleCount).map((step) => (
                    <motion.div
                      key={step.index}
                      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.22 }}
                    >
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
                        <div className="min-w-0">
                          <p className="text-[#171717]" style={{ fontFamily: MONO, fontSize: '0.95rem' }}>
                            <span className="text-[#8f8f8f]">{String(step.index).padStart(2, '0')}</span>
                            {'  '}
                            {step.name}
                          </p>
                          <p className="text-[#52525b]" style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.5 }}>
                            {step.detail}
                          </p>
                        </div>
                        <span
                          className="shrink-0 tabular-nums"
                          style={{ fontFamily: MONO, fontSize: '0.8rem', color: STATUS_COLOR[step.status] }}
                        >
                          {statusLabel(step.status)}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
              <div className="border-t border-[#ebebeb] px-5 py-3">
                <p className="text-[#52525b]" style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.5 }}>
                  The run record stays available after the agent moves on, so operators can review completion, recovery, and stops.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
