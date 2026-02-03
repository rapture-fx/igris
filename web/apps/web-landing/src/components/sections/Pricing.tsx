'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useTheme } from 'next-themes';
import PricingComparison from './PricingComparison';

interface PricingTier {
  name: string;
  price: string;
  priceDetail: string;
  description: string;
  devices: string;
  features: string[];
  cta: string;
  isContactUs?: boolean;
  highlight?: boolean;
}

// Three horizons: The Seed, The Horizon, The Infinite
const pricingTiers: PricingTier[] = [
  {
    name: "The Seed",
    price: "$0",
    priceDetail: "forever",
    description: "Single device. Full platform. All four layers included.",
    devices: "1 device",
    features: [
      "Complete nervous system (all 4 layers)",
      "Execution: Deterministic runtime with hard limits",
      "Intelligence: Local decision routing",
      "Memory: Behavioral tracking",
      "Proof: Cryptographic signing (Ed25519)",
      "Offline operation (indefinite)",
      "Community support"
    ],
    cta: "Download"
  },
  {
    name: "The Horizon",
    price: "$49",
    priceDetail: "/device/month",
    description: "Fleet awakens. Complete observability. Advanced control.",
    devices: "Up to 100 devices",
    features: [
      "Everything in The Seed",
      "Full dashboard access (all four layers visible)",
      "Fleet-wide monitoring and control",
      "Advanced routing and cost optimization",
      "Performance heatmaps and anomaly detection",
      "Immutable audit trails (7-day retention)",
      "Over-the-air verified updates",
      "Priority engineering support"
    ],
    cta: "Get Started",
    highlight: true
  },
  {
    name: "The Infinite",
    price: "Custom",
    priceDetail: "pricing",
    description: "Unbounded scale. On-premise deployment. SLA guarantees.",
    devices: "Unlimited devices",
    features: [
      "Everything in The Horizon",
      "On-premise platform deployment",
      "Custom SLA guarantees",
      "Extended audit retention (90+ days)",
      "Dedicated security review support",
      "24/7 engineering team access",
      "Compliance certification assistance",
      "Custom integration support"
    ],
    cta: "Contact",
    isContactUs: true
  }
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
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible border-l border-r border-b section-border">
          <div className="max-w-[1400px] mx-auto pt-48 px-0 md:px-8 lg:px-0 pb-12">
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-6 text-[#000000] dark:text-[#f6f6f4]">
                Pricing per device.
                <br />Dashboard free.
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto mb-4">
                The complete nervous system—execution, intelligence, memory, and proof—included in every tier. Dashboard unlocks advanced features as you scale.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[100rem] mx-auto mb-16">
              {pricingTiers.map((tier, index) => {
                const isHighlighted = tier.highlight;

                return (
                  <div
                    key={index}
                    className={`relative transition-all duration-500 w-full min-h-[550px] border section-border rounded-none ${
                      isHighlighted ? 'shadow-[0_0_8px_rgba(197,176,205,0.2),0_0_16px_rgba(197,176,205,0.1)] border-[#c5b0cd]' : ''
                    } bg-[#f6f6f4] dark:bg-[#14120a]`}
                  >
                    <div className="p-6 flex flex-col h-full">
                      <div className="flex-grow">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-lg font-inter text-[#000000] dark:text-[#f6f6f4]">
                            {tier.name}
                          </h3>
                          {isHighlighted && (
                            <span className="text-xs px-2 py-1 bg-[#c5b0cd]/20 text-[#c5b0cd] rounded font-semibold">
                              Popular
                            </span>
                          )}
                        </div>
                        
                        <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter mb-4">
                          {tier.description}
                        </p>

                        <div className="mb-6">
                          {tier.isContactUs ? (
                            <div className="flex items-baseline">
                              <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                                Custom
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-baseline">
                              <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                                {tier.price}
                              </span>
                              <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                                {tier.priceDetail}
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="mb-4">
                          <p className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4] font-inter">
                            {tier.devices}
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
                        className={`inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 transition-all duration-200 text-xs font-inter self-start mt-8 ${
                          isHighlighted 
                            ? 'text-white dark:text-[#1b1912] bg-[#000000] dark:bg-[#f6f6f4] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4]' 
                            : 'text-gray-900 dark:text-[#f6f6f4] bg-gray-200 dark:bg-[#f6f6f4]/10 hover:bg-gray-300 dark:hover:bg-[#f6f6f4]/20 border border-gray-300 dark:border-[#f6f6f4]/20'
                        }`}
                      >
                        {tier.cta}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="text-center mt-8 mb-8">
              <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter">
                All tiers include the complete platform. Professional and Enterprise unlock advanced fleet management and observability features.
              </p>
            </div>

            <PricingComparison tiers={pricingTiers} recommendedTier="Pro" />
          </div>
        </div>
      </div>
    </section>
  );
}
