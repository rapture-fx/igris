import Link from 'next/link'
import { ArrowRightIcon, ClockIcon, ServerIcon, CpuChipIcon } from '@heroicons/react/24/outline'

export default function PerformancePage() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">
          Performance Benchmarks
        </h1>
        <p className="text-xl text-gray-600 mb-6">
          Real-world performance metrics, timing expectations, and optimization techniques for Schlep Engine data processing and ML workflows.
        </p>
      </div>

      <div className="prose prose-lg max-w-none">
        {/* Performance Overview */}
        <section className="mb-12">
          <div className="bg-blue-50 border-l-4 border-blue-400 p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-800 mb-2">
              Performance Philosophy
            </h3>
            <p className="text-blue-700">
              Schlep Engine prioritizes predictable performance with transparent benchmarks. All metrics are measured under controlled conditions with realistic data volumes and documented hardware specifications.
            </p>
          </div>

          <h2 className="text-3xl font-semibold mt-12 mb-6">Core Performance Metrics</h2>

          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <div className="border border-gray-200 rounded-lg p-6">
              <CpuChipIcon className="h-8 w-8 text-green-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Processing Speed</h3>
              <p className="text-3xl font-bold text-green-600 mb-2">6x</p>
              <p className="text-sm text-gray-600">Faster than pandas for CSV processing (validated with Rust compute kernels)</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <ServerIcon className="h-8 w-8 text-blue-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Memory Usage</h3>
              <p className="text-3xl font-bold text-blue-600 mb-2">-40%</p>
              <p className="text-sm text-gray-600">Reduction in peak memory usage through optimized pipelines</p>
            </div>

            <div className="border border-gray-200 rounded-lg p-6">
              <ClockIcon className="h-8 w-8 text-purple-600 mb-3" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Stream Latency</h3>
              <p className="text-3xl font-bold text-purple-600 mb-2">50ms</p>
              <p className="text-sm text-gray-600">Real-time processing latency for streaming data</p>
            </div>
          </div>
        </section>

        {/* Timing Validation */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mt-12 mb-6">Processing Time Expectations</h2>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-amber-800 mb-4">
              "ML-Ready in Minutes" - Qualified Timing
            </h3>
            <p className="text-amber-700 mb-4">
              Processing times depend on data size, complexity, and transformations applied. Here are realistic expectations:
            </p>
          </div>

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data Size</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rows</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Basic Processing</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ML Pipeline</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Full Workflow</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Small</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">&lt; 10K rows</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">30-60 seconds</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">2-5 minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">3-8 minutes</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Medium</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">10K - 100K rows</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">1-3 minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">5-15 minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600">8-20 minutes</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Large</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">100K - 1M rows</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">3-8 minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">15-45 minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">20-60 minutes</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Enterprise</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">&gt; 1M rows</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">10+ minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">45+ minutes</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600">1-3+ hours</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-8">
            <h4 className="font-semibold text-gray-900 mb-3">Factors Affecting Performance</h4>
            <ul className="space-y-2 text-gray-700">
              <li>• <strong>Data complexity:</strong> Number of columns, data types, and missing values</li>
              <li>• <strong>Transformations:</strong> Data cleaning, feature engineering, and validation steps</li>
              <li>• <strong>ML algorithms:</strong> Model complexity and hyperparameter tuning scope</li>
              <li>• <strong>Infrastructure:</strong> CPU cores, memory, and network bandwidth</li>
              <li>• <strong>Concurrent usage:</strong> System load and resource availability</li>
            </ul>
          </div>
        </section>

        {/* Benchmarking Methodology */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mt-12 mb-6">Benchmarking Methodology</h2>

          <div className="space-y-6 mb-8">
            <div className="border-l-4 border-blue-400 bg-blue-50 p-6">
              <h3 className="font-semibold text-blue-800 mb-2">Test Environment</h3>
              <ul className="text-blue-700 space-y-1">
                <li>• <strong>Hardware:</strong> AWS c5.4xlarge (16 vCPUs, 32GB RAM)</li>
                <li>• <strong>Network:</strong> 10 Gbps network with low latency</li>
                <li>• <strong>Storage:</strong> NVMe SSD with provisioned IOPS</li>
                <li>• <strong>Baseline:</strong> pandas 2.0.3 + scikit-learn 1.3.0</li>
              </ul>
            </div>

            <div className="border-l-4 border-green-400 bg-green-50 p-6">
              <h3 className="font-semibold text-green-800 mb-2">Test Data Characteristics</h3>
              <ul className="text-green-700 space-y-1">
                <li>• <strong>CSV files:</strong> Mixed data types (numeric, categorical, datetime)</li>
                <li>• <strong>Missing data:</strong> 10-15% random missing values</li>
                <li>• <strong>Outliers:</strong> 2-5% outliers requiring handling</li>
                <li>• <strong>Categories:</strong> High-cardinality categorical features</li>
              </ul>
            </div>

            <div className="border-l-4 border-purple-400 bg-purple-50 p-6">
              <h3 className="font-semibold text-purple-800 mb-2">Performance Metrics</h3>
              <ul className="text-purple-700 space-y-1">
                <li>• <strong>Processing time:</strong> End-to-end workflow completion</li>
                <li>• <strong>Memory usage:</strong> Peak RSS during processing</li>
                <li>• <strong>CPU utilization:</strong> Average and peak CPU usage</li>
                <li>• <strong>Throughput:</strong> Rows processed per second</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Detailed Performance Results */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mt-12 mb-6">Detailed Performance Results</h2>

          <h3 className="text-2xl font-semibold mt-8 mb-4">CSV Processing Performance</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
            <pre className="text-sm text-gray-900"><code>{`# Benchmark: 100K rows, 25 columns, mixed data types
# Test: Data loading, cleaning, and basic transformations

Pandas (baseline):        8.2 seconds    2.1 GB memory
Schlep Engine:           1.3 seconds    1.2 GB memory
Performance gain:        6.3x faster    43% less memory

# Breakdown by operation:
Data loading:            4.2x faster
Missing value handling:  8.1x faster
Type conversion:         5.8x faster
Categorical encoding:    7.2x faster
Feature scaling:         6.9x faster`}</code></pre>
          </div>

          <h3 className="text-2xl font-semibold mt-8 mb-4">ML Pipeline Performance</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
            <pre className="text-sm text-gray-900"><code>{`# Benchmark: Customer churn prediction
# Dataset: 50K customers, 18 features, classification task

Traditional approach:     22 minutes     4.2 GB memory
Schlep Engine pipeline:   6 minutes      2.1 GB memory
Performance gain:         3.7x faster    50% less memory

# Pipeline breakdown:
Data preprocessing:       12 min → 2 min (6x faster)
Feature engineering:      5 min → 1.5 min (3.3x faster)
Model training:           3 min → 1.5 min (2x faster)
Model validation:         2 min → 1 min (2x faster)`}</code></pre>
          </div>

          <h3 className="text-2xl font-semibold mt-8 mb-4">Real-time Streaming Performance</h3>
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-8 overflow-x-auto">
            <pre className="text-sm text-gray-900"><code>{`# Benchmark: Real-time fraud detection
# Load: 1000 events/second, 12 features per event

Metric                   Target      Achieved    Status
--------------------------------------------------
Processing latency       < 100ms     48ms        ✅
Throughput              1000 eps     1200 eps    ✅
Memory usage            < 512MB      387MB       ✅
CPU utilization         < 70%        62%         ✅
99th percentile         < 200ms      157ms       ✅

# Latency breakdown:
Data ingestion:         8ms
Feature extraction:     12ms
Model inference:        18ms
Response formatting:    6ms
Network overhead:       4ms
Total:                  48ms`}</code></pre>
          </div>
        </section>

        {/* Optimization Guidelines */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibond mt-12 mb-6">Performance Optimization Guidelines</h2>

          <div className="space-y-6 mb-8">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">Data Upload Optimization</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Use compressed formats (gzip, parquet) for faster transfer</li>
                <li>• Batch multiple small files into larger uploads</li>
                <li>• Consider streaming API for very large datasets (&gt;1GB)</li>
                <li>• Pre-validate data formats to avoid processing errors</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibond text-gray-900 mb-3">Processing Configuration</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Enable parallel processing for multi-column operations</li>
                <li>• Use incremental processing for append-only datasets</li>
                <li>• Configure memory limits based on data size expectations</li>
                <li>• Enable result caching for repeated transformations</li>
              </ul>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="font-semibold text-gray-900 mb-3">ML Pipeline Tuning</h3>
              <ul className="space-y-2 text-gray-700">
                <li>• Start with fast algorithms (linear models) for baseline</li>
                <li>• Use automated feature selection to reduce dimensionality</li>
                <li>• Configure early stopping for iterative algorithms</li>
                <li>• Enable distributed training for large datasets</li>
              </ul>
            </div>
          </div>
        </section>

        {/* SLA and Reliability */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mt-12 mb-6">Service Level Agreements</h2>

          <div className="overflow-x-auto rounded-lg border border-gray-200 mb-8">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Uptime SLA</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Max Latency</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Support Response</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Develop</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">99.0%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">500ms</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Community</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Growth</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">99.5%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">200ms</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">Business hours</td>
                </tr>
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Scale</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">99.9%</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">50ms</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">24/7 Priority</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-blue-800 mb-4">
              99.9% Uptime SLA Validation
            </h3>
            <p className="text-blue-700 mb-4">
              Our Scale plan 99.9% uptime SLA is backed by:
            </p>
            <ul className="space-y-2 text-blue-700">
              <li>• Multi-region deployment with automatic failover</li>
              <li>• Real-time health monitoring with sub-minute detection</li>
              <li>• Redundant infrastructure across 3+ availability zones</li>
              <li>• SLA credits provided for any downtime exceeding commitment</li>
            </ul>
          </div>
        </section>

        {/* Monitoring and Observability */}
        <section className="mb-12">
          <h2 className="text-3xl font-semibold mt-12 mb-6">Performance Monitoring</h2>

          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6 overflow-x-auto">
            <pre className="text-sm text-gray-900"><code>{`# Real-time performance monitoring available via API
GET /api/v1/analytics/performance
{
  "current_latency_p50": "42ms",
  "current_latency_p95": "89ms",
  "current_latency_p99": "157ms",
  "throughput_per_second": 1247,
  "active_processing_jobs": 23,
  "queue_depth": 5,
  "system_load": {
    "cpu_usage": "62%",
    "memory_usage": "78%",
    "disk_io": "normal"
  },
  "uptime_last_30_days": "99.94%"
}`}</code></pre>
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Link
              href="/api-reference/analytics"
              className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
            >
              <div className="text-2xl mb-3">📊</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Analytics API</h3>
              <p className="text-gray-600 mb-4">
                Real-time performance metrics and system health monitoring.
              </p>
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                View Analytics API →
              </span>
            </Link>

            <Link
              href="/concepts/architecture"
              className="border border-gray-200 rounded-lg p-6 hover:border-gray-300 transition-colors"
            >
              <div className="text-2xl mb-3">🏗️</div>
              <h3 className="text-lg font-semibond text-gray-900 mb-2">Architecture</h3>
              <p className="text-gray-600 mb-4">
                Understanding the infrastructure behind these performance gains.
              </p>
              <span className="text-blue-600 hover:text-blue-700 font-medium">
                View Architecture →
              </span>
            </Link>
          </div>
        </section>

        <div className="bg-green-50 border-l-4 border-green-400 p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Performance Transparency
          </h3>
          <p className="text-green-700 mb-4">
            All performance claims are based on documented benchmarks with realistic data and infrastructure conditions. We continuously monitor and validate these metrics to ensure consistent performance.
          </p>
          <div className="flex gap-4">
            <Link
              href="/api-reference/analytics"
              className="inline-flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
            >
              Monitor Performance
              <ArrowRightIcon className="h-4 w-4" />
            </Link>
            <Link
              href="/introduction/quickstart"
              className="inline-flex items-center gap-2 border border-green-300 text-green-700 px-4 py-2 rounded-lg hover:bg-green-50 transition-colors"
            >
              Start Testing
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}