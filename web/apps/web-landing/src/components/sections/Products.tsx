import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

const MONO = 'var(--font-geist-mono), "SF Mono", "Fira Code", "Fira Mono", "Roboto Mono", Menlo, Courier, monospace'
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

const LOG_EVENTS = [
  { time: '12:01:02', sev: 'INFO', type: 'ExecutionStarted',   msg: 'task_019de343 received' },
  { time: '12:01:02', sev: 'INFO', type: 'ProviderSelected',   msg: 'routed to configured provider' },
  { time: '12:01:03', sev: 'INFO', type: 'ToolCall',           msg: 'file_read called' },
  { time: '12:01:03', sev: 'INFO', type: 'BoundaryChecked',    msg: 'limits and permissions passed' },
  { time: '12:01:04', sev: 'WARN', type: 'FallbackTriggered',  msg: 'primary path unavailable' },
  { time: '12:01:05', sev: 'INFO', type: 'ProviderSelected',   msg: 'fallback path selected' },
  { time: '12:01:06', sev: 'INFO', type: 'ReceiptSigned',      msg: 'signed record generated' },
  { time: '12:01:06', sev: 'INFO', type: 'VerificationPassed', msg: 'receipt verified' },
]

const TIMELINE_STEPS = [
  { name: 'Task received',      time: '12:01:02', desc: 'The task was accepted into the governed execution flow.',  style: 'normal' },
  { name: 'Provider selected',  time: '12:01:02', desc: 'The initial execution path was chosen.',                  style: 'normal' },
  { name: 'Tool call executed', time: '12:01:03', desc: 'The task called a tool under execution boundaries.',      style: 'normal' },
  { name: 'Boundaries checked', time: '12:01:03', desc: 'Limits and permissions were evaluated.',                  style: 'normal' },
  { name: 'Fallback triggered', time: '12:01:04', desc: 'Primary path unavailable, fallback path selected.',       style: 'warn'   },
  { name: 'Receipt signed',     time: '12:01:06', desc: 'A signed execution record was generated.',                style: 'normal' },
  { name: 'Verification passed',time: '12:01:06', desc: 'The execution record was verified successfully.',         style: 'success'},
]

const FILTER_CHIPS = [
  { label: 'Agent',    value: 'all agents'   },
  { label: 'Device',   value: 'all devices'  },
  { label: 'Exec ID',  value: 'exec_019de343'},
  { label: 'Type',     value: 'all types'    },
  { label: 'Severity', value: 'all'          },
  { label: 'Range',    value: 'Last 1h'      },
]

const SUMMARY_PAIRS = [
  { k: 'task_id', v: 'task_019de343', accent: false },
  { k: 'status',  v: 'completed',     accent: true  },
  { k: 'route',   v: 'fallback_selected', accent: false },
  { k: 'receipt', v: 'verified',      accent: true  },
]

type TabId = 'stream' | 'timeline' | 'verification'

const SEV_LIGHT: Record<string, string> = {
  INFO: '#166534',
  WARN: '#d97706',
  ERR:  '#d73a49',
  CRIT: '#d73a49',
}
const SEV_DARK: Record<string, string> = {
  INFO: '#16a34a',
  WARN: '#f59e0b',
  ERR:  '#f97583',
  CRIT: '#f97583',
}
const DARK_GREEN_LIGHT = '#166534'
const DARK_GREEN_DARK  = '#16a34a'

function ExecutionPreview({ isDark }: { isDark: boolean }) {
  const bg         = isDark ? '#16160f' : '#ffffff'
  const headerBg   = isDark ? '#111108' : '#f9fafb'
  const border     = isDark ? 'rgba(246,246,244,0.1)' : '#e5e7eb'
  const timeColor  = '#6a737d'
  const msgColor   = isDark ? '#a8a898' : '#4b5563'
  const typeColor  = isDark ? '#9ecbff' : '#032f62'
  const mutedColor = isDark ? '#6b7280' : '#9ca3af'
  const labelColor = isDark ? '#4b5563' : '#b0b8c4'
  const titleColor = isDark ? '#f6f6f4' : '#111827'
  const SEV_COLOR  = isDark ? SEV_DARK : SEV_LIGHT
  const skeletonBg = isDark ? 'rgba(246,246,244,0.06)' : '#e5e7eb'

  const [activeTab, setActiveTab] = useState<TabId>('stream')
  const [visibleCount, setVisibleCount] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)
  const [timelineAnimKey, setTimelineAnimKey] = useState(0)

  const accentGreen = isDark ? DARK_GREEN_DARK : DARK_GREEN_LIGHT

  useEffect(() => {
    if (activeTab !== 'stream') return

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (prefersReduced) {
      setVisibleCount(LOG_EVENTS.length)
      return
    }

    let active = true
    setVisibleCount(0)

    function step(count: number) {
      if (!active) return
      if (count <= LOG_EVENTS.length) {
        setVisibleCount(count)
        setTimeout(() => step(count + 1), 700)
      } else {
        setTimeout(() => {
          if (!active) return
          setVisibleCount(0)
          setTimeout(() => step(1), 400)
        }, 1800)
      }
    }

    setTimeout(() => step(1), 400)

    return () => { active = false }
  }, [activeTab, refreshKey])

  const visibleEvents = LOG_EVENTS.slice(0, visibleCount)

  const TABS: { id: TabId; label: string }[] = [
    { id: 'stream',       label: 'Event Stream'        },
    { id: 'timeline',     label: 'Execution Timeline'  },
    { id: 'verification', label: 'Verification'        },
  ]

  function tabStyle(id: TabId): React.CSSProperties {
    const active = id === activeTab
    return {
      fontFamily: SANS,
      fontSize: '12px',
      fontWeight: 400,
      color: titleColor,
      background: active ? (isDark ? 'rgba(0,0,0,0.45)' : '#ffffff') : 'transparent',
      border: 'none',
      borderRadius: '4px',
      padding: '4px 10px',
      cursor: 'pointer',
      transition: 'background 120ms',
      userSelect: 'none' as const,
      lineHeight: '1.6',
      outline: 'none',
      boxShadow: active && !isDark ? '0 1px 3px rgba(0,0,0,0.08)' : undefined,
    }
  }

  function handleTabClick(id: TabId) {
    if (id === 'timeline') setTimelineAnimKey(k => k + 1)
    setActiveTab(id)
  }

  const cardStyle: React.CSSProperties = {
    height: '100%',
    borderRadius: '24px',
    overflow: 'hidden',
    background: isDark ? '#1a1a1a' : '#ffffff',
    border: `1px solid ${border}`,
    display: 'flex',
    flexDirection: 'column',
    boxShadow: isDark ? 'none' : '0 1px 4px rgba(0,0,0,0.06)',
  }

  const cardHeaderStyle: React.CSSProperties = {
    padding: '8px 14px',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '8px',
    flexShrink: 0,
  }

  const cardBodyStyle: React.CSSProperties = {
    flex: 1,
    overflow: 'hidden',
    background: isDark ? '#111111' : '#f9fafb',
    borderTop: `1px solid ${border}`,
    borderRadius: '24px 24px 0 0',
    display: 'flex',
    flexDirection: 'column',
  }

  return (
    <>
      <style>{`
        @keyframes igris-log-in {
          from { opacity: 0; transform: translateY(3px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes igris-skeleton {
          0%, 100% { opacity: 0.25; }
          50%       { opacity: 0.5;  }
        }
        @keyframes igris-timeline-in {
          from { opacity: 0; transform: translateX(-6px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: '12px', overflow: 'hidden', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', boxShadow: isDark ? 'none' : '0 4px 24px rgba(0,0,0,0.08)' }}>

        {/* ── Tabs + Refresh row ── */}
        <div style={{ padding: '7px 12px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1px', background: isDark ? 'rgba(246,246,244,0.06)' : '#f3f4f6', borderRadius: '6px', padding: '2px' }}>
            {([
              { id: 'stream',       label: 'Event Stream'       },
              { id: 'timeline',     label: 'Execution Timeline' },
              { id: 'verification', label: 'Verification'       },
            ] as { id: TabId; label: string }[]).map((tab) => (
              <button key={tab.id} onClick={() => handleTabClick(tab.id)} style={tabStyle(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflow: 'hidden', padding: '10px 14px' }}>

          {/* Event Stream */}
          {activeTab === 'stream' && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <p style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 600, color: titleColor, margin: 0 }}>Event Stream</p>
                  <p style={{ fontFamily: SANS, fontSize: '11px', color: mutedColor, margin: '2px 0 0' }}>Structured execution events with severity and execution context.</p>
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '3px', fontFamily: SANS, fontSize: '11px', color: accentGreen, flexShrink: 0 }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: accentGreen, display: 'inline-block' }} /> live
                </span>
              </div>
              <div style={cardBodyStyle}>
                {/* Summary strip */}
                <div style={{ padding: '4px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
                  {SUMMARY_PAIRS.map((p) => (
                    <span key={p.k} style={{ display: 'inline-flex', alignItems: 'baseline', gap: '3px' }}>
                      <span style={{ fontFamily: MONO, fontSize: '11px', color: labelColor }}>{p.k}:</span>
                      <span style={{ fontFamily: MONO, fontSize: '11px', color: p.accent ? accentGreen : msgColor }}>{p.v}</span>
                    </span>
                  ))}
                </div>
                {/* Log rows */}
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  {LOG_EVENTS.map((e, i) => {
                    const loaded = i < visibleCount
                    return loaded ? (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          padding: '3px 12px 3px 11px',
                          borderLeft: `1px solid ${e.sev === 'INFO' ? 'transparent' : SEV_COLOR[e.sev]}`,
                          animation: 'igris-log-in 200ms ease forwards',
                        }}
                      >
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: timeColor, width: '60px', flexShrink: 0, userSelect: 'none' }}>{e.time}</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', fontWeight: 500, width: '45px', flexShrink: 0, color: SEV_COLOR[e.sev] }}>{e.sev.toLowerCase()}</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: typeColor, width: '180px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.type}</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: msgColor, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.7 }}>{e.msg}</span>
                      </div>
                    ) : (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '5px 12px 5px 14px',
                          gap: '8px',
                        }}
                      >
                        <div style={{ width: '40px', height: '7px', borderRadius: '3px', background: skeletonBg, animation: 'igris-skeleton 1.4s ease infinite', animationDelay: `${i * 80}ms`, flexShrink: 0 }} />
                        <div style={{ width: '28px', height: '7px', borderRadius: '3px', background: skeletonBg, animation: 'igris-skeleton 1.4s ease infinite', animationDelay: `${i * 80 + 60}ms`, flexShrink: 0 }} />
                        <div style={{ width: '90px', height: '7px', borderRadius: '3px', background: skeletonBg, animation: 'igris-skeleton 1.4s ease infinite', animationDelay: `${i * 80 + 120}ms`, flexShrink: 0 }} />
                        <div style={{ flex: 1, height: '7px', borderRadius: '3px', background: skeletonBg, animation: 'igris-skeleton 1.4s ease infinite', animationDelay: `${i * 80 + 180}ms`, maxWidth: `${55 + ((i * 47) % 35)}%` }} />
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Execution Timeline */}
          {activeTab === 'timeline' && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <p style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 600, color: titleColor, margin: 0 }}>Execution Timeline</p>
                  <p style={{ fontFamily: SANS, fontSize: '11px', color: mutedColor, margin: '2px 0 0' }}>Step-by-step view of the task lifecycle.</p>
                </div>
              </div>
              <div key={timelineAnimKey} style={{ ...cardBodyStyle, padding: '10px 14px', overflow: 'hidden' }}>
                {TIMELINE_STEPS.map((step, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      gap: '10px',
                      opacity: 0,
                      animation: 'igris-timeline-in 280ms ease forwards',
                      animationDelay: `${i * 70}ms`,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, width: '8px' }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: step.style === 'warn' ? '#d97706' : step.style === 'success' ? accentGreen : (isDark ? 'rgba(246,246,244,0.3)' : '#d1d5db'), flexShrink: 0, marginTop: '2px' }} />
                      {i < TIMELINE_STEPS.length - 1 && <div style={{ width: '1px', flex: 1, background: isDark ? 'rgba(246,246,244,0.08)' : '#e5e7eb', minHeight: '8px' }} />}
                    </div>
                    <div style={{ paddingBottom: i < TIMELINE_STEPS.length - 1 ? '7px' : 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontFamily: SANS, fontSize: '12px', fontWeight: 500, color: step.style === 'warn' ? '#d97706' : step.style === 'success' ? accentGreen : titleColor }}>{step.name}</span>
                        <span style={{ fontFamily: MONO, fontSize: '11px', color: timeColor }}>{step.time}</span>
                      </div>
                      <p style={{ fontFamily: SANS, fontSize: '11px', color: mutedColor, margin: 0, lineHeight: 1.4 }}>{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Verification */}
          {activeTab === 'verification' && (
            <div style={cardStyle}>
              <div style={cardHeaderStyle}>
                <div>
                  <p style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 600, color: titleColor, margin: 0 }}>Verification</p>
                  <p style={{ fontFamily: SANS, fontSize: '11px', color: mutedColor, margin: '2px 0 0' }}>Execution proof and verification material for the completed run.</p>
                </div>
              </div>
              <div style={{ ...cardBodyStyle, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: MONO, fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: isDark ? 'rgba(246,246,244,0.04)' : '#f3f4f6' }}>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontFamily: SANS, fontSize: '11px', fontWeight: 500, color: mutedColor, borderBottom: `1px solid ${border}`, width: '30%' }}>field</th>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontFamily: SANS, fontSize: '11px', fontWeight: 500, color: mutedColor, borderBottom: `1px solid ${border}` }}>value</th>
                      <th style={{ padding: '8px 14px', textAlign: 'left', fontFamily: SANS, fontSize: '11px', fontWeight: 500, color: mutedColor, borderBottom: `1px solid ${border}`, width: '22%' }}>group</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { k: 'status',       v: 'verified',          group: 'receipt',   accent: true  },
                      { k: 'execution_id', v: 'exec_019de343',     group: 'receipt',   accent: false },
                      { k: 'task_id',      v: 'task_019de343',     group: 'receipt',   accent: false },
                      { k: 'hash',         v: '42cbd8e558…',       group: 'integrity', accent: false },
                      { k: 'signature',    v: 'valid',             group: 'integrity', accent: true  },
                      { k: 'chain',        v: 'linked',            group: 'integrity', accent: false },
                      { k: 'route',        v: 'fallback_selected', group: 'result',    accent: false },
                      { k: 'outcome',      v: 'completed',         group: 'result',    accent: true  },
                      { k: 'verification', v: 'passed',            group: 'result',    accent: true  },
                    ].map((row) => (
                      <tr key={row.k} style={{ borderBottom: `1px solid ${isDark ? 'rgba(246,246,244,0.04)' : '#f3f4f6'}` }}>
                        <td style={{ padding: '8px 14px', color: labelColor }}>{row.k}</td>
                        <td style={{ padding: '8px 14px', color: row.accent ? accentGreen : msgColor }}>{row.v}</td>
                        <td style={{ padding: '8px 14px', color: mutedColor, fontFamily: SANS, fontSize: '11px' }}>{row.group}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
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
    <section id="product" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-3 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS }}>
              The execution layer for AI tasks.
            </h2>
            <Link
              href="https://docs.igrisinertial.com/"
              className="group inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-xl border shrink-0 md:ml-4"
              style={{ backgroundColor: isDark ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: isDark ? '#f6f6f4' : '#1b1912', borderColor: isDark ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily: SANS }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', paddingBottom: 0 }}>
          <div className="py-10 sm:py-16">

            {/* Desktop layout */}
            <div className="hidden sm:grid gap-10" style={{ gridTemplateColumns: '65fr 35fr' }}>
              {/* Left: image background, panel floats over it — 60% */}
              <div style={{ position: 'relative', minHeight: 'clamp(580px, 60vw, 720px)' }}>
                <img
                  src={isDark ? '/execution.jpeg' : '/pkrllol.png'}
                  alt="Product"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '0.5rem',
                  }}
                />
                <div style={{ position: 'absolute', inset: '50px', zIndex: 10 }}>
                  <ExecutionPreview isDark={isDark} />
                </div>
              </div>

              {/* Right: descriptive content — 40% */}
              <div className="flex flex-col justify-center">
                <p className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: SANS, fontWeight: 400 }}>
                  Models decide. Igris executes.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: SANS }}>
                  AI agents now touch APIs, databases, workflows, and live infrastructure. Igris turns model decisions into controlled action — with bounded execution, recovery when a step fails, and a signed receipt of what actually happened.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: SANS }}>
                  Built for teams running AI beyond chat — where every task needs to be inspected, recovered, and verified across cloud, edge, and local environments.
                </p>
              </div>
            </div>

            {/* Mobile layout */}
            <div className="sm:hidden flex flex-col gap-6">
              <div style={{ position: 'relative', width: '100%' }}>
                <img
                  src={isDark ? '/execution.jpeg' : '/pkrllol.png'}
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
                  AI agents now touch APIs, databases, workflows, and live infrastructure. Igris turns model decisions into controlled action — with bounded execution, recovery when a step fails, and a signed receipt of what actually happened.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: SANS }}>
                  Built for teams running AI beyond chat — where every task needs to be inspected, recovered, and verified across cloud, edge, and local environments.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  )
}
