'use client'

import { CpuChipIcon, WrenchScrewdriverIcon, ChartBarIcon } from '@heroicons/react/24/outline'

export default function ManufacturingDataProcessingApiPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold">Manufacturing Data Processing Engine</h1>
        <p className="text-gray-600 text-lg">Transform messy manufacturing data into analysis-ready insights. Process sensor data, equipment telemetry, and production metrics with statistical algorithms.</p>
      </div>
      <div className="space-y-8">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Messy Data to Analysis-Ready Pipeline</h2>
          <div className="prose prose-sm max-w-none">
            <p>
              Our Manufacturing Data Processing Engine transforms <strong>raw industrial data into actionable statistical insights</strong>.
              Handle messy sensor data, equipment telemetry, and production metrics with enterprise-grade processing capabilities.
            </p>

            <h3>Core Processing Capabilities</h3>
            <ul>
              <li><strong>Multi-sensor data fusion:</strong> Combine data from different equipment types using Kalman filters</li>
              <li><strong>Automatic preprocessing:</strong> Handle missing values, outliers, and data quality issues</li>
              <li><strong>Time-series alignment:</strong> Synchronize data streams with different sampling rates</li>
              <li><strong>Feature engineering:</strong> Extract manufacturing-specific patterns and indicators</li>
              <li><strong>Real-time processing:</strong> Stream processing with configurable time windows</li>
              <li><strong>Manufacturing context:</strong> Integration with shift schedules, maintenance calendars</li>
            </ul>

            <h3>Business Applications</h3>
            <ul>
              <li><strong>Predictive Maintenance:</strong> Equipment failure prediction with cost-benefit analysis</li>
              <li><strong>Quality Control:</strong> Real-time defect detection and quality grading</li>
              <li><strong>Supply Chain:</strong> Inventory optimization with ROI calculations</li>
              <li><strong>Process Monitoring:</strong> Anomaly detection and performance optimization</li>
              <li><strong>Energy Management:</strong> Consumption optimization and cost reduction</li>
            </ul>

            <h3>Advanced Analytics</h3>
            <ul>
              <li><strong>Risk Scoring:</strong> Equipment health and failure probability assessment</li>
              <li><strong>Cost Analysis:</strong> Preventive vs reactive maintenance economics</li>
              <li><strong>Performance Metrics:</strong> OEE, availability, and productivity tracking</li>
              <li><strong>Compliance Monitoring:</strong> Quality standards and regulatory compliance</li>
              <li><strong>Resource Optimization:</strong> Labor, materials, and energy allocation</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50 p-6 rounded-lg">
            <CpuChipIcon className="h-8 w-8 text-blue-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Data Processing</h3>
            <p className="text-sm text-gray-600">
              Transform messy sensor data into clean, analysis-ready datasets with statistical preprocessing algorithms.
            </p>
          </div>

          <div className="bg-orange-50 p-6 rounded-lg">
            <WrenchScrewdriverIcon className="h-8 w-8 text-orange-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Predictive Maintenance</h3>
            <p className="text-sm text-gray-600">
              Statistical failure prediction with multi-sensor fusion and cost-benefit maintenance optimization.
            </p>
          </div>

          <div className="bg-green-50 p-6 rounded-lg">
            <ChartBarIcon className="h-8 w-8 text-green-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">Quality Control</h3>
            <p className="text-sm text-gray-600">
              Real-time quality analysis with automated grading, defect detection, and compliance tracking.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
