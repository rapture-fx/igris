'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Bot, Factory, DollarSign, ShoppingCart } from 'lucide-react'

export default function SolutionsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-56 pb-20 sm:pt-60 sm:pb-24 lg:pt-64 lg:pb-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Industry-specific solutions</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#114dcd' }}>Transform your industry</span> with clean data
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              From AI companies to manufacturing, financial services to e-commerce—Schlep Engine turns complex data challenges into competitive advantages across every industry.
            </p>
          </div>
        </div>
      </section>

      {/* AI Companies Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">AI & Machine Learning</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#114dcd' }}>Accelerate AI development</span> with clean data
            </p>
          </div>

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

            <div className="border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                {/* Left side - Content */}
                <div className="border-r border-gray-200 dark:border-gray-700 p-16 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 font-inter">
                    Complete MLOps platform from data to deployment
                  </h3>
                  <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-8 font-inter">
                    Stop losing weeks to data preparation. Get a complete MLOps platform with model registry, experiment tracking, and automated lineage tracking that scales from prototype to enterprise deployment.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="text-sm text-gray-600 font-inter">Model registry with versioning and lineage tracking</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="text-sm text-gray-600 font-inter">Advanced experiment tracking with real-time metrics</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mt-2 mr-3 flex-shrink-0"></div>
                      <span className="text-sm text-gray-600 font-inter">Production model serving with canary deployments</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#1f53d0' }}>5x</div>
                      <div className="text-xs text-gray-500">Faster Development</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#1f53d0' }}>95%</div>
                      <div className="text-xs text-gray-500">Data Quality</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#1f53d0' }}>99.9%</div>
                      <div className="text-xs text-gray-500">Reliability</div>
                    </div>
                  </div>
                </div>

                {/* Right side - Visual */}
                <div className="p-16 flex items-center justify-center">
                  <Image
                    src="/ML card.svg"
                    alt="AI & Machine Learning"
                    width={240}
                    height={240}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
            >
              Power Your AI
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Manufacturing Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Smart Manufacturing</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#059669' }}>Optimize operations</span> with real-time data
            </p>
          </div>

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

            <div className="border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                {/* Left side - Visual */}
                <div className="border-r border-gray-200 dark:border-gray-700 p-16 flex items-center justify-center">
                  <Image
                    src="/Manufacture.svg"
                    alt="Manufacturing"
                    width={240}
                    height={240}
                    className="object-contain"
                  />
                </div>

                {/* Right side - Content */}
                <div className="p-16 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 font-inter">
                    Predictive maintenance and smart manufacturing
                  </h3>
                  <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-8 font-inter">
                    Connect your existing manufacturing systems to unlock predictive insights. Reduce downtime with equipment failure prediction, improve quality control, and optimize production with real-time sensor monitoring.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#059669' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Equipment failure prediction from sensor data</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#059669' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Batch processing for manufacturing analytics</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#059669' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Real-time sensor data quality monitoring</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#059669' }}>40%</div>
                      <div className="text-xs text-gray-500">Downtime Reduction</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#059669' }}>25%</div>
                      <div className="text-xs text-gray-500">Quality Improvement</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#059669' }}>$2M+</div>
                      <div className="text-xs text-gray-500">Annual Savings</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-green-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#d1fae5', color: '#059669' }}
            >
              Optimize Production
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Financial Technology</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#dc2626' }}>Enhance risk management</span> & compliance
            </p>
          </div>

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

            <div className="border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                {/* Left side - Content */}
                <div className="border-r border-gray-200 dark:border-gray-700 p-16 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 font-inter">
                    Advanced fraud detection and risk management
                  </h3>
                  <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-8 font-inter">
                    Process sensitive financial data with confidence. Advanced fraud detection with risk scoring APIs, transaction quality assessment, and anomaly detection ensure you meet regulatory requirements while protecting your business.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#dc2626' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Fraud detection with risk scoring APIs</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#dc2626' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Transaction data quality assessment</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#dc2626' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Anomaly detection for financial data</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>99.2%</div>
                      <div className="text-xs text-gray-500">Fraud Detection</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>10x</div>
                      <div className="text-xs text-gray-500">Processing Speed</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#dc2626' }}>100%</div>
                      <div className="text-xs text-gray-500">Compliance</div>
                    </div>
                  </div>
                </div>

                {/* Right side - Visual */}
                <div className="p-16 flex items-center justify-center">
                  <Image
                    src="/Financial.svg"
                    alt="Financial Services"
                    width={240}
                    height={240}
                    className="object-contain"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-red-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#fee2e2', color: '#dc2626' }}
            >
              Secure Your Data
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">E-commerce & Retail</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#7c3aed' }}>Drive growth</span> with customer analytics
            </p>
          </div>

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

            <div className="border border-gray-200 dark:border-gray-700">
              <div className="grid grid-cols-2" style={{ backgroundColor: '#f7f7f3' }}>
                {/* Left side - Visual */}
                <div className="border-r border-gray-200 dark:border-gray-700 p-16 flex items-center justify-center">
                  <Image
                    src="/ecommerce.svg"
                    alt="E-commerce"
                    width={240}
                    height={240}
                    className="object-contain"
                  />
                </div>

                {/* Right side - Content */}
                <div className="p-16 text-left">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 font-inter">
                    Smart recommendations and data-driven insights
                  </h3>
                  <p className="text-base text-gray-600 dark:text-gray-300 leading-relaxed mb-8 font-inter">
                    Transform customer data into revenue with advanced analytics. Process customer behavior data, assess sales data quality, and detect purchase pattern anomalies to increase conversion rates and customer lifetime value.
                  </p>

                  <div className="space-y-4 mb-8">
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Customer behavior data preprocessing</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Sales data quality assessment</span>
                    </div>
                    <div className="flex items-start">
                      <div className="w-1.5 h-1.5 rounded-full mt-2 mr-3 flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}></div>
                      <span className="text-sm text-gray-600 font-inter">Purchase pattern anomaly detection</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#7c3aed' }}>35%</div>
                      <div className="text-xs text-gray-500">Revenue Increase</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#7c3aed' }}>60%</div>
                      <div className="text-xs text-gray-500">Customer Retention</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold" style={{ color: '#7c3aed' }}>+2.3%</div>
                      <div className="text-xs text-gray-500">Conversion Rate</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-purple-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#ede9fe', color: '#7c3aed' }}
            >
              Boost Revenue
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Ready to transform your industry?</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl font-inter">
              <span style={{ color: '#114dcd' }}>Join hundreds of companies</span> already scaling with Schlep Engine
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              From startups to enterprise, teams across every industry use Schlep Engine to accelerate their data processing and unlock new insights.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
            >
              View Pricing
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-300 hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter text-gray-700"
            >
              Talk to Sales
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}