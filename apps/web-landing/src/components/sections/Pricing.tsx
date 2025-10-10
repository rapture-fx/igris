'use client';

import { Check, ChevronDown, ChevronUp, Zap, Users, Shield, Headphones, Cpu, Activity, Gauge, Brain } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

// Import canonical pricing from @schlep/pricing-config
import { pricing } from '@schlep/pricing-config'

export default function Pricing() {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
  const [openFaqItems, setOpenFaqItems] = useState<string[]>([])
  const [openFeatureCategories, setOpenFeatureCategories] = useState<number[]>([])

  const toggleFaqItem = (itemId: string) => {
    setOpenFaqItems(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    )
  }

  const toggleFeatureCategory = (categoryIndex: number) => {
    setOpenFeatureCategories(prev =>
      prev.includes(categoryIndex)
        ? prev.filter(index => index !== categoryIndex)
        : [...prev, categoryIndex]
    )
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

  const getPrice = (tierKey: 'starter' | 'professional' | 'enterprise') => {
    const tier = pricing.tiers[tierKey]
    const price = billingPeriod === 'yearly'
      ? Math.round(tier.base_price_yearly / 12)
      : tier.base_price_monthly
    return price
  }

  const faqData = [
    {
      category: "General Pricing",
      items: [
        {
          id: "free-trial",
          question: "Is there a free trial?",
          answer: "Yes! All plans come with a free trial period. You can test our inference orchestration platform before making any commitment."
        },
        {
          id: "api-limits",
          question: "What happens if I exceed my inference limits?",
          answer: "You'll receive notifications as you approach your limits. You can upgrade your plan anytime or purchase additional inference capacity through our self-service portal."
        },
        {
          id: "change-plans",
          question: "Can I change plans anytime?",
          answer: "Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated."
        },
        {
          id: "annual-discount",
          question: "Do you offer annual discounts?",
          answer: "Yes! Choose yearly billing to get 15% discount on all plans."
        }
      ]
    },
    {
      category: "Technical & Features",
      items: [
        {
          id: "supported-frameworks",
          question: "Which ML frameworks are supported?",
          answer: "We support all major ML frameworks including TensorFlow, PyTorch, scikit-learn, XGBoost, and more. Our fabric automatically optimizes models from any framework with Thompson sampling routing and multi-tier caching."
        },
        {
          id: "model-deployment",
          question: "How do model deployments work?",
          answer: "Deploy models to our AI fabric with automatic optimization. Professional tier includes 5 concurrent models with intelligent routing, Enterprise supports up to 25 with dedicated infrastructure. Models automatically get Thompson sampling routing and cost optimization."
        },
        {
          id: "inference-quotas",
          question: "How do inference quotas work?",
          answer: "Our quotas deliver optimized AI predictions with sub-10ms latency and 94%+ cache hit rates. Starter: 500k CPU inferences, Professional: 5M CPU + 500k GPU with Thompson sampling, Enterprise: 50M CPU + 5M GPU with priority routing. Costs automatically optimize based on performance."
        },
        {
          id: "data-security",
          question: "Is my data secure?",
          answer: "Yes! All plans include encryption in transit and at rest. Professional and Enterprise plans add advanced security features and monitoring."
        },
        {
          id: "sla-guarantees",
          question: "What are the SLA guarantees?",
          answer: "Each tier includes uptime guarantees: Starter offers 99.0% uptime, Professional provides 99.5% uptime, and Enterprise delivers 99.9% uptime with priority infrastructure and Thompson sampling optimization."
        },
        {
          id: "thompson-sampling",
          question: "What is Thompson sampling routing?",
          answer: "Our intelligent routing automatically selects the optimal model based on real-time performance metrics, cost efficiency, and accuracy. This typically delivers 20-40% cost savings and 10-30% latency improvement. Available on Professional and Enterprise tiers."
        }
      ]
    },
    {
      category: "Support & Scale Solutions",
      items: [
        {
          id: "support-levels",
          question: "What support do I get?",
          answer: "Starter includes community support. Professional and Enterprise plans get 24/7 email support, with Enterprise receiving <4 hour response times and dedicated account management."
        },
        {
          id: "custom-quote",
          question: "Can I get a custom quote?",
          answer: "Absolutely! If you have specific requirements or need higher limits, our team can create a custom plan tailored to your needs. Contact our sales team."
        },
        {
          id: "cache-performance",
          question: "How does the multi-tier cache system work?",
          answer: "Our L1/L2/L3 cache coherence ensures 94%+ cache hit rates, delivering sub-10ms response times. Professional tier includes intelligent caching, while Enterprise adds dedicated cache nodes and custom cache policies."
        },
        {
          id: "refund-policy",
          question: "What's your refund policy?",
          answer: "We offer a 30-day money-back guarantee on all plans. If you're not satisfied, we'll provide a full refund within the first 30 days."
        }
      ]
    }
  ];

  const plans = [
    {
      key: 'starter' as const,
      name: pricing.tiers.starter.name,
      cta: "Start Starter trial",
      ctaLink: "/auth/register",
      tagline: `Perfect for teams getting started with inference orchestration.\nDeploy up to ${pricing.tiers.starter.models_included} CPU models with ${formatNumber(pricing.tiers.starter.inference_included_cpu)} monthly inferences.`,
      highlights: [
        { icon: Activity, text: `${formatNumber(pricing.tiers.starter.inference_included_cpu)} CPU inferences/month` },
        { icon: Cpu, text: `${pricing.tiers.starter.models_included} CPU model deployments` },
        { icon: Brain, text: "gRPC + REST inference APIs" },
        { icon: Gauge, text: "Basic monitoring dashboard" },
        { icon: Shield, text: `${pricing.tiers.starter.sla_uptime}% SLA + encryption` },
        { icon: Headphones, text: "Community support" }
      ]
    },
    {
      key: 'professional' as const,
      name: pricing.tiers.professional.name,
      cta: "Start Professional trial",
      ctaLink: "/auth/register",
      tagline: `Enhanced performance for production ML workloads.\nDeploy up to ${pricing.tiers.professional.models_included} models with GPU acceleration.`,
      popular: true,
      highlights: [
        { icon: Activity, text: `${formatNumber(pricing.tiers.professional.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.professional.inference_included_gpu)} GPU inferences/month` },
        { icon: Cpu, text: `${pricing.tiers.professional.models_included} model deployments (CPU + GPU)` },
        { icon: Zap, text: "GPU acceleration + CUDA/TensorRT" },
        { icon: Brain, text: "Multi-Model Routing (Thompson Sampling)" },
        { icon: Activity, text: "Streaming Inference (WebSocket/SSE)" },
        { icon: Gauge, text: "Advanced monitoring + metrics" },
        { icon: Shield, text: `${pricing.tiers.professional.sla_uptime}% SLA + enhanced security` },
        { icon: Headphones, text: "24/7 email support" }
      ]
    },
    {
      key: 'enterprise' as const,
      name: pricing.tiers.enterprise.name,
      cta: "Start Enterprise trial",
      ctaLink: "/auth/register",
      tagline: `Maximum performance for high-scale inference.\nDeploy up to ${pricing.tiers.enterprise.models_included} models with drift detection and tracing.`,
      popular: false,
      highlights: [
        { icon: Activity, text: `${formatNumber(pricing.tiers.enterprise.inference_included_cpu)} CPU + ${formatNumber(pricing.tiers.enterprise.inference_included_gpu)} GPU inferences/month` },
        { icon: Cpu, text: `${pricing.tiers.enterprise.models_included} model deployments (CPU + GPU)` },
        { icon: Zap, text: "Priority GPU access + optimization" },
        { icon: Brain, text: "All Professional features + drift detection" },
        { icon: Activity, text: "Distributed Tracing (Jaeger access)" },
        { icon: Users, text: "Dedicated account manager" },
        { icon: Shield, text: `${pricing.tiers.enterprise.sla_uptime}% SLA + custom agreements` },
        { icon: Headphones, text: "Priority support (<4hr response)" }
      ]
    }
  ];

  const features = [
    {
      category: "Inference Performance",
      icon: Cpu,
      items: [
        { name: "CPU Inferences Included", starter: formatNumber(pricing.tiers.starter.inference_included_cpu), professional: formatNumber(pricing.tiers.professional.inference_included_cpu), enterprise: formatNumber(pricing.tiers.enterprise.inference_included_cpu) },
        { name: "GPU Inferences Included", starter: "Not available", professional: formatNumber(pricing.tiers.professional.inference_included_gpu), enterprise: formatNumber(pricing.tiers.enterprise.inference_included_gpu) },
        { name: "CPU Overage (per 1k)", starter: `$${pricing.tiers.starter.overage_cpu_per_1k}`, professional: `$${pricing.tiers.professional.overage_cpu_per_1k}`, enterprise: `$${pricing.tiers.enterprise.overage_cpu_per_1k}` },
        { name: "GPU Overage (per 1k)", starter: "Not available", professional: `$${pricing.tiers.professional.overage_gpu_per_1k}`, enterprise: `$${pricing.tiers.enterprise.overage_gpu_per_1k}` },
        { name: "Model Deployments", starter: `${pricing.tiers.starter.models_included} CPU`, professional: `${pricing.tiers.professional.models_included} (CPU + GPU)`, enterprise: `${pricing.tiers.enterprise.models_included} (CPU + GPU)` },
        { name: "GPU Acceleration", starter: false, professional: true, enterprise: true }
      ]
    },
    {
      category: "Inference APIs",
      icon: Zap,
      items: [
        { name: "gRPC Inference API", starter: true, professional: true, enterprise: true },
        { name: "REST API Endpoints", starter: true, professional: true, enterprise: true },
        { name: "Streaming Inference (WebSocket/SSE)", starter: false, professional: true, enterprise: true },
        { name: "Multi-Model Routing (Thompson Sampling)", starter: false, professional: true, enterprise: true },
        { name: "Batch Inference", starter: true, professional: true, enterprise: true }
      ]
    },
    {
      category: "Monitoring & Observability",
      icon: Activity,
      items: [
        { name: "SLA Guarantees", starter: `${pricing.tiers.starter.sla_uptime}% uptime`, professional: `${pricing.tiers.professional.sla_uptime}% uptime`, enterprise: `${pricing.tiers.enterprise.sla_uptime}% uptime` },
        { name: "Basic Monitoring", starter: true, professional: true, enterprise: true },
        { name: "Advanced Monitoring Dashboard", starter: false, professional: true, enterprise: true },
        { name: "Drift Detection & Monitoring", starter: false, professional: false, enterprise: true },
        { name: "Distributed Tracing (Jaeger)", starter: false, professional: false, enterprise: true },
        { name: "Custom Dashboards", starter: false, professional: false, enterprise: true }
      ]
    },
    {
      category: "Security & Compliance",
      icon: Shield,
      items: [
        { name: "Data Encryption (in transit + at rest)", starter: true, professional: true, enterprise: true },
        { name: "Advanced Security Controls", starter: false, professional: true, enterprise: true },
        { name: "Custom SLA Agreements", starter: false, professional: false, enterprise: true },
        { name: "Dedicated Account Manager", starter: false, professional: false, enterprise: true }
      ]
    },
    {
      category: "Support & Service",
      icon: Headphones,
      items: [
        { name: "Technical Support", starter: "Community", professional: "24/7 email", enterprise: "24/7 email" },
        { name: "Priority Response Time", starter: false, professional: false, enterprise: true },
        { name: "Response Time SLA", starter: false, professional: false, enterprise: "<4 hour response" }
      ]
    }
  ];

  const renderFeatureValue = (value: any) => {
    if (typeof value === 'boolean') {
      return value ? (
        <div className="flex items-center justify-center">
          <Check className="w-5 h-5" style={{ color: '#1f53d0' }} />
        </div>
      ) : (
        <div className="flex items-center justify-center"></div>
      );
    } else {
      return <span className="text-sm text-gray-600">{value}</span>;
    }
  };

  return (
    <section>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Pricing Table Header */}
        <div className="mt-12">
          <div className="relative p-0" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
            </div>

            <div className="min-w-full">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-8" style={{ backgroundColor: '#f7f7f3' }}>
                {plans.map((plan, index) => (
                  <div key={index} className="rounded-lg p-8 h-[42rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                    <div>
                      <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">{plan.name}</h3>
                      <p className="text-4xl font-medium text-gray-900 mb-2">
                        ${getPrice(plan.key)}
                        <span className="text-lg text-gray-600">/ month</span>
                      </p>
                      {billingPeriod === 'yearly' && (
                        <p className="text-sm text-gray-500 mb-4">*billed annually - <span style={{ color: '#1f53d0' }}>Save 15%</span></p>
                      )}
                      {billingPeriod === 'monthly' && (
                        <div className="mb-4"></div>
                      )}
                      <p className="text-gray-600 leading-relaxed font-inter text-left mb-6 whitespace-pre-line">{plan.tagline}</p>

                      {/* Key Highlights */}
                      <div className="space-y-3 mb-6">
                        {plan.highlights.map((highlight, highlightIndex) => (
                          <div key={highlightIndex} className="flex items-center space-x-3">
                            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center rounded border border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                              <Check className="w-3 h-3 text-gray-600" />
                            </div>
                            <span className="text-sm text-gray-600">
                              {highlight.text}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Link
                        href={plan.ctaLink}
                        className="inline-block py-2.5 px-5 rounded-lg transition-colors duration-200 text-center font-medium shadow-md hover:shadow-lg text-gray-700 hover:bg-blue-100 hover:text-blue-600"
                        style={{ backgroundColor: '#f2f1ed' }}
                      >
                        {plan.cta}
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="mt-8">
          <div className="relative p-0" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12" style={{ backgroundColor: '#f7f7f3' }}>
              {/* Left side - Title */}
              <div className="lg:col-span-2 px-6 py-8 text-left flex items-center">
                <h2 className="text-2xl md:text-3xl font-normal" style={{ color: '#1f53d0' }}>
                  Compare the features
                </h2>
              </div>

              {/* Right side - Feature Table */}
              <div className="lg:col-span-3 p-8">
                <div className="rounded-lg p-12 min-h-[60rem] flex items-start justify-center" style={{ backgroundColor: '#f2f1ed' }}>
                  <div className="w-full min-w-full overflow-auto">
                    {/* Table Header */}
                    <div className="grid grid-cols-4 sticky top-0 z-20 shadow-sm border-b border-gray-200" style={{ backgroundColor: '#f2f1ed' }}>
                      <div className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider">
                        <h3 className="text-lg font-medium text-gray-900 mb-2">Features</h3>
                      </div>
                      {plans.map((plan, index) => (
                        <div key={index} className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider border-l border-gray-200">
                          <h3 className="text-lg font-medium text-gray-900 mb-2">{plan.name}</h3>
                        </div>
                      ))}
                    </div>

                    {/* Table Body */}
                    {features.map((category, catIndex) => {
                      const isCategoryOpen = openFeatureCategories.includes(catIndex)
                      return (
                        <React.Fragment key={catIndex}>
                          <div
                            className="grid grid-cols-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                            style={{ backgroundColor: '#f2f1ed' }}
                            onClick={() => toggleFeatureCategory(catIndex)}
                          >
                            <div className="p-4 text-left text-sm font-medium tracking-wider col-span-4 flex items-center justify-between text-gray-900">
                              <div className="flex items-center">
                                <span>{category.category}</span>
                              </div>
                              {isCategoryOpen ? (
                                <ChevronUp className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-blue-600 flex-shrink-0" />
                              )}
                            </div>
                          </div>
                          {isCategoryOpen && category.items.map((item, itemIndex) => (
                            <div key={itemIndex} className="grid grid-cols-4 border-b border-gray-200 last:border-b-0">
                              <div className="p-4 text-left text-sm text-gray-600">{item.name}</div>
                              <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.starter)}</div>
                              <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.professional)}</div>
                              <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.enterprise)}</div>
                            </div>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-8">
          <div className="relative p-0" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
            </div>
            <div>
                <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                  {/* Left side - FAQ Accordion */}
                  <div className="border-r border-gray-200 px-6 py-8 text-left">
                    <div className="space-y-6">
                      {faqData.map((category, catIndex) => (
                        <div key={catIndex}>
                          <h4 className="text-base font-medium mb-4" style={{ color: '#1f53d0' }}>
                            {category.category}
                          </h4>
                          <div className="space-y-3">
                            {category.items.map((item) => {
                              const isOpen = openFaqItems.includes(item.id)
                              return (
                                <div key={item.id} className="border-b border-gray-200 pb-3">
                                  <button
                                    className="w-full text-left flex justify-between items-center text-sm text-gray-600 hover:text-gray-900 transition-colors"
                                    onClick={() => toggleFaqItem(item.id)}
                                    type="button"
                                  >
                                    <span>{item.question}</span>
                                    {isOpen ? (
                                      <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0 ml-2" />
                                    )}
                                  </button>
                                  {isOpen && (
                                    <div className="mt-2">
                                      <p className="text-gray-600 leading-relaxed text-sm">{item.answer}</p>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right side - FAQ Title */}
                  <div className="px-6 py-8 text-left flex items-center">
                    <h3 className="text-2xl md:text-3xl font-normal mb-6" style={{ color: '#1f53d0' }}>
                      Frequently Asked<br />Questions
                    </h3>
                  </div>
                </div>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-6">
          <div className="text-left p-0 relative" style={{
              backgroundColor: '#f7f7f3',
              borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
            }}>
              {/* Bottom right bleeding cross */}
              <div className="absolute -bottom-4 -right-4 w-8 h-8">
                <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
                <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-6 py-8">
                <div className="text-left">
                  <h3 className="text-2xl md:text-3xl font-normal mb-4 leading-tight" style={{ color: '#1f53d0' }}>
                    Ready for production ML?
                  </h3>
                  <p className="text-base mb-8 opacity-90 text-gray-700">
                    Start deploying high-performance inference with our orchestration platform.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-start">
                    <Link
                      href="/contact"
                      className="text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter"
                      style={{ backgroundColor: '#1f53d0' }}
                    >
                      Contact Sales
                    </Link>
                  </div>
                </div>
                <div className="flex justify-center md:justify-end">
                  {/* SVG removed */}
                </div>
              </div>
            </div>
        </div>

      </div>
    </section>
  )
}
