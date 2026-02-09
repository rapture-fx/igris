'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useTheme } from 'next-themes';
import PricingComparison from './PricingComparison';

interface PricingTier {
  name: string;
  tagline: string;
  price: string;
  limits: string;
  features: string[];
  cta: string;
  isContactUs?: boolean;
  recommended?: boolean;
}

const pricingTiers: PricingTier[] = [
  {
    name: "The Seed",
    tagline: "One device. Full layer. Free forever.",
    price: "$0 / forever",
    limits: "1 device",
    features: [
      "Full runtime layer (edge + cloud)",
      "Unlimited execution (no request limits)",
      "All core features included",
      "Offline operation (indefinite)",
      "Cryptographic signing (Ed25519)",
      "Community support"
    ],
    cta: "Get Started"
  },
  {
    name: "The Horizon",
    tagline: "Fleet awakens. Visibility and control.",
    price: "$99 / month",
    limits: "Up to 50 devices",
    features: [
      "Everything in The Seed",
      "Full dashboard & fleet view",
      "All Edge features (QLoRA, Swarms, Planning, Tools)",
      "All Cloud features (Speculative, Council, Health)",
      "Over-the-air verified updates",
      "Audit trails (7-day retention)",
      "Email support (24h response)",
      "$2/device/month over 50 devices"
    ],
    cta: "Get Started",
    recommended: true
  },
  {
    name: "The Infinite",
    tagline: "Serious scale. Real guarantees.",
    price: "$499 / month",
    limits: "Up to 500 devices",
    features: [
      "Everything in The Horizon",
      "On-premise deployment option",
      "Extended audit retention (90 days)",
      "99.5% SLA guarantee",
      "Slack support (4h critical response)",
      "Compliance assistance (SOC2, ISO27001)",
      "Advanced analytics & anomaly detection",
      "$1.50/device/month over 500 devices"
    ],
    cta: "Get Started"
  },
  {
    name: "Enterprise",
    tagline: "The layer at maximum scale.",
    price: "Custom pricing",
    limits: "Unlimited devices",
    features: [
      "Everything in The Infinite",
      "Air-gapped operation support",
      "Full on-premise platform deployment",
      "Custom integrations & white-label",
      "Dedicated account manager",
      "Custom SLA (99.9%+ uptime)",
      "White-glove onboarding",
      "Priority feature requests"
    ],
    cta: "Contact Sales",
    isContactUs: true
  }
];

const pricingPrinciples = [
  "One price. Unlimited execution.",
  "No token counting. No request metering.",
  "Pay for devices. Execute without limits.",
  "This is infrastructure, not API rental.",
  "Scale freely. No surprise bills.",
  "The layer holds intelligence. It doesn't meter it."
];

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  return (
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-[#1b1912] text-gray-900 dark:text-[#f6f6f4] relative transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 pt-[70px] bg-[#f6f6f4] dark:bg-[#1b1912] z-10" style={{ borderLeft: '0.5px solid #d1d5db', borderRight: '0.5px solid #d1d5db', borderBottom: '0.5px solid #d1d5db' }}>
          <div className="max-w-[1400px] mx-auto pt-24 px-0 md:px-8 lg:px-0 pb-24">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl lg:text-6xl mb-6 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[900px] mx-auto mb-16">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`group relative transition-all duration-500 w-full border rounded-none ${
                    tier.recommended
                      ? 'shadow-[0_0_4px_rgba(197,176,205,0.15)] border-gray-300 dark:border-[#f6f6f4]/10'
                      : 'border-gray-300 dark:border-[#f6f6f4]/10'
                  } bg-[#f6f6f4] dark:bg-[#14120a]`}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="mb-2">
                        <h3 className="text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                          {tier.name}
                        </h3>
                      </div>

                      <div className="mb-6">
                        {tier.isContactUs ? (
                          <div className="flex flex-col">
                            <span className="text-4xl md:text-5xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                              Custom
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-[#000000] dark:text-[#f6f6f4] transition-all duration-300" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                              <span className="text-4xl md:text-5xl">{tier.price.split(' / ')[0]}</span>
                              <span className="text-sm md:text-base text-gray-600 dark:text-[#a8a898]"> / {tier.price.split(' / ')[1]}</span>
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mb-4">
                        <p className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] font-inter">
                          {tier.limits}
                        </p>
                      </div>

                      <ul className="space-y-2">
                        {tier.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start">
                            <Check className="h-3 w-3 mr-3 flex-shrink-0 mt-0.5 text-[#000000] dark:text-[#f6f6f4]" />
                            <span className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={openEarlyAccessModal}
                      className={`inline-flex items-center justify-center px-6 py-2 rounded-md transition-all duration-200 text-sm font-inter mt-8 opacity-0 group-hover:opacity-100 self-start ${
                        tier.recommended
                          ? 'text-white dark:text-[#1b1912] bg-[#000000] dark:bg-[#f6f6f4] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4]'
                          : 'text-gray-900 dark:text-[#f6f6f4] bg-gray-200 dark:bg-[#f6f6f4]/10 hover:bg-gray-300 dark:hover:bg-[#f6f6f4]/20 border border-gray-300 dark:border-[#f6f6f4]/20'
                      }`}
                    >
                      Select
                    </button>
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
