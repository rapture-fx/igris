import React from 'react'
import { Zap, BarChart2, Lock, DollarSign, Cloud, GitBranch, Activity, Users, MessageSquare } from 'lucide-react'

const features = [
  {
    name: 'Advanced AI Endpoints',
    description: 'Leverage cutting-edge AI models for complex data analysis, prediction, and intelligent automation.',
    icon: Zap,
  },
  {
    name: 'Analytics and Metrics',
    description: 'Gain deep insights into your data processing workflows with comprehensive analytics and performance metrics.',
    icon: BarChart2,
  },
  {
    name: 'Authentication and Authorization',
    description: 'Secure your data and control access with robust authentication and fine-grained authorization mechanisms.',
    icon: Lock,
  },
  {
    name: 'Billing',
    description: 'Manage your usage and costs effectively with transparent billing and usage tracking features.',
    icon: DollarSign,
  },
  {
    name: 'Data Connections/Streaming',
    description: 'Connect to various data sources and enable real-time data streaming for continuous processing.',
    icon: Cloud,
  },
  {
    name: 'Integrations',
    description: 'Seamlessly integrate with your existing tools and platforms through a wide range of connectors.',
    icon: GitBranch,
  },
  {
    name: 'Monitoring',
    description: 'Keep an eye on your pipelines and data health with real-time monitoring and alerting capabilities.',
    icon: Activity,
  },
  {
    name: 'Users and Admin',
    description: 'Manage users, roles, and administrative settings with a comprehensive user management system.',
    icon: Users,
  },
  {
    name: 'Websocket Manager',
    description: 'Enable real-time communication and interactive data experiences with our integrated WebSocket manager.',
    icon: MessageSquare,
  },
]

export default function AdditionalFeatures() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="lg:text-left">
          <h2 className="text-base font-semibold leading-7 text-[#1A5799] text-left">Beyond the Core</h2>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl text-left">
            Explore the Full Power of Schlep-engine
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 text-left">
            Schlep-engine offers a comprehensive suite of features designed to streamline your data operations,
            from advanced AI capabilities to robust security and seamless integrations.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {features.map((feature) => (
              <div key={feature.name} className="relative pl-16">
                <dt className="text-base font-semibold leading-7 text-gray-900">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg">
                    <feature.icon className="h-6 w-6 text-gray-700" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-700">{feature.description}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  )
}
