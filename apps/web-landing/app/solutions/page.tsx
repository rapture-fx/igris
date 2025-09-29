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
                Industry Solution
              </h2>
              <h1
                style={{ color: '#1f53d0' }}
                className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
              >
                Clarity and scale,<br />built to fit your industry.
              </h1>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 max-w-4xl font-inter">
                Where you build shouldn't limit how you scale. Schlep-engine adapts to your stack — keeping your data secure, portable, and fully under your control.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Cloud Agnostic</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-gray-600 leading-relaxed font-inter text-left">Deploy your workloads across AWS, Azure, GCP, or<br />on-premises with the same seamless experience.<br />No rewrites, no hidden limitations — just the flexibility<br />to run where it makes the most sense for your business.</p>
                  </div>
                </div>
                <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Data Sovereignty</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-gray-600 leading-relaxed font-inter text-left">Keep your data exactly where it belongs — within<br />your own infrastructure. You maintain complete<br />ownership and control while ensuring regulatory<br />alignment without added complexity.</p>
                  </div>
                </div>
                <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Zero Vendor Lock-in</h3>
                  </div>
                  <div className="mt-auto">
                    <p className="text-gray-600 leading-relaxed font-inter text-left">Your strategy should drive your infrastructure, not<br />the other way around. With true portability, you can<br />switch cloud providers, expand across regions, or<br />move fully on-premises without costly migrations.</p>
                  </div>
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
          <div className="pt-4 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Skip Data Prep</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Upload raw data, get clean features instantly. No more weeks of pandas scripting and data cleaning.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Upload and process data</div>
                    <div className="text-gray-900 mt-2">result = client.data.process_file("sales_data.csv",</div>
                    <div className="ml-4 text-blue-600">transformations=[</div>
                    <div className="ml-8 text-green-600">{"{"}"type": "filter", "remove_nulls": True{"}"},</div>
                    <div className="ml-8 text-green-600">{"{"}"type": "clean", "auto_detect": True{"}"}</div>
                    <div className="ml-4 text-blue-600">]</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Auto-validation and profiling</div>
                    <div className="text-gray-900 mt-2">print(f"Quality score: 92.5%")</div>
                    <div className="text-green-600 mt-2">✓ Data processed: job_abc123</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Train in One Call</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Single API call from CSV to trained model. Automated preprocessing and hyperparameter optimization.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Create ML pipeline</div>
                    <div className="text-gray-900 mt-2">config = MLPipelineConfig(</div>
                    <div className="ml-4 text-blue-600">task_type=MLTaskType.REGRESSION,</div>
                    <div className="ml-4 text-blue-600">target_column="revenue",</div>
                    <div className="ml-4 text-blue-600">auto_hyperparameter_tuning=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Train with one call</div>
                    <div className="text-gray-900 mt-2">job = client.ml.train_pipeline(config)</div>
                    <div className="text-gray-900 mt-2">print(f"Training completed in 45s")</div>
                    <div className="text-green-600 mt-2">✓ Model ready: 94% accuracy</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Deploy with Confidence</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Model serving with built-in monitoring, versioning, and rollback capabilities.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Deploy model</div>
                    <div className="text-gray-900 mt-2">deployment = client.deploy(job.model_id)</div>
                    <div className="text-gray-900 mt-2">print(deployment.endpoint_url)</div>
                    <div className="text-gray-600 mt-3"># Built-in monitoring</div>
                    <div className="text-gray-900 mt-2">status = client.status(job.job_id)</div>
                    <div className="text-gray-600 mt-3"># Health checks and metrics</div>
                    <div className="text-gray-900 mt-2">metrics = client.get_metrics(deployment.id)</div>
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
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
            {/* Left Column - Title and Description */}
            <div className="text-left lg:col-span-2">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Smart Manufacturing</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Predictive maintenance and smart operations
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter">
                Connect existing MES systems to unlock predictive insights.<br />Deploy in air-gapped industrial networks with complete data sovereignty.
              </p>
            </div>

            {/* Right Column - Features */}
            <div className="lg:col-span-3">
              <div className="rounded-lg p-12 h-[60rem] flex items-center justify-center" style={{ backgroundColor: '#f2f1ed' }}>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Equipment Failure Prediction</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models analyze sensor data to predict equipment failures<br />before they happen. Real-time stream processing with WebSocket alerts<br />for immediate response and maintenance scheduling.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Manufacturing Analytics</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Batch processing capabilities for comprehensive manufacturing analytics.<br />Process historical data, identify trends, and optimize production<br />workflows with sub-second response times.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Real-time Monitoring</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Continuous sensor data quality monitoring with automated alerts.<br />Stream processing for IoT data aggregation and instant<br />notification delivery across manufacturing systems.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">MES System Integration</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Complete integration with SAP MES, Siemens, and Rockwell systems.<br />Real-time data sync with OAuth 2.0 authentication and production<br />confirmation with quality control automation.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Sensor Data Processing</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Stream real-time sensor data with automated quality checks and failure prediction models.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Process sensor data stream</div>
                    <div className="text-gray-900 mt-2">sensor_stream = client.manufacturing.connect_sensors(</div>
                    <div className="ml-4 text-blue-600">equipment_ids=["pump_01", "motor_02"],</div>
                    <div className="ml-4 text-blue-600">data_types=["temperature", "vibration"],</div>
                    <div className="ml-4 text-blue-600">prediction_models=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Real-time alerts</div>
                    <div className="text-gray-900 mt-2">alerts = sensor_stream.get_alerts()</div>
                    <div className="text-green-600 mt-2">✓ Failure predicted: 72 hours</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Production Analytics</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Analyze production data to optimize workflows and identify bottlenecks in real-time.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Production analytics</div>
                    <div className="text-gray-900 mt-2">analytics = client.manufacturing.analyze_production(</div>
                    <div className="ml-4 text-blue-600">time_range="last_24h",</div>
                    <div className="ml-4 text-blue-600">metrics=["throughput", "quality", "efficiency"],</div>
                    <div className="ml-4 text-blue-600">optimization=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Optimization insights</div>
                    <div className="text-gray-900 mt-2">print(f"Efficiency: {"{analytics.efficiency}"}%")</div>
                    <div className="text-green-600 mt-2">✓ Bottleneck identified: Station 3</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">MES Integration</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Connect with existing MES systems for seamless data flow and automated reporting.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># MES system integration</div>
                    <div className="text-gray-900 mt-2">mes_client = client.manufacturing.connect_mes(</div>
                    <div className="ml-4 text-blue-600">system_type="SAP_MES",</div>
                    <div className="ml-4 text-blue-600">auth_method="oauth2",</div>
                    <div className="ml-4 text-blue-600">real_time_sync=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Sync production data</div>
                    <div className="text-gray-900 mt-2">sync_status = mes_client.sync_data()</div>
                    <div className="text-green-600 mt-2">✓ Real-time sync active</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Financial Services Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
            {/* Left Column - Title and Description */}
            <div className="text-left lg:col-span-2">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">Financial Technology</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Real-time fraud detection and risk management
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter">
                Process sensitive financial data in your own VPC.<br />Stream-based fraud detection with complete regulatory compliance.
              </p>
            </div>

            {/* Right Column - Features */}
            <div className="lg:col-span-3">
              <div className="rounded-lg p-12 h-[60rem] flex items-center justify-center" style={{ backgroundColor: '#f2f1ed' }}>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Fraud Detection & Risk Scoring</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Real-time fraud detection with advanced pattern recognition and<br />risk scoring APIs. Stream processing with WebSocket notifications<br />catches suspicious transactions instantly.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Transaction Quality Assessment</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Comprehensive transaction data preprocessing and validation with<br />real-time analysis. Ensure data integrity and maintain audit trails<br />for regulatory compliance across all financial operations.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Anomaly Detection</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Advanced ML models identify unusual patterns in financial data.<br />Real-time event correlation and windowing for credit risk assessment<br />and AML pattern detection with automated alerts.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Regulatory Compliance</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Complete compliance automation with PCI DSS, Basel III, GDPR,<br />and AML/KYC standards. Multi-channel alerts and automated<br />audit trails for seamless regulatory reporting.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Real-time Fraud Detection</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Monitor transactions in real-time with advanced ML models for instant fraud detection and risk scoring.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Real-time fraud detection</div>
                    <div className="text-gray-900 mt-2">fraud_detector = client.fintech.create_detector(</div>
                    <div className="ml-4 text-blue-600">models=["anomaly", "pattern_recognition"],</div>
                    <div className="ml-4 text-blue-600">real_time=True,</div>
                    <div className="ml-4 text-blue-600">risk_threshold=0.75</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Process transaction</div>
                    <div className="text-gray-900 mt-2">result = fraud_detector.analyze(transaction)</div>
                    <div className="text-green-600 mt-2">✓ Risk score: 0.12 (Low)</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">AML Compliance</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Automated anti-money laundering detection with pattern recognition and regulatory reporting.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># AML pattern detection</div>
                    <div className="text-gray-900 mt-2">aml_monitor = client.fintech.aml_compliance(</div>
                    <div className="ml-4 text-blue-600">patterns=["structuring", "layering"],</div>
                    <div className="ml-4 text-blue-600">time_window="30d",</div>
                    <div className="ml-4 text-blue-600">auto_report=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Monitor transactions</div>
                    <div className="text-gray-900 mt-2">alerts = aml_monitor.check_patterns()</div>
                    <div className="text-green-600 mt-2">✓ Compliance: Passed</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Risk Assessment</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Comprehensive risk scoring with real-time analysis and automated decision making.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Risk assessment pipeline</div>
                    <div className="text-gray-900 mt-2">risk_engine = client.fintech.risk_assessment(</div>
                    <div className="ml-4 text-blue-600">credit_scoring=True,</div>
                    <div className="ml-4 text-blue-600">behavioral_analysis=True,</div>
                    <div className="ml-4 text-blue-600">real_time_decisions=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Calculate risk score</div>
                    <div className="text-gray-900 mt-2">score = risk_engine.calculate_risk(customer)</div>
                    <div className="text-green-600 mt-2">✓ Decision: Approved (Score: 820)</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* E-commerce Section */}
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
            {/* Left Column - Title and Description */}
            <div className="text-left lg:col-span-2">
              <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter">E-commerce & Retail</h2>
              <p className="mt-2 text-xl tracking-tight md:text-2xl font-inter" style={{ color: '#114dcd' }}>
                Real-time personalization with advanced integration
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-600 dark:text-gray-300 font-inter">
                Customer data stays in your region for GDPR compliance.<br />Real-time recommendation engines with complete data ownership.
              </p>
            </div>

            {/* Right Column - Features */}
            <div className="lg:col-span-3">
              <div className="rounded-lg p-12 h-[60rem] flex items-center justify-center" style={{ backgroundColor: '#f2f1ed' }}>
                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Customer Behavior Analysis</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Advanced preprocessing of customer behavior data with real-time<br />user profile analysis. Stream processing for shopping patterns,<br />preferences, and engagement metrics optimization.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Sales Data Quality</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Comprehensive sales data assessment and validation with<br />real-time processing. Ensure data integrity across transactions,<br />inventory, and customer interactions with automated quality checks.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Purchase Pattern Detection</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">ML-powered anomaly detection with real-time stream processing.<br />Advanced pattern recognition protects revenue and enhances<br />customer experience with intelligent fraud prevention.</p>
                  </div>

                  <div>
                    <h3 className="text-lg font-normal text-gray-900 mb-2 font-inter">Personalization Engine</h3>
                    <p className="text-gray-600 leading-relaxed font-inter">Real-time recommendations with collaborative filtering models.<br />Dynamic pricing optimization and demand forecasting with<br />gradient boosting algorithms for maximum revenue.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="pt-4 mt-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Real-time Recommendations</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Personalized product recommendations with collaborative filtering and real-time user behavior analysis.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Real-time recommendations</div>
                    <div className="text-gray-900 mt-2">recommender = client.ecommerce.create_recommender(</div>
                    <div className="ml-4 text-blue-600">model_type="collaborative_filtering",</div>
                    <div className="ml-4 text-blue-600">real_time=True,</div>
                    <div className="ml-4 text-blue-600">personalization_depth="high"</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Get recommendations</div>
                    <div className="text-gray-900 mt-2">recs = recommender.get_recommendations(user_id)</div>
                    <div className="text-green-600 mt-2">✓ 12 products recommended</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Dynamic Pricing</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Optimize pricing in real-time based on demand, competition, and market conditions.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Dynamic pricing engine</div>
                    <div className="text-gray-900 mt-2">pricing_engine = client.ecommerce.dynamic_pricing(</div>
                    <div className="ml-4 text-blue-600">strategy="demand_based",</div>
                    <div className="ml-4 text-blue-600">competitor_monitoring=True,</div>
                    <div className="ml-4 text-blue-600">real_time_updates=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Update pricing</div>
                    <div className="text-gray-900 mt-2">new_price = pricing_engine.optimize_price(product_id)</div>
                    <div className="text-green-600 mt-2">✓ Price optimized: +15% revenue</div>
                  </div>
                </div>
              </div>
              <div className="rounded-lg p-8 h-[40rem] flex flex-col" style={{ backgroundColor: '#f2f1ed' }}>
                <div>
                  <h4 className="text-lg font-normal text-gray-900 mb-2 font-inter text-left">Demand Forecasting</h4>
                  <p className="text-gray-600 leading-relaxed mb-6 font-inter text-left">Predict demand patterns and optimize inventory with advanced ML models and market analysis.</p>
                </div>
                <div className="mt-auto">
                  <div className="rounded-lg p-8 text-sm font-mono shadow-md" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="text-gray-600"># Demand forecasting</div>
                    <div className="text-gray-900 mt-2">forecast = client.ecommerce.demand_forecast(</div>
                    <div className="ml-4 text-blue-600">time_horizon="30d",</div>
                    <div className="ml-4 text-blue-600">model="gradient_boosting",</div>
                    <div className="ml-4 text-blue-600">external_factors=True</div>
                    <div className="text-gray-900">)</div>
                    <div className="text-gray-600 mt-3"># Generate forecast</div>
                    <div className="text-gray-900 mt-2">prediction = forecast.predict(product_categories)</div>
                    <div className="text-green-600 mt-2">✓ 94% accuracy forecast</div>
                  </div>
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