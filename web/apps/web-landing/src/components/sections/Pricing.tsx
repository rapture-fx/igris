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

// Polar checkout URLs — update price IDs once set in the Polar dashboard
const POLAR_CHECKOUT: Record<string, string> = {
  seed:     "https://polar.sh/igris-inertial/checkout?price=price_seed_monthly",
  horizon:  "https://polar.sh/igris-inertial/checkout?price=price_horizon_monthly",
  infinite: "https://polar.sh/igris-inertial/checkout?price=price_infinite_monthly",
};

const pricingTiers: PricingTier[] = [
  {
    name: "Seed",
    tagline: "Core runtime for one instance.",
    price: "$29 / month",
    limits: "1 runtime instance",
    features: [
      "1 runtime instance.",
      "Edge or server deployment.",
      "Execution receipts.",
      "Policy enforcement.",
      "Basic routing.",
    ],
    cta: "Get Seed",
    checkoutKey: "seed",
  },
  {
    name: "Horizon",
    tagline: "Fleet management with dashboard and updates.",
    price: "$149 / month",
    limits: "Up to 50 runtime instances",
    features: [
      "50 runtime instances.",
      "Fleet dashboard.",
      "Speculative execution.",
      "Council routing.",
      "Shadow mode.",
    ],
    cta: "Get Horizon",
    checkoutKey: "horizon",
    recommended: true,
  },
  {
    name: "Infinite",
    tagline: "Enterprise scale with advanced policy and OTA updates.",
    price: "$699 / month",
    limits: "Up to 500 runtime instances",
    features: [
      "500 runtime instances.",
      "Enterprise fleet management.",
      "Advanced policy engine.",
      "OTA runtime updates.",
      "Priority support.",
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
    <section id="pricing" className="pt-0 pb-0 bg-white dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 pt-[70px] bg-white dark:bg-[#1b1912] z-10">
          <div className="max-w-[1400px] mx-auto pt-24 px-0 md:px-8 lg:px-0 pb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl lg:text-6xl mb-6 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[900px] mx-auto mb-16">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`group relative transition-all duration-500 w-full border rounded-xl shadow-sm hover:shadow-md ${
                    tier.recommended
                      ? 'border-gray-300 dark:border-[#f6f6f4]/10'
                      : 'border-gray-300 dark:border-[#f6f6f4]/10'
                  } bg-[#f9f9fa] dark:bg-[#1b1912]`}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="mb-3">
                        <h3 className="text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                          {tier.name}
                        </h3>
                      </div>

                      <div className="mb-6">
                        {tier.isContactUs ? (
                          <div className="flex flex-col">
                            <span className="text-4xl md:text-5xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                              Custom
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-[#000000] dark:text-[#f6f6f4] transition-all duration-300">
                              <span className="text-4xl md:text-5xl" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>{tier.price.split(' / ')[0]}</span>
                              {tier.price.includes(' / ') && (
                                <span className="text-sm md:text-base text-gray-600 dark:text-[#a8a898]"> / {tier.price.split(' / ')[1]}</span>
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
                      href={POLAR_CHECKOUT[tier.checkoutKey]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md mt-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 self-start"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#1b1912', color: '#f6f6f4' }}
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
