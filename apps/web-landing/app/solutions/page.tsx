'use client'

import Link from 'next/link'
import Image from 'next/image'
import { ArrowUpRight, Bot, Factory, DollarSign, ShoppingCart, ChevronRight } from 'lucide-react'

export default function SolutionsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-40 pb-20 sm:pt-40 sm:pb-24 lg:pt-40 lg:pb-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-center py-24 px-8 relative" style={{
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

            <p className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white md:text-4xl font-inter">
              <span style={{ color: '#1f53d0' }}>Clarity and scale, built to fit your industry.</span>
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl mx-auto font-inter">
              Across industries, Schlep-engine delivers clean, reliable data pipelines. <br /> Built to match your workflows and scale with your needs.
            </p>
          </div>
        </div>
      </section>

      {/* AI Companies Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-left mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">AI & Machine Learning</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight md:text-3xl font-inter" style={{ color: '#114dcd' }}>
              Build and ship AI models, faster.
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
              Stop wasting time on data prep. Deploy models quickly.
            </p>
          </div>

          <div className="mb-16">
            {/* Core Features */}
            <div className="space-y-8">
              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Automated Data Processing</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Upload any format (CSV, JSON, Parquet, Excel) and get ML-ready data instantly. Automated cleaning, feature engineering, and schema detection eliminate weeks of data prep work.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Data Quality & Validation</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced outlier detection (IQR, Z-score), statistical validation, and data profiling. Catch data quality issues before they impact model performance.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">One-Call Training Pipelines</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">From upload to trained model in a single API call. Automated preprocessing, feature selection, and model training with built-in experiment tracking and versioning.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Production MLOps</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Complete MLOps infrastructure with model registry, experiment tracking, data lineage, and production serving. Deploy with confidence using canary releases and A/B testing.</p>
                </div>
              </div>
            </div>

          </div>

          {/* Use Cases & Getting Started */}
          <div className="border-t border-gray-200 pt-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">How AI Companies Ship Faster</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="text-left">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Skip Data Prep</h4>
                <p className="text-sm text-gray-600 font-inter">Upload raw data, get clean features instantly. No more weeks of pandas scripting and data cleaning.</p>
              </div>
              <div className="text-left">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Train in One Call</h4>
                <p className="text-sm text-gray-600 font-inter">Single API call from CSV to trained model. Automated preprocessing and hyperparameter optimization.</p>
              </div>
              <div className="text-left">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Deploy with Confidence</h4>
                <p className="text-sm text-gray-600 font-inter">Production-ready serving with built-in monitoring, versioning, and rollback capabilities.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Manufacturing Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-left mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Smart Manufacturing</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight md:text-3xl font-inter" style={{ color: '#114dcd' }}>
              Predictive maintenance and smart operations
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
              Connect existing MES systems to unlock predictive insights. Reduce downtime with equipment failure prediction and optimize production with real-time analytics.
            </p>
          </div>

          <div className="mb-16">
            {/* Core Features */}
            <div className="space-y-8">
              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Equipment Failure Prediction</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models analyze sensor data to predict equipment failures before they happen. Reduce unplanned downtime and optimize maintenance schedules.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Manufacturing Analytics</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Batch processing capabilities for comprehensive manufacturing analytics. Process historical data, identify trends, and optimize production workflows.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Real-time Monitoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Continuous sensor data quality monitoring with automated alerts. Ensure data integrity and catch quality issues before they impact production.</p>
                </div>
              </div>
            </div>
          </div>

          {/* MES Integration */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">MES System Integration</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-left p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">SAP MES</h4>
                <p className="text-sm text-gray-600 font-inter">SAP Manufacturing Execution and SAP Digital Manufacturing Cloud integration</p>
              </div>
              <div className="text-left p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Siemens</h4>
                <p className="text-sm text-gray-600 font-inter">MindSphere and Opcenter Execution system connectivity</p>
              </div>
              <div className="text-left p-6 bg-gray-50 rounded-lg">
                <h4 className="font-medium text-gray-900 mb-2 font-inter">Rockwell</h4>
                <p className="text-sm text-gray-600 font-inter">FactoryTalk Manufacturing Execution System integration</p>
              </div>
            </div>
          </div>


        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-left mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Financial Technology</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight md:text-3xl font-inter" style={{ color: '#114dcd' }}>
              Advanced fraud detection and risk management
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
              Process sensitive financial data with confidence. Advanced fraud detection, risk scoring APIs, and comprehensive compliance management protect your business.
            </p>
          </div>

          <div className="mb-16">
            {/* Core Features */}
            <div className="space-y-8">
              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Fraud Detection & Risk Scoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Real-time fraud detection with advanced pattern recognition and risk scoring APIs. Isolation Forest-based anomaly detection catches suspicious transactions instantly.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Transaction Quality Assessment</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive transaction data preprocessing and validation. Ensure data integrity and maintain audit trails for regulatory compliance.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Anomaly Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models identify unusual patterns in financial data. Credit risk assessment and AML pattern detection protect against financial crimes.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Compliance Features */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">Compliance & Risk Management</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
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
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-6xl px-6 lg:px-8">
          <div className="text-left mb-16">
            <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">E-commerce & Retail</h2>
            <p className="mt-2 text-2xl font-medium tracking-tight md:text-3xl font-inter" style={{ color: '#114dcd' }}>
              Smart recommendations and customer analytics
            </p>
            <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
              Transform customer data into revenue growth. Advanced recommendation engines, demand forecasting, and behavioral analytics drive personalization at scale.
            </p>
          </div>

          <div className="mb-16">
            {/* Core Features */}
            <div className="space-y-8">
              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Customer Behavior Analysis</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced preprocessing of customer behavior data with user profile analysis. Understand shopping patterns, preferences, and engagement metrics for targeted personalization.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Sales Data Quality</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive sales data assessment and validation. Ensure data integrity across transactions, inventory, and customer interactions for reliable analytics.</p>
                </div>
              </div>

              <div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Purchase Pattern Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">ML-powered anomaly detection identifies unusual purchase patterns and fraud attempts. Advanced pattern recognition protects revenue and customer experience.</p>
                </div>
              </div>
            </div>
          </div>

          {/* ML Capabilities */}
          <div className="border-t border-gray-200 pt-12 mb-12">
            <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">ML-Powered E-commerce Solutions</h3>
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


        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="max-w-6xl mx-auto">
          <div className="text-left p-8 relative" style={{
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              {/* Left Column - Content */}
              <div>
                <h2 className="text-2xl md:text-3xl font-medium mb-4 leading-tight font-inter" style={{ color: '#1f53d0' }}>Secure at every layer. Built to scale.</h2>
                <p className="text-base mb-8 opacity-90 text-gray-700 dark:text-gray-300">
                  Build a powerful ML pipelines and simplify your data handling.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#1f53d0' }}
                >
                  Get Started <ChevronRight className="w-4 h-4 ml-2" />
                </Link>
              </div>

              {/* Right Column - SVG */}
              <div className="flex justify-center lg:justify-end">
                <Image
                  src="/CTA.svg"
                  alt="CTA Illustration"
                  width={300}
                  height={300}
                  className="w-full max-w-sm"
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}