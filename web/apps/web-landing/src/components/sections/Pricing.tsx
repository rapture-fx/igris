'use client';

import React, { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { useTheme } from 'next-themes';

const pricingRows = [
  {
    name: "",
    cards: [
      {
        name: "Startup",
        price: "$79",
        period: "month",
        descriptor: "Get control, safely.",
        features: [
          "Up to 500K requests/month",
          "Up to 3 AI providers (BYOK)",
          "Thompson Sampling",
          "Quality-aware routing modes (Cost / Balanced / Quality)",
          "Circuit breaker and automatic failover",
          "Real-time cost tracking",
          "Core observability metrics",
          "Single-node execution support",
          "Best-effort execution telemetry"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth",
        price: "$249",
        period: "month",
        descriptor: "Run production with accountability.",
        features: [
          "Everything in Startup +",
          "Up to 2M requests/month",
          "Up to 10 AI providers",
          "Speculative execution",
          "Council mode",
          "Cognitive advisor (auto-tuning)",
          "Policy versioning with hot reload",
          "Basic SLO enforcement",
          "Multi-runtime support",
          "Policy enforcement",
          "Resource safety limits",
          "Real-time execution telemetry",
          "Decision to execution audit trail",
          "Observed vs reported provider verification",
          "Routing traces and audit logs",
          "30-day retention"
        ],
        cta: "Get Started"
      },
       {
        name: "Scale",
        price: "Contact Us",
        period: "",
        descriptor: "Custom pricing based on scale, risk profile, and compliance requirements.",
        features: [
          "Everything in Growth +",
          "Unlimited requests (1000 RPS sustained)",
          "Up to 20 AI providers",
          "Advanced observability",
          "Hard budget caps",
          "Advanced SLO auto-remediation",
          "Fleet-wide isolation controls",
          "Cryptographically enforced trust",
          "Signed decision to execution contracts",
          "Compliance-ready execution",
          "Exports and alerts",
          "90-day retention",
          "Priority support"
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
                  Pricing
                </h2>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto mb-4">
                  Progressive control tiers for production AI infrastructure
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto">
                  14-day free trial · Full feature access · Hard usage caps · No production guarantees
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
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {row.cards.map((card, cardIndex) => {
                      return (
                         <div
                           key={cardIndex}
                           className={`relative transition-all duration-300 w-full min-h-[450px] border section-border bg-[#f6f6f4] dark:bg-[#1b1912] rounded-none ${card.name === 'Growth' ? 'shadow-[0_0_8px_rgba(147,51,234,0.3)]' : ''}`}
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
