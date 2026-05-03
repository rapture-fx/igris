'use client'

import React from 'react'

export default function Solve() {
  const items = [
    {
      label: 'Pure LLM hallucinations',
      detail: 'Ungrounded outputs that drift from facts, producing unreliable results at scale.',
    },
    {
      label: 'Non-deterministic AI behavior',
      detail: 'Identical inputs producing different outputs, making systems unpredictable in production.',
    },
    {
      label: 'Unverifiable decisions',
      detail: 'No audit trail for why an AI chose a specific action—impossible to debug or prove compliance.',
    },
    {
      label: 'Cloud-dependent execution',
      detail: 'A single connectivity failure takes down the entire AI fleet. No offline fallback.',
    },
    {
      label: 'No fleet visibility',
      detail: 'Hundreds of devices running AI with zero centralized insight into what they\'re doing.',
    },
    {
      label: 'Hidden performance bottlenecks',
      detail: 'Latency spikes and cost overruns buried across provider dashboards and scattered logs.',
    },
    {
      label: 'Undetected anomalies',
      detail: 'Behavioral drift goes unnoticed until it causes failures in production environments.',
    },
    {
      label: 'Zero behavior history',
      detail: 'No record of past decisions, making it impossible to learn from or reproduce outcomes.',
    },
  ];

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: 'var(--section-border)' }} />
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#110f0f]" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', borderBottom: 'var(--section-border)' }}>

          {/* Title area */}
          <div className="text-left" style={{ paddingTop: '4rem', paddingBottom: '2.5rem' }}>
            <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ letterSpacing: '0.05em', fontFamily: 'var(--font-geist-mono, "Geist Mono", monospace)' }}>
              THE CHALLENGE
            </p>
            <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              What we solve
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Every problem that makes AI unreliable in production.
            </p>
          </div>

          {/* 2x4 Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5" style={{ paddingBottom: '4rem' }}>
            {items.map((item, index) => (
              <div
                key={index}
                className="landing-surface-card landing-surface-card-interactive border rounded-2xl p-6 flex flex-col gap-3 min-h-[140px]"
              >
                <span
                  className="text-sm text-[#000000] dark:text-[#f6f6f4]"
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                >
                  {item.label}
                </span>
                <span
                  className="text-xs text-gray-500 dark:text-[#a8a898] leading-relaxed"
                  style={{ fontWeight: 300, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                >
                  {item.detail}
                </span>
              </div>
            ))}
          </div>

        </div>
      </div>
    </section>
  )
}
