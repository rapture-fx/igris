import Link from 'next/link'
import { ArrowRightIcon, CheckCircleIcon, SparklesIcon, RocketLaunchIcon } from '@heroicons/react/24/outline'

export default function ChangelogPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Changelog & What's New</h1>
        <p className="text-xl text-gray-600">
          Stay up to date with the latest features, improvements, and fixes in Schlep Engine.
        </p>
      </div>

      {/* Latest Development Updates */}
      <section className="mb-12">
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-8 mb-8">
          <div className="flex items-center mb-4">
            <SparklesIcon className="h-6 w-6 text-blue-600 mr-2" />
            <h2 className="text-2xl font-semibold text-gray-900">Latest Development Updates</h2>
          </div>
          <p className="text-gray-700 mb-6">
            Recent enhancements and new capabilities that accelerate your ML workflows and improve data processing efficiency.
          </p>

          <div className="space-y-6">
            {/* Enhanced SDK Support */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-start">
                <RocketLaunchIcon className="h-5 w-5 text-green-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Enhanced Multi-Language SDK Support</h3>
                  <p className="text-gray-700 mb-3">
                    Expanded SDK ecosystem with comprehensive support for 8+ programming languages,
                    each optimized for different use cases and environments.
                  </p>
                  <div className="bg-gray-900 rounded p-3 mb-3">
                    <code className="text-green-400 text-sm">
                      {`# Python - Data Science focused
pip install schlep-engine

# Node.js - Web & serverless
npm install @schlep-engine/javascript-sdk

# Go - Cloud-native & microservices
go get github.com/schlep-engine/go-sdk

# CLI - DevOps & automation
pip install schlep-engine-cli`}
                    </code>
                  </div>
                  <Link href="/sdks" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center">
                    Explore all SDKs <ArrowRightIcon className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* ML Pipeline Optimization */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-start">
                <CheckCircleIcon className="h-5 w-5 text-blue-500 mr-3 mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Streamlined ML Pipeline Creation</h3>
                  <p className="text-gray-700 mb-3">
                    New one-call training pipelines that transform raw data into production-ready models
                    with automated preprocessing, hyperparameter tuning, and performance optimization.
                  </p>
                  <div className="bg-gray-900 rounded p-3 mb-3">
                    <code className="text-green-400 text-sm">
                      {`# Single API call for complete ML pipeline
result = client.ml.train_pipeline(
    data_source="sales_data.csv",
    target_column="revenue",
    task_type="regression",
    auto_optimize=True
)
# Returns trained model ready for deployment`}
                    </code>
                  </div>
                  <Link href="/api-reference/mlops" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center">
                    View MLOps API <ArrowRightIcon className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Performance Improvements */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-start">
                <div className="text-orange-500 mr-3 mt-1 flex-shrink-0">⚡</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">6x Faster Data Processing</h3>
                  <p className="text-gray-700 mb-3">
                    Rust-powered CSV processing and memory-optimized pipelines deliver significant
                    performance improvements for large dataset operations.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                    <div className="text-center p-3 bg-green-50 rounded">
                      <p className="text-lg font-bold text-green-600">6x</p>
                      <p className="text-xs text-gray-600">Faster Processing</p>
                    </div>
                    <div className="text-center p-3 bg-blue-50 rounded">
                      <p className="text-lg font-bold text-blue-600">40%</p>
                      <p className="text-xs text-gray-600">Less Memory</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded">
                      <p className="text-lg font-bold text-purple-600">50ms</p>
                      <p className="text-xs text-gray-600">Stream Latency</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded">
                      <p className="text-lg font-bold text-orange-600">99.9%</p>
                      <p className="text-xs text-gray-600">Uptime SLA</p>
                    </div>
                  </div>
                  <Link href="/concepts/architecture" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center">
                    Learn about architecture <ArrowRightIcon className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>

            {/* Industry-Specific Features */}
            <div className="bg-white rounded-lg p-6 border border-gray-200">
              <div className="flex items-start">
                <div className="text-purple-500 mr-3 mt-1 flex-shrink-0">🏭</div>
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Industry-Specific AI Solutions</h3>
                  <p className="text-gray-700 mb-3">
                    Specialized APIs and workflows for manufacturing predictive maintenance,
                    financial fraud detection, and e-commerce personalization.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700">
                      Manufacturing IoT
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-50 text-green-700">
                      Financial Services
                    </span>
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-50 text-purple-700">
                      E-commerce Analytics
                    </span>
                  </div>
                  <Link href="/industries/ai-company" className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center">
                    Explore industry solutions <ArrowRightIcon className="h-4 w-4 ml-1" />
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Version History */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Version History</h2>

        <div className="space-y-6">
          <Link
            href="/changelog/v2-3-0"
            className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Version 2.3.0</h3>
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Latest
              </span>
            </div>
            <p className="text-gray-600 mb-3">Released March 15, 2024</p>
            <p className="text-gray-700 mb-4">
              Advanced AI capabilities, real-time streaming, enhanced security features, and 40% performance improvements.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-blue-50 text-blue-700">
                AI Integration
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-green-50 text-green-700">
                Real-time Streaming
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-purple-50 text-purple-700">
                Enhanced Security
              </span>
            </div>
          </Link>

          <Link
            href="/changelog/v2-2-0"
            className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Version 2.2.0</h3>
              <span className="text-sm text-gray-500">February 8, 2024</span>
            </div>
            <p className="text-gray-700 mb-4">
              Enhanced data quality features, new visualization capabilities, and improved API performance.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-orange-50 text-orange-700">
                Data Quality
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-teal-50 text-teal-700">
                Visualization
              </span>
            </div>
          </Link>

          <Link
            href="/changelog/v2-1-0"
            className="block bg-white border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="text-lg font-semibold text-gray-900">Version 2.1.0</h3>
              <span className="text-sm text-gray-500">January 20, 2024</span>
            </div>
            <p className="text-gray-700 mb-4">
              New SDK releases, enhanced authentication, and expanded file format support.
            </p>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-indigo-50 text-indigo-700">
                SDK Updates
              </span>
              <span className="inline-flex items-center px-2 py-1 rounded text-xs bg-pink-50 text-pink-700">
                Authentication
              </span>
            </div>
          </Link>
        </div>
      </section>

      {/* Quick Links */}
      <section className="bg-gray-50 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Links</h2>
        <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/guides/sdk-migration"
            className="flex items-center p-4 bg-white rounded border hover:border-gray-300 transition-colors"
          >
            <div className="text-blue-600 mr-3">📚</div>
            <div>
              <h3 className="font-medium text-gray-900">Migration Guides</h3>
              <p className="text-sm text-gray-600">Step-by-step upgrade instructions</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>

          <Link
            href="/api-reference"
            className="flex items-center p-4 bg-white rounded border hover:border-gray-300 transition-colors"
          >
            <div className="text-green-600 mr-3">🔧</div>
            <div>
              <h3 className="font-medium text-gray-900">API Reference</h3>
              <p className="text-sm text-gray-600">Complete API documentation</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>

          <Link
            href="/sdks"
            className="flex items-center p-4 bg-white rounded border hover:border-gray-300 transition-colors"
          >
            <div className="text-purple-600 mr-3">⚡</div>
            <div>
              <h3 className="font-medium text-gray-900">SDK Documentation</h3>
              <p className="text-sm text-gray-600">Language-specific guides</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>

          <Link
            href="/introduction/quickstart"
            className="flex items-center p-4 bg-white rounded border hover:border-gray-300 transition-colors"
          >
            <div className="text-orange-600 mr-3">🚀</div>
            <div>
              <h3 className="font-medium text-gray-900">Getting Started</h3>
              <p className="text-sm text-gray-600">Quick start guide</p>
            </div>
            <ArrowRightIcon className="h-4 w-4 text-gray-400 ml-auto" />
          </Link>
        </div>
      </section>
    </div>
  )
}