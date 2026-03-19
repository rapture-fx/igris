'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';

interface PricingTier {
  name: string;
  tagline: string;
  price: string;
  features: string[];
  cta: string;
  checkoutKey: string;
  recommended?: boolean;
}

const POLAR_CHECKOUT: Record<string, string> = {
  seed:     "https://buy.polar.sh/polar_cl_glOcj9vjtqWIDXsJi2TARGLGR5ZJ3TxmaWUSY3D5Jhl",
  horizon:  "https://buy.polar.sh/polar_cl_UrT1qy0jLSgEtyCYtuSJPQnLfcwoOnLyeucnQ2rnF5O",
  infinite: "https://buy.polar.sh/polar_cl_kNQXNs1Nqy4C86LGHHJD0rCBcYRWniGxPX38W4NM3ss",
};

const pricingTiers: PricingTier[] = [
  {
    name: "Seed",
    tagline: "For developers shipping to production.",
    price: "$29",
    features: [
      "3 runtime instances",
      "Edge or server deployment",
      "Cryptographic execution receipts",
      "Offline survival mode",
      "Local + cloud routing",
      "Fleet dashboard",
      "OTA verified updates",
      "Council routing",
      "Audit logs",
      "30-day log retention",
      "Email support (48h)",
    ],
    cta: "Start free trial",
    checkoutKey: "seed",
  },
  {
    name: "Horizon",
    tagline: "For teams scaling autonomous agent fleets.",
    price: "$149",
    features: [
      "50 runtime instances",
      "Everything in Seed",
      "Shadow mode",
      "Speculative execution",
      "SLO enforcement",
      "Prometheus metrics",
      "Advanced policy engine",
      "90-day log retention",
      "Email support (24h)",
    ],
    cta: "Start free trial",
    checkoutKey: "horizon",
    recommended: true,
  },
  {
    name: "Infinite",
    tagline: "For large-scale autonomous system fleets.",
    price: "$699",
    features: [
      "500 runtime instances",
      "Everything in Horizon",
      "On-premise deployment",
      "Federated learning",
      "Multimodal inference",
      "Custom retention policy",
      "Dedicated onboarding",
      "Priority support (8h)",
    ],
    cta: "Start free trial",
    checkoutKey: "infinite",
  },
];

export default function Pricing() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  return (
    <section id="pricing" className="pt-0 pb-0 bg-white dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8 py-8">

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-[900px] mx-auto">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`relative flex flex-col rounded-xl border transition-all duration-300 ${
                tier.recommended
                  ? 'border-[#1b1912] dark:border-[#f6f6f4]/40 shadow-lg md:scale-[1.03]'
                  : 'border-gray-200 dark:border-[#f6f6f4]/10 shadow-sm hover:shadow-md'
              } bg-[#f9f9fa] dark:bg-[#222118]`}
            >
              {tier.recommended && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap">
                  <span
                    className="text-xs font-medium px-3 py-1 rounded-full bg-[#1b1912] dark:bg-[#f6f6f4] text-[#f6f6f4] dark:text-[#1b1912]"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    Most popular
                  </span>
                </div>
              )}

              <div className="p-6 flex flex-col h-full">
                {/* Header */}
                <div className="mb-5">
                  <h3
                    className="text-base font-medium text-[#000000] dark:text-[#f6f6f4]"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    {tier.name}
                  </h3>
                  <p
                    className="text-sm text-gray-500 dark:text-[#a8a898] mt-1"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    {tier.tagline}
                  </p>
                </div>

                {/* Price */}
                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span
                      className="text-4xl text-[#000000] dark:text-[#f6f6f4]"
                      style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}
                    >
                      {tier.price}
                    </span>
                    <span
                      className="text-sm text-gray-500 dark:text-[#a8a898]"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                    >
                      / mo
                    </span>
                  </div>
                  <p
                    className="text-xs text-gray-400 dark:text-[#6b6b5a] mt-1"
                    style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                  >
                    7-day free trial included
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t border-gray-200 dark:border-[#f6f6f4]/10 mb-5" />

                {/* Features */}
                <ul className="space-y-2.5 flex-grow">
                  {tier.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <Check className="h-3.5 w-3.5 flex-shrink-0 mt-0.5 text-green-500" />
                      <span
                        className="text-sm text-gray-600 dark:text-[#c8c8b8]"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <a
                  href={POLAR_CHECKOUT[tier.checkoutKey]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-6 w-full inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    tier.recommended
                      ? 'bg-[#1b1912] dark:bg-[#f6f6f4] text-[#f6f6f4] dark:text-[#1b1912] hover:opacity-90'
                      : 'border border-gray-300 dark:border-[#f6f6f4]/20 text-[#1b1912] dark:text-[#f6f6f4] hover:bg-gray-100 dark:hover:bg-[#f6f6f4]/5'
                  }`}
                  style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
                >
                  {tier.cta}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
