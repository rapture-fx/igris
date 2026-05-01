'use client';

import React from 'react'
import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import ClosingPosition from '../../src/components/sections/ClosingPosition'

const sections = [
  {
    title: 'Workflow Enforcement',
    body: [
      'Behavior trees structure agent workflows and tool usage.',
      'Language models generate decisions within bounded execution limits.',
      'Execution is deterministic and cryptographically verifiable.',
    ],
  },
  {
    title: 'Adaptive Decision Routing',
    body: [
      'Routing adapts over time based on performance, cost, and reliability.',
      'All adaptation occurs within enforced constraints.',
      'Shadow mode testing allows safe evaluation before production.',
    ],
  },
  {
    title: 'Fleet Coordination for Agents',
    body: [
      'Agent instances register automatically.',
      'Dashboard provides visibility across distributed deployments.',
      'Every action is traceable and auditable.',
    ],
  },
]

export default function AIAgentsPage() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
      <Header />
      <main>
        <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
          <div style={{ borderTop: 'var(--section-border)' }} />
          
          {/* Hero */}
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <div style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
                <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Structured execution for autonomous software systems.
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-2xl leading-relaxed text-left mt-4" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Deterministic, verifiable runtime for AI agents operating on servers or in cloud environments.
                </p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          {/* Sections */}
          {sections.map((section, index) => (
            <React.Fragment key={section.title}>
              <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
                <div className="px-4 md:px-8 lg:px-12 py-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
                  <h2 className="text-base md:text-lg mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                    {section.title}
                  </h2>
                  <div className="space-y-3">
                    {section.body.map((paragraph, i) => (
                      <p key={i} className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                        {paragraph}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
              {index < sections.length - 1 && (
                <div style={{ borderTop: 'var(--section-border)' }} />
              )}
            </React.Fragment>
          ))}
        </section>

        <ClosingPosition />
      </main>
      <Footer />
    </div>
  );
}
