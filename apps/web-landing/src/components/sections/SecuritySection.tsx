import React from 'react'
import { Shield, Lock, Key, Eye, CheckCircle, AlertTriangle, Database, Globe } from 'lucide-react'

const securityFeatures = [
  {
    name: 'Complete MFA System',
    description: 'TOTP with QR code setup, backup codes, OAuth 2.0 integration, and automatic MFA enforcement for sensitive operations.',
    icon: Shield,
  },
  {
    name: 'Token Revocation System',
    description: 'Instant token blacklisting, session revocation, and Redis-backed token validation with automatic cleanup.',
    icon: Lock,
  },
  {
    name: 'API Key Auto-Rotation',
    description: 'Automatic key rotation before expiry, grace periods for seamless transitions, and emergency rotation capabilities.',
    icon: Key,
  },
  {
    name: 'Advanced Rate Limiting',
    description: 'Sliding window algorithms, distributed Redis limits, GraphQL query complexity analysis, and DDoS protection.',
    icon: Eye,
  },
  {
    name: 'Compliance Automation',
    description: 'GDPR/HIPAA audit trails, PII masking, data retention policies, and automated compliance reporting.',
    icon: CheckCircle,
  },
  {
    name: 'Zero-Trust Validation',
    description: 'Comprehensive input sanitization, SQL/NoSQL injection prevention, and XSS protection with pattern detection.',
    icon: AlertTriangle,
  },
  {
    name: 'Encrypted Infrastructure',
    description: 'AES-256 encryption, field-level data protection, secure PostgreSQL connections, and encrypted backups.',
    icon: Database,
  },
  {
    name: 'Security-First Headers',
    description: 'HSTS preload, Content Security Policy, CORS validation, and comprehensive security headers on all responses.',
    icon: Globe,
  },
]

export default function SecuritySection() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-base leading-7 text-gray-500 dark:text-gray-400 font-inter text-center">End-to-End Safeguards</h2>
          <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl text-center font-inter">
            <span style={{ color: '#114dcd' }}>Secure by Default</span>
          </p>
          <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
            From API authentication to data encryption, every layer is secured without compromise.
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