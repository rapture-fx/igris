'use client';

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import ClosingPosition from '../../src/components/sections/ClosingPosition'

const layers = [
  {
    name: 'Execution',
    subtitle: 'Structured, bounded, deterministic.',
    description: 'Runs AI with defined limits, ensuring behavior remains predictable across devices and fleets.',
    details: [
      'Hybrid behavior trees define execution paths. The runtime follows structured decision paths, invoking language models only when needed.',
      'Every execution is bounded by configurable limits on time, memory, and output size. No uncontrolled behavior, no silent failures.',
      'Sandboxed environments isolate each workload. Resource exhaustion and runaway processes are prevented by design.',
      'Execution works identically whether deployed on a single device or across a fleet of thousands.',
    ],
    lightImage: '/exc.png',
    darkImage: '/cr.png',
  },
  {
    name: 'Intelligence',
    subtitle: 'Decision-making within structure.',
    description: 'Handles decision-making using language models, while execution remains structured and controlled.',
    details: [
      'Language models are invoked as tools within behavior trees\u2014not as autonomous agents. The runtime decides when and how to call them.',
      'BYOM (Bring Your Own Model) support lets you run any GGUF model locally. Use open-source models or your own fine-tuned weights.',
      'Thompson Sampling routes requests to the optimal model based on real-time performance data. No manual tuning required.',
      'All inference happens on-device. Models run entirely in memory with no cloud calls required. Network outages don\'t stop execution.',
    ],
    lightImage: '/tre.png',
    darkImage: '/cs.png',
  },
  {
    name: 'Memory & Proof',
    subtitle: 'Complete records, cryptographic verification.',
    description: 'Keeps a complete record of decisions and execution, with cryptographic verification for auditing and review.',
    details: [
      'Every decision, inference call, and state transition is recorded in a structured execution log.',
      'Logs are cryptographically signed and tamper-evident. You can verify that what the system reports actually happened.',
      'Execution history enables replay, debugging, and compliance auditing without relying on external logging systems.',
      'Fleet-wide synchronization ensures consistent records across all devices when connectivity is available.',
    ],
    lightImage: '/one.png',
    darkImage: '/cc.png',
  },
]

export default function CorePage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
      <Header />
      <main>
        <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
          <div style={{ borderTop: 'var(--section-border)' }} />
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <div style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
                <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: 'var(--font-geist-pixel-square)', letterSpacing: '0.1em' }}>
                  Core Architecture
                </h1>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                  Every layer working together.
                </h2>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-lg leading-relaxed text-left mt-4 font-geist-sans">
                  Execution, intelligence, memory, and proof are designed to work together as one system. Each layer has a defined role. Together they form a runtime that is predictable, auditable, and deployable anywhere.
                </p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          {layers.map((layer) => (
            <React.Fragment key={layer.name}>
              <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
                  {/* Image */}
                  <div className="p-4 md:pl-8 lg:pl-12 flex items-center justify-center" style={{ minHeight: '320px', borderRight: 'var(--section-border)' }}>
                    <img
                      src={mounted && theme === 'dark' ? layer.darkImage : layer.lightImage}
                      alt={layer.name}
                      style={{ width: '85%', height: '85%', objectFit: 'contain', opacity: 0.6 }}
                    />
                  </div>
                  {/* Content */}
                  <div className="flex flex-col justify-start py-6 px-4 md:px-8 lg:pr-12">
                    <h3 className="text-base md:text-lg mb-1 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                      {layer.name}
                    </h3>
                    <p className="text-sm text-[#c5b0cd] mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                      {layer.subtitle}
                    </p>
                    <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                      {layer.description}
                    </p>
                    <ul className="space-y-2">
                      {layer.details.map((detail, i) => (
                        <li key={i} className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans flex items-start">
                          <span className="mr-2">&bull;</span>
                          <span>{detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: 'var(--section-border)' }} />
            </React.Fragment>
          ))}
        </section>

        <ClosingPosition />
      </main>
      <Footer />
    </div>
  );
}
