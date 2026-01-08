'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

const pricingTiers = [
  {
    name: "Develop",
    price: "$149",
    period: "month",
    features: [
      "Unkillable Core (EscapeVector, Gold Code, Hotfix, Rust WASM)",
      "500K requests/month",
      "Overage: $0.25 per 1,000 requests after 500k",
      "Up to 5 AI providers (BYOK)",
      "Thompson Sampling routing",
      "Quality-aware routing (Cost/Balanced/Quality)",
      "Circuit breaker & automatic failover",
      "Real-time cost tracking & forecasting",
      "Redis caching for low latency",
      "150+ observability metrics",
      "Automatic request classification"
    ],
    cta: "Get Started",
    highlighted: false
  },
  {
    name: "Growth",
    price: "$899",
    period: "month",
    features: [
      "Everything in Develop +",
      "2M requests/month & 10 providers",
      "Overage: $0.20 per 1,000 requests after 2M",
      "Speculative execution (-60% TTFT)",
      "Council mode (quality +15-20%)",
      "Cognitive advisor (auto-tune routing)",
      "Basic observability (1k requests, charts, 30-day retention)",
      "Basic SLO enforcement & monitoring",
      "Policy versioning with hot reload",
      "Audit logs & compliance tracking",
      "Multi-tenant support (up to 5 tenants)"
    ],
    cta: "Start Growth",
    highlighted: false
  },
  {
    name: "Scale",
    price: "$2,999",
    period: "month",
    features: [
      "Everything in Growth +",
      "Unlimited requests (1000 RPS sustained)",
      "Up to 20 providers",
      "90-day trace retention + full multi-tenant observability",
      "Advanced observability (100k traces, alerts, exports)",
      "Advanced SLO enforcement & auto-remediation",
      "Hard budget caps & enforcement",
      "Self-hosted Kubernetes deployment",
      "Custom provider adapter support",
      "Advanced audit logging & security",
      "Unlimited multi-tenancy"
    ],
    cta: "Scale Up",
    highlighted: false
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
           <div className="max-w-[1100px] mx-auto pt-48 px-0 md:px-8 lg:px-16 pb-12">
            <div className="text-center mb-16 pb-12">
              <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Pricing
              </h2>
              <p className="text-base text-gray-700 dark:text-gray-300 font-inter max-w-3xl mx-auto mb-3">
                Pricing reflects operational features commonly required for production AI systems, including routing, observability, and cost controls.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter max-w-2xl mx-auto">
                14-day free trial · Full tier access · No card required
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch max-w-[84rem] mx-auto">
            {pricingTiers.map((tier, index) => (
              <div
                key={index}
                className="relative transition-all duration-300 w-full min-h-[500px]"
                style={{
                  backgroundColor: '#f6f6f4',
                  border: '1px solid rgba(156, 163, 175, 0.3)'
                }}
              >
                <div className="p-8 flex flex-col h-full">
                  <div className="flex-grow">
                    <h3 className="text-2xl mb-2 font-inter" style={{ color: '#000000' }}>
                      {tier.name}
                    </h3>

                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-lg font-inter" style={{ color: '#000000' }}>
                          {tier.price}
                        </span>
                        {tier.period && (
                          <span className="ml-2 text-gray-600 font-inter">
                            /{tier.period}
                          </span>
                        )}
                      </div>
                    </div>

                    <ul className="space-y-2.5">
                      {tier.features.map((feature, featureIndex) => (
                        <li key={featureIndex} className="flex items-start">
                          <Check className="h-4 w-4 mr-3 flex-shrink-0 mt-0.5" style={{ color: '#000000' }} />
                          <span className="text-sm text-gray-700 font-inter">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <button
                    onClick={openEarlyAccessModal}
                    className={`inline-flex items-center px-3 py-1 md:px-4 md:py-1.5 rounded-lg transition-all duration-200 text-xs md:text-sm font-inter self-start mt-8 ${
                      index === 2
                        ? 'text-black hover:opacity-70 border border-gray-300'
                        : 'text-white hover:bg-gray-800 border border-black'
                    }`}
                    style={{ backgroundColor: index === 2 ? '#f6f6f4' : '#000000' }}
                  >
                    {tier.cta}
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
