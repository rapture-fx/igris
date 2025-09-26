import React from 'react'
import { Shield, Lock, Key, Eye, CheckCircle, AlertTriangle, Database, Globe, ArrowUpRight } from 'lucide-react'
import Link from 'next/link'

const securityFeatures = [
  {
    name: 'Authentication & Access Control',
    description: 'Complete identity verification with MFA, automatic API key rotation, and instant token revocation for seamless yet secure access management.',
    icon: Shield,
  },
  {
    name: 'Infrastructure Protection',
    description: 'Advanced rate limiting with DDoS protection and zero-trust input validation to prevent attacks at every endpoint.',
    icon: Lock,
  },
  {
    name: 'Data Security & Compliance',
    description: 'End-to-end AES-256 encryption with automated GDPR/HIPAA compliance, audit trails, and secure data retention policies.',
    icon: Database,
  },
  {
    name: 'Security Headers & Standards',
    description: 'Industry-standard security headers including HSTS, CSP, and CORS validation on all API responses.',
    icon: Globe,
  },
]

export default function SecuritySection() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1450px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-8" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container with Original Width */}
          <div className="max-w-[1300px] mx-auto">
            <div className="text-center mb-12">
              <div className="inline-block border border-gray-300 rounded-lg px-3 py-1.5">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter text-center">End-to-End Safeguards</h2>
              </div>
              <p className="mt-2 text-2xl font-medium tracking-tight text-gray-900 dark:text-white md:text-3xl text-center font-inter">
                <span style={{ color: '#114dcd' }}>Built-In Protection</span>
              </p>
              <p className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-center font-inter">
                From API authentication to data encryption, every layer is secured without compromise.
              </p>
            </div>

          <div className="mx-auto mt-16 max-w-xl sm:mt-20 lg:mt-24">
          <div className="space-y-4">
            {securityFeatures.map((feature) => (
              <div key={feature.name} className="flex items-center gap-4 p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-blue-50 dark:bg-gray-700 flex-shrink-0">
                  <feature.icon className="h-6 w-6 text-blue-600 dark:text-blue-400" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                    {feature.name}
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-16 text-center">
            <Link
              href="/security/overview"
              className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl hover:bg-blue-100 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
              style={{ backgroundColor: '#e9eef9', color: '#1f53d0' }}
            >
              Learn More
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
            </div>
          </div>
          </div>
        </div>
      </div>
    </section>
  )
}