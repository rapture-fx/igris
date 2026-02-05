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

// Capacity-based pricing tiers
const pricingTiers: PricingTier[] = [
  {
    name: "The Seed",
    price: "$0",
    priceDetail: "/forever",
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
    price: "$149",
    priceDetail: "/month",
    description: "Fleet awakens. Complete observability. Advanced control.",
    devices: "Up to 50 devices",
    features: [
      "Everything in The Seed",
      "Full dashboard access (all four layers visible)",
      "Fleet-wide monitoring and control",
      "Advanced routing and cost optimization",
      "Performance heatmaps and anomaly detection",
      "Immutable audit trails (7-day retention)",
      "Over-the-air verified updates",
      "Priority engineering support",
      "~$3 per device average"
    ],
    cta: "Get Started",
    highlight: true
  },
  {
    name: "The Infinite",
    price: "$399",
    priceDetail: "/month",
    description: "Unbounded scale. On-premise deployment. SLA guarantees.",
    devices: "Up to 250 devices",
    features: [
      "Everything in The Horizon",
      "Extended audit retention (90+ days)",
      "Advanced analytics dashboard",
      "Custom SLA guarantees",
      "On-premise deployment option",
      "Dedicated security review support",
      "24/7 engineering team access",
      "Compliance certification assistance",
      "~$1.60 per device average"
    ],
    cta: "Get Started"
  },
  {
    name: "Enterprise",
    price: "Custom",
    priceDetail: "pricing",
    description: "Unlimited scale. Full customization. Dedicated support.",
    devices: "Unlimited devices",
    features: [
      "Everything in The Infinite",
      "Unlimited devices",
      "Full on-premise platform deployment",
      "Custom integration support",
      "Dedicated account manager",
      "Custom SLA with uptime guarantees",
      "White-glove onboarding",
      "Priority feature requests"
    ],
    cta: "Contact",
    isContactUs: true
  }
];

// Capacity-based pricing tiers
function getRecommendedTier(deviceCount: number): string {
  if (deviceCount === 1) return "The Seed";
  if (deviceCount <= 50) return "The Horizon";
  if (deviceCount <= 250) return "The Infinite";
  return "Enterprise";
}

function getTierPrice(deviceCount: number): { price: string; perDevice: string } {
  if (deviceCount === 1) {
    return { price: "$0", perDevice: "Free forever" };
  } else if (deviceCount <= 50) {
    return { price: "$149", perDevice: `~$${(149 / deviceCount).toFixed(2)}/device` };
  } else if (deviceCount <= 250) {
    return { price: "$399", perDevice: `~$${(399 / deviceCount).toFixed(2)}/device` };
  } else {
    return { price: "Custom", perDevice: "Contact sales" };
  }
}

// Calculate actual monthly cost for a tier based on device count (volume pricing)
function calculateTierCost(tierName: string, deviceCount: number): { monthly: number; perDevice: number } {
  if (tierName === "The Seed") {
    return { monthly: 0, perDevice: 0 };
  }

  if (tierName === "The Horizon") {
    // Up to 50 devices
    const cappedDevices = Math.min(deviceCount, 50);
    let totalCost = 0;

    // Volume pricing tiers
    if (cappedDevices <= 10) {
      totalCost = cappedDevices * 9;
    } else if (cappedDevices <= 25) {
      totalCost = 10 * 9 + (cappedDevices - 10) * 7;
    } else {
      totalCost = 10 * 9 + 15 * 7 + (cappedDevices - 25) * 5;
    }

    return { monthly: totalCost, perDevice: totalCost / cappedDevices };
  }

  if (tierName === "The Infinite") {
    // Up to 250 devices
    const cappedDevices = Math.min(deviceCount, 250);
    let totalCost = 0;

    // Volume pricing tiers
    if (cappedDevices <= 50) {
      // Calculate Horizon pricing first
      if (cappedDevices <= 10) {
        totalCost = cappedDevices * 9;
      } else if (cappedDevices <= 25) {
        totalCost = 10 * 9 + (cappedDevices - 10) * 7;
      } else {
        totalCost = 10 * 9 + 15 * 7 + (cappedDevices - 25) * 5;
      }
    } else if (cappedDevices <= 100) {
      totalCost = 10 * 9 + 15 * 7 + 25 * 5 + (cappedDevices - 50) * 4;
    } else {
      totalCost = 10 * 9 + 15 * 7 + 25 * 5 + 50 * 4 + (cappedDevices - 100) * 3;
    }

    return { monthly: totalCost, perDevice: totalCost / cappedDevices };
  }

  // Enterprise
  return { monthly: 0, perDevice: 0 };
}

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [deviceCount, setDeviceCount] = useState(10);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';
  const recommendedTier = getRecommendedTier(deviceCount);
  const tierPrice = getTierPrice(deviceCount);

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

            {/* Device Count Slider */}
            <div className="mb-12 max-w-lg mx-auto">
              <div className="px-4">
                <label className="text-sm text-gray-900 dark:text-[#f6f6f4] font-inter mb-3 block text-center">
                  Adjust to see pricing for your fleet size. Volume discounts applied automatically.
                </label>
                <div className="max-w-sm mx-auto">
                  <div className="text-center mb-4">
                    <span className="text-3xl font-inter font-bold text-[#000000] dark:text-[#f6f6f4]">
                      {deviceCount}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-[#a8a898] ml-2">
                      {deviceCount === 1 ? 'device' : 'devices'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={250}
                    step={1}
                    value={deviceCount}
                    onChange={(e) => setDeviceCount(parseInt(e.target.value))}
                    className="pricing-slider w-full appearance-none cursor-pointer mb-3"
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-gray-600 dark:text-[#a8a898] font-inter">
                      {tierPrice.price}
                      <span className="text-[#c5b0cd] ml-2">{tierPrice.perDevice}</span>
                    </span>
                    <span className="text-xs text-[#c5b0cd] font-inter font-semibold">
                      Recommended: {recommendedTier}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[100rem] mx-auto mb-16">
              {pricingTiers.map((tier, index) => {
                const isRecommended = tier.name === recommendedTier;
                const isHighlighted = isRecommended;
                const cost = calculateTierCost(tier.name, deviceCount);

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
                          {isRecommended && (
                            <span className="text-xs px-2 py-1 bg-[#c5b0cd]/20 text-[#c5b0cd] rounded font-semibold">
                              Recommended
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter mb-4">
                          {tier.description}
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
                          ) : tier.name === "The Seed" ? (
                            <div className="flex flex-col">
                              <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4] transition-all duration-300">
                                $0
                              </span>
                              <span className="text-xs text-gray-600 dark:text-[#a8a898] font-inter mt-1">
                                /forever
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              <div className="flex items-baseline">
                                <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4] transition-all duration-300 tabular-nums">
                                  ${cost.monthly}
                                </span>
                                <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                                  /month
                                </span>
                              </div>
                              <span className="text-xs text-[#c5b0cd] font-inter mt-1 transition-all duration-300 tabular-nums">
                                ${cost.perDevice.toFixed(2)}/device
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
