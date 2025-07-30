'use client'

import { ShieldCheck, Lock, Fingerprint, FileText, Server, Globe, Key, Activity, Layers } from 'lucide-react'
import { motion } from 'framer-motion'

const securityFeatures = [
  {
    name: 'Multi-layered Authentication',
    description: 'Robust user verification with advanced MFA (TOTP, SMS, email, backup codes) and account lockout.',
    icon: Fingerprint,
  },
  {
    name: 'Field-Level Encryption',
    description: 'Sensitive data is encrypted at rest and in transit using AES-256-GCM with strong key management.',
    icon: Lock,
  },
  {
    name: 'Comprehensive Audit Trails',
    description: 'Detailed logging of all activities, PII masking in logs, and security event correlation.',
    icon: FileText,
  },
  {
    name: 'Role-Based Access Control (RBAC)',
    description: 'Fine-grained permissions (Admin > Analyst > User) and API key management with usage tracking.',
    icon: Layers,
  },
  {
    name: 'SOC 2 & GDPR Compliant',
    description: 'Built with enterprise-grade security controls meeting or exceeding SOC 2 Type II and GDPR standards.',
    icon: ShieldCheck,
  },
  {
    name: 'Secure API Endpoints',
    description: 'Advanced rate limiting, security headers (HSTS, CSP), CSRF protection, and input validation.',
    icon: Server,
  },
  {
    name: 'Global Infrastructure Security',
    description: 'Leveraging secure global infrastructure with 24/7 monitoring and end-to-end encryption.',
    icon: Globe,
  },
  {
    name: 'Secure Password Requirements',
    description: 'Enforced strong password policies (8+ chars, mixed case, digits, symbols) with validation.',
    icon: Key,
  },
  {
    name: 'Real-time Security Monitoring',
    description: 'Continuous monitoring for anomalies and threats, integrated with enhanced security systems.',
    icon: Activity,
  },
]

export default function SecurityFeatures() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-[#161616]">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="lg:text-center mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-base font-semibold leading-7 text-[#1A5799]"
          >
            Enterprise-Grade Protection
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl"
          >
            Your Data, Secured with Confidence
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-gray-300"
          >
            Schlep-engine is built from the ground up with security as a core principle, 
            ensuring your sensitive data is protected by industry-leading controls and compliance.
          </motion.p>
        </div>

        <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-4xl">
          <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-10 lg:max-w-none lg:grid-cols-2 lg:gap-y-16">
            {securityFeatures.map((feature) => (
              <motion.div
                key={feature.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ duration: 0.5 }}
                className="relative pl-16"
              >
                <dt className="text-base font-semibold leading-7 text-beige-secondary">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg bg-[#468BE6]">
                    <feature.icon className="h-6 w-6 text-white" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-beige-secondary">{feature.description}</dd>
              </motion.div>
            ))}
          </dl>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-20 text-center"
        >
          <div className="bg-gradient-to-r from-[#468BE6]/10 to-blue-100/50 rounded-2xl p-8 max-w-3xl mx-auto border border-[#468BE6]/20">
            <h3 className="text-xl font-semibold text-beige-secondary mb-4">
              Compliance & Certifications
            </h3>
            <div className="flex flex-wrap justify-center gap-6 text-beige-secondary font-medium">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-green-600" />
                <span>SOC 2 Type II Ready</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-green-600" />
                <span>GDPR Fully Compliant</span>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-green-600" />
                <span>ISO 27001 (85% Ready)</span>
              </div>
            </div>
            <p className="mt-6 text-beige-secondary text-sm">
              We are committed to maintaining the highest security standards and regularly undergo third-party audits.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}