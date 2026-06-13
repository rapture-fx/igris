'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { PRICING_TIERS } from '../../lib/pricing';

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace'

export default function Pricing() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <section id="pricing" className="pt-0 pb-0 bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1080px] py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <article
                key={tier.key}
                className="flex h-full flex-col rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow-sm overflow-hidden bg-white dark:bg-[#1a1a1a]"
              >
                <div className="px-5 pt-5 pb-4 flex items-center justify-between gap-3" style={{ fontFamily: SANS }}>
                  <span
                    className="text-[#000000] dark:text-[#f6f6f4] font-medium"
                    style={{ fontSize: '1.05rem', lineHeight: 1.3, letterSpacing: '-0.01em' }}
                  >
                    {tier.name}
                  </span>
                  {tier.recommended && (
                    <span
                      className="text-[11px] px-2.5 py-0.5 rounded-full shrink-0"
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

                <div className="flex flex-1 flex-col bg-gray-50 dark:bg-[#111] border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-5 pt-5 pb-5">
                  <div className="mb-3">
                    <span
                      className="text-black dark:text-[#f6f6f4]"
                      style={{ fontFamily: PIXEL, fontSize: '1.75rem', lineHeight: 1.1 }}
                    >
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span
                        className="text-gray-500 dark:text-[#a8a898] ml-1.5"
                        style={{ fontFamily: SANS, fontSize: '0.9rem' }}
                      >
                        {tier.period}
                      </span>
                    )}
                  </div>

                  <p
                    className="text-gray-600 dark:text-[#a8a898] mb-4"
                    style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.55 }}
                  >
                    {tier.description}
                  </p>

                  <ul className="mb-5 flex-1 space-y-1.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2">
                        <span className="text-gray-400 dark:text-[#555] text-sm mt-0.5 select-none shrink-0">–</span>
                        <span
                          className="text-gray-600 dark:text-[#a8a898]"
                          style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.5 }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <a
                    href={tier.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-auto inline-flex items-center justify-center px-4 py-2.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 self-start"
                    style={{
                      fontFamily: SANS,
                      backgroundColor: isDark ? '#f6f6f4' : '#1b1912',
                      color: isDark ? '#1b1912' : '#f6f6f4',
                    }}
                  >
                    {tier.cta}
                  </a>
                </div>
              </article>
            ))}
          </div>

          <div
            className="mt-8 rounded-2xl border border-gray-200 dark:border-[#2a2a2a] px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5"
            style={{ backgroundColor: isDark ? '#1a1a1a' : '#f9fafb' }}
          >
            <div className="max-w-[52ch]">
              <p
                className="text-[#000000] dark:text-[#f6f6f4] font-medium"
                style={{ fontFamily: SANS, fontSize: '1.05rem', lineHeight: 1.35 }}
              >
                Evaluating Igris for production use?
              </p>
              <p
                className="text-gray-600 dark:text-[#a8a898] mt-2"
                style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
              >
                Request a private preview for a guided technical demo, architecture review, and validation support.
              </p>
            </div>
            <a
              href="mailto:sales@igrisinertial.com"
              className="shrink-0 inline-flex items-center justify-center px-4 py-2.5 text-[11px] font-medium rounded-xl border transition-opacity hover:opacity-80"
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