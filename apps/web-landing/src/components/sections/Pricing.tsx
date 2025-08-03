'use client'

import { Check, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

export default function Pricing() {
  const [selectedQuota, setSelectedQuota] = useState('100')

  const plans = [
    {
      name: "Automate",
      title: "Automate",
      price: "$49",
      period: "/ month",
      cta: "Start a Free Trial",
      ctaLink: "#",
      tagline: "Automate your marketing"
    },
    {
      name: "Scale",
      title: "Scale",
      price: "$99",
      period: "/ month",
      cta: "Start a Free Trial",
      ctaLink: "#",
      tagline: "Scale your operations",
      popular: true
    },
    {
      name: "Enterprise",
      title: "Enterprise",
      price: "Custom",
      period: "",
      cta: "Contact Sales",
      ctaLink: "#",
      tagline: "Tailored for large organizations"
    }
  ]

  const features = [
    {
      category: "Core Data Processing",
      items: [
        { name: "AI-Powered Data Cleaning & Validation", automate: "Basic", scale: "Advanced", enterprise: "Custom AI Models" },
        { name: "Multi-Format File Support", automate: "CSV, JSON", scale: "All Common Formats", enterprise: "All + Custom Formats" },
        { name: "Document & Image Data Extraction", automate: false, scale: true, enterprise: true },
        { name: "ML-Ready Data Preparation", automate: false, scale: true, enterprise: true },
        { name: "Unified Pipeline Orchestration", automate: false, scale: true, enterprise: true }
      ]
    },
    {
      category: "API & Usage",
      items: [
        { name: "API Calls per Month", automate: "1,000", scale: "100,000", enterprise: "Unlimited" },
        { name: "Bandwidth", automate: "10 GB", scale: "1 TB", enterprise: "Unlimited" },
        { name: "Storage", automate: "1 GB", scale: "100 GB", enterprise: "Unlimited" },
        { name: "Real-time Processing", automate: true, scale: true, enterprise: true },
        { name: "Batch Processing", automate: false, scale: true, enterprise: true }
      ]
    },
    {
      category: "Integrations & Connectivity",
      items: [
        { name: "Standard Data Source Connectors", automate: "Basic", scale: "All Standard", enterprise: "All + Custom" },
        { name: "CRM & Marketing Integrations", automate: false, scale: true, enterprise: true },
        { name: "Cloud Storage Integrations (S3, GCS, Azure Blob)", automate: false, scale: true, enterprise: true },
        { name: "Real-time Data Streaming (WebSockets)", automate: false, scale: true, enterprise: true },
        { name: "Custom Integrations", automate: false, scale: false, enterprise: true }
      ]
    },
    {
      category: "Security & Compliance",
      items: [
        { name: "2FA & Multi-layered Authentication", automate: true, scale: true, enterprise: true },
        { name: "SSO (SAML/OAuth)", automate: false, scale: true, enterprise: true },
        { name: "Data Encryption (at rest & in transit)", automate: true, scale: true, enterprise: true },
        { name: "Comprehensive Audit Logs", automate: false, scale: true, enterprise: true },
        { name: "Role-Based Access Control (RBAC)", automate: false, scale: true, enterprise: true },
        { name: "GDPR Compliance", automate: false, scale: true, enterprise: true },
        { name: "SOC2 Compliance", automate: false, scale: false, enterprise: true },
        { name: "HIPAA Compliance", automate: false, scale: false, enterprise: true },
        { name: "PCI DSS Compliance", automate: false, scale: false, enterprise: true },
        { name: "ISO 27001 Compliance", automate: false, scale: false, enterprise: true },
        { name: "NIST CSF Compliance", automate: false, scale: false, enterprise: true },
        { name: "CCPA Compliance", automate: false, scale: false, enterprise: true },
        { name: "FedRAMP Compliance", automate: false, scale: false, enterprise: true }
      ]
    },
    {
      category: "Monitoring & Analytics",
      items: [
        { name: "Basic Usage Analytics & Reporting", automate: true, scale: true, enterprise: true },
        { name: "Advanced Cost Monitoring", automate: false, scale: true, enterprise: true },
        { name: "Custom Dashboards & Alerts", automate: false, scale: false, enterprise: true },
        { name: "API Performance Monitoring", automate: false, scale: true, enterprise: true }
      ]
    },
    {
      category: "Team & Support",
      items: [
        { name: "Team Members", automate: "1", scale: "10", enterprise: "Unlimited" },
        { name: "Dedicated Account Manager", automate: false, scale: false, enterprise: true },
        { name: "Email Support", automate: true, scale: true, enterprise: true },
        { name: "Phone Support", automate: false, scale: true, enterprise: true },
        { name: "24/7 SLA Support", automate: false, scale: false, enterprise: true }
      ]
    }
  ];

  const renderFeatureValue = (value: any, planName: string) => {
    if (typeof value === 'boolean') {
      return value ? <Check className="w-5 h-5 text-green-500" /> : <X className="w-5 h-5 text-red-500" />;
    } else if (typeof value === 'object' && value.type === 'dropdown') {
      return (
        <div className="relative inline-block text-left">
          <select
            className="block appearance-none w-full bg-[#161616] border border-gray-700 text-white py-2 px-3 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            value={selectedQuota}
            onChange={(e) => setSelectedQuota(e.target.value)}
          >
            {value.options.map((option: string) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
            <ChevronDown className="h-4 w-4" />
          </div>
        </div>
      );
    } else {
      return <span className="text-gray-300">{value}</span>;
    }
  };

  return (
    <section className="py-16 md:py-24 bg-[#111111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Universal Benefits */}
        <div className="bg-gray-900 rounded-lg p-8 mb-12 shadow-lg border border-gray-700">
          <h3 className="text-2xl font-bold text-beige-secondary mb-4 text-left">On all plans</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-beige-secondary text-center">
            <p className="flex items-center justify-center"><Check className="w-5 h-5 text-green-500 mr-2" /> Upgrade anytime</p>
            <p className="flex items-center justify-center"><Check className="w-5 h-5 text-green-500 mr-2" /> Downgrade anytime</p>
            <p className="flex items-center justify-center"><Check className="w-5 h-5 text-green-500 mr-2" /> Cancel anytime</p>
          </div>
        </div>

        {/* Pricing Table */}
        <div className="bg-[#161616] rounded-lg shadow-lg overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-[#161616]/50 border-b border-gray-700">
            <div className="p-4 text-left text-sm font-medium text-beige-secondary uppercase tracking-wider">Features</div>
            {plans.map((plan, index) => (
              <div key={index} className="p-4 text-center text-sm font-medium text-gray-400 uppercase tracking-wider border-l border-gray-700">
                <h3 className="text-xl font-semibold text-beige-secondary mb-2">{plan.title}</h3>
                <p className="text-4xl font-bold text-white">{plan.price}</p>
                {plan.period && <span className="text-gray-300">{plan.period}</span>}
                <Link href={plan.ctaLink} className="mt-4 w-full inline-block bg-[#1A5799] text-white py-2 px-4 rounded-lg hover:bg-[#154A85] transition-colors duration-200">
                  {plan.cta}
                </Link>
                {plan.tagline && <p className="text-xs text-beige-secondary mt-2">{plan.tagline}</p>}
              </div>
            ))}
          </div>

          {/* Table Body */}
          {features.map((category, catIndex) => (
            <React.Fragment key={catIndex}>
              <div className="grid grid-cols-4 bg-[#111111]/50 border-b border-gray-700">
                <div className="p-4 text-left text-sm font-semibold text-beige-secondary uppercase tracking-wider col-span-4">{category.category}</div>
              </div>
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="grid grid-cols-4 border-b border-gray-700 last:border-b-0">
                  <div className="p-4 text-left text-sm text-beige-secondary">{item.name}</div>
                  <div className="p-4 text-center border-l border-gray-700">{renderFeatureValue(item.automate, 'Automate')}</div>
                  <div className="p-4 text-center border-l border-gray-700">{renderFeatureValue(item.scale, 'Scale')}</div>
                  <div className="p-4 text-center border-l border-gray-700">{renderFeatureValue(item.enterprise, 'Enterprise')}</div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}