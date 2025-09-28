'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Bot, Factory, DollarSign, ShoppingCart, ChevronRight } from 'lucide-react';

export default function SolutionsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-36 pb-20 sm:pt-36 sm:pb-24 lg:pt-36 lg:pb-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="w-full">
            <div className="text-left pt-8">
              <h2 className="text-base font-normal text-gray-500 dark:text-gray-400 mb-4 font-inter">
                Solution
              </h2>
              <h1
                style={{ color: '#1f53d0' }}
                className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
              >
                Clarity and scale,<br />built to fit your industry.
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
                Deploy anywhere. Your data, your control.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="rounded-lg p-8 h-[40rem]" style={{ backgroundColor: '#f2f1ed' }}>
                  <h3 className="font-medium text-gray-900 mb-4 font-inter text-left">Cloud Agnostic</h3>
                  <p className="text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter text-left">Deploy on AWS, Azure, GCP, or on-premises. Your choice, your timeline.</p>
                </div>
                <div className="rounded-lg p-8 h-[40rem]" style={{ backgroundColor: '#f2f1ed' }}>
                  <h3 className="font-medium text-gray-900 mb-4 font-inter text-left">Data Sovereignty</h3>
                  <p className="text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter text-left">Your data never leaves your infrastructure. Complete ownership and control.</p>
                </div>
                <div className="rounded-lg p-8 h-[40rem]" style={{ backgroundColor: '#f2f1ed' }}>
                  <h3 className="font-medium text-gray-900 mb-4 font-inter text-left">Zero Vendor Lock-in</h3>
                  <p className="text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter text-left">Portable across environments. Switch providers or go on-premises anytime.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* AI Companies Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
            {/* Left Column - Title and Description */}
            <div className="text-left lg:col-span-2">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">AI & Machine Learning</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Stop wasting time on data prep.<br />Deploy models quickly with optimized performance.
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter">
                From messy CSV to production model in minutes.<br />Built for teams who ship AI, not wrestle with infrastructure.
              </p>
            </div>

            {/* Right Column - Features */}
            <div className="lg:col-span-3">
              <div className="rounded-lg p-12 h-[60rem] flex items-center justify-center" style={{ backgroundColor: '#f2f1ed' }}>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Automated Data Processing</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Upload any format (CSV, JSON, Parquet, Excel) and get ML-ready data<br />with 6x faster processing. Rust-powered CSV reading and<br />memory-optimized pipelines eliminate weeks of data prep work.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Data Quality & Validation</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Advanced outlier detection (IQR, Z-score), statistical validation,<br />and data profiling. Catch data quality issues before they impact<br />model performance with 40% less memory usage.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">One-Call Training Pipelines</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">From upload to trained model in a single API call.<br />Automatic processing mode selection, result caching,<br />and built-in performance monitoring with multi-framework support.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Production MLOps</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Complete MLOps infrastructure with model registry,<br />experiment tracking, data lineage, and model serving.<br />Deploy with confidence using performance benchmarks and A/B testing.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-12 mt-16">
            <h3 className="text-xl font-normal text-gray-900 mb-8 text-left font-inter">How companies can accelerate AI Pipeline</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 font-inter text-left">Skip Data Prep</h4>
                  <p className="text-sm text-gray-600 mb-6 font-inter text-left">Upload raw data, get clean features instantly. No more weeks of pandas scripting and data cleaning.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-4 text-sm font-mono" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Upload and process data</div>
                    <div className="text-gray-900 mt-2">result = client.data.process_file("sales_data.csv",</div>
                    <div className="ml-4 text-blue-600">transformations=[</div>
                    <div className="ml-8 text-green-600">{"{"}"type": "filter", "remove_nulls": True{"}"},</div>
                    <div className="ml-8 text-green-600">{"{"}"type": "clean", "auto_detect": True{"}"}</div>
                    <div className="ml-4 text-blue-600">]</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># ML-ready in minutes</div>
                    <div className="text-green-600 mt-2">✓ Data processed: result.job_id</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 font-inter text-left">Train in One Call</h4>
                  <p className="text-sm text-gray-600 mb-6 font-inter text-left">Single API call from CSV to trained model. Automated preprocessing and hyperparameter optimization.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-4 text-sm font-mono" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Create ML pipeline</div>
                    <div className="text-gray-900 mt-2">config = MLPipelineConfig(</div>
                    <div className="ml-4 text-blue-600">task_type=MLTaskType.REGRESSION,</div>
                    <div className="ml-4 text-blue-600">target_column="revenue",</div>
                    <div className="ml-4 text-blue-600">auto_hyperparameter_tuning=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Train with one call</div>
                    <div className="text-gray-900 mt-2">job = client.ml.train_pipeline(config)</div>
                    <div className="text-green-600 mt-3">✓ Model ready: 94% accuracy</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="font-medium text-gray-900 mb-4 font-inter text-left">Deploy with Confidence</h4>
                  <p className="text-sm text-gray-600 mb-6 font-inter text-left">Model serving with built-in monitoring, versioning, and rollback capabilities.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-4 text-sm font-mono" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Deploy model</div>
                    <div className="text-gray-900 mt-2">deployment = client.deploy(job.model_id)</div>
                    <div className="text-gray-900 mt-2">print(deployment.endpoint_url)</div>
                    <div className="text-gray-600 mt-3"># Built-in monitoring</div>
                    <div className="text-gray-900 mt-2">status = client.status(job.job_id)</div>
                    <div className="text-green-600 mt-3">Performance tracking</div>
                    <div className="text-green-600">Model versioning enabled</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Manufacturing Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="w-full">
            <div className="text-left mb-16">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Smart Manufacturing</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Predictive maintenance and smart operations
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
                Connect existing MES systems to unlock predictive insights. Deploy in air-gapped industrial networks with complete data sovereignty.
              </p>
            </div>

            <div className="mb-16">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Equipment Failure Prediction</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models analyze sensor data to predict equipment failures before they happen. Real-time stream processing with WebSocket alerts for immediate response.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Manufacturing Analytics</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Batch processing capabilities for comprehensive manufacturing analytics. Process historical data, identify trends, and optimize production workflows with sub-second response times.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Real-time Monitoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Continuous sensor data quality monitoring with automated alerts. Stream processing for IoT data aggregation and instant notification delivery.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-12 mb-12">
              <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">MES System Integration</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="text-left p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">SAP MES</h4>
                  <p className="text-sm text-gray-600 font-inter">Real-time data sync with OAuth 2.0 authentication and production confirmation</p>
                </div>
                <div className="text-left p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Siemens</h4>
                  <p className="text-sm text-gray-600 font-inter">Integration health monitoring with real-time work order synchronization</p>
                </div>
                <div className="text-left p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Rockwell</h4>
                  <p className="text-sm text-gray-600 font-inter">Quality control automation with statistical validation and alerts</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="w-full">
            <div className="text-left mb-16">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Financial Technology</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Real-time fraud detection and risk management
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
                Process sensitive financial data in your own VPC. Stream-based fraud detection with complete regulatory compliance and data sovereignty.
              </p>
            </div>

            <div className="mb-16">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Fraud Detection & Risk Scoring</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Real-time fraud detection with advanced pattern recognition and risk scoring APIs. Stream processing with WebSocket notifications catches suspicious transactions instantly.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Transaction Quality Assessment</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive transaction data preprocessing and validation with real-time analysis. Ensure data integrity and maintain audit trails for regulatory compliance.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Anomaly Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models identify unusual patterns in financial data. Real-time event correlation and windowing for credit risk assessment and AML pattern detection.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-12 mb-12">
              <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">Compliance & Risk Management</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="p-6 bg-white rounded-lg shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Real-time AML Detection</h4>
                  <p className="text-sm text-gray-600 font-inter">Stream-based pattern recognition with instant alerts and comprehensive AML compliance automation</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Automated DPA Compliance</h4>
                  <p className="text-sm text-gray-600 font-inter">GDPR contract generation and legal workflow automation with multi-channel compliance alerts</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Multi-channel Alerts</h4>
                  <p className="text-sm text-gray-600 font-inter">WebSocket, email, SMS notifications for critical compliance events and fraud detection</p>
                </div>
                <div className="p-6 bg-white rounded-lg shadow-sm">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Regulatory Standards</h4>
                  <p className="text-sm text-gray-600 font-inter">PCI DSS, Basel III, GDPR, and AML/KYC compliance with automated audit trails</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="w-full">
            <div className="text-left mb-16">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">E-commerce & Retail</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Real-time personalization with advanced integration
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
                Customer data stays in your region for GDPR compliance. Real-time recommendation engines with complete data ownership and control.
              </p>
            </div>

            <div className="mb-16">
              <div className="space-y-8">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Customer Behavior Analysis</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Advanced preprocessing of customer behavior data with real-time user profile analysis. Stream processing for shopping patterns, preferences, and engagement metrics.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Sales Data Quality</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">Comprehensive sales data assessment and validation with real-time processing. Ensure data integrity across transactions, inventory, and customer interactions.</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 font-inter">Purchase Pattern Detection</h3>
                  <p className="text-gray-600 leading-relaxed font-inter">ML-powered anomaly detection with real-time stream processing. Advanced pattern recognition protects revenue and enhances customer experience.</p>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 pt-12 mb-12">
              <h3 className="text-xl font-semibold text-gray-900 mb-8 text-left font-inter">ML-Powered E-commerce Solutions</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Real-time Recommendations</h4>
                  <p className="text-sm text-gray-600 font-inter">Stream processing with WebSocket delivery for instant personalization and collaborative filtering models.</p>
                </div>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Demand Forecasting</h4>
                  <p className="text-sm text-gray-600 font-inter">Gradient boosting models with real-time market data integration for inventory optimization and trend analysis.</p>
                </div>
                <div className="p-6 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2 font-inter">Dynamic Pricing</h4>
                  <p className="text-sm text-gray-600 font-inter">Advanced optimization algorithms with stream-to-webhook bridge for instant updates and competitive pricing.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Section */}
      <section className="py-20 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="text-left relative min-h-[250px] flex items-center">
            <div className="w-full">
              <div className="text-left">
                <h2 className="text-xl tracking-tight md:text-2xl mb-4 font-inter" style={{ color: '#114dcd' }}>Your data, your cloud, your control.</h2>
                <p className="text-base mb-8 opacity-90 text-gray-700 dark:text-gray-300">
                  Build powerful ML pipelines anywhere. Cloud agnostic deployment with complete data sovereignty.
                </p>
                <Link
                  href="/pricing"
                  className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#1f53d0' }}
                >
                  Launch Your Pipeline
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}