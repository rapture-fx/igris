import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Execute Deterministically',
    description: 'Hard resource limits. Sandboxed safety. Predictable latency. Your AI behaves exactly as specified—no memory leaks, no runaway processes, no surprises in production.',
  },
  {
    name: 'Prove Cryptographically',
    description: 'Every decision signed. Every action logged. Every update verified. Whether proving compliance to regulators or debugging a customer incident, you have immutable, cryptographically verifiable proof.',
  },
  {
    name: 'Survive Independently',
    description: 'Run for years without the cloud. Sync when possible. Operate when denied. The first AI execution layer designed for the edge and the data center—where deterministic behavior isn\'t optional.',
  },
]

export default function CoreCapabilities() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[750px] md:h-auto">

            {/* Content Container */}
            <div className="w-full px-0 flex flex-col flex-1">

              {/* Mobile Layout - Title first, then capabilities */}
              <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                {/* Title Section - Shows first on mobile */}
                <div className="mb-8 text-left">
                  <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                    02. THE SOLUTION
                  </p>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                    Runtime is the deterministic execution layer for AI
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                    One binary. Three guarantees.
                  </p>
                </div>

                {/* Capabilities - Shows after title on mobile */}
                <div className="space-y-6">
                  {capabilities.map((capability, index) => {
                    const getImage = () => {
                      if (index === 0) return { light: '/tre.png', dark: '/cr.png' };
                      if (index === 1) return { light: '/two.png', dark: '/cs.png' };
                      if (index === 2) return { light: '/one.png', dark: '/cc.png' };
                      return null;
                    };
                    const images = getImage();

                    return (
                      <div key={capability.name}>
                        {images && (
                          <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4" style={{ height: '150px', position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <img
                              src={mounted && theme === 'dark' ? images.dark : images.light}
                              alt={capability.name}
                              style={{
                                width: '60%',
                                height: '60%',
                                objectFit: 'contain',
                                opacity: '0.6'
                              }}
                            />
                          </div>
                        )}
                        <h4 className="text-sm font-semibold mb-2 font-inter text-[#000000] dark:text-[#f6f6f4]">
                          {capability.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                          {capability.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Two-column layout */}
              <div className="hidden md:grid md:grid-cols-3 gap-0 relative flex-1">
                {/* Left Column - Capabilities (2 columns wide) */}
                <div className="hidden md:flex md:col-span-2 flex-col justify-start" style={{
                  paddingTop: '3rem',
                  paddingBottom: '3rem',
                  paddingRight: '2rem'
                }}>
                  <div className="w-full">
                    {/* Same layout for both light and dark mode - horizontal cards */}
                    <div className="flex gap-4">
                      {capabilities.map((capability, index) => (
                        <div key={capability.name} className="flex-1 border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912]">
                          {/* Image section */}
                          <div style={{
                            width: '100%',
                            height: '300px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            overflow: 'hidden'
                          }}>
                            {index === 0 && (
                              <img
                                src={mounted && theme === 'dark' ? '/cr.png' : '/tre.png'}
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '65%',
                                  height: '65%',
                                  objectFit: 'contain',
                                  opacity: '0.6'
                                }}
                              />
                            )}
                            {index === 1 && (
                              <img
                                src={mounted && theme === 'dark' ? '/cs.png' : '/two.png'}
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '55%',
                                  height: '55%',
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
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.6'
                                }}
                              />
                            )}
                          </div>
                          {/* Text section */}
                          <div className="p-4">
                            <h4 className="text-sm font-semibold mb-2 font-inter text-[#000000] dark:text-[#f6f6f4]">
                              {capability.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                              {capability.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {/* Horizontal frame below cards */}
                    <div className="mt-4 w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] relative overflow-hidden" style={{ height: '250px' }}>
                      <img
                        src="/cl.png"
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover object-center"
                        style={{ opacity: 0.8 }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right Column - Title and Intro (Desktop only) */}
                <div className="hidden md:flex text-left md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                  <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                    02. THE SOLUTION
                  </p>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                    Runtime is the deterministic execution layer for AI
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                    One binary. Three guarantees.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
