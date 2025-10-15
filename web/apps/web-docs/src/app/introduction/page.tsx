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
            AI Inference Optimization Fabric
          </h1>
          <MaturityIndicator level="production" feature="AI Inference Optimization Fabric" />
        </div>
        <p className="text-sm text-gray-600 mb-6 max-w-3xl">
          Enterprise-grade AI inference optimization platform delivering sub-10ms latency with Thompson sampling routing, 
          multi-tier caching, and intelligent cost management for production ML workloads.
        </p>
      </div>
      
      <div className="space-y-8">
        {/* Core Features */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            AI Fabric Capabilities
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">🎯 Thompson Sampling Router</h3>
              <p className="text-sm text-gray-600 mb-3">
                Intelligent model selection based on real-time performance and cost optimization.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• Automatic model selection</li>
                <li>• 20-40% cost reduction</li>
                <li>• 10-30% latency improvement</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">🚀 Multi-Tier Cache System</h3>
              <p className="text-sm text-gray-600 mb-3">
                L1/L2/L3 cache coherence delivering 94%+ hit rates for sub-10ms response times.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 94%+ cache hit rates</li>
                <li>• Sub-10ms latency</li>
                <li>• Distributed coherence</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">⚡ Adaptive Scaling</h3>
              <p className="text-sm text-gray-600 mb-3">
                Auto-scaling inference workers that respond to demand patterns and traffic spikes.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 10,000+ RPS capacity</li>
                <li>• Dynamic worker pools</li>
                <li>• Intelligent autoscaling</li>
              </ul>
            </div>
            
            <div className="p-4 bg-white border border-gray-200 rounded-lg">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">📊 Real-time Monitoring</h3>
              <p className="text-sm text-gray-600 mb-3">
                Comprehensive performance monitoring with cost tracking and alerting.
              </p>
              <ul className="text-sm text-gray-600 space-y-1">
                <li>• 99.9% uptime SLA</li>
                <li>• Distributed tracing</li>
                <li>• Cost optimization alerts</li>
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
              <h4 className="font-semibold text-gray-900 mb-2">🤖 Model Deployment</h4>
              <code className="text-xs text-gray-600">POST /fabric/v1/models/deploy</code>
              <p className="text-sm text-gray-600 mt-2">Deploy AI models with automatic optimization</p>
            </div>
            
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-2">⚡ Optimized Inference</h4>
              <code className="text-xs text-gray-600">POST /fabric/v1/predict</code>
              <p className="text-sm text-gray-600 mt-2">Run optimized inference with intelligent routing</p>
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