'use client';

import React from 'react';
import { PRICING_TIERS } from '../../lib/pricing';

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace';
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const CARD_CLASS =
  'flex h-full flex-col rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f7f7f5] dark:bg-[#0e0e0c] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]';

const CTA_CLASS =
  'inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]';

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {PRICING_TIERS.map((tier) => (
            <article
              key={tier.key}
              className={
                CARD_CLASS +
                (tier.recommended ? ' ring-1 ring-black/[0.06] dark:ring-white/[0.08]' : '')
              }
            >
              <div className="flex h-full flex-col px-6 py-6 md:px-7 md:py-7">
                <header className="border-b border-black/[0.06] dark:border-white/[0.06] pb-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3
                      className="text-gray-700 dark:text-[#c8c8b8]"
                      style={{
                        fontFamily: SANS,
                        fontWeight: 500,
                        fontSize: 'clamp(1rem, 1.2vw, 1.1rem)',
                        lineHeight: 1.3,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {tier.name}
                    </h3>
                    {tier.recommended && (
                      <span
                        className="shrink-0 rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-white/60 dark:bg-white/[0.04] px-2 py-0.5 text-[10px] text-gray-500 dark:text-[#a8a898]"
                        style={{ fontFamily: MONO, letterSpacing: '0.08em' }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="mt-4 flex items-baseline gap-1.5">
                    <span
                      className="text-gray-700 dark:text-[#c8c8b8]"
                      style={{
                        fontFamily: PIXEL,
                        fontSize: 'clamp(1.35rem, 2vw, 1.65rem)',
                        lineHeight: 1.1,
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span
                        className="text-gray-500 dark:text-[#a8a898]"
                        style={{ fontFamily: SANS, fontSize: '0.875rem' }}
                      >
                        {tier.period}
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-3 text-gray-600 dark:text-[#a8a898]"
                    style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.55 }}
                  >
                    {tier.description}
                  </p>
                </header>

                <div className="flex-1 py-5">
                  <p
                    className="mb-3 text-gray-500 dark:text-[#8a8a7a] uppercase"
                    style={{
                      fontFamily: MONO,
                      fontSize: '10px',
                      letterSpacing: '0.14em',
                      fontWeight: 500,
                    }}
                  >
                    Includes
                  </p>
                  <ul className="space-y-2.5">
                    {tier.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <span
                          className="mt-[0.45rem] h-1 w-1 shrink-0 rounded-full bg-gray-400 dark:bg-[#6a6a5c]"
                          aria-hidden
                        />
                        <span
                          className="text-gray-600 dark:text-[#a8a898]"
                          style={{ fontFamily: SANS, fontSize: '0.875rem', lineHeight: 1.5 }}
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <footer className="border-t border-black/[0.06] dark:border-white/[0.06] pt-5">
                  <a
                    href={tier.checkoutUrl}
                    target={tier.checkoutUrl.startsWith('mailto:') ? undefined : '_blank'}
                    rel={tier.checkoutUrl.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className={CTA_CLASS}
                    style={{ fontFamily: SANS }}
                  >
                    {tier.cta}
                  </a>
                </footer>
              </div>
            </article>
          ))}
        </div>

        <div className={`mt-8 md:mt-10 ${CARD_CLASS}`}>
          <div className="flex flex-col gap-5 px-6 py-6 md:px-8 md:py-7 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[52ch]">
              <p
                className="text-gray-700 dark:text-[#c8c8b8]"
                style={{
                  fontFamily: SANS,
                  fontWeight: 500,
                  fontSize: 'clamp(1rem, 1.2vw, 1.1rem)',
                  lineHeight: 1.35,
                  letterSpacing: '-0.01em',
                }}
              >
                Evaluating Igris for production use?
              </p>
              <p
                className="mt-2 text-gray-600 dark:text-[#a8a898]"
                style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.6 }}
              >
                Request a private preview for a guided technical demo, architecture review, and
                validation support.
              </p>
            </div>
            <a
              href="mailto:sales@igrisinertial.com"
              className="shrink-0 inline-flex items-center justify-center rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-gray-700 dark:text-[#f6f6f4] transition-opacity hover:opacity-80"
              style={{ fontFamily: SANS }}
            >
              Request private preview
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}