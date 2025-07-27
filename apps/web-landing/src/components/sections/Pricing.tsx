'use client'

import { Check, Star } from 'lucide-react'
import Link from 'next/link'

export default function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "$0",
      period: "/month",
      description: "Perfect for trying out Schlep-engine",
      features: [
        "100 API calls/month",
        "Basic data cleaning",
        "Community support",
        "Standard formats"
      ],
      cta: "Start Free",
      popular: false,
      ctaLink: "#get-started"
    },
    {
      name: "Professional",
      price: "$99",
      period: "/month",
      description: "For data scientists and ML engineers",
      features: [
        "10,000 API calls/month",
        "Advanced AI features",
        "Priority support",
        "All export formats",
        "Advanced analytics"
      ],
      cta: "Start Trial",
      popular: true,
      ctaLink: "#get-started"
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      description: "For large teams and organizations",
      features: [
        "Unlimited API calls",
        "Custom integrations",
        "Dedicated support",
        "SLA guarantees",
        "On-premise options"
      ],
      cta: "Contact Sales",
      popular: false,
      ctaLink: "#contact"
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Start free and scale as you grow. All plans include our core AI-powered data preparation features.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`relative bg-white rounded-lg p-8 shadow-sm border ${
                plan.popular 
                  ? 'border-[#468BE6] ring-2 ring-[#468BE6] ring-opacity-20 transform scale-105' 
                  : 'border-gray-200'
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-[#468BE6] text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
                    <Star className="w-4 h-4 mr-1" />
                    Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 mb-6 text-sm">
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center">
                  <span className="text-4xl font-bold text-gray-900">
                    {plan.price}
                  </span>
                  {plan.period && (
                    <span className="text-gray-600 ml-2">
                      {plan.period}
                    </span>
                  )}
                </div>
              </div>

              <ul className="space-y-3 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="w-5 h-5 text-[#10b981] mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 text-sm">{feature}</span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.ctaLink}
                className={`w-full text-center py-3 px-6 rounded-lg font-medium transition-colors duration-200 inline-block ${
                  plan.popular
                    ? 'bg-[#468BE6] hover:bg-[#3a7bd5] text-white'
                    : plan.name === 'Enterprise'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}