import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Execute with Bounds',
    description: 'Every execution runs in an isolated worker. Memory, CPU, and time are enforced at the OS level. Exceed a limit and the worker is killed. Every violation is signed and hash-chained.',
    imgDark: '/cr.png?v=2',
    imgLight: '/exc.png?v=2',
    imgW: '180px',
    imgH: '180px',
    wrapW: '200px',
    wrapH: '180px',
  },
  {
    name: 'Decide with Structure',
    description: 'Language models generate reasoning. The runtime governs execution through bounded control paths. Isolated, time-limited, and supervised. Intelligence remains flexible.',
    imgDark: '/cs.png',
    imgLight: '/tre.png',
    imgW: '200px',
    imgH: '200px',
    wrapW: '200px',
    wrapH: '350px',
  },
  {
    name: 'Remember with Proof',
    description: 'Every execution produces a signed envelope. Violations are hash-chained and tamper-evident. Verify independently — without our control plane. You verify the system.',
    imgDark: '/cc.png',
    imgLight: '/one.png',
    imgW: '180px',
    imgH: '180px',
    wrapW: '200px',
    wrapH: '180px',
  },
]

const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const borderStyle = '0.5px solid rgba(209, 213, 219, 0.35)'

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
                The Guarantees
              </h3>
              <Link
                href="/core"
                className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
                style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily }}
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
                      paddingLeft: index === 0 ? 0 : '2rem',
                      paddingRight: index === capabilities.length - 1 ? 0 : '2rem',
                      verticalAlign: index === 1 ? 'top' : 'middle',
                      borderRight: index < capabilities.length - 1 ? borderStyle : 'none',
                    }}
                  >
                    <div className="bg-white/50 dark:bg-dark-bg/50 rounded-xl p-4 border border-[rgba(209,213,219,0.35)] flex flex-col items-center shadow-sm">
                      <div style={{ width: cap.wrapW, height: cap.wrapH, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div className="rounded-xl p-2" style={{ width: '200px', height: '200px' }}>
                          <img
                            src={mounted && theme === 'dark' ? cap.imgDark : cap.imgLight}
                            alt={cap.name}
                            style={{ width: cap.imgW, height: cap.imgH, objectFit: 'contain', opacity: 1 }}
                          />
                        </div>
                      </div>
                      <div className="w-full text-left px-4 py-4">
                        <h4 className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                          {cap.name}
                        </h4>
                        <p className="text-xs md:text-sm text-gray-500 dark:text-gray-400 leading-relaxed" style={{ fontWeight: 400, fontFamily }}>
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
          <div className="flex flex-col md:hidden divide-y divide-[rgba(209,213,219,0.35)]">
            {capabilities.map((cap) => (
              <div key={cap.name} className="py-8">
                <div className="bg-white/50 dark:bg-dark-bg/50 rounded-xl p-4 border border-[rgba(209,213,219,0.35)] flex flex-col items-center shadow-sm">
                  <div className="w-36 h-40 flex items-center justify-center">
                    <div className="rounded-xl p-2" style={{ width: '160px', height: '160px' }}>
                      <img
                        src={mounted && theme === 'dark' ? cap.imgDark : cap.imgLight}
                        alt={cap.name}
                        style={{ width: cap.name.includes('Decide') ? '140px' : '120px', height: cap.name.includes('Decide') ? '140px' : '120px', objectFit: 'contain', opacity: 1 }}
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
