'use client'

import React from 'react'

const steps = [
  {
    name: 'Send an AI task',
    description: 'Call Igris from your application using the API or SDK.',
  },
  {
    name: 'Govern execution',
    description: 'Igris applies execution boundaries, routing rules, permission checks, and failure handling before the task becomes action.',
  },
  {
    name: 'Run across environments',
    description: 'Execute through configured cloud, edge, or local paths without changing your application flow.',
  },
  {
    name: 'Verify what happened',
    description: 'Receive execution metadata and signed records that can be inspected after the run.',
  },
]

export default function HowItWorks() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          <div className="text-left" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Send a task. Govern the run. Verify the result.
            </h3>
          </div>

          <div style={{ borderTop: 'var(--section-border)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
            {steps.map((step, index) => (
              <div key={step.name} className="pb-0 pt-6 pr-4">
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