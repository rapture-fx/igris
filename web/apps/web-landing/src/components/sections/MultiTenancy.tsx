import React from 'react'
import { DollarSign, Shield, Database, KeyRound } from 'lucide-react';

const features = [
  {
    name: 'Per-Tenant Budgets',
    description: 'Set individual spending limits for each tenant. Automatic enforcement prevents any tenant from exceeding their allocated budget.',
    icon: DollarSign,
  },
  {
    name: 'Secure Key Storage',
    description: 'Vault-encrypted API key storage with AES-256 encryption. Keys never stored in plaintext and isolated per tenant.',
    icon: KeyRound,
  },
  {
    name: 'Complete Data Isolation',
    description: 'Tenant data, policies, and usage logs are completely isolated. No cross-tenant data leakage with database-level separation.',
    icon: Database,
  },
  {
    name: 'JWT Authentication',
    description: 'Enterprise-grade authentication with JSON Web Tokens. Secure tenant context across all API calls.',
    icon: Shield,
  },
];

export default function MultiTenancy() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f7f7f3'
        }}>
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8 h-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              {/* Left Column - Features */}
              <div className="text-left lg:col-span-1">
                <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-4 font-inter" style={{ color: '#000000' }}>
                  Secure by design.<br />Scalable by default.
                </h3>
                  <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
                    Complete tenant isolation with per-tenant controls.<br />
                    Production architecture designed for scale.
                  </p>
                  <ul className="space-y-4">
                    {features.map((feature, index) => (
                      <li key={feature.name} className="flex items-start gap-3 mb-4">
                        <div className="flex h-8 w-8 items-center justify-center flex-shrink-0">
                          <feature.icon className="h-5 w-5 text-black" aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                            {feature.name}
                          </h3>
                          <p className="text-sm text-gray-700 dark:text-gray-300 leading-tight font-mono">
                            {feature.description}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Right Column - Additional Content */}
                <div className="text-left lg:col-span-1">
                  {/* Add any additional content here if needed */}
                </div>
              </div>
            </div>
          </div>
        </div>
    </section>
  );
}
