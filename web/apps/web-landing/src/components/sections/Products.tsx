import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

const MONO = '"SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Courier, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const LOG_EVENTS = [
  { time: '12:01:02', sev: 'INFO', type: 'ExecutionStarted',    msg: 'task_019de343 received · agent igris-worker-01' },
  { time: '12:01:02', sev: 'INFO', type: 'ProviderSelected',    msg: 'routed → anthropic / claude-3-5-sonnet' },
  { time: '12:01:03', sev: 'INFO', type: 'ToolCall',            msg: 'tool file_read called · path /data/config.json' },
  { time: '12:01:03', sev: 'INFO', type: 'ToolCall',            msg: 'tool http_post called · url api.internal/submit' },
  { time: '12:01:04', sev: 'WARN', type: 'PolicyViolation',     msg: 'rate limit threshold reached · action deferred' },
  { time: '12:01:04', sev: 'ERR',  type: 'ExecutionTerminated', msg: 'retry limit exceeded · fallback triggered' },
  { time: '12:01:05', sev: 'INFO', type: 'ProviderSelected',    msg: 'failover → openai / gpt-4o' },
  { time: '12:01:06', sev: 'INFO', type: 'ReceiptSigned',       msg: 'receipt verified · execution complete' },
]

const SEV_COLOR: Record<string, string> = {
  INFO: '#22c55e',
  WARN: '#eab308',
  ERR:  '#f97316',
  CRIT: '#ef4444',
}

function ExecutionPreview({ isDark }: { isDark: boolean }) {
  const bg        = isDark ? '#16160f' : '#ffffff'
  const headerBg  = isDark ? '#111108' : '#f9fafb'
  const border    = isDark ? 'rgba(246,246,244,0.1)' : '#e5e7eb'
  const timeColor = isDark ? '#6b7280' : '#9ca3af'
  const msgColor  = isDark ? '#c8c8b8' : '#374151'
  const typeColor = isDark ? '#a78bfa' : '#7c3aed'

  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '10px', overflow: 'hidden', width: '100%' }}>
      {/* Header */}
      <div style={{ background: headerBg, borderBottom: `1px solid ${border}`, padding: '7px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: SANS, fontSize: '11px', fontWeight: 600, color: isDark ? '#f6f6f4' : '#111827' }}>
          Runtime Events
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: SANS, fontSize: '10px', color: '#22c55e' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          live
        </span>
      </div>

      {/* Rows */}
      {LOG_EVENTS.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'baseline',
            padding: '4px 10px 4px 9px',
            borderBottom: i < LOG_EVENTS.length - 1 ? `1px solid ${border}` : undefined,
            borderLeft: `3px solid ${e.sev === 'INFO' ? 'transparent' : SEV_COLOR[e.sev]}`,
          }}
        >
          <span style={{ fontFamily: MONO, fontSize: '10px', color: timeColor, width: '48px', flexShrink: 0, userSelect: 'none' }}>
            {e.time}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '10px', fontWeight: 700, width: '34px', flexShrink: 0, color: SEV_COLOR[e.sev] }}>
            {e.sev}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: typeColor, width: '155px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.type}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '10px', color: msgColor, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {e.msg}
          </span>
        </div>
      ))}
    </div>
  )
}

function CopyButton() {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="flex-shrink-0 p-1 rounded transition-colors"
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = mounted && theme === 'dark'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-3 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS }}>
              The execution layer for AI tasks.
            </h2>
            <Link
              href="https://docs.igrisinertial.com/"
              className="group inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
              style={{ backgroundColor: isDark ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: isDark ? '#f6f6f4' : '#1b1912', borderColor: isDark ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily: SANS }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', paddingBottom: 0 }}>
          <div className="py-10 sm:py-16">

            {/* Desktop layout */}
            <div className="hidden sm:grid gap-10" style={{ gridTemplateColumns: '3fr 2fr' }}>
              {/* Left: image background, panel floats over it — 60% */}
              <div style={{ position: 'relative', minHeight: 'clamp(320px, 36vw, 460px)' }}>
                <img
                  src={'/pkrllol.png'}
                  alt="Product"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '1rem',
                  }}
                />
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 10 }}>
                  <div style={{ width: '90%' }}>
                    <ExecutionPreview isDark={isDark} />
                  </div>
                </div>
              </div>

              {/* Right: descriptive content — 40% */}
              <div className="flex flex-col justify-center">
                <div>
                  <p className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                    Models decide. Igris executes.
                  </p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                    Igris gives AI systems a governed path for turning model output into controlled action. Define boundaries, handle failure paths, and generate signed records of what happened during execution.
                  </p>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: SANS }}>
                    Built for teams running AI beyond simple prompts — where tasks need to be inspected, constrained, and verified across cloud, edge, and local environments.
                  </p>
                </div>
                <div className="mt-6" style={{ maxWidth: '320px' }}>
                  <ul className="list-disc list-inside space-y-3">
                    <li>
                      <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                        Governed runs
                      </span>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: SANS }}>
                        Apply limits, permission checks, and execution boundaries before AI output becomes action.
                      </p>
                    </li>
                    <li>
                      <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                        Failure paths
                      </span>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: SANS }}>
Design tasks with explicit failure paths across cloud, edge, and local environments.
                      </p>
                    </li>
                    <li>
                      <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                        Signed records
                      </span>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: SANS }}>
                        Produce verifiable execution records for critical runs, decisions, and actions.
                      </p>
                    </li>
                    <li>
                      <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                        Deploy anywhere
                      </span>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: SANS }}>
                        Run the same execution model across servers, devices, and edge environments.
                      </p>
                    </li>
                  </ul>
                  <div className="mt-4">
                    <div className="landing-surface-card rounded-md border px-3 py-1.5 flex items-center gap-2" style={{ maxWidth: '100%', overflow: 'hidden' }}>
                      <span className="font-mono select-all" style={{ fontSize: '10px', color: isDark ? '#c8c8b8' : '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {INSTALL_CMD}
                      </span>
                      <CopyButton />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile layout */}
            <div className="sm:hidden flex flex-col gap-6">
              <div style={{ position: 'relative', width: '100%' }}>
                <img
                  src={'/pkrllol.png'}
                  alt="Product"
                  className="rounded-xl"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    zIndex: 0,
                    borderRadius: '0.75rem',
                  }}
                />
                <div style={{ position: 'relative', zIndex: 10, padding: '12px' }}>
                  <ExecutionPreview isDark={isDark} />
                </div>
              </div>
              <div className="max-w-full">
                <p className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Models decide. Igris executes.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  Igris gives AI systems a governed path for turning model output into controlled action. Define boundaries, handle failure paths, and generate signed records of what happened during execution.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: SANS }}>
                  Built for teams running AI beyond simple prompts — where tasks need to be inspected, constrained, and verified across cloud, edge, and local environments.
                </p>
              </div>
              <div className="mt-4 max-w-full md:max-w-[320px]">
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Governed runs
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  Apply limits, permission checks, and execution boundaries before AI output becomes action.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Failure paths
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  Keep tasks moving across cloud, edge, and local environments when part of the system fails.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Signed records
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  Produce verifiable execution records for critical runs, decisions, and actions.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Deploy anywhere
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  Run the same execution model across servers, devices, and edge environments.
                </p>
                <div className="mt-6">
                  <div className="landing-surface-card relative rounded-2xl border px-3 py-2 md:px-4 md:py-2 inline-block pt-4" style={{ minWidth: '280px' }}>
                    <CopyButton />
                    <span className="font-mono text-xs md:text-sm select-all whitespace-nowrap mr-8" style={{ color: isDark ? '#c8c8b8' : '#374151' }}>
                      {INSTALL_CMD}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
