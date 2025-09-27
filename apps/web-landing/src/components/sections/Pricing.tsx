'use client';

import { Check, X, ChevronDown, ChevronUp, Zap, Users, Database, Shield, Headphones, Cpu, Settings, Activity, Lock, Globe, BarChart3, Brain, Gauge, Wrench, Layers } from 'lucide-react'
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
          answer: "We connect to all major databases (PostgreSQL, MySQL, MongoDB, Snowflake, Elasticsearch), cloud storage (AWS S3, Google Cloud, Azure), and streaming platforms (Kafka, Redis, WebSockets). Bring your own storage - we process your data where it lives, no data transfer needed."
        },
        {
          id: "ml-frameworks",
          question: "Which ML frameworks are supported?",
          answer: "Develop tier includes scikit-learn access. Growth tier adds TensorFlow and PyTorch support. Scale tier provides access to all ML frameworks plus large model support up to 5GB."
        },
        {
          id: "streaming-connections",
          question: "What are streaming connections?",
          answer: "Streaming connections allow real-time data processing. Develop tier gets 2 WebSocket connections, Growth tier gets 10 connections (WebSocket, Kafka, Redis), and Scale tier gets 100+ connections including advanced protocols like MQTT, SSE, and gRPC."
        },
        {
          id: "training-quotas",
          question: "How do ML training quotas work?",
          answer: "Training quotas limit the number of ML jobs you can run daily and inference requests per hour. Develop: 5 jobs/day + 100 inferences/hour, Growth: 50 jobs/day + 1,000 inferences/hour, Scale: 500 jobs/day + 10,000 inferences/hour."
        },
        {
          id: "data-scaling",
          question: "How does data processing scaling work?",
          answer: "All plans deliver optimized performance through efficient streaming. Develop processes up to 50GB daily (10GB per file), Growth handles up to 200GB daily (25GB per file), and Scale manages up to 500GB daily (50GB per file). With BYOS, process unlimited data directly in your own storage - daily limits apply only to API processing."
        },
        {
          id: "data-security",
          question: "Is my data secure?",
          answer: "Yes! All plans include encryption in transit and at rest. Growth and Scale plans add advanced security features, request monitoring, and enhanced protection controls."
        },
        {
          id: "byos-benefits",
          question: "What are the benefits of Bring-Your-Own-Storage (BYOS)?",
          answer: "Process data directly in your AWS S3, Google Cloud, or Azure storage. No data transfer costs, no compliance headaches. Your data stays in your infrastructure while we do the processing."
        },
        {
          id: "sla-guarantees",
          question: "What are the SLA guarantees?",
          answer: "Each tier includes uptime guarantees: Develop tier offers 99.0% uptime, Growth tier provides 99.5% uptime, and Scale tier delivers 99.9% uptime with priority infrastructure and monitoring."
        },
        {
          id: "self-service-portal",
          question: "What's included in the self-service portal?",
          answer: "Growth tier includes usage tracking and basic management features. Scale tier provides a dedicated portal with full API key management, team role administration, billing controls, and support ticket management."
        }
      ]
    },
    {
      category: "Support & Scale Solutions",
      items: [
        {
          id: "support-levels",
          question: "What support do I get?",
          answer: "Develop includes business hours support (9am-5pm). Growth and Scale plans get 24/7 support access, with Scale receiving <4 hour response times."
        },
        {
          id: "scale-solutions",
          question: "Do you offer advanced scale solutions?",
          answer: "Yes! Our Scale plan includes advanced features like parallel processing, 500GB daily processing capacity, priority integrations, and priority support. Contact us for custom Scale pricing."
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
      cta: "Start Develop trial",
      ctaLink: "/auth/register",
      tagline: "Process up to 50GB daily with optimized performance.\nPerfect for individual developers and small teams.",
      highlights: [
        { icon: Activity, text: "5M API calls included" },
        { icon: Database, text: "50GB daily processing limit" },
        { icon: Zap, text: "Optimized CSV processing" },
        { icon: Globe, text: "2 WebSocket connections" },
        { icon: Brain, text: "sklearn ML framework" },
        { icon: Gauge, text: "5 training jobs/day, 100 inferences/hour" },
        { icon: Users, text: "3 team members" },
        { icon: Shield, text: "99.0% SLA + basic security" },
        { icon: Headphones, text: "Business hours support" }
      ]
    },
    {
      name: "Growth",
      title: "Growth",
      basePrice: 299,
      cta: "Start Growth trial",
      ctaLink: "/auth/register",
      tagline: "Enhanced performance for growing teams.\nProcess large datasets with improved efficiency.",
      popular: true,
      highlights: [
        { icon: Activity, text: "25M API calls included" },
        { icon: Database, text: "200GB daily processing limit" },
        { icon: Zap, text: "Memory-efficient processing" },
        { icon: Globe, text: "10 streaming connections (WebSocket, Kafka, Redis)" },
        { icon: Brain, text: "TensorFlow + PyTorch access" },
        { icon: Gauge, text: "50 training jobs/day, 1,000 inferences/hour" },
        { icon: BarChart3, text: "Real-time metrics dashboard" },
        { icon: Shield, text: "Integration health monitoring" },
        { icon: Settings, text: "Bring Your Own", linkText: "Storage", linkUrl: "http://localhost:3005" },
        { icon: Users, text: "15 team members + self-service" },
        { icon: Shield, text: "99.5% SLA + enhanced security" },
        { icon: Headphones, text: "24/7 support" }
      ]
    },
    {
      name: "Scale",
      title: "Scale",
      basePrice: 599,
      cta: "Start Scale trial",
      ctaLink: "/auth/register",
      tagline: "Maximum performance optimization.\nAdvanced processing for high-volume data workloads.",
      popular: false,
      highlights: [
        { icon: Activity, text: "100M API calls included" },
        { icon: Database, text: "500GB daily processing limit" },
        { icon: Zap, text: "High-performance processing" },
        { icon: Globe, text: "100+ streaming connections (incl. MQTT, SSE, gRPC)" },
        { icon: Brain, text: "All ML frameworks + large models (up to 5GB)" },
        { icon: Gauge, text: "500 training jobs/day, 10,000 inferences/hour" },
        { icon: Layers, text: "Advanced integration patterns (GraphQL, MQTT, SSE)" },
        { icon: Wrench, text: "Dedicated self-service portal" },
        { icon: Settings, text: "Bring Your Own", linkText: "Storage", linkUrl: "http://localhost:3005" },
        { icon: Users, text: "50 team members + full portal" },
        { icon: Shield, text: "99.9% SLA + advanced security" },
        { icon: Headphones, text: "Priority support" }
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
      category: "Performance & Processing",
      icon: Cpu,
      items: [
        { name: "Daily Processing Quota", develop: "50GB/day", growth: "200GB/day", scale: "500GB/day" },
        { name: "Use Your Own Storage", develop: true, growth: true, scale: true },
        { name: "Processing Architecture", develop: "Streaming pipeline", growth: "Memory-optimized processing", scale: "Parallel distributed processing" },
        { name: "Processing Optimization", develop: "Standard optimization", growth: "Memory-efficient processing", scale: "High-performance kernels" },
        { name: "Memory Efficiency", develop: "40-60% less memory", growth: "50-70% less memory", scale: "70-80% less memory" },
        { name: "AI Training Data Support", develop: "TensorFlow integration", growth: "Multi-framework support", scale: "Advanced ML Operations" }
      ]
    },
    {
      category: "Data Pipeline Platform",
      icon: Database,
      items: [
        { name: "Data Preparation Pipeline", develop: "Essential stages", growth: "Advanced workflows", scale: "Automated pipelines" },
        { name: "Data Sources", develop: "All major databases", growth: "All major databases", scale: "All major databases" },
        { name: "Use Your Own Storage", develop: true, growth: true, scale: true },
        { name: "Real-time Data Processing", develop: false, growth: true, scale: true },
        { name: "File Upload Limit", develop: "10GB per file", growth: "25GB per file", scale: "50GB per file" },
        { name: "Automated Error Recovery", develop: false, growth: true, scale: true }
      ]
    },
    {
      category: "ML Data Preparation",
      icon: Zap,
      items: [
        { name: "ML Framework Access", develop: "scikit-learn only", growth: "+ TensorFlow + PyTorch", scale: "All frameworks + large models (5GB)" },
        { name: "ML Training Quotas", develop: "5 jobs/day, 100 inferences/hour", growth: "50 jobs/day, 1,000 inferences/hour", scale: "500 jobs/day, 10,000 inferences/hour" },
        { name: "ML Resource Quotas", develop: "2GB memory", growth: "8GB memory", scale: "32GB memory" },
        { name: "ML Framework Export Support", develop: "TensorFlow Only", growth: "TensorFlow + PyTorch", scale: "All Frameworks + Custom" },
        { name: "Data Registry & Version Control", develop: false, growth: true, scale: true },
        { name: "Feature Engineering Pipeline", develop: "Basic", growth: "Advanced", scale: "Custom Pipelines" }
      ]
    },
    {
      category: "API & Integration",
      icon: Settings,
      items: [
        { name: "REST API Endpoints", develop: true, growth: true, scale: true },
        { name: "API Calls Included", develop: "5M calls", growth: "25M calls", scale: "100M calls" },
        { name: "Database Connectors", develop: "PostgreSQL, MySQL, MongoDB", growth: "+ Snowflake, Elasticsearch", scale: "+ Enterprise databases" },
        { name: "Streaming Connections", develop: "2 WebSocket connections", growth: "10 connections (WebSocket, Kafka, Redis)", scale: "100+ connections (incl. MQTT, SSE, gRPC)" },
        { name: "Advanced Integration Patterns", develop: false, growth: "Basic patterns", scale: "GraphQL, MQTT, SSE, gRPC" },
        { name: "Real-time Streaming", develop: "WebSockets", growth: "Kafka, Redis", scale: "All streaming" },
        { name: "Stream-to-Webhook Bridge", develop: false, growth: "10/min rate limit", scale: "100/min rate limit" },
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
        { name: "Data Encryption", develop: "Basic", growth: "Advanced", scale: "Advanced Plus" },
        { name: "Advanced Security Controls", develop: false, growth: true, scale: true },
        { name: "Request Monitoring", develop: false, growth: "Basic tracking", scale: "Advanced analytics" },
        { name: "Advanced Security Controls", develop: false, growth: true, scale: true }
      ]
    },
    {
      category: "Monitoring & Analytics",
      icon: Activity,
      items: [
        { name: "SLA Guarantees", develop: "99.0% uptime", growth: "99.5% uptime", scale: "99.9% uptime" },
        { name: "Real-time Metrics Dashboard", develop: "Basic metrics", growth: "Live dashboard with quota visualization", scale: "Advanced analytics + custom dashboards" },
        { name: "Integration Health Monitoring", develop: false, growth: "Health monitoring for connectors", scale: "Full monitoring suite + alerting" },
        { name: "Performance Monitoring", develop: "Essential metrics", growth: "Advanced dashboards", scale: "Comprehensive analytics" },
        { name: "Smart Alerting System", develop: false, growth: true, scale: true },
        { name: "Usage Analytics & Reporting", develop: "Essential reports", growth: "Advanced insights", scale: "Custom dashboards" },
        { name: "High Availability", develop: false, growth: false, scale: "Priority infrastructure" }
      ]
    },
    {
      category: "Customer Self-Service",
      icon: Settings,
      items: [
        { name: "API Key Management", develop: "Basic keys", growth: "Advanced key management", scale: "Full key management" },
        { name: "Team Management", develop: "Basic roles", growth: "Advanced roles + invites", scale: "Full RBAC + SSO" },
        { name: "Self-Service Portal", develop: false, growth: "Usage tracking + basic management", scale: "Dedicated portal (API keys, billing, roles)" },
        { name: "Load Testing & Benchmarks", develop: false, growth: false, scale: "Performance validation" }
      ]
    },
    {
      category: "Support & Service",
      icon: Headphones,
      items: [
        { name: "Team Members", develop: "3", growth: "15", scale: "50" },
        { name: "Technical Support", develop: "Business hours", growth: "24/7 support", scale: "24/7 support" },
        { name: "Extended Support Hours", develop: false, growth: true, scale: true },
        { name: "Priority Response Time", develop: false, growth: false, scale: true },
        { name: "Response Time", develop: false, growth: false, scale: "<4 hour response" }
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
      return <span className="text-sm text-gray-600">{value}</span>;
    }
  };

  return (
    <section>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Billing Period Selection */}
        <div className="flex justify-center mb-8">
          <div className="relative inline-flex bg-gray-100 rounded-lg p-1">
            <input
              type="checkbox"
              id="billing-toggle"
              className="sr-only"
              checked={billingPeriod === 'yearly'}
              onChange={(e) => setBillingPeriod(e.target.checked ? 'yearly' : 'monthly')}
            />

            {/* Background slider */}
            <div
              className="absolute top-1 bottom-1 bg-white rounded-md shadow-sm transition-all duration-300 ease-in-out"
              style={{
                left: billingPeriod === 'monthly' ? '4px' : '50%',
                width: 'calc(50% - 4px)',
                backgroundColor: '#ffffff',
                boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
              }}
            />

            {/* Monthly button */}
            <button
              className={`relative z-10 px-6 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                billingPeriod === 'monthly' ? 'text-blue-600' : 'text-gray-600'
              }`}
              style={billingPeriod === 'monthly' ? { color: '#1f53d0' } : {}}
              onClick={() => setBillingPeriod('monthly')}
            >
              Monthly
            </button>

            {/* Yearly button */}
            <button
              className={`relative z-10 px-6 py-2 text-sm font-medium rounded-md transition-colors duration-300 ${
                billingPeriod === 'yearly' ? 'text-blue-600' : 'text-gray-600'
              }`}
              style={billingPeriod === 'yearly' ? { color: '#1f53d0' } : {}}
              onClick={() => setBillingPeriod('yearly')}
            >
              Yearly
            </button>
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
                  <div key={index} className="px-6 pt-8 pb-8 text-left flex flex-col h-full min-h-[650px] relative transition-all duration-300 md:border-r border-gray-200 last:border-r-0">
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
                      <p className="text-sm text-gray-700 mb-6 whitespace-pre-line">{plan.tagline}</p>

                      {/* Key Highlights */}
                      <div className="space-y-3 mb-6">
                        {plan.highlights.map((highlight, highlightIndex) => (
                          <div key={highlightIndex} className="flex items-center space-x-3">
                            <highlight.icon className="w-5 h-5 text-blue-600 flex-shrink-0" />
                            <span className="text-sm text-gray-600">
                              {highlight.text}
                              {highlight.linkText && (
                                <>
                                  {' '}
                                  <Link href={highlight.linkUrl} className="text-blue-600 underline hover:text-blue-700 inline-flex items-center">
                                    {highlight.linkText}
                                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                    </svg>
                                  </Link>
                                </>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Link
                        href={plan.ctaLink}
                        className={`inline-block py-2.5 px-5 rounded-lg transition-colors duration-200 text-center font-medium shadow-md hover:shadow-lg ${
                          plan.name === 'Growth'
                            ? 'text-white hover:bg-blue-700'
                            : 'hover:bg-blue-100'
                        }`}
                        style={
                          plan.name === 'Growth'
                            ? { backgroundColor: '#1f53d0' }
                            : { backgroundColor: '#e9eef9', color: '#1f53d0' }
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

        {/* Pricing Table */}
        <div className="mt-8">
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

            {/* Feature Comparison Title */}
            <div className="px-6 py-4 text-left border-b border-gray-200" style={{ backgroundColor: '#f7f7f3' }}>
              <h2 className="text-2xl md:text-3xl font-normal" style={{ color: '#1f53d0' }}>
                Compare the features
              </h2>
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
                      <div className="p-4 text-left text-sm font-medium tracking-wider col-span-4 flex items-center justify-between text-gray-900">
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
        <div className="mt-8">
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
            <div>
                <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                  {/* Left side - FAQ Title */}
                  <div className="border-r border-gray-200">
                    <div className="px-6 py-8 text-left">
                      <h3 className="text-2xl md:text-3xl font-normal mb-6" style={{ color: '#1f53d0' }}>
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
        <div className="mt-6">
          <div className="text-left p-0 relative" style={{
              backgroundColor: '#f7f7f3',
              borderTop: '1px solid rgba(74, 123, 214, 0.15)',
              borderBottom: '1px solid rgba(74, 123, 214, 0.15)',
              borderLeft: '1px solid rgba(74, 123, 214, 0.15)',
              borderRight: '1px solid rgba(74, 123, 214, 0.15)'
            }}>
              {/* Bottom right bleeding cross */}
              <div className="absolute -bottom-4 -right-4 w-8 h-8">
                <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '1px solid #4a7bd6' }}></div>
                <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '1px solid #4a7bd6' }}></div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center px-6 py-8">
                <div className="text-left">
                  <h3 className="text-2xl md:text-3xl font-normal mb-4 leading-tight" style={{ color: '#1f53d0' }}>
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