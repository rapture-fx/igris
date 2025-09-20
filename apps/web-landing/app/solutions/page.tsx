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
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">AI & Machine Learning</h2>
            <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
              <span style={{ color: '#114dcd' }}>Complete MLOps platform</span> from data to deployment
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Stop losing weeks to data preparation. Get enterprise-grade MLOps infrastructure with model registry, experiment tracking, and automated lineage tracking.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            {/* Core Features */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Model Registry & Versioning</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced model versioning with comprehensive lineage tracking. Track every transformation, experiment, and deployment with enterprise-grade metadata management.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Experiment Tracking</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Real-time metrics monitoring and advanced experiment tracking. Compare models, track performance, and optimize hyperparameters with comprehensive analytics.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Production Serving</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Seamless deployment with canary releases and A/B testing. Scale from prototype to production with enterprise reliability and monitoring.</p>
                </div>
              </div>
            </div>

            {/* Stats & Visual */}
            <div className="space-y-8">
              <Image
                src="/ML card.svg"
                alt="AI & Machine Learning"
                width={280}
                height={280}
                className="object-contain mx-auto"
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>5x</div>
                  <div className="text-sm text-gray-500 font-inter">Faster Development</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>95%</div>
                  <div className="text-sm text-gray-500 font-inter">Data Quality</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#1f53d0' }}>99.9%</div>
                  <div className="text-sm text-gray-500 font-inter">Reliability</div>
                </div>
              </div>
            </div>
          </div>

          {/* Use Cases */}
          <div className="border-t border-gray-200 pt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center font-inter">What AI Companies Build</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Model Registry</h4>
                <p className="text-sm text-gray-600 font-inter">Versioning, lineage tracking, and metadata management for production ML models</p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Experiment Tracking</h4>
                <p className="text-sm text-gray-600 font-inter">Real-time metrics monitoring with comprehensive performance analytics</p>
              </div>
              <div className="text-center">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Model Serving</h4>
                <p className="text-sm text-gray-600 font-inter">Production deployment with canary releases and A/B testing capabilities</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturing Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Smart Manufacturing</h2>
            <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
              <span style={{ color: '#059669' }}>Predictive maintenance</span> and smart operations
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Connect existing MES systems to unlock predictive insights. Reduce downtime with equipment failure prediction and optimize production with real-time analytics.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            {/* Visual */}
            <div className="flex items-center justify-center">
              <Image
                src="/Manufacture.svg"
                alt="Manufacturing"
                width={300}
                height={300}
                className="object-contain"
              />
            </div>

            {/* Core Features */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Factory className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Equipment Failure Prediction</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models analyze sensor data to predict equipment failures before they happen. Reduce unplanned downtime and optimize maintenance schedules.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Factory className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Manufacturing Analytics</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Batch processing capabilities for comprehensive manufacturing analytics. Process historical data, identify trends, and optimize production workflows.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <Factory className="w-6 h-6 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Real-time Monitoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Continuous sensor data quality monitoring with automated alerts. Ensure data integrity and catch quality issues before they impact production.</p>
                </div>
              </div>
            </div>
          </div>

          {/* MES Integration */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center font-inter">MES System Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">SAP MES</h4>
                <p className="text-sm text-gray-600 font-inter">SAP Manufacturing Execution and SAP Digital Manufacturing Cloud integration</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Siemens</h4>
                <p className="text-sm text-gray-600 font-inter">MindSphere and Opcenter Execution system connectivity</p>
              </div>
              <div className="text-center p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Rockwell</h4>
                <p className="text-sm text-gray-600 font-inter">FactoryTalk Manufacturing Execution System integration</p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#059669' }}>40%</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Downtime Reduction</div>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#059669' }}>25%</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Quality Improvement</div>
            </div>
            <div className="text-center p-6 bg-green-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#059669' }}>$2M+</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Annual Savings</div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Financial Technology</h2>
            <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
              <span style={{ color: '#dc2626' }}>Advanced fraud detection</span> and risk management
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Process sensitive financial data with confidence. Advanced fraud detection, risk scoring APIs, and comprehensive compliance management protect your business.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            {/* Core Features */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Fraud Detection & Risk Scoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Real-time fraud detection with advanced pattern recognition and risk scoring APIs. Isolation Forest-based anomaly detection catches suspicious transactions instantly.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Transaction Quality Assessment</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive transaction data preprocessing and validation. Ensure data integrity and maintain audit trails for regulatory compliance.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Anomaly Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models identify unusual patterns in financial data. Credit risk assessment and AML pattern detection protect against financial crimes.</p>
                </div>
              </div>
            </div>

            {/* Visual & Stats */}
            <div className="space-y-8">
              <Image
                src="/Financial.svg"
                alt="Financial Services"
                width={280}
                height={280}
                className="object-contain mx-auto"
              />

              <div className="grid grid-cols-1 gap-4">
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>99.2%</div>
                  <div className="text-sm text-gray-500 font-inter">Fraud Detection Rate</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>10x</div>
                  <div className="text-sm text-gray-500 font-inter">Processing Speed</div>
                </div>
                <div className="text-center p-4 bg-white rounded-lg shadow-sm">
                  <div className="text-3xl font-bold" style={{ color: '#dc2626' }}>100%</div>
                  <div className="text-sm text-gray-500 font-inter">Compliance Ready</div>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Features */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center font-inter">Compliance & Risk Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Credit Risk Assessment</h4>
                <p className="text-sm text-gray-600 font-inter">Advanced credit risk scoring with gradient boosting models and comprehensive risk grade classification</p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">AML Pattern Detection</h4>
                <p className="text-sm text-gray-600 font-inter">Anti-money laundering detection with pattern recognition and regulatory compliance automation</p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">DPA Compliance</h4>
                <p className="text-sm text-gray-600 font-inter">Complete GDPR DPA contract generation, legal workflow automation, and third-party processor management</p>
              </div>
              <div className="p-6 bg-white rounded-lg shadow-sm">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Regulatory Standards</h4>
                <p className="text-sm text-gray-600 font-inter">PCI DSS, Basel III, GDPR, and AML/KYC compliance with automated audit trails</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: 'white' }}>
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">E-commerce & Retail</h2>
            <p className="mt-2 text-3xl font-medium tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
              <span style={{ color: '#7c3aed' }}>Smart recommendations</span> and customer analytics
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Transform customer data into revenue growth. Advanced recommendation engines, demand forecasting, and behavioral analytics drive personalization at scale.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 mb-16">
            {/* Visual */}
            <div className="flex items-center justify-center">
              <Image
                src="/ecommerce.svg"
                alt="E-commerce"
                width={300}
                height={300}
                className="object-contain"
              />
            </div>

            {/* Core Features */}
            <div className="lg:col-span-2 space-y-8">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Customer Behavior Analysis</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced preprocessing of customer behavior data with user profile analysis. Understand shopping patterns, preferences, and engagement metrics for targeted personalization.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Sales Data Quality</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive sales data assessment and validation. Ensure data integrity across transactions, inventory, and customer interactions for reliable analytics.</p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0 w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <ShoppingCart className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Purchase Pattern Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">ML-powered anomaly detection identifies unusual purchase patterns and fraud attempts. Advanced pattern recognition protects revenue and customer experience.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ML Capabilities */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-center font-inter">ML-Powered E-commerce Solutions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Recommendation Engine</h4>
                <p className="text-sm text-gray-600 font-inter">Collaborative filtering with RandomForest models. Personalized product recommendations based on user behavior and purchase history.</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Demand Forecasting</h4>
                <p className="text-sm text-gray-600 font-inter">Gradient boosting models for inventory optimization. Predict demand patterns and seasonal trends for better stock management.</p>
              </div>
              <div className="p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Price Optimization</h4>
                <p className="text-sm text-gray-600 font-inter">Dynamic pricing algorithms that maximize revenue while maintaining competitiveness. Real-time price adjustments based on market conditions.</p>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>35%</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Revenue Increase</div>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>60%</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Customer Retention</div>
            </div>
            <div className="text-center p-6 bg-purple-50 rounded-lg">
              <div className="text-3xl font-bold" style={{ color: '#7c3aed' }}>+2.3%</div>
              <div className="text-sm text-gray-600 font-inter mt-2">Conversion Rate</div>
            </div>
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