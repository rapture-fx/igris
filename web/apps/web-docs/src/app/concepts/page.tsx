'use client'

import Link from 'next/link'
import { 
  CpuChipIcon, 
  CogIcon, 
  ChartBarIcon, 
  BeakerIcon,
  ClockIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

export default function ConceptsPage() {
  const concepts = [
    {
      title: 'Data Processing Pipeline',
      description: 'Learn how Schlep Engine processes and transforms your data through intelligent pipelines.',
      href: '/concepts/pipeline',
      icon: CpuChipIcon,
      color: 'bg-blue-100 text-blue-700'
    },
    {
      title: 'ML Workflow',
      description: 'Understand the machine learning workflow from data ingestion to model deployment.',
      href: '/concepts/ml-workflow',
      icon: BeakerIcon,
      color: 'bg-purple-100 text-purple-700'
    },
    {
      title: 'Reinforcement Learning',
      description: 'Explore how RL agents optimize data processing and decision-making workflows.',
      href: '/concepts/reinforcement-learning',
      icon: ChartBarIcon,
      color: 'bg-green-100 text-green-700'
    },
    {
      title: 'ML Model Optimization',
      description: 'Advanced techniques for optimizing machine learning models for production.',
      href: '/concepts/ml-optimization',
      icon: CogIcon,
      color: 'bg-orange-100 text-orange-700'
    },
    {
      title: 'Architecture Overview',
      description: 'Deep dive into Schlep Engine\'s distributed architecture and design patterns.',
      href: '/concepts/architecture',
      icon: ShieldCheckIcon,
      color: 'bg-indigo-100 text-indigo-700'
    },
    {
      title: 'Compatibility Mode',
      description: 'How Schlep Engine maintains backward compatibility while introducing new features.',
      href: '/concepts/compatibility-mode',
      icon: ClockIcon,
      color: 'bg-teal-100 text-teal-700'
    }
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-900">Core Concepts</h1>
        <p className="text-gray-600 text-lg">
          Understand the fundamental concepts behind Schlep Engine's data processing, 
          machine learning, and optimization capabilities.
        </p>
      </div>

      {/* Concepts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {concepts.map((concept) => {
          const Icon = concept.icon
          return (
            <Link
              key={concept.href}
              href={concept.href}
              className="group relative rounded-lg border border-gray-200 bg-white p-6 hover:shadow-lg transition-all duration-200"
            >
              <div className="flex items-start space-x-4">
                <div className={`rounded-lg p-2 ${concept.color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                    {concept.title}
                  </h3>
                  <p className="text-gray-600 text-sm mt-2">
                    {concept.description}
                  </p>
                </div>
              </div>
              <div className="absolute top-4 right-4">
                <svg className="h-4 w-4 text-gray-400 group-hover:text-blue-600 transition-colors" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 111.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          )
        })}
      </div>

      {/* Quick Links */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-2xl font-semibold text-gray-900 mb-6">Quick Links</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Getting Started</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/introduction" className="text-blue-600 hover:text-blue-700">
                  Introduction & Overview
                </Link>
              </li>
              <li>
                <Link href="/introduction/quickstart" className="text-blue-600 hover:text-blue-700">
                  Quick Start Guide
                </Link>
              </li>
              <li>
                <Link href="/introduction/pricing" className="text-blue-600 hover:text-blue-700">
                  Pricing & Plans
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 mb-3">Advanced Topics</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/concepts/feature-maturity-roadmap" className="text-blue-600 hover:text-blue-700">
                  Feature Maturity Roadmap
                </Link>
              </li>
              <li>
                <Link href="/concepts/manufacturing-data-processing" className="text-blue-600 hover:text-blue-700">
                  Manufacturing Data Processing
                </Link>
              </li>
              <li>
                <Link href="/security/overview" className="text-blue-600 hover:text-blue-700">
                  Security & Compliance
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}