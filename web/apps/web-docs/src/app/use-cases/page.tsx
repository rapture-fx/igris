'use client'

import Link from 'next/link'
import { 
  BeakerIcon,
  AdjustmentsHorizontalIcon,
  ShieldCheckIcon,
  BoltIcon,
  CpuChipIcon,
  ChartBarIcon,
  ShoppingCartIcon,
  UserGroupIcon
} from '@heroicons/react/24/outline'

export default function UseCasesPage() {
  const useCases = [
    {
      title: 'ML Model Training',
      description: 'Streamline machine learning model training with automated pipelines and hyperparameter optimization.',
      href: '/use-cases/ml-training',
      icon: BeakerIcon,
      color: 'bg-blue-100 text-blue-700',
      category: 'Machine Learning'
    },
    {
      title: 'Hyperparameter Optimization',
      description: 'Automatically tune model parameters using advanced optimization algorithms.',
      href: '/use-cases/hyperparameter-optimization',
      icon: AdjustmentsHorizontalIcon,
      color: 'bg-purple-100 text-purple-700',
      category: 'Machine Learning'
    },
    {
      title: 'Data Quality Monitoring',
      description: 'Continuous monitoring and validation of data quality across your pipelines.',
      href: '/use-cases/quality-monitoring',
      icon: ShieldCheckIcon,
      color: 'bg-green-100 text-green-700',
      category: 'Data Processing'
    },
    {
      title: 'Real-time Processing',
      description: 'Process streaming data with low latency for immediate insights and actions.',
      href: '/use-cases/real-time-processing',
      icon: BoltIcon,
      color: 'bg-orange-100 text-orange-700',
      category: 'Data Processing'
    },
    {
      title: 'Fraud Detection',
      description: 'Advanced machine learning techniques for financial fraud detection and prevention.',
      href: '/use-cases/fraud-detection',
      icon: ShieldCheckIcon,
      color: 'bg-red-100 text-red-700',
      category: 'Financial Services'
    },
    {
      title: 'Customer Analytics',
      description: 'Comprehensive customer behavior analysis and segmentation for better insights.',
      href: '/use-cases/customer-analytics',
      icon: UserGroupIcon,
      color: 'bg-indigo-100 text-indigo-700',
      category: 'E-commerce'
    }
  ]

  const categories = ['All', 'Machine Learning', 'Data Processing', 'Financial Services', 'E-commerce']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Use Cases</h1>
        <p className="text-gray-600 text-lg">
          Explore real-world applications and implementation examples of Schlep Engine 
          across different industries and use cases.
        </p>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-4">
        {categories.map((category) => (
          <button
            key={category}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {category}
          </button>
        ))}
      </div>

      {/* Use Cases Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {useCases.map((useCase) => {
          const Icon = useCase.icon
          return (
            <Link
              key={useCase.href}
              href={useCase.href}
              className="group relative rounded-lg border border-gray-200 bg-white p-6 hover:shadow-lg transition-all duration-200"
            >
              {/* Category Badge */}
              <div className="absolute top-4 right-4">
                <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                  {useCase.category}
                </span>
              </div>
              
              <div className="flex items-start space-x-4 mt-2">
                <div className={`rounded-lg p-2 ${useCase.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {useCase.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-2">
                    {useCase.description}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <span className="text-sm text-blue-600 font-medium group-hover:text-blue-700">
                  Learn more →
                </span>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Industry-Specific Sections */}
      <div className="grid md:grid-cols-2 gap-8 mt-12">
        <div className="bg-blue-50 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Manufacturing & IoT</h2>
          <p className="text-gray-600 text-sm mb-6">
            Specialized use cases for manufacturing, industrial IoT, and predictive maintenance.
          </p>
          <ul className="space-y-3">
            <li>
              <Link href="/industries/manufacturing" className="flex items-center text-blue-600 hover:text-blue-700 text-sm">
                <CpuChipIcon className="h-4 w-4 mr-2" />
                Predictive Maintenance
              </Link>
            </li>
            <li>
              <Link href="/industries/manufacturing" className="flex items-center text-blue-600 hover:text-blue-700 text-sm">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Digital Twin Operations
              </Link>
            </li>
            <li>
              <Link href="/industries/manufacturing" className="flex items-center text-blue-600 hover:text-blue-700 text-sm">
                <AdjustmentsHorizontalIcon className="h-4 w-4 mr-2" />
                Process Optimization
              </Link>
            </li>
          </ul>
        </div>

        <div className="bg-purple-50 rounded-xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">AI & MLOps</h2>
          <p className="text-gray-600 text-sm mb-6">
            Advanced machine learning operations and AI company workflows.
          </p>
          <ul className="space-y-3">
            <li>
              <Link href="/industries/ai-company" className="flex items-center text-purple-600 hover:text-purple-700 text-sm">
                <BeakerIcon className="h-4 w-4 mr-2" />
                Experiment Tracking
              </Link>
            </li>
            <li>
              <Link href="/industries/ai-company" className="flex items-center text-purple-600 hover:text-purple-700 text-sm">
                <CpuChipIcon className="h-4 w-4 mr-2" />
                Model Serving
              </Link>
            </li>
            <li>
              <Link href="/industries/ai-company" className="flex items-center text-purple-600 hover:text-purple-700 text-sm">
                <ChartBarIcon className="h-4 w-4 mr-2" />
                A/B Testing
              </Link>
            </li>
          </ul>
        </div>
      </div>

      {/* Getting Started CTA */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ready to Get Started?</h2>
          <p className="text-gray-600 mb-6">
            Choose your use case and follow our step-by-step guides to implement Schlep Engine in your workflow.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link 
              href="/introduction/quickstart"
              className="px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Quick Start Guide
            </Link>
            <Link 
              href="/api-reference"
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              API Reference
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}