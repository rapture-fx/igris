'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

const pricingTiers = [
  {
    name: "Developer",
    price: "$399",
    period: "month",
    description: "Perfect for individual developers and small projects",
    features: [
      "100K requests/month",
      "Basic multi-provider routing",
      "Thompson Sampling optimization",
      "Email support",
      "Community access"
    ],
    cta: "Start Develop",
    highlighted: false
  },
  {
    name: "Founders'",
    price: "$499",
    period: "month",
    description: "Special limited-time offer for early adopters",
    features: [
      "500K requests/month",
      "Multi-tenancy with BYOK",
      "Advanced routing algorithms",
      "Priority support",
      "Custom integrations",
      "Dedicated Slack channel"
    ],
    cta: "Get started",
    highlighted: true,
    badge: ""
  },
  {
    name: "Growth",
    price: "$999",
    period: "month",
    description: "For growing teams and production workloads",
    features: [
      "2M requests/month",
      "Full multi-tenancy suite",
      "Advanced analytics dashboard",
      "24/7 priority support",
      "Custom SLA guarantees",
      "Dedicated solutions engineer"
    ],
    cta: "Start Growth",
    highlighted: false
  },
  {
    name: "Scale",
    price: "$2,499",
    period: "contact sales",
    description: "Tailored solutions for large-scale deployments",
    features: [
      "Unlimited requests",
      "On-premise deployment option",
      "Custom provider integrations",
      "White-label support",
      "Dedicated infrastructure",
      "Custom contract terms"
    ],
    cta: "Scale Up",
    highlighted: false
  }
];

export default function Pricing() {
  const { openEarlyAccessModal } = useModal();

  return (
    <section id="pricing" className="py-16 sm:py-20 lg:py-24 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-inter mb-4" style={{ color: '#000000' }}>
            Pricing
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 font-inter max-w-2xl mx-auto">
            All plans include a 14-day free trial.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`relative rounded-2xl transition-all duration-300 min-h-[500px] ${
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

              <div className="p-8 flex flex-col justify-between h-full">
                <div>
                  <h3 className="text-2xl mb-2 font-inter" style={{ color: '#000000' }}>
                    {tier.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-6 font-inter">
                    {tier.description}
                  </p>

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

                  <ul className="space-y-3 mb-8">
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
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm font-inter self-start ${
                    tier.highlighted
                      ? 'text-white hover:opacity-90 border border-black'
                      : 'text-black hover:opacity-70 border border-gray-300'
                  }`}
                  style={{
                    backgroundColor: tier.highlighted ? '#000000' : '#f6f6f4'
                  }}
                >
                  {tier.cta}
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-24">
          <h3 className="text-3xl font-inter text-center mb-12" style={{ color: '#000000' }}>
            Feature Comparison
          </h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-[#f6f6f4] dark:bg-gray-800">
                <tr>
                  <th scope="col" className="py-3.5 px-6 text-left text-sm font-semibold text-gray-900 dark:text-white">
                    Feature
                  </th>
                  {pricingTiers.map(tier => (
                    <th key={tier.name} scope="col" className="py-3.5 px-6 text-center text-sm font-semibold text-gray-900 dark:text-white">
                      {tier.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-[#f6f6f4] dark:bg-gray-900">
                {([...new Set(pricingTiers.flatMap(tier => tier.features))]).map(feature => (
                  <tr key={feature}>
                    <td className="py-4 px-6 text-sm font-medium text-gray-900 dark:text-white">
                      {feature}
                    </td>
                    {pricingTiers.map(tier => (
                      <td key={tier.name} className="py-4 px-6 text-center">
                        {tier.features.includes(feature) ? (
                          <Check className="h-5 w-5 mx-auto" style={{ color: '#16A34A' }} />
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>


        <div className="mt-12 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
            All plans include Thompson Sampling optimization, real-time analytics, and automatic failover.
          </p>
        </div>
      </div>
    </section>
  );
}
