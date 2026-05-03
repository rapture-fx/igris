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

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
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

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Desktop table — 3 columns */}
          <table className="w-full hidden md:table" style={{ borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
{capabilities.map((cap, index) => (
                  <td
                    key={cap.name}
                    style={{
                      width: '33.333%',
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingLeft: index === 0 ? 0 : '0.75rem',
                      paddingRight: index === capabilities.length - 1 ? 0 : '0.75rem',
                      verticalAlign: index === 1 ? 'top' : 'middle',
                      borderRight: 'none',
                    }}
                  >
                    <div className="landing-surface-card rounded-xl p-4 border flex flex-col items-center shadow-sm">
                      <div style={{ width: cap.wrapW, height: cap.wrapH, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
                        <div className="rounded-xl p-2" style={{ width: cap.imgW, height: cap.imgH, backgroundColor: 'transparent', border: 'none' }}>
                          <img
                            src={mounted && theme === 'dark' ? cap.imgDark : cap.imgLight}
                            alt={cap.name}
                            style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: index === 1 || index === 2 ? (mounted && theme === 'dark' ? 1 : 0.5) : 1, background: 'transparent' }}
                          />
                        </div>
                      </div>
                      <div className="w-full text-left px-4 py-4">
                        <h4 className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                          {cap.name}
                        </h4>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily }}>
                          {cap.description}
                        </p>
                      </div>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Mobile stacked */}
          <div className="flex flex-col md:hidden divide-y divide-[rgba(209,213,219,0.35)] dark:divide-[rgba(246,246,244,0.06)]">
            {capabilities.map((cap, index) => (
              <div key={cap.name} className="py-8">
                <div className="landing-surface-card rounded-xl p-4 border flex flex-col items-center shadow-sm">
                  <div className="w-36 h-40 flex items-center justify-center" style={{ background: 'transparent' }}>
                    <div className="p-2" style={{ width: '160px', height: '160px', backgroundColor: 'transparent', border: 'none' }}>
                      <img
                        src={mounted && theme === 'dark' ? cap.imgDark : cap.imgLight}
                        alt={cap.name}
                        style={{ width: cap.name.includes('Decide') ? '140px' : '120px', height: cap.name.includes('Decide') ? '140px' : '120px', objectFit: 'contain', opacity: index === 1 || index === 2 ? (mounted && theme === 'dark' ? 1 : 0.5) : 1, background: 'transparent' }}
                      />
                    </div>
                  </div>
                  <div className="w-full text-left px-4 py-4">
                    <h4 className="text-sm mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                      {cap.name}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed" style={{ fontWeight: 400, fontFamily }}>
                      {cap.description}
                    </p>
                  </div>
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
