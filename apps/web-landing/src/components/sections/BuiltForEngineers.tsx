
import React from 'react'
import { Zap, BarChart2, Lock, DollarSign, Cloud, GitBranch, Activity, Users, MessageSquare } from 'lucide-react'

const features = [
  {
    name: 'Streamlined Data Pipelines',
    description: 'Build, test, and deploy data pipelines with a simple, intuitive API.',
    icon: Zap,
  },
  {
    name: 'Automated Data Cleaning',
    description: 'Automatically clean and prepare your data for machine learning models.',
    icon: BarChart2,
  },
  {
    name: 'Scalable Infrastructure',
    description: 'Scale your data processing from a single file to millions of records.',
    icon: Cloud,
  },
  {
    name: 'Seamless Integrations',
    description: 'Integrate with your existing tools and workflows with ease.',
    icon: GitBranch,
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
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature) => (
              <div key={feature.name} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg dark:bg-gray-800">
                    <feature.icon className="h-8 w-8 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  </div>
                </div>
                <h3 className="text-base font-semibold leading-7 text-gray-900 dark:text-white mb-2">
                  {feature.name}
                </h3>
                <p className="text-sm leading-6 text-gray-700 dark:text-gray-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
