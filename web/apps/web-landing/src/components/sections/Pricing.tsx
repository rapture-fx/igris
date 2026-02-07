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
      "Execution: Deterministic runtime with enforced bounds",
      "Intelligence: Local decision routing",
      "Memory: Behavioral tracking",
      "Proof: Cryptographic signing (Ed25519)",
      "Offline operation (indefinite)",
      "Community support"
    ],
    cta: "Get Started"
  },
  {
    name: "The Horizon",
    tagline: "Fleet awakens. Visibility and control.",
    price: "$90 / month",
    limits: "Up to 50 devices (~$1.80 per device)",
    features: [
      "Everything in The Seed",
      "Full dashboard access",
      "Fleet-wide monitoring and control",
      "Advanced routing and cost optimization",
      "Performance heatmaps and anomaly detection",
      "Immutable audit trails (7-day retention)",
      "Over-the-air verified updates",
      "Priority engineering support"
    ],
    cta: "Get Started",
    recommended: true
  },
  {
    name: "The Infinite",
    tagline: "Serious scale. Real guarantees.",
    price: "$399 / month",
    limits: "Up to 250 devices (~$1.60 per device)",
    features: [
      "Everything in The Horizon",
      "Extended audit retention (90+ days)",
      "Advanced analytics dashboard",
      "Custom SLA guarantees",
      "On-premise deployment option",
      "Dedicated security review support",
      "24/7 engineering team access",
      "Compliance certification assistance"
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
      "Unlimited devices",
      "Full on-premise platform deployment",
      "Custom integrations",
      "Dedicated account manager",
      "Custom SLA with uptime guarantees",
      "White-glove onboarding",
      "Priority feature requests"
    ],
    cta: "Contact Sales",
    isContactUs: true
  }
];

const pricingPrinciples = [
  "No per-request pricing",
  "No token billing",
  "No usage surprises",
  "You pay for presence, not consumption",
  "This layer does not meter intelligence.",
  "It holds it."
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
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="max-w-[1400px] mx-auto pt-16 px-0 md:px-8 lg:px-0 pb-16">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-6 text-[#000000] dark:text-[#f6f6f4]">
                The execution layer everything runs on
              </h2>
              <div className="max-w-2xl mx-auto space-y-2">
                <p className="text-sm md:text-base text-gray-700 dark:text-[#a8a898] font-inter">
                  This is not usage-based AI.
                </p>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#a8a898] font-inter">
                  This is the deterministic execution layer that holds intelligence in place.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[100rem] mx-auto mb-16">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`relative transition-all duration-500 w-full min-h-[500px] border rounded-none ${
                    tier.recommended 
                      ? 'shadow-[0_0_4px_rgba(197,176,205,0.15)] border-[#c5b0cd]' 
                      : 'border-gray-300 dark:border-[#f6f6f4]/10'
                  } bg-[#f6f6f4] dark:bg-[#14120a]`}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="text-lg font-inter text-[#000000] dark:text-[#f6f6f4]">
                          {tier.name}
                        </h3>
                        {tier.recommended && (
                          <span className="text-xs px-2 py-1 bg-[#c5b0cd]/20 text-[#c5b0cd] rounded font-semibold">
                            Recommended
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter mb-4">
                        {tier.tagline}
                      </p>

                      <div className="mb-6">
                        {tier.isContactUs ? (
                          <div className="flex flex-col">
                            <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                              Custom
                            </span>
                            <span className="text-xs text-gray-600 dark:text-[#a8a898] font-inter mt-1">
                              pricing
                            </span>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4] transition-all duration-300">
                              {tier.price}
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
                      className={`inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 transition-all duration-200 text-xs font-inter self-start mt-8 w-full justify-center ${
                        tier.recommended 
                          ? 'text-white dark:text-[#1b1912] bg-[#000000] dark:bg-[#f6f6f4] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4]' 
                          : 'text-gray-900 dark:text-[#f6f6f4] bg-gray-200 dark:bg-[#f6f6f4]/10 hover:bg-gray-300 dark:hover:bg-[#f6f6f4]/20 border border-gray-300 dark:border-[#f6f6f4]/20'
                      }`}
                    >
                      {tier.cta}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="max-w-3xl mx-auto text-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {pricingPrinciples.map((principle, index) => (
                  <p 
                    key={index}
                    className="text-sm text-gray-600 dark:text-[#a8a898] font-inter"
                  >
                    {principle}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
