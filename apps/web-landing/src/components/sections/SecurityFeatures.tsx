'use client'

import { ShieldCheck, Lock, Fingerprint, FileText, Server, Globe, Key, Activity, Layers } from 'lucide-react'
import { motion } from 'framer-motion'

const securityFeatures = [
  {
    name: 'User Authentication',
    description: 'Standard user authentication with password requirements and optional two-factor authentication.',
    icon: Fingerprint,
  },
  {
    name: 'Data Encryption',
    description: 'HTTPS for data in transit and encrypted storage for sensitive information.',
    icon: Lock,
  },
  {
    name: 'Activity Logging',
    description: 'Basic audit logs for user actions and API requests for security monitoring.',
    icon: FileText,
  },
  {
    name: 'Access Control',
    description: 'User roles and permissions system with API key management for controlled access.',
    icon: Layers,
  },
  {
    name: 'Security Standards',
    description: 'Security implementation following common industry practices and standards.',
    icon: ShieldCheck,
  },
  {
    name: 'API Security',
    description: 'Rate limiting, input validation, and standard security headers for API endpoints.',
    icon: Server,
  },
  {
    name: 'Infrastructure Security',
    description: 'Hosted on secure cloud infrastructure with regular security updates.',
    icon: Globe,
  },
  {
    name: 'Password Policy',
    description: 'Basic password requirements including minimum length and complexity rules.',
    icon: Key,
  },
  {
    name: 'Monitoring',
    description: 'System monitoring for unusual activity and basic security alerting.',
    icon: Activity,
  },
]

export default function SecurityFeatures() {
  return (
    <section className="py-20 sm:py-24 lg:py-32 bg-white dark:bg-black">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="lg:text-left mb-16">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-base font-semibold leading-7 text-[#1A5799] text-left"
          >
            Security Features
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white sm:text-4xl text-left"
          >
            Data Security and Access Control
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-lg leading-8 text-gray-700 dark:text-gray-300 text-left"
          >
            Standard security features to protect your data and control access to processing capabilities.
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
                <dt className="text-base font-semibold leading-7 text-gray-900 dark:text-white">
                  <div className="absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-lg dark:bg-gray-800">
                    <feature.icon className="h-6 w-6 text-gray-700 dark:text-gray-300" aria-hidden="true" />
                  </div>
                  {feature.name}
                </dt>
                <dd className="mt-2 text-base leading-7 text-gray-700 dark:text-gray-400">{feature.description}</dd>
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
          <div className="bg-gray-50 dark:bg-gray-900 rounded-2xl p-8 max-w-3xl mx-auto border border-gray-200 dark:border-gray-800">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Security Approach
            </h3>
            <div className="flex flex-wrap justify-center gap-6 text-gray-900 dark:text-gray-300 font-medium">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-blue-600" />
                <span>Industry Best Practices</span>
              </div>
              <div className="flex items-center space-x-2">
                <Globe className="w-5 h-5 text-blue-600" />
                <span>Privacy by Design</span>
              </div>
              <div className="flex items-center space-x-2">
                <Lock className="w-5 h-5 text-blue-600" />
                <span>Secure by Default</span>
              </div>
            </div>
            <p className="mt-6 text-gray-700 dark:text-gray-400 text-sm">
              Security features are implemented following established industry practices and standards.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
}