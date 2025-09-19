'use client'

import { Check, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

export default function Pricing() {
  const [selectedQuota, setSelectedQuota] = useState('100')
  const [billingPeriod, setBillingPeriod] = useState('monthly') // 'monthly' or 'yearly'
  const [selectedApiCount, setSelectedApiCount] = useState('100k')

  const apiCountOptions = [
    { value: '100k', label: '100K API calls', priceMultiplier: { develop: 1, growth: 1, scale: 1 } },
    { value: '500k', label: '500K API calls', priceMultiplier: { develop: 1.5, growth: 1.3, scale: 1.2 } },
    { value: '1m', label: '1M API calls', priceMultiplier: { develop: 2, growth: 1.5, scale: 1.3 } },
    { value: '5m', label: '5M API calls', priceMultiplier: { develop: 3, growth: 2, scale: 1.5 } },
    { value: 'unlimited', label: 'Unlimited', priceMultiplier: { develop: 4, growth: 2.5, scale: 1.8 } }
  ]

  const plans = [
    {
      name: "Develop",
      title: "Develop",
      basePrice: 99,
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "Perfect for individuals and small teams prototyping ML workflows.",
    },
    {
      name: "Growth",
      title: "Growth",
      basePrice: 299,
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "For growing teams who need faster pipelines and collaboration.",
      popular: true
    },
    {
      name: "Scale",
      title: "Scale",
      basePrice: 599,
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "Enterprise-grade performance, compliance, and scale without the infra burden.",
      popular: false
    }
  ]

  const getPrice = (plan: any) => {
    const selectedOption = apiCountOptions.find(option => option.value === selectedApiCount);
    const multiplier = selectedOption?.priceMultiplier[plan.name.toLowerCase()] || 1;
    const adjustedPrice = plan.basePrice * multiplier;

    if (billingPeriod === 'yearly') {
      return Math.round(adjustedPrice * 10); // 2 months free for yearly
    }
    return Math.round(adjustedPrice);
  };

  const getPeriod = () => {
    if (billingPeriod === 'yearly') {
      return '/ year';
    }
    return '/ month';
  };

  const features = [
    {
      category: "API-first Pipeline Platform",
      items: [
        { name: "7-Stage Data Preparation Pipeline", develop: "Basic", growth: "Advanced", scale: "Enterprise" },
        { name: "Multi-Source Data Orchestration", develop: "5 Sources", growth: "15+ Sources", scale: "All Sources + Custom" },
        { name: "Real-time Pipeline Processing", develop: false, growth: true, scale: true },
        { name: "Automated Error Recovery & Rollback", develop: false, growth: true, scale: true },
        { name: "Large Dataset Processing", develop: "1GB", growth: "50GB", scale: "Unlimited" },
        { name: "Pipeline State Management", develop: true, growth: true, scale: true }
      ]
    },
    {
      category: "ML Data Preparation",
      items: [
        { name: "ML Framework Export Support", develop: "TensorFlow Only", growth: "TensorFlow + PyTorch", scale: "All Frameworks + Custom" },
        { name: "Data Registry & Version Control", develop: false, growth: true, scale: true },
        { name: "Feature Engineering Pipeline", develop: "Basic", growth: "Advanced", scale: "Custom Pipelines" }
      ]
    },
    {
      category: "API-first Architecture",
      items: [
        { name: "REST API Endpoints (40+)", develop: true, growth: true, scale: true },
        { name: "API Calls per Month", develop: "10K", growth: "100K", scale: "Unlimited" },
        { name: "Real-time WebSocket Updates", develop: true, growth: true, scale: true },
        { name: "Webhook Integration", develop: false, growth: true, scale: true },
        { name: "Custom API Integrations", develop: false, growth: true, scale: true },
        { name: "OpenAPI Documentation", develop: true, growth: true, scale: true }
      ]
    },
    {
      category: "Security & Compliance",
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
      items: [
        { name: "Pipeline Performance Monitoring", develop: "Basic", growth: "Advanced", scale: "Enterprise" },
        { name: "Intelligent Pipeline Alerts", develop: false, growth: true, scale: true },
        { name: "Usage Analytics & Reporting", develop: "Basic", growth: "Advanced", scale: "Custom Dashboards" },
        { name: "99.9% Platform SLA", develop: false, growth: false, scale: true }
      ]
    },
    {
      category: "Platform Service & Support",
      items: [
        { name: "Team Members", develop: "3", growth: "15", scale: "Unlimited" },
        { name: "Platform Support", develop: "Business Hours", growth: "24/7", scale: "24/7" },
        { name: "Priority Pipeline Support", develop: false, growth: true, scale: true },
        { name: "Dedicated Account Manager", develop: false, growth: false, scale: true },
        { name: "99.9% Platform Uptime SLA", develop: false, growth: false, scale: true }
      ]
    }
  ];

  const renderFeatureValue = (value: any, planName: string) => {
    if (typeof value === 'boolean') {
      return value ? <div className="flex items-center justify-center"><Check className="w-5 h-5" style={{ color: '#1f53d0' }} /></div> : <div className="flex items-center justify-center"></div>;
    } else if (typeof value === 'object' && value.type === 'dropdown') {
      return (
        <div className="relative inline-block text-left">
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-900 py-2 px-3 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            value={selectedApiCount}
            onChange={(e) => setSelectedApiCount(e.target.value)}
          >
            {apiCountOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
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
            <div className="inline-flex rounded-md shadow-sm" role="group">
              <button
                type="button"
                className={`py-2 px-4 text-sm font-medium rounded-l-lg ${billingPeriod === 'monthly' ? 'text-white' : 'bg-white text-gray-900'}`}
                style={billingPeriod === 'monthly' ? { backgroundColor: '#e9eef9', color: '#1f53d0' } : {}}
                onClick={() => setBillingPeriod('monthly')}
              >
                Monthly
              </button>
              <button
                type="button"
                className={`py-2 px-4 text-sm font-medium rounded-r-lg ${billingPeriod === 'yearly' ? 'text-white' : 'bg-white text-gray-900'}`}
                style={billingPeriod === 'yearly' ? { backgroundColor: '#e9eef9', color: '#1f53d0' } : {}}
                onClick={() => setBillingPeriod('yearly')}
              >
                Yearly (2 months free)
              </button>
            </div>
          </div>

        {/* Pricing Table Header */}
        <div className="mt-12">
          <div className="relative p-8" style={{
            borderTop: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderBottom: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderLeft: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderRight: '0.5px solid rgba(74, 123, 214, 0.15)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #4a7bd6' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #4a7bd6' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #4a7bd6' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #4a7bd6' }}></div>
            </div>

            <div className="min-w-full border border-gray-300">
              <div className="grid grid-cols-3" style={{ backgroundColor: '#f7f7f3' }}>
                {plans.map((plan, index) => (
                  <div key={index} className="px-12 pt-8 pb-8 text-left border-r border-gray-300 last:border-r-0 flex flex-col h-full min-h-[400px]">
                    <div className="mb-4">
                      <h3 className="text-2xl font-medium mb-2" style={{ color: '#1f53d0' }}>{plan.title}</h3>
                      <p className="text-4xl font-medium text-gray-900 mb-4">
                        ${getPrice(plan)}
                        <span className="text-lg text-gray-600">{getPeriod()}</span>
                      </p>
                      <p className="text-sm text-gray-700">{plan.tagline}</p>
                    </div>
                    <div className="mt-auto">
                      <Link href={plan.ctaLink} className="inline-block text-white py-2 px-6 rounded-lg hover:bg-blue-700 transition-colors duration-200" style={{ backgroundColor: '#1f53d0' }}>
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
        <div className="mt-12">
          <div className="relative p-8" style={{
            borderTop: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderBottom: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderLeft: '0.5px solid rgba(74, 123, 214, 0.15)',
            borderRight: '0.5px solid rgba(74, 123, 214, 0.15)'
          }}>
            {/* Top left bleeding cross */}
            <div className="absolute -top-4 -left-4 w-8 h-8">
              <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #4a7bd6' }}></div>
              <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #4a7bd6' }}></div>
            </div>
            {/* Bottom right bleeding cross */}
            <div className="absolute -bottom-4 -right-4 w-8 h-8">
              <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #4a7bd6' }}></div>
              <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #4a7bd6' }}></div>
            </div>

            <div className="min-w-full overflow-auto">
            {/* Table Header */}
            <div className="grid grid-cols-4 border-b border-gray-200 sticky top-0 z-20 shadow-sm" style={{ backgroundColor: '#f7f7f3' }}>
              <div className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider">
                <h3 className="text-2xl font-medium text-gray-900 mb-2">Features</h3>
              </div>
              {plans.map((plan, index) => (
                <div key={index} className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider border-l border-gray-200">
                <h3 className="text-2xl font-medium text-gray-900 mb-2">{plan.title}</h3>
                </div>
              ))}
            </div>

            {/* Table Body */}
            {features.map((category, catIndex) => (
              <React.Fragment key={catIndex}>
                <div className="grid grid-cols-4 border-b border-gray-200" style={{ backgroundColor: '#f7f7f3' }}>
                  <div className="p-4 text-left text-sm font-semibold tracking-wider col-span-4" style={{ color: '#1f53d0' }}>{category.category}</div>
                </div>
                {category.items.map((item, itemIndex) => (
                  <div key={itemIndex} className="grid grid-cols-4 border-b border-gray-200 last:border-b-0">
                    <div className="p-4 text-left text-sm text-gray-600">{item.name}</div>
                    <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.develop, 'Develop')}</div>
                    <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.growth, 'Growth')}</div>
                    <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.scale, 'Scale')}</div>
                  </div>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
    </div>
    </section>
  )
}