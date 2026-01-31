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
                03. FLOW
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                How It Works
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter leading-relaxed mb-8">
                Runtime runs locally on your devices. When online, it syncs with the included Fleet Dashboard for management.
              </p>
            </div>

            {/* Mobile Content - Three Steps */}
            <div className="space-y-8">
              {/* Step 1: Deploy */}
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">1. Deploy</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  Download the 16MB Runtime binary. Deploy to any device—Raspberry Pi, edge server, or embedded hardware. Add your GGUF models.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Zero dependencies. No Docker required.
                </p>
              </div>

              {/* Step 2: Execute */}
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">2. Execute</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  Runtime executes AI workloads locally in a sandboxed environment. Runs offline indefinitely with local models. No cloud required.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Sandboxed execution with enforced safety limits.
                </p>
              </div>

              {/* Step 3: Sync */}
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">3. Sync (When Online)</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  When connected, Runtime syncs with the Overture Fleet Dashboard. Push model updates, monitor status, and manage configurations across your entire fleet.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Dashboard is included free with every Runtime license.
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
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">1. Deploy</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Download the 16MB Runtime binary.<br/>
                      Deploy to any device—Raspberry Pi, edge server, or embedded hardware. Add your GGUF models.
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
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">2. Execute</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Runtime executes AI workloads locally.<br/>
                      Runs offline indefinitely with local models. No cloud required.
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
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">3. Sync (When Online)</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Runtime syncs with the Overture Fleet Dashboard.<br/>
                      Push model updates, monitor status, and manage configurations across your fleet.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Title (1 column wide with left border) */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. FLOW
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                How It Works
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Runtime runs on your devices, executing AI locally. When online, it syncs with the Overture Fleet Dashboard for management and updates.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
