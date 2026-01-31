'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useTheme } from 'next-themes'

export default function HowItWorks() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section id="how-it-works" className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[750px] md:h-[750px]">

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

            {/* Title Section - Shows first on mobile */}
            <div className="mb-8 text-left">
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. THE FLOW
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                Drop it. Run it. Scale it.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter leading-relaxed mb-8">
                Three steps. One binary. Infinite reach.
              </p>
            </div>

            {/* Mobile Content - Three Steps */}
            <div className="space-y-8">
              {/* Step 1: Drop it */}
              <div>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/ovr.png"
                    alt="Deploy Runtime"
                    fill
                    className="opacity-100"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Drop it</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  A single binary lighter than a photo. It wakes up on hardware you already own. Raspberry Pi. Old industrial PC. That weird ARM board from 2019. It just works.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  No containers. No cloud contracts.
                </p>
              </div>

              {/* Step 2: Run it */}
              <div>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/xe.png"
                    alt="Execute Locally"
                    fill
                    className="opacity-100"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Run it</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  Your model breathes. The world goes quiet. No API calls. No dependency anxiety. Internet optional.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Works in the silence between connections.
                </p>
              </div>

              {/* Step 3: Scale it */}
              <div>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/ol.png"
                    alt="Fleet Dashboard"
                    fill
                    className="opacity-100"
                    style={{ objectFit: 'cover' }}
                  />
                </div>
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Scale it</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  When one becomes many, the horizon appears. Push an update. Watch the fleet sync. Sleep through the night. The dashboard isn't a purchase decision—it's the view that unlocks when you're ready to see it.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  The view unlocks automatically. No separate product.
                </p>
              </div>
            </div>
          </div>

          {/* Two-column layout - Matching Products section */}
          <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Content (2 columns wide) */}
            <div className="md:col-span-2 flex flex-col justify-start relative" style={{
              padding: '3rem 2rem 3rem 0',
              backgroundImage: mounted && theme === 'dark' ? 'none' : 'radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px)',
              backgroundSize: '20px 20px',
              backgroundPosition: '1rem 3rem'
            }}>
              {/* Frames layout for both light and dark mode */}
              <div className="flex flex-col gap-4 w-full">
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ height: '240px' }}>
                  <div className="w-3/5 p-6 flex flex-col justify-between overflow-hidden">
                    <div>
                      <Image
                        src="/ovr.png"
                        alt="Deploy Runtime"
                        width={450}
                        height={450}
                        className="mb-4 object-contain opacity-100"
                      />
                    </div>
                    <div className="mt-auto pb-8">
                      <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed line-clamp-2">
                        Zero dependencies. No Docker required.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Drop it</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      A single binary lighter than a photo.<br/>
                      Wakes up on hardware you already own. It just works.
                    </p>
                  </div>
                </div>
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ height: '210px' }}>
                  <div className="w-3/5 p-6 flex flex-col justify-between">
                    <div>
                      <Image
                        src="/xe.png"
                        alt="Execute Locally"
                        width={450}
                        height={450}
                        className="mb-4 object-contain opacity-80"
                      />
                    </div>
                    <div className="mt-auto pb-4">
                      <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                        Sandboxed execution with enforced safety limits.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Run it</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Your model breathes. The world goes quiet.<br/>
                      No API calls. No dependency anxiety. Internet optional.
                    </p>
                  </div>
                </div>
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ height: '210px' }}>
                  <div className="w-3/5 p-6 flex flex-col justify-between">
                    <div>
                      <Image
                        src="/ol.png"
                        alt="Fleet Dashboard"
                        width={450}
                        height={450}
                        className="mb-4 object-contain opacity-100"
                      />
                    </div>
                    <div className="mt-auto pb-4">
                      <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                        Dashboard is included free with every Runtime license.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Scale it</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      When one becomes many, the horizon appears.<br/>
                      The dashboard isn't a purchase—it's the view that unlocks when you're ready to see it.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Title (1 column wide with left border) */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. THE FLOW
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Drop it. Run it. Scale it.
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Three steps. One binary. Infinite reach.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
