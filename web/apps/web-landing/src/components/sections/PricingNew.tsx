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

// Calculate price based on device count
function calculatePrice(deviceCount: number): { monthly: number; perDevice: number; tier: string } {
  if (deviceCount === 1) {
    return { monthly: 0, perDevice: 0, tier: 'seed' };
  } else if (deviceCount <= 10) {
    return { monthly: deviceCount * 9, perDevice: 9, tier: 'horizon' };
  } else if (deviceCount <= 25) {
    const first10 = 10 * 9; // $90
    const remaining = (deviceCount - 10) * 7;
    return { monthly: first10 + remaining, perDevice: 7, tier: 'horizon' };
  } else if (deviceCount <= 50) {
    const first10 = 10 * 9; // $90
    const next15 = 15 * 7; // $105
    const remaining = (deviceCount - 25) * 5;
    return { monthly: first10 + next15 + remaining, perDevice: 5, tier: 'horizon' };
  } else if (deviceCount <= 100) {
    const first10 = 10 * 9;
    const next15 = 15 * 7;
    const next25 = 25 * 5;
    const remaining = (deviceCount - 50) * 4;
    return { monthly: first10 + next15 + next25 + remaining, perDevice: 4, tier: 'infinite' };
  } else if (deviceCount <= 250) {
    const first10 = 10 * 9;
    const next15 = 15 * 7;
    const next25 = 25 * 5;
    const next50 = 50 * 4;
    const remaining = (deviceCount - 100) * 3;
    return { monthly: first10 + next15 + next25 + next50 + remaining, perDevice: 3, tier: 'infinite' };
  } else {
    // 251+ devices - Enterprise custom pricing
    return { monthly: 0, perDevice: 0, tier: 'enterprise' };
  }
}

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [deviceCount, setDeviceCount] = useState(10);

  const pricing = calculatePrice(deviceCount);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  // Pricing tiers with dynamic pricing
  const pricingTiers: PricingTier[] = [
    {
      name: "The Seed",
      price: "$0",
      priceDetail: "forever",
      description: "Single device. Full platform. All four layers included.",
      devices: "1 device",
      features: [
        "Complete nervous system (all 4 layers)",
        "Execution: Deterministic runtime",
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
      price: "From $49",
      priceDetail: "/month",
      description: "Fleet awakens. Complete observability. Advanced control.",
      devices: "1-50 devices",
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
      price: "From $299",
      priceDetail: "/month",
      description: "Unbounded scale. On-premise deployment. SLA guarantees.",
      devices: "51-500 devices",
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

  return (
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible border-l border-r border-b section-border">
          <div className="max-w-[1400px] mx-auto pt-48 px-0 md:px-8 lg:px-0 pb-12">

            {/* Header */}
            <div className="text-center mb-12">
              <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-6 text-[#000000] dark:text-[#f6f6f4]">
                Scale with confidence.
                <br />Pay for what you use.
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto mb-4">
                The complete nervous system—execution, intelligence, memory, and proof—included in every tier.
              </p>
            </div>

            {/* Pricing Calculator */}
            <div className="max-w-3xl mx-auto mb-16 p-8 border section-border rounded-none bg-white dark:bg-[#14120a]">
              <div className="text-center mb-6">
                <h3 className="text-lg font-inter text-[#000000] dark:text-[#f6f6f4] mb-2">
                  Calculate your pricing
                </h3>
                <p className="text-sm text-gray-600 dark:text-[#a8a898]">
                  Adjust the slider to see pricing for your fleet size
                </p>
              </div>

              {/* Device Count Display */}
              <div className="text-center mb-6">
                <div className="text-5xl font-inter font-bold text-[#000000] dark:text-[#f6f6f4] mb-2">
                  {deviceCount}
                </div>
                <div className="text-sm text-gray-600 dark:text-[#a8a898]">
                  {deviceCount === 1 ? 'device' : 'devices'}
                </div>
              </div>

              {/* Slider */}
              <div className="mb-8">
                <input
                  type="range"
                  min="1"
                  max="500"
                  value={deviceCount}
                  onChange={(e) => setDeviceCount(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                  style={{
                    background: `linear-gradient(to right, #c5b0cd 0%, #c5b0cd ${(deviceCount / 500) * 100}%, #e5e7eb ${(deviceCount / 500) * 100}%, #e5e7eb 100%)`
                  }}
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-[#a8a898] mt-2">
                  <span>1</span>
                  <span>50</span>
                  <span>100</span>
                  <span>250</span>
                  <span>500</span>
                </div>
              </div>

              {/* Price Display */}
              {deviceCount > 250 ? (
                <div className="text-center p-6 border section-border rounded-none bg-[#f6f6f4] dark:bg-[#1b1912]">
                  <div className="text-3xl font-inter font-bold text-[#000000] dark:text-[#f6f6f4] mb-2">
                    Custom Pricing
                  </div>
                  <div className="text-sm text-gray-600 dark:text-[#a8a898] mb-4">
                    Enterprise plan for 250+ devices
                  </div>
                  <button
                    onClick={openEarlyAccessModal}
                    className="inline-flex items-center px-6 py-2 text-sm font-inter bg-[#000000] dark:bg-[#f6f6f4] text-white dark:text-[#1b1912] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4] transition-all"
                  >
                    Contact Sales
                  </button>
                </div>
              ) : (
                <div className="text-center p-6 border section-border rounded-none bg-[#f6f6f4] dark:bg-[#1b1912]">
                  <div className="text-5xl font-inter font-bold text-[#000000] dark:text-[#f6f6f4] mb-2">
                    ${pricing.monthly}
                    <span className="text-xl font-normal text-gray-600 dark:text-[#a8a898]">/month</span>
                  </div>
                  {deviceCount > 1 && (
                    <div className="text-sm text-gray-600 dark:text-[#a8a898] mb-4">
                      ~${pricing.perDevice}/device/month with volume pricing
                    </div>
                  )}
                  {deviceCount === 1 ? (
                    <div className="text-sm text-gray-600 dark:text-[#a8a898] mb-4">
                      Free forever • No credit card required
                    </div>
                  ) : (
                    <div className="text-sm text-gray-600 dark:text-[#a8a898] mb-4">
                      Tier: {pricing.tier === 'horizon' ? 'The Horizon' : 'The Infinite'}
                    </div>
                  )}
                  <button
                    onClick={openEarlyAccessModal}
                    className="inline-flex items-center px-6 py-2 text-sm font-inter bg-[#000000] dark:bg-[#f6f6f4] text-white dark:text-[#1b1912] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4] transition-all"
                  >
                    Get Started
                  </button>
                </div>
              )}

              {/* Volume Pricing Breakdown */}
              {deviceCount > 1 && deviceCount <= 250 && (
                <div className="mt-6 p-4 bg-white/50 dark:bg-black/20 rounded-none border section-border">
                  <div className="text-xs text-gray-600 dark:text-[#a8a898] font-inter">
                    <div className="font-semibold mb-2">Volume pricing tiers:</div>
                    <div className="space-y-1">
                      <div>• 1-10 devices: $9/device/month</div>
                      <div>• 11-25 devices: $7/device/month</div>
                      <div>• 26-50 devices: $5/device/month</div>
                      <div>• 51-100 devices: $4/device/month</div>
                      <div>• 101-250 devices: $3/device/month</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Pricing Tiers */}
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
                          <div className="flex items-baseline">
                            <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                              {tier.price}
                            </span>
                            <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                              {tier.priceDetail}
                            </span>
                          </div>
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
                All tiers include the complete platform. Higher tiers unlock advanced fleet management and observability features.
              </p>
            </div>

            <PricingComparison tiers={pricingTiers} recommendedTier="The Horizon" />
          </div>
        </div>
      </div>
    </section>
  );
}
