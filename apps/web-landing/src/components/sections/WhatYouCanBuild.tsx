'use client'

import React, { useState, useRef } from 'react'
import { Brain, Factory, CreditCard, ShoppingBag, ArrowUpRight, ChevronLeft, ChevronRight } from 'lucide-react'
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
    accent: 'from-white to-white',
    iconBg: 'bg-white',
    iconColor: 'text-blue-600',
    isCustomIcon: true,
    customIconSrc: '/ML card.svg'
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    description: 'From sensor ingestion to predictive deployment. API-first pipelines that process manufacturing data, train predictive models, and serve insights without overhead.',
    examples: [
      'Equipment failure prediction from sensor data',
      'Batch processing for manufacturing analytics',
      'Real-time sensor data quality monitoring'
    ],
    cta: 'See Manufacturing Use Cases',
    link: '/industries/manufacturing',
    accent: 'from-white to-white',
    iconBg: 'bg-emerald-100',
    iconColor: 'text-emerald-600',
    isCustomIcon: true,
    customIconSrc: '/Manufacture.svg'
  },
  {
    icon: CreditCard,
    title: 'Financial Services',
    description: 'From transaction ingestion to fraud deployment. API-first pipelines that process financial data, train risk models, and serve predictions without overhead.',
    examples: [
      'Fraud detection with risk scoring APIs',
      'Transaction data quality assessment',
      'Anomaly detection for financial data'
    ],
    cta: 'View FinTech Solutions',
    link: '/industries/financial-services',
    accent: 'from-white to-white',
    iconBg: 'bg-amber-100',
    iconColor: 'text-amber-600',
    isCustomIcon: true,
    customIconSrc: '/Financial.svg'
  },
  {
    icon: ShoppingBag,
    title: 'E-commerce',
    description: 'From customer ingestion to recommendation deployment. API-first pipelines that process commerce data, train behavior models, and serve insights without overhead.',
    examples: [
      'Customer behavior data preprocessing',
      'Sales data quality assessment',
      'Purchase pattern anomaly detection'
    ],
    cta: 'Discover E-commerce Tools',
    link: '/industries/ecommerce',
    accent: 'from-white to-white',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600',
    isCustomIcon: true,
    customIconSrc: '/ecommerce.svg'
  }
]

export default function WhatYouCanBuild() {
  const [currentCard, setCurrentCard] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)

  const nextCard = () => {
    setCurrentCard((prev) => (prev + 1) % useCases.length)
  }

  const prevCard = () => {
    setCurrentCard((prev) => (prev - 1 + useCases.length) % useCases.length)
  }

  return (
    <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
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

          {/* Section Header */}
          <div className="text-center mb-20">
            <div className="inline-block border border-gray-300 rounded-lg px-3 py-1.5">
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter">
                Built for every scale
              </h2>
            </div>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              Turn data into <span style={{ color: '#114dcd' }}>advantage</span>
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Across industries, Schlep-engine powers the work behind the scenes.
            </p>
          </div>

          {/* Carousel with Navigation */}
          <div className="max-w-6xl mx-auto relative flex items-center gap-8">
            {/* Left Arrow */}
            <button
              onClick={prevCard}
              className="w-12 h-12 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group hover:border-blue-300 flex-shrink-0"
            >
              <ChevronLeft className="h-6 w-6 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </button>

            {/* Carousel Container */}
            <div className="flex-1 overflow-hidden rounded-xl">
              <div
                ref={containerRef}
                className="flex transition-transform duration-500 ease-in-out"
                style={{ transform: `translateX(-${currentCard * 100}%)` }}
              >
                {useCases.map((useCase, index) => (
                  <div
                    key={useCase.title}
                    className="w-full flex-shrink-0"
                  >
                    <div
                      className={`bg-gradient-to-br ${useCase.accent} rounded-xl p-6 border border-gray-200 dark:border-gray-700 ${index === 0 ? '' : 'shadow-lg hover:shadow-xl'} transition-all duration-300 flex items-center gap-6 ${(index === 1 || index === 3) ? 'flex-row-reverse' : ''}`}
                      style={{ minHeight: '400px' }}
                    >
                      {/* Left Column - Icon */}
                      <div className="flex-1 flex items-center justify-center">
                        {useCase.isCustomIcon ? (
                          <div className="h-60 w-60 flex items-center justify-center">
                            <img
                              src={useCase.customIconSrc}
                              alt={useCase.title}
                              className="h-60 w-60 object-contain"
                            />
                          </div>
                        ) : (
                          <div className={`inline-flex items-center justify-center w-24 h-24 ${useCase.iconBg} rounded-xl`}>
                            <useCase.icon className={`h-12 w-12 ${useCase.iconColor}`} />
                          </div>
                        )}
                      </div>

                      {/* Right Column - Content */}
                      <div className="flex-1 flex items-center justify-center">
                        <div className="bg-white border border-gray-200 rounded-xl p-10 shadow-md w-full h-full flex flex-col justify-between">
                          <div>
                            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                              {useCase.title}
                            </h3>

                            <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 font-inter leading-relaxed">
                              {useCase.description}
                            </p>

                            {/* Bullet Points */}
                            <ul className="space-y-2 mb-6">
                              {useCase.examples.map((example, exampleIndex) => (
                                <li key={exampleIndex} className="flex items-start text-sm text-gray-600 dark:text-gray-300 font-inter">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                                  <span className="leading-relaxed">{example}</span>
                                </li>
                              ))}
                            </ul>
                          </div>

                          {/* CTA Button */}
                          <Link
                            href={useCase.link}
                            className="inline-flex items-center justify-center px-6 py-3 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-sm hover:shadow-md font-inter group self-start"
                            style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
                          >
                            {useCase.cta}
                            <ArrowUpRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Arrow */}
            <button
              onClick={nextCard}
              className="w-12 h-12 bg-white border border-gray-200 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center group hover:border-blue-300 flex-shrink-0"
            >
              <ChevronRight className="h-6 w-6 text-gray-600 group-hover:text-blue-600 transition-colors" />
            </button>
          </div>

          {/* Navigation Dots */}
          <div className="flex justify-center space-x-2 mt-8">
            {useCases.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentCard(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  currentCard === index
                    ? 'bg-blue-600 scale-110'
                    : 'bg-gray-300 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}