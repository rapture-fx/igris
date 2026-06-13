'use client';

import React from 'react';
import { PRICING_TIERS } from '../../lib/pricing';

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace';
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const BEZEL_OUTER =
  'relative rounded-[18px] p-[6px] bg-black/[0.03] dark:bg-white/[0.02] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.08)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.04)]';
const BEZEL_MID =
  'relative rounded-[14px] p-[4px] bg-black/[0.04] dark:bg-white/[0.025] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]';
const BEZEL_INNER =
  'relative overflow-hidden rounded-[10px] bg-[#f7f7f5] dark:bg-[#0e0e0c] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.12)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.06)]';

function PricingCardBezel({
  children,
  emphasized = false,
}: {
  children: React.ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className={BEZEL_OUTER + (emphasized ? ' ring-1 ring-black/[0.06] dark:ring-white/[0.08]' : '')}>
      <div className={BEZEL_MID}>
        <div className={BEZEL_INNER}>{children}</div>
      </div>
    </div>
  );
}

export default function Pricing() {
  return (
    <section
      id="pricing"
      className="pt-0 pb-0 bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1120px] py-4 md:py-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-5 items-stretch">
            {PRICING_TIERS.map((tier) => (
              <PricingCardBezel key={tier.key} emphasized={tier.recommended}>
                <article className="flex h-full flex-col px-6 py-6 md:px-7 md:py-7">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p
                        className="text-gray-500 dark:text-[#8a8a7a] uppercase"
                        style={{
                          fontFamily: MONO,
                          fontSize: '10px',
                          letterSpacing: '0.18em',
                          fontWeight: 500,
                        }}
                      >
                        {tier.key}
                      </p>
                      <h3
                        className="mt-2 text-gray-700 dark:text-[#c8c8b8]"
                        style={{
                          fontFamily: PIXEL,
                          fontWeight: 400,
                          fontSize: 'clamp(1.1rem, 1.6vw, 1.35rem)',
                          lineHeight: 1.15,
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {tier.name}
                      </h3>
                    </div>
                    {tier.recommended && (
                      <span
                        className="shrink-0 rounded-md border border-black/[0.08] dark:border-white/[0.1] bg-white/70 dark:bg-white/[0.04] px-2 py-1 text-[10px] text-gray-600 dark:text-[#a8a898]"
                        style={{ fontFamily: MONO, letterSpacing: '0.06em' }}
                      >
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="mt-5 flex items-baseline gap-1.5">
                    <span
                      className="text-gray-700 dark:text-[#c8c8b8]"
                      style={{ fontFamily: PIXEL, fontSize: 'clamp(1.5rem, 2.2vw, 1.85rem)', lineHeight: 1.1 }}
                    >
                      {tier.price}
                    </span>
                    {tier.period && (
                      <span
                        className="text-gray-500 dark:text-[#a8a898]"
                        style={{ fontFamily: SANS, fontSize: '0.9rem' }}
                      >
                        {tier.period}
                      </span>
                    )}
                  </div>

                  <p
                    className="mt-4 text-gray-600 dark:text-[#a8a898]"
                    style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
                  >
                    {tier.description}
                  </p>

                  <ul className="mt-6 flex-1 border-t border-black/[0.06] dark:border-white/[0.06]">
                    {tier.features.map((feature, index) => (
                      <li
                        key={feature}
                        className={
                          'py-3 text-gray-600 dark:text-[#a8a898] ' +
                          (index < tier.features.length - 1
                            ? 'border-b border-black/[0.06] dark:border-white/[0.06]'
                            : '')
                        }
                        style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.5 }}
                      >
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <a
                    href={tier.checkoutUrl}
                    target={tier.checkoutUrl.startsWith('mailto:') ? undefined : '_blank'}
                    rel={tier.checkoutUrl.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                    className="mt-6 inline-flex w-full items-center justify-center px-3.5 py-2.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: SANS }}
                  >
                    {tier.cta}
                  </a>
                </article>
              </PricingCardBezel>
            ))}
          </div>

          <div className="mt-8 md:mt-10">
            <PricingCardBezel>
              <div className="flex flex-col gap-5 px-6 py-6 md:px-8 md:py-7 sm:flex-row sm:items-center sm:justify-between">
                <div className="max-w-[52ch]">
                  <p
                    className="text-gray-700 dark:text-[#c8c8b8]"
                    style={{
                      fontFamily: PIXEL,
                      fontWeight: 400,
                      fontSize: 'clamp(1rem, 1.4vw, 1.15rem)',
                      lineHeight: 1.2,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Evaluating Igris for production use?
                  </p>
                  <p
                    className="mt-3 text-gray-600 dark:text-[#a8a898]"
                    style={{ fontFamily: SANS, fontSize: '0.95rem', lineHeight: 1.6 }}
                  >
                    Request a private preview for a guided technical demo, architecture review, and
                    validation support.
                  </p>
                </div>
                <a
                  href="mailto:sales@igrisinertial.com"
                  className="shrink-0 inline-flex items-center justify-center rounded-xl border border-black/[0.1] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.03] px-4 py-2.5 text-[11px] font-medium text-gray-700 dark:text-[#f6f6f4] transition-opacity hover:opacity-80"
                  style={{ fontFamily: SANS }}
                >
                  Request private preview
                </a>
              </div>
            </PricingCardBezel>
          </div>
        </div>
      </div>
    </section>
  );
}