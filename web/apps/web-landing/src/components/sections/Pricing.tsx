'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

const pricingTiers = [
  {
    name: "Develop",
    price: "$249",
    period: "month",
    features: [
      "500K requests/month",
      "Up to 5 AI providers (BYOK)",
      "Smart routing with Thompson Sampling",
      "Real-time cost tracking & forecasting",
      "Redis caching for low latency",
      "150+ observability metrics",
      "Quality-aware routing (Cost/Balanced/Quality modes)",
      "Automatic request classification",
      "Real-time quality scoring",
      "Multi-factor optimization"
    ],
    cta: "Get started",
    highlighted: false,
    badge: ""
  },
  {
    name: "Growth",
    price: "$799",
    period: "month",
    features: [
      "Everything in Develop +",
      "2M requests/month & 10 providers",
      "SLA enforcement & monitoring",
      "Policy versioning with hot reload",
      "Audit logs & compliance tracking",
      "Multi-tenant support (up to 5 tenants)"
    ],
    cta: "Start Growth",
    highlighted: false
  },
  {
    name: "Scale",
    price: "$1,899",
    period: "month",
    features: [
      "Everything in Growth +",
      "Unlimited requests (1000 RPS sustained)",
      "Up to 20 providers",
      "Self-hosted Kubernetes deployment",
      "Custom provider adapter support",
      "Advanced audit logging & security"
    ],
    cta: "Scale Up",
    highlighted: false
  }
];


export default function Pricing() {
  const { openEarlyAccessModal } = useModal();

  return (
    <section id="pricing" className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          <div className="text-center mb-16">
            <h2 className="text-2xl tracking-tight md:text-3xl font-normal font-inter mb-4" style={{ color: '#000000' }}>
              Pricing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 font-inter max-w-2xl mx-auto">
              All plans include a 14-day free trial.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch max-w-[84rem] mx-auto">
            {pricingTiers.map((tier, index) => (
              <div
                key={index}
                className={`relative rounded-2xl transition-all duration-300 w-full min-h-[500px] ${
                  tier.highlighted
                    ? 'border-2'
                    : ''
                }`}
                style={{
                  backgroundColor: tier.highlighted ? '#f6f6f4' : '#f6f6f4',
                  borderColor: tier.highlighted ? 'rgba(156, 163, 175, 0.3)' : 'rgba(156, 163, 175, 0.3)',
                  border: tier.highlighted ? '1px solid rgba(156, 163, 175, 0.3)' : '1px solid rgba(156, 163, 175, 0.3)'
                }}
              >
                {tier.badge && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="inline-block px-4 py-1 text-xs font-semibold text-white rounded-full font-inter" style={{ backgroundColor: '#1f53d0' }}>
                      {tier.badge}
                    </span>
                  </div>
                )}

                <div className="p-8 flex flex-col h-full">
                  <div className="flex-grow">
                    <h3 className="text-2xl mb-2 font-inter" style={{ color: '#000000' }}>
                      {tier.name}
                    </h3>

                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-2xl font-inter" style={{ color: '#000000' }}>
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
                    className={`inline-flex items-center px-6 py-3 rounded-lg transition-all duration-200 font-semibold text-base font-inter self-start mt-8 ${
                      tier.highlighted
                        ? 'text-white hover:opacity-90 border border-black'
                        : 'text-black hover:opacity-70 border border-gray-300'
                    }`}
                    style={{
                      backgroundColor: tier.highlighted ? '#000000' : '#f6f6f4',
                      minHeight: '44px'
                    }}
                  >
                    {tier.cta}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
