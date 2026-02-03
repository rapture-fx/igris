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
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[750px] md:h-[750px]">

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

            {/* Title Section - Shows first on mobile */}
            <div className="mb-8 text-left">
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. DEPLOYMENT
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                Deploy. Verify. Optimize.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter leading-relaxed mb-8">
                Hybrid behavior trees meet LLM reasoning. Deterministic execution meets cryptographic proof.
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Deploy</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  16MB binary. The complete nervous system in a single file. Behavior trees for structure, LLM reasoning for intelligence, cryptographic signing for proof. Deploy on a Raspberry Pi or industrial edge device. Hardware you already own becomes AI-capable in minutes.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  No containers. No dependencies. No cloud required.
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Verify</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  Behavior trees execute deterministically. LLMs reason when needed. Memory layer tracks every decision. Proof layer signs everything. Your AI operates predictably offline while the nervous system records what it does, why it did it, and proves it happened exactly as specified.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Deterministic execution. Cryptographic proof. Zero hallucination risk.
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Optimize</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                  Deploy to hundreds of devices. The dashboard awakens—fleet health across execution layer, routing decisions from intelligence layer, behavior patterns in memory layer, cryptographic verification from proof layer. Performance heatmaps reveal bottlenecks. Anomaly detection catches failures before they cascade. A/B test behavior trees across your fleet.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                  Complete observability. Advanced optimization. Full control.
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
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ minHeight: '240px' }}>
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
                        Behavior trees + LLM reasoning. 16MB.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Deploy</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Single binary with complete nervous system.<br/>
                      Structured decisions meet language model intelligence. Cryptographically provable.
                    </p>
                  </div>
                </div>
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ minHeight: '240px' }}>
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
                        Deterministic + intelligent. Offline capable.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Verify</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Behavior trees execute predictably. LLMs reason when needed.<br/>
                      Memory tracks decisions. Proof signs everything. No hallucination.
                    </p>
                  </div>
                </div>
                <div className="w-full border border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912] flex" style={{ minHeight: '260px' }}>
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
                        Fleet observability. Advanced analytics. Full control.
                      </p>
                    </div>
                  </div>
                  <div className="w-2/5 p-6">
                    <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Optimize</h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-2 leading-relaxed">
                      Dashboard reveals all four layers across your fleet.<br/>
                      Heatmaps, anomaly detection, A/B testing. Complete nervous system visibility.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Title (1 column wide with left border) */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. DEPLOYMENT
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Deploy. Verify. Optimize.
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Hybrid behavior trees meet LLM reasoning. Deterministic execution meets cryptographic proof.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
