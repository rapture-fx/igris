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
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 py-4 md:py-8 lg:py-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left side - Intro */}
            <div className="text-left" style={{ paddingTop: '3rem' }}>
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ letterSpacing: '0.05em' }}>
                04. DEPLOYMENT
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 400 }}>
                Deploy. Verify. Optimize.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, maxWidth: '360px' }}>
                The system is designed to move from initial installation to fleet-level operation without changing how execution works.
              </p>
            </div>

            {/* Right side - Steps */}
            <div className="flex flex-col items-start justify-start" style={{ paddingTop: '3rem' }}>
              <div className="w-full max-w-xl">
                {steps.map((step) => (
                  <div key={step.name} className="border-b border-gray-300 dark:border-[#f6f6f4]/5 pb-4 last:border-0 last:pb-0">
                    <h4 className="text-sm font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">
                      {step.name}
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400 }}>
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
