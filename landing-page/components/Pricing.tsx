'use client'

import { motion } from 'framer-motion'
import { Check, ArrowRight, Star, Zap } from 'lucide-react'

export default function Pricing() {
  const plans = [
    {
      name: "Starter",
      price: "Free",
      description: "Perfect for trying out Schlep Engine",
      features: [
        "Up to 1,000 rows per dataset",
        "5 datasets per month",
        "Basic transformations",
        "CSV & JSON support",
        "Email support",
        "API access"
      ],
      cta: "Get Started",
      popular: false,
      color: "border-gray-200"
    },
    {
      name: "Professional",
      price: "$49",
      period: "/month",
      description: "For data scientists and ML engineers",
      features: [
        "Up to 1M rows per dataset",
        "Unlimited datasets",
        "Advanced AI transformations",
        "All file formats",
        "Priority support",
        "Custom integrations",
        "Data versioning",
        "Team collaboration"
      ],
      cta: "Start Free Trial",
      popular: true,
      color: "border-soft-blue ring-2 ring-soft-blue"
    },
    {
      name: "Enterprise",
      price: "Custom",
      description: "For large teams and organizations",
      features: [
        "Unlimited everything",
        "Custom AI models",
        "On-premise deployment",
        "SSO & SAML",
        "24/7 phone support",
        "Custom SLA",
        "Dedicated success manager",
        "Advanced security"
      ],
      cta: "Contact Sales",
      popular: false,
      color: "border-gray-200"
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    <section id="pricing" className="section-padding bg-white">
      <div className="max-w-7xl mx-auto container-padding">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-soft-gray text-soft-blue text-sm font-medium mb-6"
          >
            <Star className="w-4 h-4 mr-2" />
            Pricing Plans
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-section font-bold text-gray-900 mb-6"
          >
            Choose the perfect plan for your needs
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto"
          >
            Start free and scale as you grow. All plans include our core AI-powered 
            data preparation features with no hidden fees.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8"
        >
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`relative bg-white rounded-2xl p-8 shadow-lg border-2 ${plan.color} ${
                plan.popular ? 'transform scale-105' : ''
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-soft-blue text-white px-4 py-2 rounded-full text-sm font-medium flex items-center">
                    <Zap className="w-4 h-4 mr-1" />
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center mb-8">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  {plan.name}
                </h3>
                <p className="text-gray-600 mb-6">
                  {plan.description}
                </p>
                <div className="flex items-center justify-center">
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

              <ul className="space-y-4 mb-8">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start">
                    <Check className="w-5 h-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </li>
                ))}
              </ul>

              <a
                href="#"
                className={`w-full text-center py-3 px-6 rounded-xl font-medium transition-all duration-300 inline-flex items-center justify-center ${
                  plan.popular
                    ? 'bg-soft-blue hover:bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                }`}
              >
                {plan.cta}
                <ArrowRight className="ml-2 w-4 h-4" />
              </a>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="bg-gray-50 rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              All plans include
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-600">
              <div>✓ 99.9% uptime SLA</div>
              <div>✓ SOC 2 Type II compliance</div>
              <div>✓ End-to-end encryption</div>
              <div>✓ GDPR & CCPA compliant</div>
              <div>✓ 30-day money-back guarantee</div>
              <div>✓ No setup fees</div>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-600 mb-4">
            Need a custom solution? We offer volume discounts and custom pricing.
          </p>
          <a
            href="#"
            className="text-soft-blue hover:text-blue-600 font-medium"
          >
            Contact our sales team →
          </a>
        </motion.div>
      </div>
    </section>
  )
}