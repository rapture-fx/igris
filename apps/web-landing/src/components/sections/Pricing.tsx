'use client';

import { Check, X, ChevronDown, ChevronUp, Zap, Users, Database, Shield, Headphones, Cpu, Settings, Activity, Lock } from 'lucide-react'
import Link from 'next/link'
import React, { useState, useEffect, useRef, useMemo } from 'react'
import Image from 'next/image'

export default function Pricing() {
  const [selectedQuota, setSelectedQuota] = useState('100')
  const [billingPeriod, setBillingPeriod] = useState('monthly')
  const [apiCalls, setApiCalls] = useState(5000000) // Default to 5M
  const [openFaqItems, setOpenFaqItems] = useState<string[]>([])
  const [openFeatureCategories, setOpenFeatureCategories] = useState<number[]>([])

  // Pricing calculation logic
  const pricingPlans = [
    {
      name: 'Develop',
      basePrice: 99,
      includedCalls: 5000000, // 5M
      additionalCostPer1k: 0.08
    },
    {
      name: 'Growth',
      basePrice: 299,
      includedCalls: 25000000, // 25M
      additionalCostPer1k: 0.06
    },
    {
      name: 'Scale',
      basePrice: 599,
      includedCalls: 100000000, // 100M
      additionalCostPer1k: 0.04
    }
  ];

  const calculateUsageCost = (plan: typeof pricingPlans[0], calls: number) => {
    if (calls <= plan.includedCalls) {
      return plan.basePrice;
    }

    const additionalCalls = calls - plan.includedCalls;
    const additional1kBlocks = Math.ceil(additionalCalls / 1000);
    const additionalCost = additional1kBlocks * plan.additionalCostPer1k;

    return plan.basePrice + additionalCost;
  };

  const recommendedPlan = useMemo(() => {
    const costs = pricingPlans.map(plan => ({
      ...plan,
      totalCost: calculateUsageCost(plan, apiCalls)
    }));

    return costs.reduce((min, current) =>
      current.totalCost < min.totalCost ? current : min
    );
  }, [apiCalls]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(0) + 'k';
    }
    return num.toString();
  };

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


  const faqData = [
    {
      category: "General Pricing",
      items: [
        {
          id: "free-trial",
          question: "Is there a free trial?",
          answer: "Yes! All plans come with a free trial period. You can explore our platform and test your data pipelines before making any commitment."
        },
        {
          id: "api-limits",
          question: "What happens if I exceed my API limits?",
          answer: "You'll receive notifications as you approach your limits. You can upgrade your plan anytime or purchase additional API calls through our self-service portal."
        },
        {
          id: "change-plans",
          question: "Can I change plans anytime?",
          answer: "Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and billing is prorated."
        },
        {
          id: "annual-discount",
          question: "Do you offer annual discounts?",
          answer: "Yes! Choose yearly billing to get 2 months free (equivalent to ~17% discount) on all plans."
        }
      ]
    },
    {
      category: "Technical & Features",
      items: [
        {
          id: "data-sources",
          question: "What data sources do you support?",
          answer: "We support 40+ data sources including databases (PostgreSQL, MySQL, MongoDB), cloud storage (AWS S3, GCP, Azure), APIs, CSV, JSON, and more. Custom connectors available on Scale plan."
        },
        {
          id: "ml-frameworks",
          question: "Which ML frameworks are supported?",
          answer: "Develop plan supports TensorFlow, Growth adds PyTorch, and Scale includes all major frameworks plus custom framework support."
        },
        {
          id: "data-scaling",
          question: "How does data processing scaling work?",
          answer: "All plans offer unlimited file processing through streaming technology. Develop uses standard + streaming processing, Growth adds memory-mapped optimization, and Scale provides distributed processing with fault tolerance. Our platform auto-scales to handle datasets of any size efficiently."
        },
        {
          id: "data-security",
          question: "Is my data secure?",
          answer: "Yes! All plans include encryption in transit and at rest. Growth and Scale plans add SOC2/GDPR compliance, audit logs, and advanced security controls."
        }
      ]
    },
    {
      category: "Support & Enterprise",
      items: [
        {
          id: "support-levels",
          question: "What support do I get?",
          answer: "Develop includes business hours support, Growth and Scale get 24/7 support. Scale plans also include a dedicated account manager and priority support."
        },
        {
          id: "enterprise-solutions",
          question: "Do you offer enterprise solutions?",
          answer: "Yes! Our Scale plan includes enterprise features like unlimited distributed processing, full cluster management, custom integrations, SLA guarantees, and dedicated support. Contact us for custom enterprise pricing."
        },
        {
          id: "custom-quote",
          question: "Can I get a custom quote?",
          answer: "Absolutely! If you have specific requirements or need higher limits, our team can create a custom plan tailored to your needs. Contact our sales team."
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
      name: "Develop",
      title: "Develop",
      basePrice: 99,
      cta: "Start Develop for free",
      ctaLink: "/auth/register",
      tagline: "Perfect for individuals and small teams prototyping ML workflows with unlimited data processing.",
      highlights: [
        { icon: Activity, text: "5M API calls included" },
        { icon: Database, text: "Unlimited file processing" },
        { icon: Zap, text: "5 data source connections" },
        { icon: Users, text: "3 team members" },
        { icon: Shield, text: "Basic security & encryption" },
        { icon: Headphones, text: "Business hours support" }
      ]
    },
    {
      name: "Growth",
      title: "Growth",
      basePrice: 299,
      cta: "Start Growth for free",
      ctaLink: "/auth/register",
      tagline: "For growing AI teams needing multi-modal data processing and streaming pipelines.",
      popular: true,
      highlights: [
        { icon: Activity, text: "25M API calls included" },
        { icon: Database, text: "Streaming for large datasets" },
        { icon: Zap, text: "Real-time pipeline processing" },
        { icon: Users, text: "15 team members + collaboration" },
        { icon: Shield, text: "Advanced security & compliance" },
        { icon: Headphones, text: "24/7 priority support" }
      ]
    },
    {
      name: "Scale",
      title: "Scale",
      basePrice: 599,
      cta: "Start to Scale for free",
      ctaLink: "/auth/register",
      tagline: "Enterprise AI infrastructure with foundation model support and distributed processing.",
      popular: false,
      highlights: [
        { icon: Activity, text: "100M API calls included" },
        { icon: Database, text: "Unlimited distributed processing" },
        { icon: Zap, text: "Enterprise performance & SLA" },
        { icon: Users, text: "100 team members + account manager" },
        { icon: Shield, text: "SOC2/GDPR + 7-year audit logs" },
        { icon: Headphones, text: "Dedicated account manager" }
      ]
    }
  ];

  const getPrice = (plan: any) => {
    const pricingPlan = pricingPlans.find(p => p.name === plan.name);
    if (!pricingPlan) return plan.basePrice;

    const usageCost = calculateUsageCost(pricingPlan, apiCalls);

    // Safety guard against invalid calculations
    if (!usageCost || isNaN(usageCost) || usageCost < 0) {
      return plan.basePrice;
    }

    if (billingPeriod === 'yearly') {
      return Math.round((usageCost * 10) / 12);
    }
    return Math.round(usageCost);
  };

  const getPeriod = () => {
    return '/ month';
  };

  // Animated Number Component
  const AnimatedNumber = ({ value }: { value: number }) => {
    const [displayValue, setDisplayValue] = useState(value);
    const [isAnimating, setIsAnimating] = useState(false);
    const animationRef = useRef(null);

    useEffect(() => {
      // Initialize with current value on first render
      if (displayValue === 0) {
        setDisplayValue(value);
        return;
      }

      if (displayValue !== value) {
        setIsAnimating(true);

        const startValue = displayValue;
        const endValue = value;
        const duration = 800;
        const startTime = Date.now();

        const animate = () => {
          const now = Date.now();
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);

          // Easing function
          const easeOutQuart = 1 - Math.pow(1 - progress, 4);

          const currentValue = Math.round(startValue + (endValue - startValue) * easeOutQuart);
          setDisplayValue(currentValue);

          if (progress < 1) {
            animationRef.current = requestAnimationFrame(animate);
          } else {
            setIsAnimating(false);
            animationRef.current = null;
          }
        };

        // Cancel any existing animation
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }

        animationRef.current = requestAnimationFrame(animate);
      }

      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }, [value]);

    return (
      <span
        className={`inline-block transition-transform duration-200 ${isAnimating ? 'scale-110 text-blue-600' : 'scale-100'}`}
        style={{
          fontWeight: isAnimating ? '600' : '500',
          color: isAnimating ? '#1f53d0' : 'inherit'
        }}
      >
        {displayValue}
      </span>
    );
  };

  const features = [
    {
      category: "Distributed Processing & Scale",
      icon: Cpu,
      items: [
        { name: "File Size Limits", develop: "Unlimited (streaming)", growth: "Unlimited (optimized)", scale: "Unlimited (distributed)" },
        { name: "Distributed Processing", develop: false, growth: "Auto-scaling", scale: "Full cluster management" },
        { name: "Processing Method", develop: "Standard + Streaming", growth: "Streaming + Memory-mapped", scale: "Distributed + Fault tolerance" },
        { name: "AI Training Data Support", develop: "Basic", growth: "Multi-modal", scale: "Foundation models + MLOps" }
      ]
    },
    {
      category: "API-first Pipeline Platform",
      icon: Database,
      items: [
        { name: "7-Stage Data Preparation Pipeline", develop: "Basic", growth: "Advanced", scale: "Enterprise" },
        { name: "Multi-Source Data Orchestration", develop: "5 Sources", growth: "15+ Sources", scale: "All Sources + Custom" },
        { name: "Real-time Pipeline Processing", develop: false, growth: true, scale: true },
        { name: "Automated Error Recovery & Rollback", develop: false, growth: true, scale: true },
        { name: "Large Dataset Processing", develop: "Unlimited file processing", growth: "Streaming for large datasets", scale: "Distributed processing for TB-scale" },
        { name: "Pipeline State Management", develop: true, growth: true, scale: true }
      ]
    },
    {
      category: "ML Data Preparation",
      icon: Zap,
      items: [
        { name: "ML Framework Export Support", develop: "TensorFlow Only", growth: "TensorFlow + PyTorch", scale: "All Frameworks + Custom" },
        { name: "Data Registry & Version Control", develop: false, growth: true, scale: true },
        { name: "Feature Engineering Pipeline", develop: "Basic", growth: "Advanced", scale: "Custom Pipelines" }
      ]
    },
    {
      category: "API-first Architecture",
      icon: Settings,
      items: [
        { name: "REST API Endpoints (40+)", develop: true, growth: true, scale: true },
        { name: "API Calls per Month", develop: "5M", growth: "25M", scale: "100M+" },
        { name: "Real-time WebSocket Updates", develop: true, growth: true, scale: true },
        { name: "Webhook Integration", develop: false, growth: true, scale: true },
        { name: "Custom API Integrations", develop: false, growth: true, scale: true },
        { name: "OpenAPI Documentation", develop: true, growth: true, scale: true }
      ]
    },
    {
      category: "Security & Compliance",
      icon: Shield,
      items: [
        { name: "Multi-Factor Authentication", develop: true, growth: true, scale: true },
        { name: "Single Sign-On (SSO)", develop: false, growth: true, scale: true },
        { name: "Data Encryption", develop: "Basic", growth: "Advanced", scale: "Enterprise" },
        { name: "SOC2 & GDPR Compliance", develop: false, growth: true, scale: true },
        { name: "Audit Logs", develop: false, growth: "30 Days", scale: "7 Years" },
        { name: "Advanced Security Controls", develop: false, growth: true, scale: true }
      ]
    },
    {
      category: "Platform Monitoring & Analytics",
      icon: Activity,
      items: [
        { name: "Pipeline Performance Monitoring", develop: "Basic", growth: "Advanced", scale: "Enterprise" },
        { name: "Intelligent Pipeline Alerts", develop: false, growth: true, scale: true },
        { name: "Usage Analytics & Reporting", develop: "Basic", growth: "Advanced", scale: "Custom Dashboards" },
        { name: "99.9% Platform SLA", develop: false, growth: false, scale: true }
      ]
    },
    {
      category: "Platform Service & Support",
      icon: Headphones,
      items: [
        { name: "Team Members", develop: "3", growth: "15", scale: "100" },
        { name: "Platform Support", develop: "Business Hours", growth: "24/7", scale: "24/7" },
        { name: "Priority Pipeline Support", develop: false, growth: true, scale: true },
        { name: "Dedicated Account Manager", develop: false, growth: false, scale: true },
        { name: "99.9% Platform Uptime SLA", develop: false, growth: false, scale: true }
      ]
    }
  ];

  const renderFeatureValue = (value: any, planName: string) => {
    if (typeof value === 'boolean') {
      return value ? (
        <div className="flex items-center justify-center">
          <Check className="w-5 h-5" style={{ color: '#1f53d0' }} />
        </div>
      ) : (
        <div className="flex items-center justify-center"></div>
      );
    } else {
      return <span className="text-gray-600">{value}</span>;
    }
  };

  return (
    <section>
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Billing Period Selection */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            <span
              className={`text-sm font-medium cursor-pointer ${billingPeriod === 'monthly' ? 'text-blue-600' : 'text-gray-600'}`}
              style={billingPeriod === 'monthly' ? { color: '#1f53d0' } : {}}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </span>

            {/* Toggle Switch */}
            <div className="relative">
              <input
                type="checkbox"
                id="billing-toggle"
                className="sr-only"
                checked={billingPeriod === 'yearly'}
                onChange={(e) => setBillingPeriod(e.target.checked ? 'yearly' : 'monthly')}
              />
              <label
                htmlFor="billing-toggle"
                className="block w-12 h-6 rounded-full cursor-pointer relative transition-all duration-300 ease-in-out"
                style={{
                  backgroundColor: billingPeriod === 'yearly' ? '#1f53d0' : '#e5e7eb',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
                }}
              >
                <div
                  className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-all duration-300 ease-in-out"
                  style={{
                    left: billingPeriod === 'yearly' ? '26px' : '2px',
                    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                  }}
                />
              </label>
            </div>

            <span
              className={`text-sm font-medium cursor-pointer ${billingPeriod === 'yearly' ? 'text-blue-600' : 'text-gray-600'}`}
              style={billingPeriod === 'yearly' ? { color: '#1f53d0' } : {}}
              onClick={() => setBillingPeriod('yearly')}
            >
              Yearly
            </span>
          </div>
        </div>


        {/* Pricing Table Header */}
        <div className="mt-12">
          <div className="relative p-0" style={{
            borderTop: '1px solid rgba(74, 123, 214, 0.15)',
            borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
            borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
            borderRight: '1px solid rgba(74, 123, 214, 0.15)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '1px solid #4a7bd6' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '1px solid #4a7bd6' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
            </div>

            <div className="min-w-full">
              <div className="grid grid-cols-1 md:grid-cols-3" style={{ backgroundColor: '#f7f7f3' }}>
                {plans.map((plan, index) => (
                  <div key={index} className="px-6 pt-8 pb-8 text-left flex flex-col h-full min-h-[500px] relative transition-all duration-300 md:border-r border-gray-200 last:border-r-0">
                    {plan.popular && (
                      <div className="absolute top-3 right-3 bg-white px-3 py-1 text-xs font-medium" style={{ border: '0.5px solid rgba(31, 83, 208, 0.3)', color: '#1f53d0' }}>
                        Where Most Start
                      </div>
                    )}
                    <div className="mb-6">
                      <h3 className="text-2xl font-medium mb-2" style={{ color: '#1f53d0' }}>{plan.title}</h3>
                      <p className="text-4xl font-medium text-gray-900 mb-2">
                        $<AnimatedNumber key={`${plan.name}-${billingPeriod}-${apiCalls}`} value={getPrice(plan)} />
                        <span className="text-lg text-gray-600">{getPeriod()}</span>
                      </p>
                      {billingPeriod === 'yearly' && (
                        <p className="text-sm text-gray-500 mb-4">*billed annually - <span style={{ color: '#1f53d0' }}>Save 17%</span></p>
                      )}
                      {billingPeriod === 'monthly' && (
                        <div className="mb-4"></div>
                      )}
                      <p className="text-sm text-gray-700 mb-6">{plan.tagline}</p>

                      {/* Key Highlights */}
                      <div className="space-y-3 mb-6">
                        {plan.highlights.map((highlight, highlightIndex) => (
                          <div key={highlightIndex} className="flex items-center space-x-3">
                            <highlight.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-gray-600">{highlight.text}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Link
                        href={plan.ctaLink}
                        className={`inline-block py-2.5 px-5 rounded-lg transition-colors duration-200 text-center font-medium shadow-md hover:shadow-lg ${
                          plan.name === 'Develop'
                            ? 'text-blue-600 bg-white border border-blue-600 hover:bg-blue-50'
                            : plan.name === 'Scale'
                            ? 'hover:bg-blue-100'
                            : 'text-white hover:bg-blue-700'
                        }`}
                        style={
                          plan.name === 'Develop'
                            ? { borderColor: '#1f53d0', color: '#1f53d0' }
                            : plan.name === 'Scale'
                            ? { backgroundColor: '#e9eef9', color: '#1f53d0' }
                            : { backgroundColor: '#1f53d0' }
                        }
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

        {/* Feature Comparison Title */}
        <div className="mt-16 mb-8 text-left">
          <h2 className="text-2xl md:text-3xl font-bold" style={{ color: '#1f53d0' }}>
            Compare the features
          </h2>
        </div>

        {/* Pricing Table */}
        <div className="mt-12">
          <div className="relative p-0" style={{
            borderTop: '1px solid rgba(74, 123, 214, 0.15)',
            borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
            borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
            borderRight: '1px solid rgba(74, 123, 214, 0.15)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '1px solid #4a7bd6' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '1px solid #4a7bd6' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
            </div>

            <div className="min-w-full overflow-auto">
              {/* Table Header */}
              <div className="grid grid-cols-4 sticky top-0 z-20 shadow-sm border-b border-gray-200" style={{ backgroundColor: '#f7f7f3' }}>
                <div className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Features</h3>
                </div>
                {plans.map((plan, index) => (
                  <div key={index} className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider border-l border-gray-200">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">{plan.title}</h3>
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
                      style={{ backgroundColor: '#f7f7f3' }}
                      onClick={() => toggleFeatureCategory(catIndex)}
                    >
                      <div className="p-4 text-left text-sm font-semibold tracking-wider col-span-4 flex items-center justify-between text-gray-900">
                        <div className="flex items-center space-x-3">
                          <category.icon className="w-5 h-5 text-gray-900" />
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
                        <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.develop, 'Develop')}</div>
                        <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.growth, 'Growth')}</div>
                        <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.scale, 'Scale')}</div>
                      </div>
                    ))}
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-20">
          <div className="relative p-0" style={{
            borderTop: '1px solid rgba(74, 123, 214, 0.15)',
            borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
            borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
            borderRight: '1px solid rgba(74, 123, 214, 0.15)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '1px solid #4a7bd6' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '1px solid #4a7bd6' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
            </div>
            <div>
                <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                  {/* Left side - FAQ Title */}
                  <div className="border-r border-gray-200">
                    <div className="px-6 py-8 text-left">
                      <h3 className="text-2xl md:text-3xl font-semibold mb-6" style={{ color: '#1f53d0' }}>
                        Frequently Asked<br />Questions
                      </h3>
                    </div>
                  </div>

                  {/* Right side - FAQ Accordion */}
                  <div className="px-6 py-8 text-left">
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
                </div>
            </div>
          </div>
        </div>

        {/* Contact CTA */}
        <div className="mt-12">
          <div className="text-left p-0 relative" style={{
              backgroundColor: '#f7f7f3',
              borderTop: '1px solid rgba(74, 123, 214, 0.15)',
              borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
              borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
              borderRight: '1px solid rgba(74, 123, 214, 0.15)'
            }}>
              {/* Top left bleeding cross */}
              <div className="absolute -top-4 -left-4 w-8 h-8">
                <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '1px solid #4a7bd6' }}></div>
                <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '1px solid #4a7bd6' }}></div>
              </div>
              {/* Bottom right bleeding cross */}
              <div className="absolute -bottom-4 -right-4 w-8 h-8">
                <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
                <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-6 py-8">
                <div className="text-left">
                  <h3 className="text-2xl md:text-3xl font-medium mb-4 leading-tight" style={{ color: '#1f53d0' }}>
                    Understand your return
                  </h3>
                  <p className="text-base mb-8 opacity-90 text-gray-700">
                    Optimize your choice with our ROI calculator and pick the plan that delivers the most value.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-start">
                    <Link
                      href="/contact"
                      className="text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold text-sm shadow-md hover:shadow-lg font-inter"
                      style={{ backgroundColor: '#1f53d0' }}
                    >
                      Run the numbers
                    </Link>
                  </div>
                </div>
                <div className="flex justify-center md:justify-end">
                  <Image
                    src="/Financial.svg"
                    alt="Financial analysis illustration"
                    width={300}
                    height={300}
                    className="max-w-full h-auto"
                  />
                </div>
              </div>
            </div>
        </div>

      </div>
    </section>
  )
}