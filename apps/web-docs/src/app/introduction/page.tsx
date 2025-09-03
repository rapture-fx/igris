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
  PlayIcon
} from '@heroicons/react/24/outline'
import CodeBlock from '../../components/ui/CodeBlock'

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
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 mb-3">
          Industrial Data Processing Platform
        </h1>
        <p className="text-xs text-[#999999] mb-4 max-w-3xl">
          Transform messy manufacturing and sensor data into analysis-ready datasets. 
          Industrial sensor validation, equipment health monitoring, and real-time quality assessment through REST APIs.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column */}
        <div className="space-y-6">

          {/* Key Benefits */}
          <section>
            <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
              Core Capabilities
            </h2>
            <p className="text-xs text-[#999999] mb-4">
              Industrial sensor data processing with multi-modal anomaly detection and manufacturing quality assessment.
            </p>
            <div className="space-y-4">
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <RocketLaunchIcon className="h-4 w-4 flex-none text-blue-600" />
                  Industrial Sensor Validation
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Multi-modal anomaly detection using IsolationForest, OneClassSVM, DBSCAN for manufacturing sensors
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <CpuChipIcon className="h-4 w-4 flex-none text-blue-600" />
                  Manufacturing Quality Assessment
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Equipment health monitoring with cross-sensor correlation analysis and real-time quality metrics
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <ChartBarIcon className="h-4 w-4 flex-none text-blue-600" />
                  Real-time Monitoring
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  Sliding window quality assessment with industrial-specific alerts and automated data validation workflows
                </p>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center gap-x-3 text-xs font-semibold leading-7 text-[#999999] mb-2">
                  <ShieldCheckIcon className="h-4 w-4 flex-none text-blue-600" />
                  Document Processing
                </div>
                <p className="text-xs leading-7 text-[#999999]">
                  PDF, Excel, Word extraction for manufacturing documentation with multi-source data fusion
                </p>
              </div>
            </div>
          </section>
        </div>
        
        {/* Right Column - Empty for now */}
        <div className="space-y-6">
          {/* Content to be added later */}
        </div>
      </div>
      
      {/* Continue with existing content below the 2-column layout */}

      {/* Quick Start Preview */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
          Getting Started
        </h2>
        <p className="text-xs text-[#999999] mb-4">
          Install our SDK and start processing industrial sensor data with real anomaly detection
        </p>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <CodeBlock
              code={`# Install the SDK
pip install schlep-engine

# Import and authenticate
from schlep_engine import SchlepEngineClient

async with SchlepEngineClient(api_key="your_key") as client:
    # Upload manufacturing sensor data
    sensor_file = await client.storage.upload_file("factory_sensors.csv")
    
    # Real industrial quality assessment
    quality_report = await client.data_quality.comprehensive_quality_assessment(
        file_id=sensor_file.file_id,
        sensor_metadata={
            "temperature_sensor_1": {"min_value": -40, "max_value": 150},
            "pressure_sensor_1": {"min_value": 0, "max_value": 100},
            "vibration_sensor_1": {"sensor_type": "accelerometer"}
        }
    )
    
    # Multi-modal anomaly detection results
    anomaly_results = quality_report["anomaly_detection"]
    print(f"Anomalies detected: {anomaly_results['total_anomalies_detected']}")
    print(f"Methods used: {anomaly_results['anomaly_methods']}")  # IsolationForest, DBSCAN, etc.`}
              language="python"
              title="Python SDK - Industrial Data Quality Assessment"
              showCopyButton={true}
            />
          </div>

          <div>
            <CodeBlock
              code={`// Install the SDK
npm install @schlep-engine/js-sdk

// Import and authenticate
import { SchlepEngineClient } from '@schlep-engine/js-sdk';

const client = new SchlepEngineClient({
  apiKey: 'your_api_key'
});

// Monitor equipment health in real-time
const healthReport = await client.monitoring.equipmentHealth({
  sensorData: {
    temperature: [22.5, 23.1, 22.8, 24.2],
    vibration: [0.1, 0.15, 0.12, 0.18],
    pressure: [101.3, 101.5, 101.2, 101.8]
  },
  equipmentId: 'pump_001',
  timeWindow: '1h'
});

console.log('Equipment Health Score:', healthReport.healthScore);
console.log('Detected Anomalies:', healthReport.anomalies);`}
              language="javascript"
              title="JavaScript SDK - Equipment Health Monitoring"
              showCopyButton={true}
            />
          </div>
        </div>
      </div>

      {/* Core Features */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
          Core Features
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">🔧 Predictive Maintenance</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Monitor vibration, temperature, and pressure sensors to detect equipment degradation patterns.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Equipment health scores in real-time</li>
              <li>• Multi-sensor correlation analysis</li>
              <li>• Automated degradation alerts</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📊 Quality Control</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Multi-sensor correlation analysis for production lines with automated detection of sensor drift.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Statistical process control</li>
              <li>• Sensor calibration monitoring</li>
              <li>• Production quality metrics</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">⚡ Production Optimization</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              Cross-sensor data validation and real-time anomaly detection for production equipment.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Real-time anomaly detection</li>
              <li>• Data preparation for analytics</li>
              <li>• Multi-source data fusion</li>
            </ul>
          </div>
          
          <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">📄 Document Processing</h3>
            <p className="text-xs text-[#999999] dark:text-[#999999] mb-2">
              PDF, Excel, Word extraction for manufacturing documentation and data sheets.
            </p>
            <ul className="text-xs text-[#999999] dark:text-[#999999] space-y-1">
              <li>• Equipment manual extraction</li>
              <li>• Sensor specification parsing</li>
              <li>• Quality report processing</li>
            </ul>
          </div>
        </div>
      </div>

      {/* API Overview */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold tracking-tight text-gray-900 mb-4">
          API Overview
        </h2>
        <p className="text-sm text-[#999999] mb-6">
          Our REST API provides industrial sensor data processing with real anomaly detection and quality assessment capabilities.
        </p>
        
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400 dark:border-blue-500 p-4 mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-[#999999] dark:text-[#999999]">
                <strong>Base URL:</strong> <code className="bg-blue-100 dark:bg-blue-800 px-2 py-1 rounded text-xs">https://api.schlep-engine.com</code>
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📊 Data Quality Assessment</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /api/v1/data-quality/assess</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Industrial data quality assessment with anomaly detection</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">🔧 Sensor Validation</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /api/v1/data-processing/validate-sensors</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Multi-modal sensor validation and calibration check</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">❤️ Equipment Health</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /api/v1/monitoring/equipment-health</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">Real-time equipment health assessment</p>
          </div>
          
          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2">📄 Document Extraction</h4>
            <code className="text-xs text-[#999999] dark:text-[#999999]">POST /api/v1/document-extraction/</code>
            <p className="text-sm text-[#999999] dark:text-[#999999] mt-2">PDF, Excel, Word processing for manufacturing docs</p>
          </div>
        </div>
      </div>

      {/* Current Capabilities */}
      <div className="mb-8">
        <h2 className="text-lg font-bold tracking-tight text-gray-900 mb-3">
          Current Capabilities
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg">
            <h3 className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">✅ What Works Today</h3>
            <ul className="text-xs text-green-800 dark:text-green-200 space-y-1">
              <li>• Multi-modal anomaly detection (IsolationForest, OneClassSVM, DBSCAN)</li>
              <li>• Industrial sensor data validation and quality assessment</li>
              <li>• Equipment health monitoring with cross-sensor correlation</li>
              <li>• Real-time quality monitoring and alerts</li>
              <li>• Document extraction (PDF, Excel, Word)</li>
              <li>• Statistical analysis and pattern detection</li>
            </ul>
          </div>
          
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">⚠️ In Development</h3>
            <ul className="text-xs text-yellow-800 dark:text-yellow-200 space-y-1">
              <li>• Advanced missing value imputation</li>
              <li>• Automated sensor drift correction</li>
              <li>• Deep learning model integration</li>
              <li>• Advanced predictive analytics</li>
              <li>• AutoML workflows</li>
              <li>• Real-time intelligent insights</li>
            </ul>
          </div>
        </div>
      </div>

      {/* What's Next */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">What's Next?</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a 
            href="/introduction/quickstart"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <RocketLaunchIcon className="h-5 w-5" />
              <span className="font-medium">Quick Start</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Set up your development environment</p>
          </a>
          <a 
            href="/introduction/api-keys"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <ShieldCheckIcon className="h-5 w-5" />
              <span className="font-medium">Authentication</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Learn about API keys and security</p>
          </a>
          <a 
            href="/introduction/first-call"
            className="text-left p-4 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
          >
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-2">
              <PlayIcon className="h-5 w-5" />
              <span className="font-medium">First API Call</span>
            </div>
            <p className="text-sm text-[#999999] dark:text-[#999999]">Make your first request to the API</p>
          </a>
        </div>
      </div>
    </div>
  )
}

