'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useTheme } from 'next-themes';
import PricingComparison from './PricingComparison';

interface UsageTier {
  name: string;
  basePrice: number;
  includedRequests: number;
  overageRate: number;
  hardLimit: number;
  providers: number;
  descriptor: string;
  authorityLevel: 'observe' | 'influence' | 'enforce' | 'prove';
  features: string[];
  cta: string;
  isContactUs?: boolean;
  minimumCommitment?: number;
}

// Authority progression: Observe → Influence → Enforce → Prove
const pricingTiers: UsageTier[] = [
  {
    name: "Hacker",
    basePrice: 0,
    includedRequests: 45000,
    overageRate: 0,
    hardLimit: 45000,
    providers: 2,
    descriptor: "Fully functional routing with execution.",
    authorityLevel: "observe",
    features: [
      "45K requests per month (hard limit)",
      "Routing across up to 2 AI providers",
      "Execution capability with write access",
      "Automatic failover and circuit breaking",
      "Cost and latency visibility",
      "Decision explanations",
      "7-day log retention"
    ],
    cta: "Get Started"
  },
  {
    name: "Startup",
    basePrice: 20,
    includedRequests: 100000,
    overageRate: 0.10,
    hardLimit: 999999,
    providers: 5,
    descriptor: "Usage-based pricing for growing teams.",
    authorityLevel: "influence",
    features: [
      "Includes 100K requests",
      "+ $0.10 per 1K overage",
      "Hard limit: 999,999 requests",
      "Up to 5 AI providers",
      "Thompson Sampling (ML)",
      "Semantic routing",
      "Auto-optimization",
      "Real-time cost tracking",
      "14-day log retention"
    ],
    routingFeatures: [
      "Thompson Sampling (ML)",
      "Semantic routing",
      "Auto-optimization"
    ],
    cta: "Get Started"
  },
  {
    name: "Growth",
    basePrice: 149,
    includedRequests: 1000000,
    overageRate: 0.05,
    hardLimit: 9999999,
    providers: 10,
    descriptor: "Usage-based + Runtime license included.",
    authorityLevel: "enforce",
    features: [
      "Includes 1M requests",
      "+ $0.05 per 1K overage",
      "Hard limit: 9.9M requests",
      "Up to 10 AI providers",
      "Everything in Startup +",
      "Runtime license included ($500 value)",
      "Adaptive routing with live learning",
      "Speculative execution",
      "Multi-provider consensus",
      "Local LLM fallback",
      "Reflection agents",
      "On-device inference",
      "Policy versioning with hot reload",
      "30-day log retention"
    ],
    cta: "Get Started"
  },
  {
    name: "Scale",
    basePrice: 0,
    includedRequests: 0,
    overageRate: 0,
    hardLimit: 0,
    providers: 0,
    descriptor: "Compliance, proof, and cryptographic guarantees.",
    authorityLevel: "prove",
    features: [
      "Everything in Growth +",
      "Unlimited AI providers",
      "Cryptographically signed routing decisions",
      "Cryptographically verified execution",
      "Tamper-evident audit logs",
      "Fleet-wide tenant isolation",
      "90-day log retention",
      "Priority support with SLA"
    ],
    isContactUs: true,
    minimumCommitment: 5000,
    cta: "Contact Us"
  }
];

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [requestVolume, setRequestVolume] = useState(100000);
  const [animatedCosts, setAnimatedCosts] = useState<{ [key: string]: number }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && theme === 'dark';

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const calculateCost = (tier: UsageTier, requests: number) => {
    if (tier.isContactUs || tier.basePrice === 0) return null;
    if (requests <= tier.includedRequests) {
      return tier.basePrice;
    }
    const overage = requests - tier.includedRequests;
    const overageCost = (overage / 1000) * tier.overageRate;
    return Math.round(tier.basePrice + overageCost);
  };

  const getRecommendedTier = (requests: number) => {
    if (requests <= 45000) return 'Hacker';
    if (requests <= 999999) return 'Startup';
    return 'Growth';
  };

  const recommendedTier = getRecommendedTier(requestVolume);

  // Animate cost changes with smooth counter
  useEffect(() => {
    const newCosts: { [key: string]: number } = {};
    pricingTiers.forEach(tier => {
      const cost = calculateCost(tier, requestVolume);
      if (cost !== null) {
        newCosts[tier.name] = cost;
      }
    });

    const startCosts = { ...animatedCosts };
    const startTime = Date.now();
    const duration = 600;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const currentCosts: { [key: string]: number } = {};
      Object.keys(newCosts).forEach(tierName => {
        const start = startCosts[tierName] || newCosts[tierName];
        const end = newCosts[tierName];
        currentCosts[tierName] = Math.round(start + (end - start) * easeProgress);
      });

      setAnimatedCosts(currentCosts);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  }, [requestVolume]);

  return (
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible border-l border-r border-b section-border">
           <div className="max-w-[1400px] mx-auto pt-48 px-0 md:px-8 lg:px-0 pb-12">
                 <div className="text-center mb-12">
                 <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-24 text-[#000000] dark:text-[#f6f6f4]">
                   Control your AI routing as it grows.
                 </h2>
                 <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto mb-12">
                 </p>
                 <p className="text-xs text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto">
                 </p>
              </div>

               {/* Global Pricing Slider */}
               <div className="mb-12 max-w-lg mx-auto">
                 <div className="px-4">
                   <label className="text-sm text-gray-900 dark:text-[#f6f6f4] font-inter mb-3 block text-center">
                     Pay only for what you use. Hard limits prevent unexpected bills.
                   </label>
                   <div className="max-w-sm mx-auto">
                     <input
                       type="range"
                       min={0}
                       max={10000000}
                       step={10000}
                       value={requestVolume}
                       onChange={(e) => setRequestVolume(parseInt(e.target.value))}
                       className="pricing-slider w-full appearance-none cursor-pointer mb-3"
                     />
                     <div className="flex justify-between items-center">
                       <span className="text-xs text-gray-600 dark:text-[#a8a898] font-inter">
                         {formatNumber(requestVolume)} requests/month
                       </span>
                       <span className="text-xs text-[#c5b0cd] font-inter">
                         Recommended: {recommendedTier}
                       </span>
                     </div>
                   </div>
                 </div>
               </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 max-w-[100rem] mx-auto mb-16">
              {pricingTiers.map((tier, index) => {
                const isRecommended = tier.name === recommendedTier;
                const calculatedCost = calculateCost(tier, requestVolume);
                const displayCost = animatedCosts[tier.name] || calculatedCost || tier.basePrice;

                return (
                  <div
                    key={index}
                     className={`relative transition-all duration-500 w-full min-h-[550px] border section-border rounded-none ${
                      isRecommended ? 'shadow-[0_0_8px_rgba(197,176,205,0.2),0_0_16px_rgba(197,176,205,0.1)]' : ''
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
                              Best fit
                            </span>
                          )}
                        </div>
                        {tier.descriptor && (
                          <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter mb-4">
                            {tier.descriptor}
                          </p>
                        )}

                        <div className="mb-6">
                          {tier.isContactUs ? (
                            <div className="flex items-baseline">
                              <span className="text-base font-inter text-[#000000] dark:text-[#f6f6f4]">
                                Contact Us
                              </span>
                            </div>
                          ) : tier.basePrice === 0 ? (
                            <div className="flex items-baseline">
                              <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                                $0
                              </span>
                              <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                                /month
                              </span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-baseline mb-2">
                                <span className="text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">$</span>
                                <div className="price-number-container">
                                  <span className="price-number text-2xl font-inter text-[#000000] dark:text-[#f6f6f4]">
                                    {displayCost}
                                  </span>
                                </div>
                                <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                                  /month
                                </span>
                              </div>
                              {requestVolume > tier.includedRequests && calculatedCost && (
                                <div className="text-xs text-gray-600 dark:text-[#a8a898] font-inter space-y-1">
                                  <div className="flex justify-between">
                                    <span>Base:</span>
                                    <span>${tier.basePrice}</span>
                                  </div>
                                  <div className="flex justify-between">
                                    <span>Overage ({formatNumber(requestVolume - tier.includedRequests)}):</span>
                                    <span>${Math.round((requestVolume - tier.includedRequests) / 1000 * tier.overageRate)}</span>
                                  </div>
                                   <div className="flex justify-between text-xs pt-1 border-t border-[rgba(156,163,175,0.5)] dark:border-[rgba(246,246,244,0.15)]">
                                    <span>Per 1K:</span>
                                    <span>${(calculatedCost / requestVolume * 1000).toFixed(2)}</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
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
                        className="inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 transition-all duration-200 text-xs font-inter self-start mt-8 text-white dark:text-[#1b1912] bg-[#000000] dark:bg-[#f6f6f4] hover:bg-gray-800 dark:hover:bg-[#e6e6e4] border border-black dark:border-[#f6f6f4]"
                      >
                        {tier.cta}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <PricingComparison tiers={pricingTiers} recommendedTier={recommendedTier} />
          </div>
        </div>
      </div>
    </section>
  );
}
