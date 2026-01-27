'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useTheme } from 'next-themes';

// Authority progression: Observe → Influence → Enforce → Prove
const pricingRows = [
  {
    name: "",
    cards: [
      {
        name: "Hacker",
        price: "$0",
        period: "",
        descriptor: "Observation only.",
        authorityLevel: "observe",
        features: [
          "Up to 50K requests per month",
          "Routing across up to 2 AI providers using your own keys",
          "Deterministic cost or latency routing",
          "Automatic failover and circuit breaking",
          "Read-only cost and latency visibility",
          "Decision explanations",
          "Read-only Cognitive Advisor insights",
          "7-day read-only log retention"
        ],
        cta: "Get Started"
      },
      {
        name: "Startup",
        price: "$79",
        period: "month",
        descriptor: "Human-in-the-loop control.",
        authorityLevel: "influence",
        features: [
          "Up to 500K requests per month",
          "Routing across up to 3 AI providers using your own keys",
          "Routing informed by historical performance data",
          "Cost, balanced, or quality routing modes",
          "Automatic failover and circuit breaking",
          "Real-time cost tracking",
          "Core observability metrics",
          "Execution telemetry without cryptographic enforcement",
          "Manual configuration only"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth",
        price: "$249",
        period: "month",
        descriptor: "Autonomous enforcement with safeguards.",
        authorityLevel: "enforce",
        features: [
          "Everything in Startup +",
          "Up to 2M requests per month",
          "Routing across up to 10 AI providers",
          "Adaptive routing with live performance learning",
          "Speculative execution",
          "Multi-provider consensus execution",
          "Automatic optimization with rollback protection",
          "Policy versioning with hot reload",
          "SLO monitoring with guarded enforcement",
          "Decision to execution audit trail",
          "Observed versus reported provider verification",
          "30-day log retention"
        ],
        cta: "Get Started"
      },
       {
        name: "Scale",
        price: "Contact Us",
        period: "",
        descriptor: "Compliance, proof, and cryptographic guarantees.",
        authorityLevel: "prove",
        features: [
          "Everything in Growth +",
          "Unlimited requests with sustained high throughput",
          "Unlimited AI providers",
          "Cryptographically signed routing decisions",
          "Cryptographically verified execution",
          "Tamper-evident audit logs",
          "Advanced SLO enforcement with automatic remediation",
          "Compliance-ready execution trails",
          "Fleet-wide tenant isolation",
          "90-day log retention",
          "Priority support with SLA"
        ],
        cta: "Contact Us"
      }
    ]
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
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible border-l border-r border-b section-border">
           <div className="max-w-[1400px] mx-auto pt-48 px-0 md:px-8 lg:px-0 pb-12">
                <div className="text-center mb-16 pb-12">
                 <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                   Control your AI routing as it grows.
                 </h2>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto mb-4">
                  Observe how decisions are made, then influence and enforce them in production.
                </p>
                <p className="text-xs text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto">
                  14-day trial on paid plans. Usage limits apply to all tiers.
                </p>
              </div>

            <div className="space-y-16 max-w-[100rem] mx-auto">
            {pricingRows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-col items-stretch gap-4">
                 <div className="text-left mb-2">
                    <h3 className="text-xl font-inter font-medium text-[#000000] dark:text-[#f6f6f4]">
                      {row.name}
                    </h3>
                  </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {row.cards.map((card, cardIndex) => {
                      return (
                         <div
                           key={cardIndex}
                            className={`relative transition-all duration-300 w-full min-h-[450px] border section-border rounded-none ${card.name === 'Growth' ? 'shadow-[0_0_8px_rgba(197,176,205,0.2),0_0_16px_rgba(197,176,205,0.1)]' : ''}`} style={{ backgroundColor: '#14120a' }}
                         >
                          <div className="p-6 flex flex-col h-full">
                            <div className="flex-grow">
                              <h3 className="text-lg mb-2 font-inter text-[#000000] dark:text-[#f6f6f4]">
                                {card.name}
                              </h3>
                              {card.descriptor && (
                                <p className="text-xs text-gray-500 dark:text-[#a8a898] font-inter mb-4">
                                  {card.descriptor}
                                </p>
                              )}

                              <div className="mb-6">
                               <div className="flex items-baseline">
                                 <span className="text-base font-inter text-[#000000] dark:text-[#f6f6f4]">
                                   {card.price}
                                 </span>
                                 {card.period && (
                                   <span className="ml-2 text-gray-600 dark:text-[#a8a898] font-inter text-sm">
                                     /{card.period}
                                   </span>
                                 )}
                               </div>
                             </div>

                             <ul className="space-y-2">
                               {card.features.map((feature, featureIndex) => (
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
                             {card.cta}
                            </button>
                        </div>
                      </div>
                    );
                  })}
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
