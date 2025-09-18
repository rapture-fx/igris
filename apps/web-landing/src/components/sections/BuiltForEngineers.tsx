
import React from 'react'
import { Zap, Code, Wrench, DollarSign, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const features = [
  {
    name: 'API-First Architecture',
    description: 'Clean REST APIs for data processing and ML workflows. Upload CSV, train models, and get predictions with simple HTTP calls. Built with FastAPI for speed and reliability.',
    icon: Zap,
  },
  {
    name: 'Developer Experience',
    description: 'Straightforward APIs that handle the complexity for you. Focus on your data and business logic, not ML infrastructure setup and maintenance.',
    icon: Code,
  },
  {
    name: 'Data to Model Pipeline',
    description: 'Automated data processing and model training workflows. From messy CSV files to trained models through API calls instead of complex ML pipeline setup.',
    icon: Wrench,
  },
]

export default function BuiltForEngineers() {
  return (
    <section className="py-56 sm:py-60 lg:py-64 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div>
          <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter text-center">Built for engineers shipping ML at speed.</h2>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl text-center font-inter">
            <span style={{ color: '#114dcd' }}>No infra. No setup. Just results.</span>
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
            Simple APIs for complex ML workflows. Skip the infrastructure setup and get straight to training models and processing data.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl sm:mt-20 lg:mt-24">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.name} className="bg-white dark:bg-gray-800 rounded-xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300 border border-gray-200 dark:border-gray-700 flex flex-col" style={{ height: '360px' }}>
                <div className="flex items-center mb-4">
                  <feature.icon className="h-8 w-8 text-blue-600 dark:text-blue-400 mr-4" aria-hidden="true" />
                  <h3 className="text-lg font-semibold leading-7 text-gray-900 dark:text-white">
                    {feature.name}
                  </h3>
                </div>
                <div>
                  <p className="text-sm leading-6 text-gray-600 dark:text-gray-300">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Button moved below cards */}
          <div className="mt-10 text-center">
            <Link
              href="/#pricing"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
            >
              Explore Schlep-engine
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
