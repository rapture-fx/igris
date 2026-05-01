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
    <section id="how-it-works" className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          {/* Title */}
          <div className="text-left" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Deploy. Verify. Optimize.
            </h3>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: 'var(--section-border)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* 3-column seamless table */}
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
            {steps.map((step, index) => (
              <div key={step.name} className={`pb-0 pt-6 pr-6 ${index === 0 ? 'pl-0' : 'pl-6'}`}>
                <span className="text-xs text-[#85612c] dark:text-[#c5b0cd] mb-3 block" style={{ fontFamily: 'var(--font-geist-mono, "Geist Mono", monospace)' }}>
                  0{index + 1}
                </span>
                <h4 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  {step.name}
                </h4>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
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
