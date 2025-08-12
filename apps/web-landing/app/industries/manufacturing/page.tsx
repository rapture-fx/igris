'use client'

import React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle, TrendingUp, Shield, Zap, AlertTriangle } from 'lucide-react'

export default function ManufacturingPage() {
  return (
    <div className="min-h-screen bg-[#111111] text-white">
      {/* Header */}
      <header className="bg-[#111111] border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-[#1A5799] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SE</span>
              </div>
              <span className="text-xl font-semibold text-white">Schlep Engine</span>
            </Link>
            <div className="flex space-x-4">
              <Link href="/signup" className="bg-[#1A5799] text-white px-4 py-2 rounded-lg hover:bg-[#154A85] transition-colors">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative pt-20 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="inline-flex items-center px-4 py-2 bg-[#1A5799]/20 border border-[#1A5799]/30 rounded-full text-sm text-[#1A5799] mb-6">
              <Shield className="w-4 h-4 mr-2" />
              Industrial Data Intelligence
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6 leading-tight">
              Transform Manufacturing Data into
              <span className="text-[#F2E8CE]"> Predictive Insights</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Clean noisy sensor data, detect equipment anomalies, and predict maintenance needs with our specialized manufacturing ML pipeline. Reduce downtime by up to 40% and increase equipment efficiency by 25%.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/signup" className="bg-[#1A5799] text-white px-8 py-3 rounded-lg hover:bg-[#154A85] transition-colors font-semibold">
                Start Free Trial
              </Link>
              <Link href="#demo" className="border border-gray-600 text-white px-8 py-3 rounded-lg hover:border-gray-500 transition-colors font-semibold">
                See Demo
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Manufacturing Data Challenges</h2>
            <p className="text-gray-300 text-lg">Traditional approaches to industrial data processing fall short</p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-red-900/20 border border-red-900/30 rounded-lg p-6">
              <AlertTriangle className="w-8 h-8 text-red-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-red-300">Noisy Sensor Data</h3>
              <p className="text-gray-300">Electromagnetic interference, calibration drift, and environmental factors corrupt 15-30% of sensor readings, leading to false alarms and missed maintenance windows.</p>
            </div>
            <div className="bg-orange-900/20 border border-orange-900/30 rounded-lg p-6">
              <TrendingUp className="w-8 h-8 text-orange-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-orange-300">Reactive Maintenance</h3>
              <p className="text-gray-300">Equipment failures cost manufacturers $50 billion annually. Current systems detect problems after damage occurs, not before.</p>
            </div>
            <div className="bg-yellow-900/20 border border-yellow-900/30 rounded-lg p-6">
              <Zap className="w-8 h-8 text-yellow-400 mb-4" />
              <h3 className="text-xl font-semibold mb-3 text-yellow-300">Manual Analysis</h3>
              <p className="text-gray-300">Data scientists spend 80% of their time cleaning sensor data instead of building predictive models, delaying insights by weeks.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Manufacturing Intelligence Pipeline</h2>
            <p className="text-gray-300 text-lg">Purpose-built for industrial sensor data and predictive maintenance</p>
          </div>
          
          {/* Pipeline Visual */}
          <div className="bg-gray-900/50 rounded-xl p-8 mb-12">
            <div className="grid md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">1</span>
                </div>
                <h4 className="font-semibold mb-2">Sensor Data Ingestion</h4>
                <p className="text-sm text-gray-400">Real-time processing of vibration, temperature, pressure, and flow sensors</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">2</span>
                </div>
                <h4 className="font-semibold mb-2">Noise Filtering</h4>
                <p className="text-sm text-gray-400">Advanced signal processing removes interference and calibration drift</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">3</span>
                </div>
                <h4 className="font-semibold mb-2">Feature Engineering</h4>
                <p className="text-sm text-gray-400">Extract time-series patterns, correlations, and equipment health indicators</p>
              </div>
              <div className="text-center">
                <div className="w-16 h-16 bg-[#1A5799] rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-white font-bold">4</span>
                </div>
                <h4 className="font-semibold mb-2">Predictive Insights</h4>
                <p className="text-sm text-gray-400">Anomaly detection, maintenance scheduling, and optimization recommendations</p>
              </div>
            </div>
          </div>

          {/* Key Features */}
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h3 className="text-2xl font-bold mb-6">Advanced Sensor Data Processing</h3>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Industrial Noise Filtering</h4>
                    <p className="text-gray-300">Removes electromagnetic interference, calibration drift, and environmental noise from sensor readings with 95% accuracy</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Multi-Sensor Correlation</h4>
                    <p className="text-gray-300">Identifies relationships between temperature, vibration, and pressure sensors to detect complex failure patterns</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Real-time Processing</h4>
                    <p className="text-gray-300">Process 1000+ sensor readings per second with sub-millisecond latency for immediate anomaly detection</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold mb-1">Equipment Health Scoring</h4>
                    <p className="text-gray-300">Continuous monitoring of equipment condition with predictive maintenance recommendations</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="bg-gray-900 rounded-lg p-6">
              <h4 className="text-lg font-semibold mb-4">API Integration Example</h4>
              <pre className="bg-black rounded p-4 text-sm text-green-400 overflow-x-auto">
{`curl -X POST https://api.schlep-engine.com/v1/manufacturing/process \\
  -H "Authorization: Bearer your-api-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "sensor_data": {
      "vibration_sensors": [...],
      "temperature_sensors": [...],
      "pressure_sensors": [...]
    },
    "equipment_metadata": {
      "equipment_type": "pump",
      "model": "industrial_pump_v3"
    },
    "processing_options": {
      "enable_noise_filtering": true,
      "anomaly_detection": true,
      "predictive_maintenance": true
    }
  }'`}
              </pre>
            </div>
          </div>
        </div>
      </section>

      {/* Results Section */}
      <section className="py-16 bg-gray-900/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Proven Manufacturing Results</h2>
            <p className="text-gray-300 text-lg">Real impact on production efficiency and equipment reliability</p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">40%</div>
              <div className="text-gray-300">Reduction in Unplanned Downtime</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">25%</div>
              <div className="text-gray-300">Increase in Equipment Efficiency</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">90%</div>
              <div className="text-gray-300">Reduction in False Alarms</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-[#F2E8CE] mb-2">60%</div>
              <div className="text-gray-300">Faster Data Processing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Manufacturing Use Cases</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Predictive Maintenance</h3>
              <p className="text-gray-300 mb-4">Predict equipment failures 2-4 weeks before they occur, allowing for planned maintenance during scheduled downtime.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Bearing wear detection</li>
                <li>• Motor degradation analysis</li>
                <li>• Pump efficiency monitoring</li>
                <li>• Belt tension optimization</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Quality Control</h3>
              <p className="text-gray-300 mb-4">Real-time detection of production anomalies that affect product quality, reducing waste and rework costs.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Temperature variance detection</li>
                <li>• Pressure irregularity alerts</li>
                <li>• Flow rate optimization</li>
                <li>• Process stability monitoring</li>
              </ul>
            </div>
            <div className="bg-gray-900/50 rounded-lg p-6">
              <h3 className="text-xl font-semibold mb-4">Energy Optimization</h3>
              <p className="text-gray-300 mb-4">Identify energy inefficiencies and optimize equipment operation to reduce power consumption by 15-20%.</p>
              <ul className="text-sm text-gray-400 space-y-2">
                <li>• Power consumption analysis</li>
                <li>• Equipment efficiency scoring</li>
                <li>• Operational parameter tuning</li>
                <li>• Load balancing optimization</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-[#1A5799]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4 text-white">Ready to Transform Your Manufacturing Data?</h2>
          <p className="text-xl mb-8 text-blue-100">Join leading manufacturers using Schlep Engine to optimize their operations</p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/signup" className="bg-white text-[#1A5799] px-8 py-3 rounded-lg hover:bg-gray-100 transition-colors font-semibold">
              Start Free Trial
            </Link>
            <Link href="/contact" className="border border-white text-white px-8 py-3 rounded-lg hover:bg-white hover:text-[#1A5799] transition-colors font-semibold">
              Contact Sales
            </Link>
          </div>
          <p className="text-sm text-blue-200 mt-4">No credit card required • 14-day free trial • Full API access</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-black py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-2 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-[#1A5799] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">SE</span>
              </div>
              <span className="text-xl font-semibold text-white">Schlep Engine</span>
            </div>
            <div className="flex space-x-6 text-sm text-gray-400">
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/support" className="hover:text-white transition-colors">Support</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}