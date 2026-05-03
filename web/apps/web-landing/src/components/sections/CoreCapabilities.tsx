import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Controlled runs',
    description: 'Define boundaries before an AI task executes. Apply limits, permission checks, and failure conditions so tasks do not continue unchecked.',
    imgDark: '/excd.png',
    imgLight: '/exdc.png',
    imgW: '140px',
    imgH: '140px',
    wrapW: '200px',
    wrapH: '260px',
  },
  {
    name: 'Structured paths',
    description: 'Let models reason, but keep execution on explicit paths. Use defined steps, conditions, and approvals to make long-running tasks easier to inspect and control.',
    imgDark: '/cr.png?v=2',
    imgLight: '/tre.png',
    imgW: '240px',
    imgH: '240px',
    wrapW: '280px',
    wrapH: '350px',
  },
  {
    name: 'Verifiable records',
    description: 'Generate signed execution records for critical runs, so teams can inspect what happened and verify the result independently.',
    imgDark: '/cc.png',
    imgLight: '/one.png',
    imgW: '140px',
    imgH: '140px',
    wrapW: '200px',
    wrapH: '260px',
  },
]

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const borderStyle = 'var(--section-border)'

export default function CoreCapabilities() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden relative z-0">

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle, paddingBottom: 0 }}>
          <div className="py-6 md:py-12 lg:py-16">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-6">
              <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                Execution guarantees
              </h3>
              <Link
                href="/core"
                className="landing-surface-button inline-flex items-center justify-center px-3 py-1.5 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
                style={{ fontFamily }}
              >
                Learn More
                <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Divider below title */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Cards grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-8 md:py-12 md:items-start">
            {capabilities.map((cap, index) => (
              <div
                key={cap.name}
                className="rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col"
              >
                {/* Header */}
                <div className="px-4 pt-3 pb-2.5" style={{ fontFamily }}>
                  <span className="text-xs font-medium text-black dark:text-[#f6f6f4]">{cap.name}</span>
                </div>
                {/* Nested inner panel */}
                <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl flex flex-col px-6 pt-6 pb-6 flex-1">
                  <div style={{ width: cap.wrapW, height: cap.wrapH, display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' }}>
                    <img
                      src={mounted && theme === 'dark' ? cap.imgDark : cap.imgLight}
                      alt={cap.name}
                      style={{
                        width: cap.imgW,
                        height: cap.imgH,
                        objectFit: 'contain',
                        opacity: index === 1 || index === 2 ? (mounted && theme === 'dark' ? 1 : 0.5) : 1,
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[200px] mt-4" style={{ fontFamily, fontWeight: 400 }}>
                    {cap.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

        </div>
      </div>

      {/* Bottom border */}
      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
