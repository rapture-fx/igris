'use client'

import React from 'react'

const steps = [
  {
    name: 'Deploy',
    description: 'Install a single binary on any supported device. Execution, decision routing, memory, and proof are included from the start. The runtime operates independently of containers or external services.',
  },
  {
    name: 'Verify',
    description: 'Execution follows defined constraints. Behavior trees execute predictably. Each decision is recorded and cryptographically signed. Verification does not depend on network access.',
  },
  {
    name: 'Optimize',
    description: 'As deployments expand, visibility increases. The dashboard provides insight into execution health, decision routing, and verification status across the fleet.',
  },
]

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12" style={{ paddingTop: '3rem', paddingBottom: '3rem', borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title */}
          <div className="text-left mb-8">
            <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Deploy. Verify. Optimize.
            </h3>
          </div>

          {/* 3-column seamless table */}
          <div className="grid grid-cols-1 md:grid-cols-3 pt-8">
            {steps.map((step, index) => (
              <div key={step.name} className="p-6 pb-0" style={{ borderRight: index < steps.length - 1 ? '0.5px solid rgba(209, 213, 219, 0.35)' : 'none' }}>
                <span className="text-xs text-[#85612c] dark:text-[#c5b0cd] mb-3 block" style={{ fontFamily: 'var(--font-geist-mono, "Geist Mono", monospace)' }}>
                  0{index + 1}
                </span>
                <h4 className="text-base md:text-lg font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">
                  {step.name}
                </h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: 'var(--font-geist-sans)' }}>
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
