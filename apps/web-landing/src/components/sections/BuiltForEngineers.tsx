
import React from 'react'
import { Zap, Code, Wrench, DollarSign } from 'lucide-react'

const features = [
  {
    name: 'Speed & Productivity',
    description: '3 API calls vs weeks of setup. From raw data to trained model in minutes, not months. No ML infrastructure costs - pay only for usage.',
    icon: Zap,
  },
  {
    name: 'Engineering-First Design',
    description: 'API-native architecture with multiple SDKs. Production-ready from day 1 with built-in monitoring.',
    icon: Code,
  },
  {
    name: 'Eliminate ML Engineering Overhead',
    description: 'Auto preprocessing, smart feature engineering, model optimization, and deployment automation.',
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
            Schlep-engine is designed to help you get from messy data to production-ready models in record time.
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
        </div>
      </div>
    </section>
  )
}
