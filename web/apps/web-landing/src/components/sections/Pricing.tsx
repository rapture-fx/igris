'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

const pricingRows = [
  {
    name: "Overture",
    cards: [
      {
        name: "Developer · Overture",
        price: "$79",
        period: "month",
        features: [
          "Fault-tolerant routing core",
          "Up to 150K routed requests / month",
          "Overage: $0.35 per 1,000 requests",
          "Up to 3 AI providers (BYOK)",
          "Thompson Sampling routing",
          "Quality-aware routing modes (Cost / Balanced / Quality)",
          "Circuit breaker & automatic failover",
          "Real-time cost tracking",
          "Low-latency request caching",
          "Decision-level observability (routing, latency, cost)",
          "Automatic request classification"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth · Overture",
        price: "$249",
        period: "month",
        features: [
          "Everything in Developer · Overture",
          "Up to 2M routed requests / month",
          "Overage: $0.20 per 1,000 requests",
          "Up to 7 AI providers",
          "Speculative execution (TTFT optimization)",
          "Explainable routing traces",
          "Cognitive advisor (auto-tuned routing)",
          "Policy versioning with hot reload",
          "Audit logs",
          "Multi-tenant support (up to 5 tenants)",
          "Decision observability with 30-day retention"
        ],
        cta: "Get Started"
      },
      {
        name: "Scale · Overture",
        price: "$799",
        period: "month",
        features: [
          "Everything in Growth · Overture",
          "Unlimited routed requests (1000 RPS sustained)",
          "Up to 20 AI providers",
          "Advanced observability (alerts, exports)",
          "90-day decision trace retention",
          "Advanced SLO enforcement & auto-remediation",
          "Hard budget caps & enforcement",
          "Self-hosted Kubernetes deployment",
          "Custom provider adapter support",
          "Unlimited multi-tenancy"
        ],
        cta: "Get Started"
      }
    ]
  },
  {
    name: "Runtime",
    cards: [
      {
        name: "Developer · Runtime",
        price: "$99",
        period: "month",
        features: [
          "Single-node governed execution runtime",
          "Secure-by-default execution environment",
          "Signed runtime releases",
          "Compatible with Overture decision output",
          "Local execution telemetry (node-level)",
          "Community support"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth · Runtime",
        price: "$349",
        period: "month",
        features: [
          "Everything in Developer · Runtime",
          "Multi-runtime coordination",
          "Policy enforcement hooks",
          "Real-time execution telemetry",
          "Resource safety limits",
          "Supported upgrade path",
          "Incident-response SLA"
        ],
        cta: "Get Started"
      },
      {
        name: "Scale · Runtime",
        price: "$999",
        period: "month",
        features: [
          "Everything in Growth · Runtime",
          "Fleet mode",
          "Isolation controls",
          "Extended execution telemetry retention",
          "Compliance-ready execution patterns",
          "Priority security updates"
        ],
        cta: "Get Started"
      }
    ]
  },
  {
    name: "Hybrid",
    cards: [
      {
        name: "Developer · Hybrid",
        price: "$149",
        period: "month",
        features: [
          "Signed decision → execution verification",
          "Cryptographic trust-chain validation",
          "Limited hybrid execution volume",
          "Trial-first onboarding"
        ],
        cta: "Get Started"
      },
      {
        name: "Growth · Hybrid",
        price: "$599",
        period: "month",
        features: [
          "Full closed-loop decision → execution",
          "Observed vs reported provider verification",
          "Decision + execution audit trail",
          "Tamper-evident logs",
          "Production eligibility"
        ],
        cta: "Get Started"
      },
      {
        name: "Scale · Hybrid",
        price: "$1999",
        period: "month",
        features: [
          "Cryptographically enforced trust loop",
          "Signed Overture → Runtime contracts",
          "Compliance-ready execution",
          "Audit-grade guarantees",
          "Priority support"
        ],
        cta: "Get Started"
      }
    ]
  }
];

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();

  return (
    <section id="pricing" className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px] dark:bg-gray-900 dark:text-white" style={{
      backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center top -100px',
      backgroundRepeat: 'no-repeat',
      borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)'
    }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
           <div className="max-w-[1400px] mx-auto pt-48 px-0 md:px-8 lg:px-0 pb-12">
             <div className="text-center mb-16 pb-12">
              <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Pricing
              </h2>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter max-w-2xl mx-auto mb-4">
                Control, reliability, and leverage for AI inference orchestration
              </p>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-inter max-w-2xl mx-auto">
                14-day free trial · Full feature access · Hard usage caps · No production guarantees
              </p>
            </div>

            <div className="space-y-16 max-w-[100rem] mx-auto">
            {pricingRows.map((row, rowIndex) => (
              <div key={rowIndex} className="flex flex-col items-stretch gap-4">
                <div className="text-left mb-2">
                  <h3 className="text-xl font-inter font-medium" style={{ color: '#000000' }}>
                    {row.name}
                  </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-1">
                  {row.cards.map((card, cardIndex) => {
                    const globalCardIndex = rowIndex * 3 + cardIndex;
                    const isRuntime = row.name === "Runtime";
                    const isHybrid = row.name === "Hybrid";
                    
                    return (
                      <div
                        key={cardIndex}
                        className="relative transition-all duration-300 w-full min-h-[450px]"
                        style={{
                          backgroundColor: '#f6f6f4',
                          border: '1px solid rgba(156, 163, 175, 0.3)'
                        }}
                      >
                        <div className="p-6 flex flex-col h-full">
                          <div className="flex-grow">
                            <h3 className="text-lg mb-2 font-inter" style={{ color: '#000000' }}>
                              {card.name}
                            </h3>
                            {(isRuntime || isHybrid) && (
                              <p className="text-xs text-gray-500 font-inter mb-4">
                                {isRuntime ? "Self-hosted governed execution runtime" : "Cryptographic trust layer between decision and execution"}
                              </p>
                            )}

                            <div className="mb-6">
                              <div className="flex items-baseline">
                                <span className="text-base font-inter" style={{ color: '#000000' }}>
                                  {card.price}
                                </span>
                                {card.period && (
                                  <span className="ml-2 text-gray-600 font-inter text-sm">
                                    /{card.period}
                                  </span>
                                )}
                              </div>
                            </div>

                            <ul className="space-y-2">
                              {card.features.map((feature, featureIndex) => (
                                <li key={featureIndex} className="flex items-start">
                                  <Check className="h-3 w-3 mr-3 flex-shrink-0 mt-0.5" style={{ color: '#000000' }} />
                                  <span className="text-xs text-gray-700 font-inter">{feature}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                                          <button
                            onClick={openEarlyAccessModal}
                            className="inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 rounded-lg transition-all duration-200 text-xs font-inter self-start mt-8 text-white hover:bg-gray-800 border border-black"
                            style={{ backgroundColor: '#000000', minWidth: 'auto' }}
                          >
                            Get Started
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
