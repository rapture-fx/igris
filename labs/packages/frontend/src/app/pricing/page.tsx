'use client'

import Link from 'next/link'
import { ArrowRight, CheckCircle, X, Zap, Shield, Users, Star, Brain } from 'lucide-react'
import { Footer } from '@/components/layout/Footer'
import { pricing } from '@schlep/pricing-config'

const PricingPage = () => {
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

  const plans = [
    {
      key: 'starter',
      name: pricing.tiers.starter.name,
      price: `$${pricing.tiers.starter.base_price_monthly}`,
      period: "/month",
      description: "Perfect for teams getting started with inference orchestration",
      features: [
        `${formatNumber(pricing.tiers.starter.inference_included_cpu)} CPU inferences/month`,
        `${pricing.tiers.starter.models_included} CPU model deployments`,
        "gRPC + REST inference APIs",
        "Basic monitoring",
        `${pricing.tiers.starter.sla_uptime}% SLA uptime`,
        "Community support"
      ],
      limitations: [
        "No GPU acceleration",
        "No multi-model routing",
        "No advanced monitoring"
      ],
      popular: false,
      cta: "Start Free Trial",
      icon: <Zap className="w-6 h-6" />
    },
    {
      key: 'professional',
      name: pricing.tiers.professional.name,
      price: `$${pricing.tiers.professional.base_price_monthly}`,
      period: "/month",
      description: "For production ML workloads with GPU acceleration",
      features: [
        `${formatNumber(pricing.tiers.professional.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.professional.inference_included_gpu)} GPU inferences/month`,
        `${pricing.tiers.professional.models_included} model deployments (CPU + GPU)`,
        "GPU acceleration (CUDA/TensorRT)",
        "Multi-Model Routing (Thompson Sampling)",
        "Streaming Inference (WebSocket/SSE)",
        "Advanced monitoring dashboard",
        `${pricing.tiers.professional.sla_uptime}% SLA uptime`,
        "24/7 email support"
      ],
      limitations: [
        "No on-premise deployment"
      ],
      popular: true,
      cta: "Start Free Trial",
      icon: <Brain className="w-6 h-6" />
    },
    {
      key: 'enterprise',
      name: pricing.tiers.enterprise.name,
      price: `$${pricing.tiers.enterprise.base_price_monthly}`,
      period: "/month",
      description: "For large-scale inference with drift detection and tracing",
      features: [
        `${formatNumber(pricing.tiers.enterprise.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.enterprise.inference_included_gpu)} GPU inferences/month`,
        `${pricing.tiers.enterprise.models_included} model deployments (CPU + GPU)`,
        "Priority GPU access",
        "Drift detection & monitoring",
        "Distributed tracing (Jaeger access)",
        "Custom SLA agreements",
        "Dedicated account manager",
        `${pricing.tiers.enterprise.sla_uptime}% SLA uptime`,
        "Priority support (<4hr response)"
      ],
      limitations: [],
      popular: false,
      cta: "Contact Sales",
      icon: <Shield className="w-6 h-6" />
    }
  ]

  const faqs = [
    {
      question: "What counts as an inference?",
      answer: "Each prediction request to your deployed model counts as one inference. This includes both CPU and GPU inference requests. Batch operations count as one inference per item in the batch."
    },
    {
      question: "Can I change plans anytime?",
      answer: "Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the billing accordingly. Your deployed models remain intact when switching plans."
    },
    {
      question: "What ML frameworks do you support?",
      answer: "We support all major ML frameworks including TensorFlow, PyTorch, scikit-learn, XGBoost, and more. You can deploy models trained in any framework using our inference orchestration platform."
    },
    {
      question: "Is my data secure?",
      answer: "Absolutely. We use enterprise-grade security with end-to-end encryption. Your model data and inference requests are encrypted in transit and at rest. Professional and Enterprise plans include advanced security controls."
    },
    {
      question: "Do you offer refunds?",
      answer: "Yes, we offer a 30-day money-back guarantee for all paid plans. If you're not satisfied with Schlep-engine, we'll provide a full refund within the first 30 days."
    },
    {
      question: "Can I get a custom plan?",
      answer: "Yes, we work with enterprise customers to create custom plans that fit their specific needs, including volume discounts, custom features, and specialized support."
    }
  ]

  const features = [
    {
      icon: <Brain className="w-5 h-5" />,
      title: "High-Performance Inference",
      description: "Deploy models with 10,000 RPS throughput and P99 latency <100ms"
    },
    {
      icon: <Zap className="w-5 h-5" />,
      title: "GPU Acceleration",
      description: "CUDA and TensorRT optimizations for 56% faster inference"
    },
    {
      icon: <Shield className="w-5 h-5" />,
      title: "Enterprise Security",
      description: "End-to-end encryption with advanced security controls"
    },
    {
      icon: <Users className="w-5 h-5" />,
      title: "Multi-Model Routing",
      description: "Thompson Sampling for intelligent A/B testing of models"
    }
  ]

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="px-6 lg:px-8 bg-white border-b border-gray-200">
        <nav className="mx-auto flex max-w-7xl items-center justify-between p-6 lg:px-8" aria-label="Global">
          <div className="flex lg:flex-1">
            <Link href="/" className="-m-1.5 p-1.5">
              <span className="text-2xl font-bold text-gray-900">Schlep-engine</span>
            </Link>
          </div>
          <div className="flex lg:flex-1 lg:justify-end gap-x-8">
            <Link href="/documentation" className="text-sm font-semibold leading-6 text-gray-900 hover:text-blue-600">
              Documentation
            </Link>
            <Link href="/auth/signin" className="text-sm font-semibold leading-6 text-gray-900">
              Log in <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-semibold text-gray-900 mb-6 font-apple">
            Simple, transparent pricing
          </h1>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto font-apple">
            Choose the plan that fits your inference workloads. All plans include high-performance ML inference with a 14-day free trial.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center mb-12">
            <span className="text-sm text-gray-600 font-apple">Monthly billing</span>
            <div className="mx-3 text-mercury-accent font-medium text-sm font-apple">
              💰 Save 15% with annual billing
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {plans.map((plan, index) => (
              <div key={index} className={`relative bg-white rounded-2xl p-8 border-2 transition-all hover:shadow-lg ${
                plan.popular
                  ? 'border-mercury-accent shadow-lg'
                  : 'border-gray-200'
              }`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <span className="bg-mercury-accent text-white px-4 py-1 rounded-full text-sm font-medium flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      Most Popular
                    </span>
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center mb-8">
                  <div className="w-16 h-16 bg-mercury-muted rounded-lg flex items-center justify-center text-mercury-primary mx-auto mb-4">
                    {plan.icon}
                  </div>
                  <h3 className="text-2xl font-semibold text-gray-900 mb-2 font-apple">{plan.name}</h3>
                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900 font-apple">{plan.price}</span>
                    {plan.period && <span className="text-lg text-gray-500 font-apple">{plan.period}</span>}
                  </div>
                  <p className="text-gray-600 font-apple">{plan.description}</p>
                </div>

                {/* Features */}
                <div className="mb-8">
                  <h4 className="font-semibold text-gray-900 mb-4 font-apple">Everything included:</h4>
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start text-sm text-gray-600 font-apple">
                        <CheckCircle className="w-4 h-4 text-mercury-accent mr-3 mt-0.5 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plan.limitations.length > 0 && (
                    <div className="mt-6">
                      <h5 className="text-sm font-medium text-gray-500 mb-2 font-apple">Not included:</h5>
                      <ul className="space-y-2">
                        {plan.limitations.map((limitation, idx) => (
                          <li key={idx} className="flex items-start text-sm text-gray-400 font-apple">
                            <X className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
                            {limitation}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <Link
                  href="/dashboard"
                  className={`w-full py-3 px-6 rounded-lg font-semibold text-center transition-all duration-200 inline-flex items-center justify-center gap-2 font-apple ${
                    plan.popular
                      ? 'bg-mercury-accent hover:bg-mercury-primary text-white hover:scale-105 hover:shadow-lg'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }`}
                >
                  {plan.cta}
                  <ArrowRight className="w-4 h-4" />
                </Link>

                {plan.price !== "Custom" && (
                  <p className="text-xs text-gray-500 text-center mt-3 font-apple">
                    14-day free trial • No credit card required
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Comparison */}
      <section className="py-16 bg-gray-50 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-4 font-apple">
              Everything you need for production ML
            </h2>
            <p className="text-lg text-gray-600 font-apple">
              All plans include these powerful features for high-performance inference orchestration
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div key={index} className="bg-white p-6 rounded-lg text-center">
                <div className="w-12 h-12 bg-mercury-muted rounded-lg flex items-center justify-center text-mercury-primary mx-auto mb-4">
                  {feature.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 font-apple">{feature.title}</h3>
                <p className="text-sm text-gray-600 font-apple">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold text-gray-900 mb-4 font-apple">
              Frequently asked questions
            </h2>
            <p className="text-lg text-gray-600 font-apple">
              Everything you need to know about Schlep-engine pricing
            </p>
          </div>

          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div key={index} className="bg-white p-6 rounded-lg border border-gray-200">
                <h3 className="font-semibold text-gray-900 mb-2 font-apple">{faq.question}</h3>
                <p className="text-gray-600 font-apple">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-mercury-muted px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-semibold text-gray-900 mb-4 font-apple">
            Ready for production ML inference?
          </h2>
          <p className="text-lg text-gray-600 mb-8 font-apple">
            Start deploying high-performance models with our inference orchestration platform
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dashboard"
              className="px-8 py-4 bg-mercury-accent hover:bg-mercury-primary text-white font-semibold rounded-lg transition-all hover:scale-105 hover:shadow-lg inline-flex items-center justify-center gap-2 font-apple"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/enterprise"
              className="px-8 py-4 border border-gray-300 text-gray-700 hover:bg-white font-semibold rounded-lg transition-colors font-apple"
            >
              Talk to Sales
            </Link>
          </div>

          <p className="text-sm text-gray-500 mt-4 font-apple">
            Questions? <a href="mailto:sales@Schlep-engine.com" className="text-mercury-primary hover:text-mercury-accent">Contact our sales team</a>
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}

export default PricingPage
