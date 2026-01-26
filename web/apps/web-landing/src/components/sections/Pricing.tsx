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
        descriptor: "Observe decisions.",
        authorityLevel: "observe",
        features: [
          "Up to 50K requests/month",
          "Routing across up to 2 AI providers (BYOK)",
          "Latency or cost–optimized routing (round-robin)",
          "Automatic failover and circuit breaking",
          "Read-only cost and latency visibility",
          "Decision explanations (no live exploration)",
          "Read-only Cognitive Advisor insights",
          "7-day log retention (read-only)"
        ],
        cta: "Get Started"
      },
      {
        name: "Startup",
        price: "$79",
        period: "month",
        descriptor: "Influence decisions.",
        authorityLevel: "influence",
        features: [
          "Up to 500K requests/month",
          "Up to 3 AI providers (BYOK)",
          "Historical-metrics–informed routing (no live exploration)",
          "Quality-aware routing modes (Cost / Balanced / Quality)",
          "Circuit breaker and automatic failover",
          "Real-time cost tracking",
          "Core observability metrics",
          "Execution telemetry (non-cryptographic)",
          "Manual configuration only"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth",
        price: "$249",
        period: "month",
        descriptor: "Enforce decisions.",
        authorityLevel: "enforce",
        features: [
          "Everything in Startup +",
          "Up to 2M requests/month",
          "Up to 10 AI providers",
          "Thompson Sampling (live exploration)",
          "Speculative execution",
          "Council mode",
          "Auto-apply with rollback protection",
          "Policy versioning with hot reload",
          "SLO monitoring with guarded enforcement",
          "Decision to execution audit trail",
          "Observed vs reported verification",
          "30-day retention"
        ],
        cta: "Get Started"
      },
       {
        name: "Scale",
        price: "Contact Us",
        period: "",
        descriptor: "Prove and govern decisions.",
        authorityLevel: "prove",
        features: [
          "Everything in Growth +",
          "Unlimited requests (1000 RPS sustained)",
          "Unlimited AI providers",
          "Ed25519-signed routing decisions",
          "Cryptographic execution envelopes",
          "Tamper-evident audit logs",
          "Advanced SLO enforcement with auto-remediation",
          "Compliance-ready execution trails",
          "Fleet-wide tenant isolation",
          "90-day retention",
          "Priority support + SLA"
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
                  Progressive authority tiers: Observe → Influence → Enforce → Prove
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter max-w-2xl mx-auto">
                  14-day trial · Hard usage caps · Cryptographic guarantees Scale-only
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
                           className={`relative transition-all duration-300 w-full min-h-[450px] border section-border bg-[#f6f6f4] dark:bg-[#1b1912] rounded-none ${card.name === 'Growth' ? 'shadow-[0_0_8px_rgba(197,176,205,0.2),0_0_16px_rgba(197,176,205,0.1)]' : ''}`}
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
