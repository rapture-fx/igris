'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowUpRight, Bot, ChevronRight } from 'lucide-react';

export default function SolutionsPage() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="pt-36 pb-20 sm:pt-36 sm:pb-24 lg:pt-36 lg:pb-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
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
      <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
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