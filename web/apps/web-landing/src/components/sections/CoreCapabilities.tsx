import React, { useEffect, useState } from 'react'
import { Shield, Box } from 'lucide-react'
import { useTheme } from 'next-themes'

const capabilities = [
  {
    name: 'Smart Routing',
    description: 'Routes requests to the best provider based on real performance data. Detects slow or failing providers and shifts traffic automatically. Can query multiple providers and pick the best response.',
  },
  {
    name: 'Built for Scale',
    description: 'Handles 50,000+ requests per second with sub-millisecond caching. Each customer gets their own rate limits — no noisy neighbor problems. Requests run in parallel to cut latency.',
  },
  {
    name: 'Isolated and Resilient',
    description: 'Each customer\'s data is isolated at the database level. Your API keys work even if our servers are unreachable. Routing decisions are cached locally for 72 hours as a fallback.',
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
        <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
            height: '750px'
          }}>

            {/* Content Container */}
            <div className="w-full px-0 flex flex-col h-full">
              {/* No absolute divider - use border on right column instead */}

              {/* Capabilities - Mobile - Shows first on mobile */}
              <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                <div className="space-y-6">
                  {capabilities.map((capability) => (
                    <div key={capability.name}>
                      <h4 className="text-sm font-semibold mb-2 font-inter text-[#000000] dark:text-[#f6f6f4]">
                        {capability.name}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                        {capability.description}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Title Section - Shows last on mobile */}
                <div className="mt-12 text-left">
                  <p className="text-base text-[#084CCF] dark:text-[#a20b0b] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                    02. CORE
                  </p>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                    System Overview
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                    Overture decides which provider handles each request. Runtime executes agents safely on edge devices. Hybrid connects them with cryptographic verification.
                  </p>
                </div>
              </div>

              {/* Two-column layout */}
              <div className="hidden md:grid md:grid-cols-3 gap-0 relative h-full">
                {/* Left Column - Capabilities (2 columns wide) */}
                <div className="hidden md:flex md:col-span-2 flex-col justify-start" style={{
                  paddingTop: '3rem',
                  paddingBottom: '3rem',
                  paddingRight: '2rem'
                }}>
                  <div className="w-full">
                    {/* Light mode - vertical stack */}
                    <div className={mounted && theme === 'dark' ? 'hidden' : 'space-y-6'}>
                       {capabilities.map((capability) => (
                         <div key={capability.name} className="flex gap-4 items-start">
                           <div className="bg-[#f6f6f4] dark:bg-[#1b1912] border border-gray-300 dark:border-[#f6f6f4]/5" style={{
                             width: '200px',
                             height: '200px',
                             flexShrink: 0,
                             display: 'flex',
                             alignItems: 'center',
                             justifyContent: 'center',
                             position: 'relative',
                             overflow: 'hidden'
                           }}>
                            <img
                              src={mounted && theme === 'dark' ? '/dm.png' : '/fr.png'}
                              alt={capability.name}
                              style={{
                                position: 'absolute',
                                width: '140%',
                                height: '140%',
                                objectFit: 'cover',
                                opacity: '0.7'
                              }}
                            />
                            {capabilities.indexOf(capability) === 0 && (
                              <img
                                src={mounted && theme === 'dark' ? '/dmone.png' : '/tre.png'}
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.65'
                                }}
                              />
                            )}
                            {capabilities.indexOf(capability) === 1 && (
                              <img
                                src={mounted && theme === 'dark' ? '/dmtwo.png' : '/two.png'}
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.5'
                                }}
                              />
                            )}
                            {capabilities.indexOf(capability) === 2 && (
                              <img
                                src={mounted && theme === 'dark' ? '/dmtre.png' : '/one.png'}
                                alt={capability.name}
                                style={{
                                  position: 'absolute',
                                  width: '60%',
                                  height: '60%',
                                  objectFit: 'contain',
                                  opacity: '0.5'
                                }}
                              />
                            )}
                          </div>
                          <div className="flex-1">
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

                    {/* Dark mode - each card contains image and text together */}
                    {mounted && theme === 'dark' && (
                      <>
                        <div className="flex gap-4">
                          {capabilities.map((capability, index) => (
                            <div key={capability.name} className="flex-1 border border-[#f6f6f4]/5 bg-[#1b1912]">
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
                                <img
                                  src="/dm.png"
                                  alt={capability.name}
                                  style={{
                                    position: 'absolute',
                                    width: '140%',
                                    height: '140%',
                                    objectFit: 'cover',
                                    opacity: '0.4'
                                  }}
                                />
                                {index === 0 && (
                                  <img
                                    src="/dmone.png"
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
                                {index === 1 && (
                                  <img
                                    src="/dmtwo.png"
                                    alt={capability.name}
                                    style={{
                                      position: 'absolute',
                                      width: '45%',
                                      height: '45%',
                                      objectFit: 'contain',
                                      opacity: '0.6'
                                    }}
                                  />
                                )}
                                {index === 2 && (
                                  <img
                                    src="/dmtre.png"
                                    alt={capability.name}
                                    style={{
                                      position: 'absolute',
                                      width: '50%',
                                      height: '50%',
                                      objectFit: 'contain',
                                      opacity: '0.6'
                                    }}
                                  />
                                )}
                              </div>
                              {/* Text section */}
                              <div className="p-4">
                                <h4 className="text-sm font-semibold mb-2 font-inter text-[#f6f6f4]">
                                  {capability.name}
                                </h4>
                                <p className="text-xs text-[#a8a898] leading-relaxed font-inter">
                                  {capability.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Horizontal frame below cards */}
                        <div className="mt-4 w-full border border-[#f6f6f4]/5 bg-[#1b1912] relative overflow-hidden" style={{ height: '250px' }}>
                          <img
                            src="/pnk.png"
                            alt="Background"
                            style={{
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover'
                            }}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Right Column - Title and Intro (Desktop only) */}
                <div className="hidden md:flex text-left md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                  <p className="text-base text-[#084CCF] dark:text-[#a20b0b] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                    02. CORE
                  </p>
                  <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                    System Overview
                  </h3>
                  <p className="text-sm text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                    Overture decides which provider handles each request. Runtime executes agents safely on edge devices. Hybrid connects them with cryptographic verification.
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
