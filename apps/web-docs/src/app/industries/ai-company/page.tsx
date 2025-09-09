'use client'

import Link from 'next/link'
import { CpuChipIcon, ChartBarIcon, Cog6ToothIcon, RocketLaunchIcon, BeakerIcon, CloudIcon } from '@heroicons/react/24/outline'

export default function AICompanyPage() {
  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <div className="space-y-6">
        <div className="flex items-center space-x-3">
          <CpuChipIcon className="h-10 w-10 text-blue-600" />
          <h1 className="text-4xl font-bold text-gray-900">AI Company Solutions</h1>
        </div>
        <p className="text-xl text-gray-600 leading-relaxed">
          Complete MLOps platform for AI companies to build, deploy, and scale machine learning models 
          from prototype to production with enterprise-grade reliability and monitoring.
        </p>
      </div>

      {/* Key Features Grid */}
      <div className="grid md:grid-cols-3 gap-8">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-xl border border-blue-100">
          <CpuChipIcon className="h-12 w-12 text-blue-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">MLOps Platform</h3>
          <p className="text-gray-600 mb-4">
            End-to-end machine learning operations with automated model training, validation, and deployment pipelines.
          </p>
          <Link href="/api-reference/mlops" className="text-blue-600 hover:text-blue-700 font-medium">
            View MLOps API →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-xl border border-green-100">
          <BeakerIcon className="h-12 w-12 text-green-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Experiment Tracking</h3>
          <p className="text-gray-600 mb-4">
            Advanced experiment management with hyperparameter optimization, A/B testing, and model comparison tools.
          </p>
          <Link href="/api-reference/experiments" className="text-green-600 hover:text-green-700 font-medium">
            View Experiments API →
          </Link>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 p-8 rounded-xl border border-purple-100">
          <CloudIcon className="h-12 w-12 text-purple-600 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-3">Model Serving</h3>
          <p className="text-gray-600 mb-4">
            Production-ready model serving with auto-scaling, A/B testing, canary deployments, and real-time inference.
          </p>
          <Link href="/api-reference/model-serving" className="text-purple-600 hover:text-purple-700 font-medium">
            View Model Serving API →
          </Link>
        </div>
      </div>

      {/* Platform Capabilities */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Platform Capabilities</h2>
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ChartBarIcon className="h-5 w-5 text-blue-600 mr-2" />
              Advanced Analytics
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Real-time model performance monitoring</li>
              <li>• Automated drift detection and alerting</li>
              <li>• Cost optimization and resource utilization</li>
              <li>• Multi-framework support (TensorFlow, PyTorch, scikit-learn)</li>
            </ul>
          </div>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Cog6ToothIcon className="h-5 w-5 text-green-600 mr-2" />
              Enterprise Features
            </h3>
            <ul className="space-y-2 text-gray-600">
              <li>• Dataset marketplace with quality assessment</li>
              <li>• Automated retraining and continuous learning</li>
              <li>• RBAC and audit trails for compliance</li>
              <li>• Multi-cloud and hybrid deployment support</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Use Cases */}
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Common Use Cases</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">AI Startups</h3>
            <p className="text-gray-600 mb-4">
              Rapidly prototype and deploy ML models with automated infrastructure scaling and cost optimization.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> MLOps Platform, Model Serving, Experiments
            </div>
          </div>
          
          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">ML Consulting Firms</h3>
            <p className="text-gray-600 mb-4">
              Manage multiple client projects with isolated environments and comprehensive experiment tracking.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Dataset Marketplace, Experiments, Automated Retraining
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enterprise AI Teams</h3>
            <p className="text-gray-600 mb-4">
              Scale AI initiatives across the organization with governance, compliance, and enterprise security.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> MLOps Platform, Model Serving, Automated Retraining
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Research Organizations</h3>
            <p className="text-gray-600 mb-4">
              Accelerate research with advanced experiment tracking, dataset sharing, and reproducible workflows.
            </p>
            <div className="text-sm text-gray-500">
              <strong>Key APIs:</strong> Experiments, Dataset Marketplace, MLOps Platform
            </div>
          </div>
        </div>
      </div>

      {/* Getting Started */}
      <div className="bg-blue-50 rounded-xl p-8 border border-blue-100">
        <div className="flex items-center space-x-3 mb-4">
          <RocketLaunchIcon className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-semibold text-gray-900">Ready to Get Started?</h2>
        </div>
        <p className="text-gray-600 mb-6">
          Follow our comprehensive guides to integrate Schlep Engine's AI Company solutions into your workflow.
        </p>
        <div className="flex flex-wrap gap-4">
          <Link 
            href="/getting-started/ai-company" 
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Quick Start Guide
          </Link>
          <Link 
            href="/tutorials/mlops-setup" 
            className="bg-white text-blue-600 px-6 py-3 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors font-medium"
          >
            MLOps Tutorial
          </Link>
          <Link 
            href="/examples/ai-company" 
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
          <Link href="/api-reference/mlops" className="block p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all">
            <div className="font-medium text-gray-900">MLOps Platform</div>
            <div className="text-sm text-gray-500 mt-1">Complete ML lifecycle management</div>
          </Link>
          <Link href="/api-reference/experiments" className="block p-4 border border-gray-200 rounded-lg hover:border-green-300 hover:bg-green-50 transition-all">
            <div className="font-medium text-gray-900">Experiment Tracking</div>
            <div className="text-sm text-gray-500 mt-1">Advanced experimentation tools</div>
          </Link>
          <Link href="/api-reference/model-serving" className="block p-4 border border-gray-200 rounded-lg hover:border-purple-300 hover:bg-purple-50 transition-all">
            <div className="font-medium text-gray-900">Model Serving</div>
            <div className="text-sm text-gray-500 mt-1">Production model deployment</div>
          </Link>
          <Link href="/api-reference/datasets" className="block p-4 border border-gray-200 rounded-lg hover:border-orange-300 hover:bg-orange-50 transition-all">
            <div className="font-medium text-gray-900">Dataset Marketplace</div>
            <div className="text-sm text-gray-500 mt-1">Data sharing and quality</div>
          </Link>
          <Link href="/api-reference/retraining" className="block p-4 border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all">
            <div className="font-medium text-gray-900">Automated Retraining</div>
            <div className="text-sm text-gray-500 mt-1">Continuous learning pipelines</div>
          </Link>
          <Link href="/api-reference/ml-pipeline" className="block p-4 border border-gray-200 rounded-lg hover:border-indigo-300 hover:bg-indigo-50 transition-all">
            <div className="font-medium text-gray-900">ML Pipeline</div>
            <div className="text-sm text-gray-500 mt-1">Core ML model management</div>
          </Link>
        </div>
      </div>
    </div>
  )
}