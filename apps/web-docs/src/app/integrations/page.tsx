'use client'

import Link from 'next/link'
import { 
  CloudIcon,
  CodeBracketIcon,
  CpuChipIcon,
  CircleStackIcon,
  CommandLineIcon,
  CubeTransparentIcon
} from '@heroicons/react/24/outline'

export default function IntegrationsPage() {
  const integrations = [
    {
      title: 'Jupyter Notebooks',
      description: 'Seamlessly integrate Schlep Engine with Jupyter notebooks for data science workflows.',
      href: '/integrations/jupyter',
      icon: CodeBracketIcon,
      color: 'bg-orange-100 text-orange-700',
      category: 'Development Tools',
      status: 'Available'
    },
    {
      title: 'AWS SageMaker',
      description: 'Connect with Amazon SageMaker for scalable machine learning model training and deployment.',
      href: '/integrations/aws-sagemaker',
      icon: CloudIcon,
      color: 'bg-blue-100 text-blue-700',
      category: 'Cloud Platforms',
      status: 'Available'
    },
    {
      title: 'Docker & Kubernetes',
      description: 'Deploy Schlep Engine workloads in containerized environments.',
      href: '/integrations/docker-kubernetes',
      icon: CubeTransparentIcon,
      color: 'bg-purple-100 text-purple-700',
      category: 'Infrastructure',
      status: 'Coming Soon'
    },
    {
      title: 'Apache Spark',
      description: 'Process large-scale data using Apache Spark integration.',
      href: '/integrations/apache-spark',
      icon: CpuChipIcon,
      color: 'bg-green-100 text-green-700',
      category: 'Data Processing',
      status: 'Coming Soon'
    },
    {
      title: 'PostgreSQL/MySQL',
      description: 'Direct database connections for data ingestion and storage.',
      href: '/integrations/databases',
      icon: CircleStackIcon,
      color: 'bg-indigo-100 text-indigo-700',
      category: 'Databases',
      status: 'Coming Soon'
    },
    {
      title: 'REST API & CLI',
      description: 'Comprehensive REST API and command-line interface for all operations.',
      href: '/api-reference',
      icon: CommandLineIcon,
      color: 'bg-gray-100 text-gray-700',
      category: 'Developer Tools',
      status: 'Available'
    }
  ]

  const categories = ['All', 'Development Tools', 'Cloud Platforms', 'Infrastructure', 'Data Processing', 'Databases']

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-600 text-lg">
          Connect Schlep Engine with your existing tools and platforms for a seamless 
          data processing and machine learning workflow.
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

      {/* Integrations Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {integrations.map((integration) => {
          const Icon = integration.icon
          const isAvailable = integration.status === 'Available'
          
          return (
            <div
              key={integration.title}
              className="group relative rounded-lg border border-gray-200 bg-white p-6 hover:shadow-lg transition-all duration-200"
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                  isAvailable 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-yellow-100 text-yellow-700'
                }`}>
                  {integration.status}
                </span>
              </div>
              
              <div className="flex items-start space-x-4 mt-2">
                <div className={`rounded-lg p-2 ${integration.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {integration.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-2">
                    {integration.description}
                  </p>
                  <div className="mt-3">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                      {integration.category}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                {isAvailable ? (
                  <Link 
                    href={integration.href}
                    className="text-sm text-blue-600 font-medium hover:text-blue-700"
                  >
                    View Documentation →
                  </Link>
                ) : (
                  <span className="text-sm text-gray-500 font-medium">
                    Coming Soon
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* SDK Section */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-8 border border-blue-100">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">SDKs & Libraries</h2>
        <p className="text-gray-600 mb-6">
          Use our official SDKs to integrate Schlep Engine into your applications with ease.
        </p>
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">Python SDK</h3>
            <p className="text-gray-600 text-sm mb-4">
              Comprehensive Python library with full API coverage and Jupyter notebook support.
            </p>
            <Link 
              href="/sdk/python"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View Python Docs →
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-blue-200">
            <h3 className="font-semibold text-gray-900 mb-2">TypeScript SDK</h3>
            <p className="text-gray-600 text-sm mb-4">
              Modern TypeScript/JavaScript SDK with React hooks and WebSocket support.
            </p>
            <Link 
              href="/sdk/typescript"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              View TypeScript Docs →
            </Link>
          </div>
        </div>
      </div>

      {/* Enterprise Integrations */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Enterprise Integrations</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">On-Premises Deployment</h3>
            <p className="text-gray-600 text-sm mb-4">
              Deploy Schlep Engine on your own infrastructure for maximum control and security.
            </p>
            <Link 
              href="/security/overview"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Security Overview →
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Single Sign-On (SSO)</h3>
            <p className="text-gray-600 text-sm mb-4">
              Integrate with your organization's identity provider for seamless authentication.
            </p>
            <Link 
              href="/security/overview"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Learn More →
            </Link>
          </div>
          
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">Custom Integrations</h3>
            <p className="text-gray-600 text-sm mb-4">
              Need a specific integration? Our team can help you build custom connectors.
            </p>
            <a 
              href="mailto:support@schlep-engine.com"
              className="text-blue-600 hover:text-blue-700 font-medium text-sm"
            >
              Contact Support →
            </a>
          </div>
        </div>
      </div>

      {/* Quick Start */}
      <div className="text-center">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Ready to Integrate?</h2>
        <p className="text-gray-600 mb-6">
          Get started with our comprehensive integration guides and examples.
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
            API Documentation
          </Link>
        </div>
      </div>
    </div>
  )
}