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
    description: 'Advanced rate limiting with DDoS protection and comprehensive input validation to prevent attacks at every endpoint.',
    icon: Lock,
  },
  {
    name: 'Data Security & Compliance',
    description: 'End-to-end AES-256 encryption with GDPR/HIPAA compliance features, comprehensive audit trails, and configurable data retention policies.',
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
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Left Column - Title and Description */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">End-to-End Safeguards</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-6" style={{ color: '#114dcd' }}>
                  From API authentication to data encryption, every layer is secured without compromise.
                </h3>

                {/* Learn More Link */}
                <div className="mb-6">
                  <Link
                    href="/security/overview"
                    className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                    style={{ color: '#1f53d0' }}
                  >
                    Learn More
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>

              {/* Right Column - Security Features */}
              <div className="rounded-lg p-12 lg:col-span-3 min-h-[700px] flex items-center" style={{
                backgroundColor: '#f2f1ed',
                backgroundImage: `repeating-linear-gradient(
                  45deg,
                  transparent,
                  transparent 2px,
                  rgba(0,0,0,0.02) 2px,
                  rgba(0,0,0,0.02) 4px
                )`
              }}>
                <div className="space-y-4 max-w-lg mx-auto w-full">
                  {securityFeatures.map((feature) => (
                    <div key={feature.name} className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#f7f7f3', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                      <div className="flex h-12 w-12 items-center justify-center flex-shrink-0">
                        <feature.icon className="h-6 w-6 text-black" aria-hidden="true" />
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}