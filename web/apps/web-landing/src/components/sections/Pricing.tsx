'use client';

import React from 'react';
import { Check } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';

const pricingTiers = [
  {
    name: "Develop",
    price: "$99",
    period: "month",
    description: "Perfect for individual developers and small teams",
    features: [
      "500K requests/month",
      "Up to 5 AI providers (BYOK)",
      "Multi-tenancy with full isolation",
      "Thompson Sampling optimization",
      "ML-powered semantic routing",
      "Bayesian adaptive learning",
      "Cost forecasting & tracking",
      "Redis-based caching (L1)",
      "Real-time observability (150+ metrics)",
      "RBAC + JWT/API Key auth",
      "Circuit breaker & auto-failover",
      "Priority support",
      "Custom integrations"
    ],
    cta: "Get started",
    highlighted: false,
    badge: ""
  },
  {
    name: "Growth",
    price: "$299",
    period: "month",
    description: "For growing teams and production workloads",
    features: [
      "2M requests/month",
      "Up to 10 AI providers (BYOK)",
      "Advanced analytics dashboard",
      "SLA enforcement & monitoring",
      "Policy versioning with hot reload",
      "Adaptive governance engine",
      "Audit logs & compliance tracking",
      "Real-time cost optimization",
      "Multi-tenant management (5 tenants)",
      "RBAC with role-based policies",
      "24/7 priority support",
      "Custom SLA guarantees",
      "Dedicated solutions engineer"
    ],
    cta: "Start Growth",
    highlighted: false
  },
  {
    name: "Scale",
    price: "$599",
    period: "month",
    description: "Enterprise-grade for large-scale deployments",
    features: [
      "Unlimited requests (1000 RPS sustained)",
      "Up to 20 AI providers (BYOK)",
      "On-premise deployment (Kubernetes)",
      "Self-hosted deployment option",
      "ONNX model framework integration",
      "Advanced security & tenant isolation",
      "Full audit logs & compliance",
      "Kubernetes-native with Helm charts",
      "Custom provider adapters",
      "Multi-region infrastructure ready",
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
            All plans include a 14-day free trial. All plans include Thompson Sampling optimization, real-time analytics, and automatic failover.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch max-w-[84rem] mx-auto">
          {pricingTiers.map((tier, index) => (
            <div
              key={index}
              className={`relative rounded-2xl transition-all duration-300 w-full ${
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
                  className={`inline-flex items-center px-4 py-2 rounded-lg transition-all duration-200 font-semibold text-sm font-inter self-start mt-8 ${
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
          <h3 className="text-3xl font-inter text-center mb-4" style={{ color: '#000000' }}>
            Feature Comparison
          </h3>
          <p className="text-center text-sm text-gray-600 mb-8 font-inter">
            Compare features across all pricing tiers
          </p>
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="inline-block min-w-full align-middle">
              <div className="overflow-hidden border border-gray-200 rounded-lg">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-[#f6f6f4] dark:bg-gray-800">
                    <tr>
                      <th scope="col" className="sticky left-0 z-10 bg-[#f6f6f4] py-3 px-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                        Feature
                      </th>
                      {pricingTiers.map(tier => (
                        <th key={tier.name} scope="col" className="py-3 px-3 text-center text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider whitespace-nowrap">
                          {tier.name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-[#f6f6f4] dark:bg-gray-900">
                    {([...new Set(pricingTiers.flatMap(tier => tier.features))]).map((feature, idx) => (
                      <tr key={feature} className={idx % 2 === 0 ? 'bg-[#f6f6f4]' : 'bg-[#f6f6f4]'}>
                        <td className="sticky left-0 z-10 py-3 px-4 text-xs text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
                          {feature}
                        </td>
                        {pricingTiers.map(tier => (
                          <td key={tier.name} className="py-3 px-3 text-center">
                            {tier.features.includes(feature) ? (
                              <Check className="h-4 w-4 mx-auto" style={{ color: '#16A34A' }} />
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>



        <div className="mt-24">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="md:col-span-1">
              <h3 className="text-3xl font-inter font-semibold" style={{ color: '#000000' }}>
                Frequently Asked Questions
              </h3>
            </div>
            <div className="md:col-span-2 space-y-8">
              {/* FAQ Item 1 */}
              <div>
                <h4 className="text-xl font-inter font-semibold mb-2" style={{ color: '#000000' }}>
                  What is Schlep Engine?
                </h4>
                <p className="text-gray-700 font-inter">
                  Schlep Engine is an advanced routing and optimization platform designed for modern microservices architectures. It helps you intelligently route requests, optimize resource utilization, and ensure high availability.
                </p>
              </div>
              {/* FAQ Item 2 */}
              <div>
                <h4 className="text-xl font-inter font-semibold mb-2" style={{ color: '#000000' }}>
                  How does the free trial work?
                </h4>
                <p className="text-gray-700 font-inter">
                  All plans include a 14-day free trial. You'll have full access to all features of your chosen plan during this period. No credit card is required to start the trial.
                </p>
              </div>
              {/* FAQ Item 3 */}
              <div>
                <h4 className="text-xl font-inter font-semibold mb-2" style={{ color: '#000000' }}>
                  Can I change my plan later?
                </h4>
                <p className="text-gray-700 font-inter">
                  Yes, you can upgrade or downgrade your plan at any time. Changes will be prorated and reflected in your next billing cycle.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
