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
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r min-h-[900px] md:h-[900px]">

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

            {/* Title Section - Shows first on mobile */}
            <div className="mb-8 text-left">
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. DEPLOYMENT
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                Deploy. Verify. Optimize.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-8" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Deploy</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                  16MB binary. The complete nervous system in a single file. Behavior trees for structure, LLM reasoning for intelligence, cryptographic signing for proof. Deploy on a Raspberry Pi or industrial edge device. Hardware you already own becomes AI-capable in minutes.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed italic" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Verify</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                  Behavior trees execute deterministically. LLMs reason when needed. Memory layer tracks every decision. Proof layer signs everything. Your AI operates predictably offline while the nervous system records what it does, why it did it, and proves it happened exactly as specified.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed italic" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
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
                <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Optimize</h4>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                  Deploy to hundreds of devices. The dashboard awakens—fleet health across execution layer, routing decisions from intelligence layer, behavior patterns in memory layer, cryptographic verification from proof layer. Performance heatmaps reveal bottlenecks. Anomaly detection catches failures before they cascade. A/B test behavior trees across your fleet.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed italic" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                  Complete observability. Advanced optimization. Full control.
                </p>
              </div>
            </div>
          </div>

          {/* Two-column layout - Empty left, Text on right */}
          <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - With hw.png image */}
            <div className="md:col-span-2 relative" style={{ padding: '1rem' }}>
              <img
                src="/hw.png"
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                style={{ opacity: 0.9 }}
              />
            </div>

            {/* Right Column - Title and all text content */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                03. DEPLOYMENT
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                Deploy. Verify. Optimize.
              </h2>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-6" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                The system is designed to move from initial installation to fleet-level operation without changing how execution works.
              </p>
              
              {/* Text content in right column */}
              <div className="flex flex-col gap-6">
                <div className="p-4">
                  <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Deploy</h4>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Install a single binary on any supported device.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Execution, decision routing, memory, and proof are included from the start. Structured decision paths run locally, while language models are invoked only when required.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                    The runtime operates independently of containers or external services and does not require continuous connectivity. Offline operation is supported by default.
                  </p>
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Verify</h4>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Execution follows defined constraints.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Behavior trees execute predictably. Language models operate within enforced limits. Each decision is recorded and cryptographically signed.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Verification does not depend on network access. You can trace what ran, when it ran, and under which conditions.
                  </p>
                </div>
                <div className="p-4">
                  <h4 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] mb-2" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>Optimize</h4>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    As deployments expand, visibility increases.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    The dashboard provides insight into execution health, decision routing, historical behavior, and verification status across the fleet.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-2">
                    Performance patterns become visible over time. Anomalies can be identified early. Behavior can be evaluated and refined without altering the underlying execution model.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                    Execution remains consistent. Only observability evolves.
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
