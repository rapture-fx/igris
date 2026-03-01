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
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingBottom: '2rem' }}>
          {/* Title */}
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              The Guarantees
            </h3>
            <Link
              href="/core"
              className="inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border shrink-0 ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Learn More
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Frame with centered cards */}
          <div className="rounded-2xl flex items-center justify-center relative overflow-hidden core-cards-frame" style={{ height: '600px', marginTop: '2rem' }}>
            <img
              src="/arc.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0 rounded-2xl"
              style={{ opacity: 0.9 }}
            />
            <div className="flex flex-col md:flex-row gap-4 z-10 w-full md:w-auto px-4 md:px-0 py-8 md:py-0">
              {capabilities.map((capability, index) => (
                <React.Fragment key={capability.name}>
                   <div className="bg-[#f9f9fa] dark:bg-[#1b1912]/60 border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl w-full md:w-[280px] flex flex-col" style={{ minHeight: '380px' }}>
                    <div style={{
                      width: '100%',
                      height: '200px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}>
                      {index === 0 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cr.png?v=2' : '/exc.png?v=2'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                      {index === 1 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cs.png' : '/tre.png'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                      {index === 2 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cc.png' : '/one.png'}
                          alt={capability.name}
                          style={{
                            width: '85%',
                            height: '85%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                    </div>
                    <div className="p-6 pt-4 mt-auto">
                      <h4 className="text-base md:text-lg mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                        {capability.name}
                      </h4>
                      <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                        {capability.description}
                      </p>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
