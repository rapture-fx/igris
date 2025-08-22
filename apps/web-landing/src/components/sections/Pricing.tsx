'use client'

import { Check, X, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import React, { useState } from 'react'

export default function Pricing() {
  const [selectedQuota, setSelectedQuota] = useState('100')

  const plans = [
    {
      name: "Free",
      title: "Free",
      price: "$0",
      period: "/ month",
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "The perfect starting point to prepare your first ML dataset."
    },
    {
      name: "Developer",
      title: "Developer",
      price: "$49",
      period: "/ month",
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "Go from raw data to model-ready in minutes.",
      popular: true
    },
    {
      name: "Growth",
      title: "Growth",
      price: "$149",
      period: "/ month",
      cta: "Get started for free",
      ctaLink: "/auth/register",
      tagline: "Accelerate your team's ML development and scale your data pipelines."
    }
  ]

  const features = [
    {
      category: "Core Data Processing",
      items: [
        { name: "AI-Powered Data Cleaning & Validation", free: "Basic", developer: "Advanced", growth: "Custom AI Models" },
        { name: "Multi-Format File Support", free: "CSV, JSON, Excel", developer: "All Common Formats", growth: "All + Custom Formats" },
        { name: "Document & Image Data Extraction", free: true, developer: true, growth: true },
        { name: "ML-Ready Data Preparation", free: "Basic", developer: "Advanced", growth: "Custom Pipelines" },
        { name: "Unified Pipeline Orchestration", free: false, developer: true, growth: true },
        { name: "Real-time Data Streaming", free: false, developer: true, growth: true },
        { name: "Auto-labeling & Data Enrichment", free: false, developer: true, growth: true }
      ]
    },
    {
      category: "API & Usage",
      items: [
        { name: "API Calls per Month", free: "1,000", developer: "100,000", growth: "Unlimited" },
        { name: "Bandwidth", free: "5 GB", developer: "500 GB", growth: "Unlimited" },
        { name: "Storage", free: "1 GB", developer: "100 GB", growth: "Unlimited" },
        { name: "Real-time Processing", free: true, developer: true, growth: true },
        { name: "Batch Processing", free: "Small jobs", developer: "Large jobs", growth: "Enterprise scale" },
        { name: "Concurrent Processing Jobs", free: "1", developer: "10", growth: "Unlimited" }
      ]
    },
    {
      category: "Integrations & Connectivity",
      items: [
        { name: "Standard Data Source Connectors", free: "3 connectors", developer: "All standard", growth: "All + Custom" },
        { name: "Database Integrations (SQL, NoSQL)", free: true, developer: true, growth: true },
        { name: "Cloud Storage Integrations (S3, GCS, Azure)", free: false, developer: true, growth: true },
        { name: "Real-time Data Streaming (WebSockets)", free: false, developer: true, growth: true },
        { name: "RESTful APIs", free: true, developer: true, growth: true },
        { name: "Custom Integrations & Webhooks", free: false, developer: "Limited", growth: "Unlimited" }
      ]
    },
    {
      category: "Security & Compliance",
      items: [
        { name: "2FA & Multi-layered Authentication", free: true, developer: true, growth: true },
        { name: "SSO (SAML/OAuth)", free: false, developer: true, growth: true },
        { name: "Data Encryption (at rest & in transit)", free: true, developer: true, growth: true },
        { name: "Comprehensive Audit Logs", free: "Basic", developer: "Advanced", growth: "Enterprise" },
        { name: "Role-Based Access Control (RBAC)", free: false, developer: true, growth: true },
        { name: "GDPR & Privacy Compliance", free: true, developer: true, growth: true },
        { name: "SOC2 Type II Compliance", free: false, developer: false, growth: true },
        { name: "HIPAA Compliance", free: false, developer: false, growth: true },
        { name: "Enterprise Security Certifications", free: false, developer: false, growth: true }
      ]
    },
    {
      category: "Monitoring & Analytics",
      items: [
        { name: "Usage Analytics & Reporting", free: "Basic", developer: "Advanced", growth: "Custom" },
        { name: "Real-time Performance Monitoring", free: false, developer: true, growth: true },
        { name: "Custom Dashboards & Alerts", free: false, developer: "Standard", growth: "Unlimited" },
        { name: "API Performance & Error Tracking", free: "Basic", developer: "Advanced", growth: "Enterprise" },
        { name: "Data Quality Monitoring", free: false, developer: true, growth: true },
        { name: "Predictive Analytics", free: false, developer: "Limited", growth: "Advanced" }
      ]
    },
    {
      category: "Team & Support",
      items: [
        { name: "Team Members", free: "1", developer: "10", growth: "Unlimited" },
        { name: "Email Support", free: true, developer: true, growth: true },
        { name: "Priority Support", free: false, developer: true, growth: true }
      ]
    }
  ];

  const renderFeatureValue = (value: any, planName: string) => {
    if (typeof value === 'boolean') {
      return value ? <div className="flex items-center justify-center"><Check className="w-5 h-5 text-green-500" /></div> : <div className="flex items-center justify-center"><X className="w-5 h-5 text-red-500" /></div>;
    } else if (typeof value === 'object' && value.type === 'dropdown') {
      return (
        <div className="relative inline-block text-left">
          <select
            className="block appearance-none w-full bg-white border border-gray-300 text-gray-900 py-2 px-3 pr-8 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
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
      return <span className="text-gray-700">{value}</span>;
    }
  };

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        

        {/* Pricing Table */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          {/* Table Header */}
          <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-200">
            <div className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider">Features</div>
            {plans.map((plan, index) => (
              <div key={index} className="p-4 text-center text-sm font-medium text-gray-600 tracking-wider border-l border-gray-200">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{plan.title}</h3>
                <p className="text-4xl font-bold text-gray-900">{plan.price}</p>
                {plan.period && <span className="text-gray-600 mb-2 block">{plan.period}</span>}
                <Link href={plan.ctaLink} className="mt-4 inline-block bg-[#1A5799] text-white py-2 px-4 rounded-lg hover:bg-[#154A85] transition-colors duration-200 block">
                  {plan.cta}
                </Link>
                {plan.tagline && <p className="text-xs text-gray-700 mt-2 normal-case">{plan.tagline}</p>}
              </div>
            ))}
          </div>

          {/* Table Body */}
          {features.map((category, catIndex) => (
            <React.Fragment key={catIndex}>
              <div className="grid grid-cols-4 bg-gray-100 border-b border-gray-200">
                <div className="p-4 text-left text-sm font-semibold text-gray-900 uppercase tracking-wider col-span-4">{category.category}</div>
              </div>
              {category.items.map((item, itemIndex) => (
                <div key={itemIndex} className="grid grid-cols-4 border-b border-gray-200 last:border-b-0">
                  <div className="p-4 text-left text-sm text-gray-900">{item.name}</div>
                  <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.free, 'Free')}</div>
                  <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.developer, 'Developer')}</div>
                  <div className="p-4 text-center border-l border-gray-200">{renderFeatureValue(item.growth, 'Growth')}</div>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  )
}