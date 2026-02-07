import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Execution',
    description: 'Execute AI with deterministic precision and sandboxed safety. Monitor devices in real time, deploy models instantly, and push configurations fleet-wide. From one agent to thousands, execution remains predictable and bounded.',
  },
  {
    name: 'Intelligence',
    description: 'Route decisions across multiple LLM providers. Balance cost and performance. Test in shadow mode before production. The decision layer adapts intelligently while keeping execution fully controlled.',
  },
  {
    name: 'Memory & Proof',
    description: 'Track behavior trees across the fleet. Detect anomalies automatically. Inspect historical decisions end-to-end. Every action is cryptographically signed, creating an immutable audit trail—from debugging incidents to proving compliance.',
  },
]

export default function CoreCapabilities() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10 min-h-[900px]">
          {/* Title outside the frame */}
          <div className="text-left mb-8" style={{ paddingTop: '3rem' }}>
            <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
              02. THE ARCHITECTURE
            </p>
            <h3 className="text-lg md:text-xl lg:text-2xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
              Every layer working together
            </h3>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
              From a single device to fleets. From edge to cloud.
            </p>
          </div>
          
          {/* Frame with centered cards */}
          <div className="border border-gray-300 dark:border-[#f6f6f4]/10 rounded-lg flex items-center justify-center relative overflow-hidden" style={{ height: '700px', paddingBottom: '3rem' }}>
            <img
              src="/arc.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover z-0"
              style={{ opacity: 0.9 }}
            />
            <div className="flex gap-4 z-10">
              {capabilities.map((capability, index) => (
                <React.Fragment key={capability.name}>
                  <div className="bg-[#f6f6f4] dark:bg-[#1b1912] border border-gray-300 dark:border-[#f6f6f4]/10 rounded-lg w-[220px] shadow-md">
                    <div style={{
                      width: '100%',
                      height: '150px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      overflow: 'hidden'
                    }}>
                      {index === 0 && (
                        <img
                          src={mounted && theme === 'dark' ? '/cr.png' : '/exc.png'}
                          alt={capability.name}
                          style={{
                            width: '60%',
                            height: '60%',
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
                            width: '60%',
                            height: '60%',
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
                            width: '60%',
                            height: '60%',
                            objectFit: 'contain',
                            opacity: '0.6'
                          }}
                        />
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="text-sm font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        {capability.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
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
    </section>
  )
}
