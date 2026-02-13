'use client';

import React, { useEffect, useState } from 'react';
import { Check, ChevronRight } from 'lucide-react';
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
      "Full runtime (local + cloud routing)",
      "Unlimited execution (no request limits)",
      "Local LLM fallback (offline capable)",
      "Thompson Sampling routing",
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
      "Dashboard & fleet management",
      "Speculative Execution & Council Mode",
      "Planning, Reflection & Swarm agents",
      "QLoRA on-device training",
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
      "Cognitive Advisor (auto-optimization)",
      "Shadow Mode (risk-free testing)",
      "SLO Enforcer with auto-remediation",
      "Extended audit retention (90 days)",
      "Federated learning across fleet",
      "Priority email support (8h response)",
      "$1.50/device/month over 500 devices"
    ],
    cta: "Get Started"
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
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 pt-[70px] bg-[#f6f6f4] dark:bg-[#1b1912] z-10">
          <div className="max-w-[1400px] mx-auto pt-24 px-0 md:px-8 lg:px-0 pb-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-5xl lg:text-6xl mb-6 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Pricing
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-[900px] mx-auto mb-16">
              {pricingTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`group relative transition-all duration-500 w-full border rounded-xl shadow-lg hover:shadow-xl ${
                    tier.recommended
                      ? 'border-gray-300 dark:border-[#f6f6f4]/10'
                      : 'border-gray-300 dark:border-[#f6f6f4]/10'
                  } bg-[#f6f6f4] dark:bg-[#1b1912]`}
                >
                  <div className="p-6 flex flex-col h-full">
                    <div className="flex-grow">
                      <div className="mb-2">
                        <h3 className="text-lg text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
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
                            <span className="text-[#000000] dark:text-[#f6f6f4] transition-all duration-300">
                              <span className="text-4xl md:text-5xl" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>{tier.price.split(' / ')[0]}</span>
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
                            <Check className="h-3 w-3 mr-3 flex-shrink-0 mt-0.5 text-green-500" />
                            <span className="text-xs text-gray-700 dark:text-[#c8c8b8]" style={{ fontFamily: 'var(--font-geist-mono)' }}>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <button
                      onClick={openEarlyAccessModal}
                      className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md mt-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 self-start"
                      style={{ fontFamily: 'var(--font-geist-sans)', backgroundColor: '#1b1912', color: '#f6f6f4' }}
                    >
                      Select
                      <ChevronRight className="ml-1 h-4 w-4" />
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
