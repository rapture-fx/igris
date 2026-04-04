import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Execute with Bounds',
    description: 'Every execution runs in an isolated worker. Memory, CPU, and time are enforced at the OS level. Exceed a limit and the worker is killed. Every violation is signed and hash-chained.',
  },
  {
    name: 'Decide with Structure',
    description: 'Language models generate reasoning. The runtime governs execution through bounded control paths. Isolated, time-limited, and supervised. Intelligence remains flexible.',
  },
  {
    name: 'Remember with Proof',
    description: 'Every execution produces a signed envelope. Violations are hash-chained and tamper-evident. Verify independently — without our control plane. You verify the system.',
  },
]

export default function CoreCapabilities() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden relative z-0">
      
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingBottom: 0 }}>
          {/* Title */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-lg md:text-xl lg:text-2xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              The Guarantees
            </h3>
            <Link
              href="/core"
              className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Learn More
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width border below title */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingBottom: 0 }}>

          {/* Table layout — block on mobile, table on md+ */}
          <table className="w-full hidden md:table" style={{ borderCollapse: 'collapse', marginTop: 0 }}>
            <tbody>
              <tr>
                {capabilities.map((capability, index) => (
                  <td
                    key={capability.name}
                    style={{
                      width: '33.333%',
                      paddingTop: '3rem',
                      paddingBottom: '10rem',
                      paddingLeft: index === 0 ? 0 : '2rem',
                      paddingRight: index === capabilities.length - 1 ? 0 : '2rem',
                      verticalAlign: 'top',
                      borderRight: index < capabilities.length - 1 ? '0.5px solid rgba(209, 213, 219, 0.35)' : 'none',
                    }}
                  >
                    <div style={{
                      width: '100px',
                      height: '100px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'flex-start',
                      marginBottom: '16rem',
                    }}>
                      {index === 0 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cr.png?v=2' : '/exc.png?v=2'}
                          alt={capability.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                        />
                      )}
                      {index === 1 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cs.png' : '/tre.png'}
                          alt={capability.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                        />
                      )}
                      {index === 2 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cc.png' : '/one.png'}
                          alt={capability.name}
                          style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                        />
                      )}
                    </div>
                    <div className="max-w-xs">
                      <h4 className="text-sm md:text-base mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                        {capability.name}
                      </h4>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                        {capability.description}
                      </p>
                    </div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>

          {/* Mobile stacked layout — visible only below md */}
          <div className="flex flex-col md:hidden divide-y divide-[rgba(209,213,219,0.35)]">
            {capabilities.map((capability, index) => (
              <div key={capability.name} className="py-8">
                <div className="w-24 h-24 flex items-start justify-start mb-24">
                  {index === 0 && (
                    <img
                      src={mounted && theme === 'dark' ? '/cr.png?v=2' : '/exc.png?v=2'}
                      alt={capability.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                    />
                  )}
                  {index === 1 && (
                    <img
                      src={mounted && theme === 'dark' ? '/cs.png' : '/tre.png'}
                      alt={capability.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                    />
                  )}
                  {index === 2 && (
                    <img
                      src={mounted && theme === 'dark' ? '/cc.png' : '/one.png'}
                      alt={capability.name}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: 1 }}
                    />
                  )}
                </div>
                <div className="max-w-xs">
                  <h4 className="text-base mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {capability.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    {capability.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
