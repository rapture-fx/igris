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
    tagline: "Core runtime for one instance.",
    price: "Free",
    limits: "1 instance",
    features: [
      "Core deterministic runtime.",
      "Local + cloud routing.",
      "Offline survival.",
      "Cryptographic signing.",
      "7-day execution retention.",
      "Community support.",
      "Runs anywhere. Server, edge, robot."
    ],
    cta: "Get Started"
  },
  {
    name: "The Horizon",
    tagline: "Fleet management with dashboard and updates.",
    price: "$149 / month",
    limits: "Up to 50 instances",
    features: [
      "Fleet dashboard.",
      "Over-the-air verified updates.",
      "30-day signed execution retention.",
      "Role-based access control.",
      "Email support (24h).",
      "$3 per instance beyond 50."
    ],
    cta: "Get Started",
    recommended: true
  },
  {
    name: "The Infinite",
    tagline: "Enterprise scale with on-premise and SLO enforcement.",
    price: "$699 / month",
    limits: "Up to 500 instances",
    features: [
      "On-premise deployment option.",
      "90-day retention.",
      "SLO enforcement with auto-remediation.",
      "Priority support (8h).",
      "Security review assistance.",
      "Volume pricing beyond 500."
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
                      <div className="mb-2">
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

                      <div className="mb-4">
                        <p className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                          {tier.limits}
                        </p>
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
                    <button
                      onClick={openEarlyAccessModal}
                      className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md mt-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 self-start"
                      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', backgroundColor: '#1b1912', color: '#f6f6f4' }}
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
