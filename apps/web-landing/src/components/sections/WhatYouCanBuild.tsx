'use client'

import React from 'react'
import { Brain, Factory, CreditCard, ShoppingBag, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const useCases = [
  {
    icon: Brain,
    title: 'AI Company',
    description: 'ML model training and data pipelines',
    examples: [
      'CSV to trained model APIs',
      'Automated data quality assessment',
      'Model persistence and metadata tracking'
    ],
    cta: 'Explore AI Solutions',
    link: '/industries/ai-company'
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
    link: '/industries/manufacturing'
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
    link: '/industries/financial-services'
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
    link: '/industries/ecommerce'
  }
]

export default function WhatYouCanBuild() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-white dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">
            What You Can Build
          </h2>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
            Turn data into <span style={{ color: '#114dcd' }}>advantage</span>
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-3xl mx-auto font-inter">
            Real solutions built on Schlep-engine across industries. From AI startups to enterprise manufacturing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {useCases.map((useCase) => (
            <div
              key={useCase.title}
              className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 hover:shadow-lg transition-all duration-300 border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center mb-4">
                <useCase.icon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white font-inter">
                  {useCase.title}
                </h3>
              </div>

              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 font-inter">
                {useCase.description}
              </p>

              <ul className="space-y-2 mb-6">
                {useCase.examples.map((example, index) => (
                  <li key={index} className="text-xs text-gray-500 dark:text-gray-400 flex items-start font-inter">
                    <span className="w-1 h-1 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                    {example}
                  </li>
                ))}
              </ul>

              <Link
                href={useCase.link}
                className="inline-flex items-center text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm font-medium font-inter group"
              >
                {useCase.cta}
                <ArrowUpRight className="ml-1 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}