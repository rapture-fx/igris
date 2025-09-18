'use client'

import React from 'react'
import { Brain, Factory, CreditCard, ShoppingBag, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const useCases = [
  {
    icon: Brain,
    title: 'Data + ML Pipelines',
    description: 'From ingestion to deployment. API-first pipelines that process data, train models, and serve predictions without overhead.',
    examples: [
      'Model registry with versioning and lineage tracking',
      'Advanced experiment tracking with real-time metrics',
      'Production model serving with canary deployments'
    ],
    cta: 'Explore Data + ML Pipelines',
    link: '/industries/ai-company',
    accent: 'from-blue-50 to-indigo-50',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600'
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    description: 'Sensor data processing and forecasting',
    examples: [
      'Equipment failure prediction from sensor data',
      'Batch processing for manufacturing analytics',
      'Real-time sensor data quality monitoring'
    ],
    cta: 'See Manufacturing Use Cases',
    link: '/industries/manufacturing',
    accent: 'from-emerald-50 to-green-50',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600'
  },
  {
    icon: CreditCard,
    title: 'Financial Services',
    description: 'Transaction analysis and risk scoring',
    examples: [
      'Fraud detection with risk scoring APIs',
      'Transaction data quality assessment',
      'Anomaly detection for financial data'
    ],
    cta: 'View FinTech Solutions',
    link: '/industries/financial-services',
    accent: 'from-amber-50 to-orange-50',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600'
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'Customer data processing and analytics',
    examples: [
      'Customer behavior data preprocessing',
      'Sales data quality assessment',
      'Purchase pattern anomaly detection'
    ],
    cta: 'Discover E-commerce Tools',
    link: '/industries/ecommerce',
    accent: 'from-purple-50 to-violet-50',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600'
  }
]

export default function WhatYouCanBuild() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-20">
          <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">
            What You Can Build
          </h2>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
            Turn data into <span style={{ color: '#114dcd' }}>advantage</span>
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
            Real solutions powered by Schlep-engine across industries. From AI startups to enterprise manufacturing.
          </p>
        </div>

        {/* 2x2 Grid of Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className={`bg-gradient-to-br ${useCase.accent} rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-lg hover:shadow-xl transition-all duration-300 flex flex-col justify-between`}
              style={{ minHeight: '200px' }}
            >
              {/* Icon and Title */}
              <div>
                <div className={`inline-flex items-center justify-center w-12 h-12 ${useCase.iconBg} rounded-xl mb-6`}>
                  <useCase.icon className={`h-6 w-6 ${useCase.iconColor}`} />
                </div>

                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                  {useCase.title}
                </h3>

                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6 font-inter leading-relaxed">
                  {useCase.description}
                </p>

                {/* Bullet Points */}
                <ul className="space-y-3 mb-8">
                  {useCase.examples.map((example, index) => (
                    <li key={index} className="flex items-start text-sm text-gray-600 dark:text-gray-300 font-inter">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="leading-relaxed">{example}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA Button */}
              <Link
                href={useCase.link}
                className="inline-flex items-center justify-center px-6 py-3 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md font-inter group w-full"
                style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
              >
                {useCase.cta}
                <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}