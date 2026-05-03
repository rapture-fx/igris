'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
import { useTheme } from 'next-themes';

interface PricingTier {
  name: string;
  tagline: string;
  price: string;
  limits: string;
  features: string[];
  cta: string;
  checkoutKey: string;
  isContactUs?: boolean;
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
    price: "$29 / month",
    limits: "3 runtime instances",
    features: [
      "3 runtime instances",
      "Edge or server deployment",
      "Behavior Trees + hybrid LLM execution",
      "Agent Memory (shared blackboard)",
      "Safety Containment + EscapeVector",
      "Cryptographic execution receipts",
      "Tamper-evident audit logs",
      "Offline survival mode",
      "Local + cloud routing",
      "Fleet dashboard",
      "OTA verified updates",
      "MCP Integration",
      "Council routing",
      "30-day log retention",
      "Email support (48h)",
    ],
    cta: "Start free trial",
    checkoutKey: "seed",
  },
  {
    name: "Horizon",
    tagline: "For teams scaling autonomous agent fleets.",
    price: "$149 / month",
    limits: "Up to 50 runtime instances",
    features: [
      "50 runtime instances",
      "Everything in Seed",
      "Shadow mode",
      "Speculative execution",
      "Human-in-the-Loop approvals",
      "Multi-Agent Swarms",
      "Reflection Mode",
      "SLO enforcement",
      "Prometheus metrics",
      "Advanced policy engine",
      "90-day log retention",
      "Email support (24h)",
    ],
    cta: "Get Horizon",
    checkoutKey: "horizon",
    recommended: true,
  },
  {
    name: "Infinite",
    tagline: "For large-scale autonomous system fleets.",
    price: "$699 / month",
    limits: "Up to 500 runtime instances",
    features: [
      "500 runtime instances",
      "Everything in Horizon",
      "On-premise deployment",
      "Federated model aggregation",
      "Multimodal inference",
      "Custom retention policy",
      "Dedicated onboarding",
      "Priority support (8h)",
    ],
    cta: "Get Infinite",
    checkoutKey: "infinite",
  },
];

export default function Pricing() {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <section id="pricing" className="pt-0 pb-0 bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 py-8 bg-white dark:bg-dark-bg z-10">
          <div className="max-w-[1000px] mx-auto px-0 md:px-8 lg:px-0">

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[1200px] mx-auto">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className="landing-surface-card landing-surface-card-interactive group relative transition-all duration-500 w-full border rounded-xl shadow-sm hover:shadow-md lg:min-h-[480px]"
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="mb-3">
                        <h3 className="text-lg font-bold text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                          {tier.name}
                        </h3>
                      </div>

                      <div className="mb-6">
                        {tier.isContactUs ? (
                          <div className="flex flex-col">
                            <span className="text-4xl md:text-5xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}>
                              Custom
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-[#000000] dark:text-[#f6f6f4] transition-all duration-300">
                              <span className="text-3xl md:text-5xl" style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}>{tier.price.split(' / ')[0]}</span>
                              {tier.price.includes(' / ') && (
                                <span className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898]"> / {tier.price.split(' / ')[1]}</span>
                              )}
                            </span>
                          </div>
                        )}
                      </div>

                      <ul className="space-y-2">
                        {tier.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <Check className="h-3 w-3 mr-3 flex-shrink-0 mt-0.5 text-green-500" />
                             <span className="text-sm text-gray-700 dark:text-[#c8c8b8]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <a
                      href={tier.checkoutKey ? POLAR_CHECKOUT[tier.checkoutKey] : '/auth?mode=signup'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md mt-5 md:mt-8 opacity-100 self-start"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: isDark ? '#f6f6f4' : '#1b1912', color: isDark ? '#1b1912' : '#f6f6f4' }}
                    >
                      {tier.cta}
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
