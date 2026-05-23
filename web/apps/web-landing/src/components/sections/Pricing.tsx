'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { PRICING_TIERS } from '../../lib/pricing';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export default function Pricing() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <section id="pricing" className="pt-0 pb-0 bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200">
      <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-2 md:px-4 lg:px-6 py-8 bg-white dark:bg-dark-bg z-10">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {PRICING_TIERS.map((tier, index) => (
                <div
                  key={index}
                  className="rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col"
                >
                  {/* Header strip */}
                  <div className="px-5 pt-4 pb-3 flex items-center justify-between" style={{ fontFamily: SANS }}>
                    <span className="text-base font-semibold text-black dark:text-[#f6f6f4]">{tier.name}</span>
                    {tier.recommended && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: isDark ? '#f6f6f4' : '#1b1912',
                          color: isDark ? '#1b1912' : '#f6f6f4',
                          fontFamily: SANS,
                        }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>

                  {/* Inner nested panel */}
                  <div className="bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-5 pt-4 pb-4 flex flex-col flex-1">
                    {/* Price */}
                    <div className="mb-3">
                      <span
                        className="text-3xl text-black dark:text-[#f6f6f4]"
                        style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}
                      >
                        {tier.price}
                      </span>
                      {tier.period && (
                        <span className="text-xs text-gray-500 dark:text-[#a8a898] ml-1.5" style={{ fontFamily: SANS }}>
                          {tier.period}
                        </span>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] mb-3 leading-relaxed" style={{ fontFamily: SANS }}>
                      {tier.description}
                    </p>

                    {/* Features */}
                    <ul className="space-y-1.5 flex-1 mb-4">
                      {tier.features.map((feature, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="text-gray-400 dark:text-[#555] text-xs mt-0.5 select-none">–</span>
                          <span className="text-sm text-gray-700 dark:text-[#c8c8b8]" style={{ fontFamily: SANS }}>{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <a
                      href={tier.checkoutUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl transition-opacity hover:opacity-80 self-start"
                      style={{
                        fontFamily: SANS,
                        backgroundColor: isDark ? '#f6f6f4' : '#1b1912',
                        color: isDark ? '#1b1912' : '#f6f6f4',
                      }}
                    >
                      {tier.cta}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Private preview CTA */}
            <div
              className="mt-6 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] px-6 py-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }}
            >
              <div>
                <p className="text-sm font-medium text-black dark:text-[#f6f6f4]" style={{ fontFamily: SANS }}>
                  Evaluating Igris for your team?
                </p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] mt-0.5" style={{ fontFamily: SANS }}>
                  Request private preview access for a guided technical demo and validation support.
                </p>
              </div>
              <a
                href="mailto:sales@igrisinertial.com"
                className="shrink-0 inline-flex items-center justify-center px-4 py-2 text-xs font-medium rounded-xl border transition-opacity hover:opacity-80"
                style={{
                  fontFamily: SANS,
                  borderColor: isDark ? 'rgba(246,246,244,0.12)' : 'rgba(0,0,0,0.1)',
                  color: isDark ? '#f6f6f4' : '#1b1912',
                  backgroundColor: isDark ? 'rgba(246,246,244,0.06)' : '#ffffff',
                }}
              >
                Request private preview
              </a>
            </div>

        </div>
      </div>
    </section>
  );
}
