'use client'

import React from 'react'
import Link from 'next/link'
import { CogIcon, ChartBarIcon, CubeIcon, RocketLaunchIcon, WrenchScrewdriverIcon, CircuitBoardIcon } from '@heroicons/react/24/outline'

export default function ManufacturingPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <CogIcon className="h-10 w-10 text-orange-600" />
          <h1 className="text-4xl font-bold text-gray-900">Manufacturing Solutions</h1>
        </div>
        <p className="text-xl text-gray-600 leading-relaxed">
          Complete industrial IoT and manufacturing intelligence platform for predictive maintenance, 
          quality control, and supply chain optimization with real-time analytics and digital twin capabilities.
        </p>
      </div>

      {/* Key Features Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        <div className="bg-gradient-to-br from-orange-50 to-red-50 p-8 rounded-xl border border-orange-100">
          <WrenchScrewdriverIcon className="h-12 w-12 text-orange-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Manufacturing IoT</h3>
          <p className="text-gray-600 mb-4">
            Industrial IoT data processing with OPC-UA, MQTT, and Modbus protocol support for real-time equipment monitoring.
          </p>
          <Link href="/api-reference/manufacturing-iot" className="text-orange-600 hover:text-orange-700 font-medium">
            View IoT API →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-100">
          <ChartBarIcon className="h-12 w-12 text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Analytics & SPC</h3>
          <p className="text-gray-600 mb-4">
            Statistical Process Control with advanced analytics for quality monitoring, defect detection, and performance optimization.
          </p>
          <Link href="/api-reference/manufacturing-analytics" className="text-blue-600 hover:text-blue-700 font-medium">
            View Analytics API →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-8 rounded-xl border border-purple-100">
          <CubeIcon className="h-12 w-12 text-purple-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Digital Twin</h3>
          <p className="text-gray-600 mb-4">
            Create and manage digital twins of manufacturing processes with real-time synchronization and predictive modeling.
          </p>
          <Link href="/api-reference/digital-twin" className="text-purple-600 hover:text-purple-700 font-medium">
            View Digital Twin API →
          </Link>
        </div>
      </div>

      {/* Platform Capabilities */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Platform Capabilities</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <CircuitBoardIcon className="h-5 w-5 text-orange-600 mr-2" />
              Industrial Protocols
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>• OPC-UA server and client connectivity</li>
              <li>• MQTT broker integration and edge processing</li>
              <li>• Modbus TCP/RTU protocol support</li>
              <li>• Real-time data streaming and buffering</li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <WrenchScrewdriverIcon className="h-5 w-5 text-blue-600 mr-2" />
              Manufacturing Intelligence
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Predictive maintenance and failure detection</li>
              <li>• MES integration and workflow orchestration</li>
              <li>• Supply chain optimization with ML</li>
              <li>• Energy monitoring and optimization</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Automotive Manufacturing</h3>
            <p className="text-gray-600 mb-4">
              Real-time quality control and predictive maintenance for assembly lines with digital twin modeling.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Manufacturing IoT, Digital Twin, Analytics
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Process Industries</h3>
            <p className="text-gray-600 mb-4">
              Continuous monitoring of chemical processes, refineries, and pharmaceutical production facilities.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Manufacturing IoT, MES Integration, Forecasting
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Discrete Manufacturing</h3>
            <p className="text-gray-600 mb-4">
              Machine health monitoring, production optimization, and quality assurance for discrete part manufacturing.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Manufacturing Analytics, Digital Twin, MES
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Food & Beverage</h3>
            <p className="text-gray-600 mb-4">
              Temperature monitoring, batch tracking, and quality control with regulatory compliance support.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Manufacturing IoT, Analytics, MES Integration
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-orange-50 rounded-xl p-8 border border-orange-100">
        <div className="flex items-center space-x-3 mb-4">
          <RocketLaunchIcon className="h-6 w-6 text-orange-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Ready to Get Started?</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Follow our comprehensive guides to integrate Schlep Engine's Manufacturing solutions into your industrial operations.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link 
            href="/getting-started/manufacturing" 
            className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 transition-colors font-medium"
          >
            Quick Start Guide
          </Link>
          <Link 
            href="/tutorials/manufacturing-iot-setup" 
            className="bg-white text-orange-600 px-6 py-3 rounded-lg border border-orange-200 hover:bg-orange-50 transition-colors font-medium"
          >
            IoT Setup Tutorial
          </Link>
          <Link 
            href="/examples/manufacturing" 
            className="bg-white text-gray-700 px-6 py-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors font-medium"
          >
            View Examples
          </Link>
        </div>
      </div>

      {/* API Reference Quick Links */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">API Reference</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Link href="/api-reference/manufacturing-iot" className="block p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all">
            <div className="font-medium text-gray-900">Manufacturing IoT</div>
            <div className="text-sm text-gray-500 mt-1">Industrial IoT data processing</div>
          </Link>
          <Link href="/api-reference/manufacturing-analytics" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
            <div className="font-medium text-gray-900">Analytics & SPC</div>
            <div className="text-sm text-gray-500 mt-1">Statistical process control</div>
          </Link>
          <Link href="/api-reference/digital-twin" className="block p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all">
            <div className="font-medium text-gray-900">Digital Twin</div>
            <div className="text-sm text-gray-500 mt-1">Virtual manufacturing models</div>
          </Link>
          <Link href="/api-reference/manufacturing-mes" className="block p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all">
            <div className="font-medium text-gray-900">MES Integration</div>
            <div className="text-sm text-gray-500 mt-1">Manufacturing execution systems</div>
          </Link>
          <Link href="/api-reference/manufacturing-forecasting" className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all">
            <div className="font-medium text-gray-900">Demand Forecasting</div>
            <div className="text-sm text-gray-500 mt-1">Production planning and optimization</div>
          </Link>
          <Link href="/api-reference/manufacturing" className="block p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all">
            <div className="font-medium text-gray-900">Core Manufacturing</div>
            <div className="text-sm text-gray-500 mt-1">General manufacturing APIs</div>
          </Link>
        </div>
      </div>
    </div>
  )
}