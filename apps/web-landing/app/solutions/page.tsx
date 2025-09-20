'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Bot, Factory, DollarSign, ShoppingCart, Zap, Shield, TrendingUp, BarChart3 } from 'lucide-react'

export default function SolutionsPage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#f7f7f3' }}>
      {/* Hero Section */}
      <div className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl" style={{ color: '#1f53d0' }}>
              Solutions for Every Industry
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-3xl mx-auto">
              Transform your data challenges into competitive advantages with industry-specific solutions designed for scale, security, and performance.
            </p>
          </div>
        </div>
      </div>

      {/* AI Companies Section */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#e9eef9' }}>
                  <Bot className="h-8 w-8" style={{ color: '#1f53d0' }} />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">AI Companies</h2>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{ color: '#1f53d0' }}>
                Accelerate AI Development with Clean Data
              </h3>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Transform raw data into ML-ready datasets that power breakthrough AI models. Our platform eliminates data preparation bottlenecks, letting your team focus on innovation instead of data wrangling.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1f53d0' }}></div>
                  <span className="text-gray-700">Reduce data prep time by 80%</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1f53d0' }}></div>
                  <span className="text-gray-700">Ensure ML model accuracy</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1f53d0' }}></div>
                  <span className="text-gray-700">Scale data pipelines seamlessly</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1f53d0' }}></div>
                  <span className="text-gray-700">Support multiple ML frameworks</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>5x</div>
                  <div className="text-sm text-gray-500">Faster Time to Model</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>95%</div>
                  <div className="text-sm text-gray-500">Data Quality</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>99.9%</div>
                  <div className="text-sm text-gray-500">Pipeline Reliability</div>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: '#1f53d0' }}
              >
                Power Your AI
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="w-96 h-96 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#e9eef9' }}>
                <Bot className="h-32 w-32" style={{ color: '#1f53d0' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturing Section */}
      <section className="py-20" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center lg:order-1">
              <div className="w-96 h-96 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#d1fae5' }}>
                <Factory className="h-32 w-32" style={{ color: '#059669' }} />
              </div>
            </div>
            <div className="lg:order-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#d1fae5' }}>
                  <Factory className="h-8 w-8" style={{ color: '#059669' }} />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">Manufacturing</h2>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{ color: '#059669' }}>
                Optimize Operations with Real-Time Data
              </h3>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Turn sensor data and production metrics into actionable insights. Predict maintenance needs, optimize quality control, and streamline operations with real-time data processing that scales with your production.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                  <span className="text-gray-700">Predictive maintenance alerts</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                  <span className="text-gray-700">Real-time quality monitoring</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                  <span className="text-gray-700">Production optimization</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#059669' }}></div>
                  <span className="text-gray-700">Cost reduction insights</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#059669' }}>40%</div>
                  <div className="text-sm text-gray-500">Downtime Reduction</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#059669' }}>25%</div>
                  <div className="text-sm text-gray-500">Quality Improvement</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#059669' }}>$2M+</div>
                  <div className="text-sm text-gray-500">Annual Savings</div>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: '#059669' }}
              >
                Optimize Production
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#fee2e2' }}>
                  <DollarSign className="h-8 w-8" style={{ color: '#dc2626' }} />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">Financial Services</h2>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{ color: '#dc2626' }}>
                Enhance Risk Management & Compliance
              </h3>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Process financial data with enterprise-grade security and compliance. Detect fraud patterns, assess risk in real-time, and ensure regulatory compliance while maintaining the highest standards of data privacy.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
                  <span className="text-gray-700">Advanced fraud detection</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
                  <span className="text-gray-700">Real-time risk assessment</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
                  <span className="text-gray-700">Regulatory compliance</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#dc2626' }}></div>
                  <span className="text-gray-700">Secure data processing</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>99.2%</div>
                  <div className="text-sm text-gray-500">Fraud Detection</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>10x</div>
                  <div className="text-sm text-gray-500">Processing Speed</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>100%</div>
                  <div className="text-sm text-gray-500">Compliance Score</div>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: '#dc2626' }}
              >
                Secure Your Data
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
            <div className="flex justify-center">
              <div className="w-96 h-96 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#fee2e2' }}>
                <DollarSign className="h-32 w-32" style={{ color: '#dc2626' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section className="py-20" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div className="flex justify-center lg:order-1">
              <div className="w-96 h-96 rounded-2xl flex items-center justify-center" style={{ backgroundColor: '#ede9fe' }}>
                <ShoppingCart className="h-32 w-32" style={{ color: '#7c3aed' }} />
              </div>
            </div>
            <div className="lg:order-2">
              <div className="flex items-center space-x-3 mb-6">
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#ede9fe' }}>
                  <ShoppingCart className="h-8 w-8" style={{ color: '#7c3aed' }} />
                </div>
                <h2 className="text-4xl font-bold text-gray-900">E-commerce</h2>
              </div>
              <h3 className="text-2xl font-semibold mb-6" style={{ color: '#7c3aed' }}>
                Drive Growth with Customer Analytics
              </h3>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                Understand customer behavior, optimize inventory, and personalize experiences at scale. Process transaction data, user interactions, and market trends to boost revenue and customer satisfaction.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7c3aed' }}></div>
                  <span className="text-gray-700">Customer behavior insights</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7c3aed' }}></div>
                  <span className="text-gray-700">Inventory optimization</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7c3aed' }}></div>
                  <span className="text-gray-700">Personalization engines</span>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#7c3aed' }}></div>
                  <span className="text-gray-700">Revenue growth analytics</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>35%</div>
                  <div className="text-sm text-gray-500">Revenue Increase</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>60%</div>
                  <div className="text-sm text-gray-500">Customer Retention</div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>+2.3%</div>
                  <div className="text-sm text-gray-500">Conversion Rate</div>
                </div>
              </div>
              <Link
                href="/pricing"
                className="inline-flex items-center px-6 py-3 rounded-xl font-semibold text-white transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Boost Revenue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-6" style={{ color: '#1f53d0' }}>
              Ready to Transform Your Industry?
            </h2>
            <p className="text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Join hundreds of companies already using Schlep Engine to accelerate their data processing and unlock new insights across every industry.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/pricing"
                className="px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200 hover:shadow-lg"
                style={{ backgroundColor: '#1f53d0', color: 'white' }}
              >
                View Pricing
              </Link>
              <Link
                href="/contact"
                className="px-8 py-4 rounded-xl font-semibold text-lg border-2 transition-all duration-200 hover:shadow-lg"
                style={{
                  borderColor: '#1f53d0',
                  color: '#1f53d0',
                  backgroundColor: 'transparent'
                }}
              >
                Talk to Sales
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}