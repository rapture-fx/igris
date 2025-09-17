import React from 'react'
import { Shield, Lock, Key, Eye, CheckCircle, AlertTriangle, Database, Globe } from 'lucide-react'

const securityFeatures = [
  {
    name: 'API-First Security',
    description: 'Built-in API authentication, rate limiting, and request validation with comprehensive threat detection.',
    icon: Shield,
  },
  {
    name: 'End-to-End Encryption',
    description: 'All data is encrypted in transit and at rest using industry-standard AES-256 encryption.',
    icon: Lock,
  },
  {
    name: 'Advanced Authentication',
    description: 'Multi-layered auth with JWT tokens, API keys, OAuth 2.0, and automated key rotation.',
    icon: Key,
  },
  {
    name: 'Real-time Monitoring',
    description: 'Continuous security monitoring with ML-based threat detection and instant alerting.',
    icon: Eye,
  },
  {
    name: 'Compliance Ready',
    description: 'SOC 2, GDPR, and HIPAA compliant infrastructure with comprehensive audit logging.',
    icon: CheckCircle,
  },
  {
    name: 'Threat Prevention',
    description: 'Advanced DDoS protection, SQL injection prevention, and automated incident response.',
    icon: AlertTriangle,
  },
  {
    name: 'Secure Data Isolation',
    description: 'Multi-tenant architecture with complete data isolation and encrypted storage.',
    icon: Database,
  },
  {
    name: 'Network Security',
    description: 'VPC isolation, WAF protection, and secure API gateways with global edge security.',
    icon: Globe,
  },
]

export default function SecuritySection() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter text-center">Enterprise-grade protection</h2>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl text-center font-inter">
            <span style={{ color: '#114dcd' }}>Secure by Default</span>
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
            Built with security at every layer. From API authentication to data encryption, every request is protected by enterprise-grade security measures.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-6xl sm:mt-20 lg:mt-24">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {securityFeatures.map((feature) => (
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