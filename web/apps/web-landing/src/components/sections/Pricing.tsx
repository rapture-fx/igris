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
    tagline: "For developers running a single autonomous system.",
    price: "$29 / month",
    limits: "5 runtime instances",
    features: [
      "5 runtime instances",
      "Edge or server deployment",
      "Execution receipts",
      "Policy enforcement",
      "Basic routing",
      "Local model support",
      "Community support",
    ],
    cta: "Get Seed",
    checkoutKey: "seed",
  },
  {
    name: "Horizon",
    tagline: "For teams operating multiple autonomous agents or edge systems.",
    price: "$149 / month",
    limits: "Up to 50 runtime instances",
    features: [
      "Up to 50 runtime instances",
      "Fleet dashboard",
      "Speculative execution",
      "Council routing",
      "Shadow mode",
      "Execution analytics",
      "Device health monitoring",
      "Email support",
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
      "Up to 500 runtime instances",
      "Enterprise fleet management",
      "Advanced policy engine",
      "OTA runtime updates",
      "High availability routing",
      "Custom deployment support",
      "Priority support",
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
        <div className="relative px-4 md:px-8 lg:px-12 py-8 bg-white dark:bg-[#1b1912] z-10">
          <div className="max-w-[1400px] mx-auto px-0 md:px-8 lg:px-0">

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 max-w-[900px] mx-auto">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`group relative transition-all duration-500 w-full border rounded-xl shadow-sm hover:shadow-md lg:min-h-[450px] ${
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
                        <p className="text-sm text-gray-600 dark:text-[#a8a898] mt-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                          {tier.tagline}
                        </p>
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
                      className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-xs md:text-sm font-medium shadow-sm rounded-md mt-5 md:mt-8 opacity-100 self-start"
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
