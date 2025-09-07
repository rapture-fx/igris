'use client'

import { useState } from 'react'
import { 
  ArrowRightIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  RocketLaunchIcon,
  CpuChipIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  PlayIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline'
import CodeBlock from '../../components/ui/CodeBlock'
import MaturityIndicator from '../../components/ui/MaturityIndicator'

export default function Introduction() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const handleCopyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code)
    setCopiedCode(id)
    setTimeout(() => setCopiedCode(null), 2000)
  }

  return (
    <div className="max-w-7xl mx-auto px-6">
      {/* Hero Section */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">
            Enterprise Data Processing Platform
          </h1>
          <MaturityIndicator level="production" showLabel={false} />
        </div>
        <p className="text-sm text-gray-600 mb-6 max-w-3xl">
          Production-ready data processing and machine learning platform with intelligent compatibility mode. 
          Transform unstructured data into ML-ready datasets through enterprise APIs with world-class technical implementation.
        </p>
      </div>
      
      <div className="space-y-8">
        {/* Core Features */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Core Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">🔧 Predictive Maintenance</h3>
              <p className="text-sm text-gray-600 mb-3">
                Monitor vibration, temperature, and pressure sensors to detect equipment degradation patterns.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Equipment health scores in real-time</li>
                <li>• Multi-sensor correlation analysis</li>
                <li>• Automated degradation alerts</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Quality Control</h3>
              <p className="text-sm text-gray-600 mb-3">
                Multi-sensor correlation analysis for production lines with automated detection of sensor drift.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Statistical process control</li>
                <li>• Sensor calibration monitoring</li>
                <li>• Production quality metrics</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">⚡ Production Optimization</h3>
              <p className="text-sm text-gray-600 mb-3">
                Cross-sensor data validation and real-time anomaly detection for production equipment.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Real-time anomaly detection</li>
                <li>• Data preparation for analytics</li>
                <li>• Multi-source data fusion</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📄 Document Processing</h3>
              <p className="text-sm text-gray-600 mb-3">
                PDF, Excel, Word extraction for manufacturing documentation and data sheets.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Equipment manual extraction</li>
                <li>• Sensor specification parsing</li>
                <li>• Quality report processing</li>
              </ul>
            </div>
          </div>
        </section>

        {/* API Overview */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            API Overview
          </h2>
          <p className="text-sm text-gray-600 mb-6">
            Our REST API provides industrial sensor data processing with real anomaly detection and quality assessment capabilities.
          </p>
          
          <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mb-6">
            <div className="flex">
              <div className="ml-3">
                <p className="text-sm text-gray-600">
                  <strong>Base URL:</strong> <code className="bg-blue-100 px-2 py-1 rounded text-xs">https://api.schlep-engine.com</code>
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">📊 Data Quality Assessment</h4>
              <code className="text-xs text-gray-600">POST /api/v1/data-quality/assess</code>
              <p className="text-sm text-gray-600 mt-2">Industrial data quality assessment with anomaly detection</p>
            </div>
            
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">🔧 Sensor Validation</h4>
              <code className="text-xs text-gray-600">POST /api/v1/data-processing/validate-sensors</code>
              <p className="text-sm text-gray-600 mt-2">Multi-modal sensor validation and calibration check</p>
            </div>
          </div>
        </section>

        {/* What's Next */}
        <section className="bg-gray-50 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">What's Next?</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <a 
              href="/introduction/quickstart"
              className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <RocketLaunchIcon className="h-5 w-5" />
                <span className="font-medium">Quick Start</span>
              </div>
              <p className="text-sm text-gray-600">Set up your development environment</p>
            </a>
            <a 
              href="/introduction/api-keys"
              className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <ShieldCheckIcon className="h-5 w-5" />
                <span className="font-medium">Authentication</span>
              </div>
              <p className="text-sm text-gray-600">Learn about API keys and security</p>
            </a>
            <a 
              href="/introduction/first-call"
              className="text-left p-4 bg-white rounded-lg border border-gray-200 hover:border-blue-500 transition-colors"
            >
              <div className="flex items-center gap-2 text-blue-600 mb-2">
                <PlayIcon className="h-5 w-5" />
                <span className="font-medium">First API Call</span>
              </div>
              <p className="text-sm text-gray-600">Make your first request to the API</p>
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}