'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  BillingInterval,
  PRICING_TIERS,
  PricingTierKey,
  TierBillingOption,
  YEARLY_TOGGLE_LABEL,
  getTierBilling,
} from '../../lib/pricing';

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PIXEL = 'var(--font-geist-pixel-square), "Geist Pixel Square", ui-monospace, monospace';
const MONO = 'var(--font-geist-pixel-square), "Geist Pixel Square", "SF Mono", ui-monospace, monospace';

const CARD_CLASS =
  'flex h-full flex-col rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-[#f7f7f5] dark:bg-[#0e0e0c] shadow-[inset_0_0_0_0.5px_rgba(0,0,0,0.06)] dark:shadow-[inset_0_0_0_0.5px_rgba(255,255,255,0.05)]';

const DIVIDER = 'border-dashed border-black/[0.14] dark:border-white/[0.12]';

const CTA_CLASS =
  'inline-flex items-center justify-center px-3.5 py-1.5 text-[11px] font-medium rounded-xl transition-opacity hover:opacity-80 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]';

const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const PRICE_COUNT_DURATION = 1.4;
const PRICE_FADE_DURATION = 0.95;
const TAB_TRANSITION_DURATION = 0.9;
const MOTION_TRANSITION = { duration: PRICE_FADE_DURATION, ease: MOTION_EASE };
const TAB_TRANSITION = { duration: TAB_TRANSITION_DURATION, ease: MOTION_EASE };

const PIXEL_PRICE_STYLE: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: 'clamp(1.35rem, 2vw, 1.65rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.01em',
};

const PIXEL_COMPARE_STYLE: React.CSSProperties = {
  fontFamily: PIXEL,
  fontSize: 'clamp(1.1rem, 1.6vw, 1.35rem)',
  lineHeight: 1.1,
  letterSpacing: '-0.01em',
};

const PRICE_DIGIT_LINE = 1.1;

function parsePriceAmount(price: string): number | null {
  if (!price.startsWith('$')) return null;
  const amount = Number(price.replace(/[$,]/g, ''));
  return Number.isFinite(amount) ? amount : null;
}

function formatPriceAmount(amount: number): string {
  return amount >= 1000 ? `$${amount.toLocaleString('en-US')}` : `$${amount}`;
}

function alignDigits(from: number, to: number) {
  const fromDigits = from.toString().split('');
  const toDigits = to.toString().split('');
  const width = Math.max(fromDigits.length, toDigits.length);
  const pad = (digits: string[]) => {
    const padding = width - digits.length;
    return [...Array(padding).fill(null), ...digits];
  };

  return { from: pad(fromDigits), to: pad(toDigits), width };
}

function digitOffset(digit: number | null) {
  return digit === null ? 0 : `calc(${-digit} * ${PRICE_DIGIT_LINE}em)`;
}

function RollingDigit({
  fromDigit,
  toDigit,
  animate,
}: {
  fromDigit: number | null;
  toDigit: number | null;
  animate: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const shouldAnimate = animate && !reducedMotion;

  if (toDigit === null && fromDigit === null) {
    return null;
  }

  if (toDigit === null) {
    return (
      <motion.span
        className="inline-block overflow-hidden align-baseline"
        initial={false}
        animate={{ width: 0, opacity: 0 }}
        transition={{
          duration: shouldAnimate ? PRICE_FADE_DURATION : 0,
          ease: MOTION_EASE,
        }}
        aria-hidden
      />
    );
  }

  return (
    <span
      className="price-number-container"
      style={{
        height: `${PRICE_DIGIT_LINE}em`,
        width: '0.62em',
      }}
      aria-hidden
    >
      <motion.span
        className="price-number"
        initial={{ y: digitOffset(shouldAnimate ? fromDigit : toDigit) }}
        animate={{ y: digitOffset(toDigit) }}
        transition={
          shouldAnimate
            ? { duration: PRICE_COUNT_DURATION, ease: MOTION_EASE }
            : { duration: 0 }
        }
      >
        {Array.from({ length: 10 }, (_, value) => (
          <span
            key={value}
            className="block w-full text-center tabular-nums"
            style={{
              height: `${PRICE_DIGIT_LINE}em`,
              lineHeight: `${PRICE_DIGIT_LINE}em`,
            }}
          >
            {value}
          </span>
        ))}
      </motion.span>
    </span>
  );
}

function RollingPriceValue({
  amount,
  fromAmount,
  animate,
}: {
  amount: number;
  fromAmount: number;
  animate: boolean;
}) {
  const reducedMotion = useReducedMotion();
  const formatted = formatPriceAmount(amount);
  const { from, to, width } = alignDigits(fromAmount, amount);

  return (
    <motion.span
      layout="position"
      className="inline-flex items-baseline text-gray-700 dark:text-[#c8c8b8] tabular-nums"
      style={PIXEL_PRICE_STYLE}
      initial={reducedMotion ? false : { opacity: 0.9, y: 2 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...MOTION_TRANSITION, layout: MOTION_TRANSITION }}
      aria-label={formatted}
    >
      <span aria-hidden>$</span>
      {to.map((digitChar, index) => (
        <RollingDigit
          key={`slot-${width - index}`}
          fromDigit={from[index] === null ? null : Number(from[index])}
          toDigit={digitChar === null ? null : Number(digitChar)}
          animate={animate}
        />
      ))}
    </motion.span>
  );
}

function AnimatedPriceValue({
  price,
  tierKey,
  interval,
}: {
  price: string;
  tierKey: PricingTierKey;
  interval: BillingInterval;
}) {
  const amount = parsePriceAmount(price);
  const [rollState, setRollState] = useState<{
    amount: number;
    fromAmount: number;
    animate: boolean;
  } | null>(null);
  const prevAmountRef = useRef<number | null>(amount);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (amount === null) {
      setRollState(null);
      prevAmountRef.current = null;
      initializedRef.current = false;
      return;
    }

    if (!initializedRef.current) {
      initializedRef.current = true;
      prevAmountRef.current = amount;
      setRollState({ amount, fromAmount: amount, animate: false });
      return;
    }

    const from = prevAmountRef.current ?? amount;
    prevAmountRef.current = amount;

    if (from === amount) {
      setRollState({ amount, fromAmount: amount, animate: false });
      return;
    }

    setRollState({ amount, fromAmount: from, animate: true });
  }, [amount, interval, price, tierKey]);

  if (amount === null || rollState === null) {
    return (
      <motion.span
        layout="position"
        className="text-gray-700 dark:text-[#c8c8b8] tabular-nums"
        style={PIXEL_PRICE_STYLE}
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...MOTION_TRANSITION, layout: MOTION_TRANSITION }}
      >
        {price}
      </motion.span>
    );
  }

  return (
    <RollingPriceValue
      amount={rollState.amount}
      fromAmount={rollState.fromAmount}
      animate={rollState.animate}
    />
  );
}

function TierPriceDisplay({
  billing,
  tierKey,
  interval,
}: {
  billing: TierBillingOption;
  tierKey: PricingTierKey;
  interval: BillingInterval;
}) {
  const reducedMotion = useReducedMotion();
  const motionKey = `${tierKey}-${interval}`;
  const fade = reducedMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : {
        initial: { opacity: 0, y: 2 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -1 },
      };

  return (
    <>
      <div className="mt-4 flex flex-wrap items-baseline gap-x-1.5 gap-y-1">
        <AnimatePresence mode="sync" initial={false}>
          {billing.comparePrice && (
            <motion.span
              key={`${motionKey}-compare`}
              layout="position"
              className="text-gray-400 dark:text-[#6a6a5c] line-through tabular-nums"
              style={PIXEL_COMPARE_STYLE}
              {...fade}
              transition={{ ...MOTION_TRANSITION, layout: MOTION_TRANSITION }}
            >
              {billing.comparePrice}
            </motion.span>
          )}
        </AnimatePresence>

        <AnimatedPriceValue price={billing.price} tierKey={tierKey} interval={interval} />

        <AnimatePresence mode="sync" initial={false}>
          {billing.period && (
            <motion.span
              key={`${motionKey}-period`}
              layout="position"
              className="text-gray-500 dark:text-[#a8a898]"
              style={{ fontFamily: SANS, fontSize: '0.875rem' }}
              {...fade}
              transition={{ ...MOTION_TRANSITION, layout: MOTION_TRANSITION }}
            >
              {billing.period}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="sync" initial={false}>
        {billing.detail && (
          <motion.p
            key={`${motionKey}-detail`}
            layout="position"
            className="mt-2 text-gray-500 dark:text-[#8a8a7a]"
            style={{ fontFamily: SANS, fontSize: '0.8rem', lineHeight: 1.4 }}
            {...fade}
            transition={{ ...MOTION_TRANSITION, layout: MOTION_TRANSITION }}
          >
            {billing.detail}
          </motion.p>
        )}
      </AnimatePresence>
    </>
  );
}

function BillingToggle({
  interval,
  onChange,
}: {
  interval: BillingInterval;
  onChange: (next: BillingInterval) => void;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <div className="mb-8 md:mb-10 flex justify-center">
      <div
        className="relative inline-flex items-center gap-1 rounded-xl border border-black/[0.08] dark:border-white/[0.1] bg-white/50 dark:bg-white/[0.02] p-1"
        role="group"
        aria-label="Billing interval"
      >
        {(['monthly', 'yearly'] as const).map((option) => {
          const active = interval === option;
          const label = option === 'monthly' ? 'Monthly' : `Yearly · ${YEARLY_TOGGLE_LABEL}`;

          return (
            <button
              key={option}
              type="button"
              onClick={() => onChange(option)}
              aria-pressed={active}
              className={
                'relative rounded-lg px-3.5 py-1.5 text-[11px] ' +
                (active
                  ? 'text-[#f6f6f4] dark:text-[#1b1912]'
                  : 'text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4]')
              }
              style={{
                fontFamily: SANS,
                transition: reducedMotion
                  ? undefined
                  : `color ${TAB_TRANSITION_DURATION}s cubic-bezier(0.22, 1, 0.36, 1)`,
              }}
            >
              {active && (
                <motion.span
                  layoutId="billing-toggle-pill"
                  className="absolute inset-0 rounded-lg bg-[#1b1912] dark:bg-[#f6f6f4]"
                  transition={{
                    duration: reducedMotion ? 0 : TAB_TRANSITION_DURATION,
                    ease: MOTION_EASE,
                  }}
                  aria-hidden
                />
              )}
              <span className="relative z-10">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Pricing() {
  const [interval, setInterval] = useState<BillingInterval>('yearly');

  return (
    <section
      id="pricing"
      className="bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8 pb-16 md:pb-20">
        <BillingToggle interval={interval} onChange={setInterval} />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 items-stretch">
          {PRICING_TIERS.map((tier) => {
            const billing = getTierBilling(tier, interval);

            return (
              <article
                key={tier.key}
                className={
                  CARD_CLASS +
                  (tier.recommended ? ' ring-1 ring-black/[0.06] dark:ring-white/[0.08]' : '')
                }
              >
                <div className="flex h-full flex-col px-6 py-6 md:px-7 md:py-7">
                  <header className={`${DIVIDER} border-b pb-5`}>
                    <div className="flex flex-wrap items-center gap-2">
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

                    <TierPriceDisplay billing={billing} tierKey={tier.key} interval={interval} />

                    <p
                      className="mt-3 text-gray-600 dark:text-[#a8a898]"
                      style={{ fontFamily: SANS, fontSize: '0.9rem', lineHeight: 1.55 }}
                    >
                      {tier.description}
                    </p>
                  </header>

                  <div className="flex-1 py-5">
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

                  <footer className={`${DIVIDER} border-t pt-5`}>
                    <a
                      href={billing.checkoutUrl}
                      target={billing.checkoutUrl.startsWith('mailto:') ? undefined : '_blank'}
                      rel={billing.checkoutUrl.startsWith('mailto:') ? undefined : 'noopener noreferrer'}
                      className={CTA_CLASS}
                      style={{ fontFamily: SANS }}
                    >
                      {billing.cta}
                    </a>
                  </footer>
                </div>
              </article>
            );
          })}
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
              className="shrink-0 inline-flex items-center justify-center rounded-xl border border-dashed border-black/[0.14] dark:border-white/[0.12] bg-white/80 dark:bg-white/[0.03] px-3.5 py-1.5 text-[11px] font-medium text-gray-700 dark:text-[#f6f6f4] transition-opacity hover:opacity-80"
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