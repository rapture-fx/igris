import React from 'react'
import { Zap, BarChart2, Lock, DollarSign, Cloud, GitBranch, Activity, Users, MessageSquare } from 'lucide-react'

const features = [
  {
    name: 'Machine Learning APIs',
    description: 'APIs for data preparation tasks commonly needed in ML workflows and model training.',
    icon: Zap,
  },
  {
    name: 'Analytics and Metrics',
    description: 'Basic usage analytics and processing metrics for monitoring your data operations.',
    icon: BarChart2,
  },
  {
    name: 'Authentication and Authorization',
    description: 'API key management and user authentication for secure access to processing endpoints.',
    icon: Lock,
  },
  {
    name: 'Usage Tracking',
    description: 'Track API usage, processing volume, and account limits with built-in monitoring.',
    icon: DollarSign,
  },
  {
    name: 'Data Streaming',
    description: 'Support for processing streaming data and batch uploads through various input methods.',
    icon: Cloud,
  },
  {
    name: 'Standard Integrations',
    description: 'Work with common data formats and export to standard destinations via APIs.',
    icon: GitBranch,
  },
  {
    name: 'System Monitoring',
    description: 'Basic health checks and status monitoring for processing jobs and system uptime.',
    icon: Activity,
  },
  {
    name: 'User Management',
    description: 'Basic user accounts, roles, and administrative controls for team access.',
    icon: Users,
  },
  {
    name: 'Real-time Updates',
    description: 'WebSocket connections for live status updates during data processing operations.',
    icon: MessageSquare,
  },
]

export default function AdditionalFeatures() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-gray-50 dark:bg-black text-gray-900 dark:text-white">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:text-left">
          <h2 className="text-base font-semibold leading-7 text-[#1A5799] text-left">Additional Features</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl text-left">
            Extended Platform Capabilities
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-left">
            Supporting features for user management, monitoring, and integration with existing workflows.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg dark:bg-gray-800">
                    <feature.icon className="h-6 w-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-700 dark:text-gray-400">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
