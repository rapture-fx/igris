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
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-16 px-12" style={{
          borderTop: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderBottom: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderLeft: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderRight: '0.3px solid rgba(156, 163, 175, 0.2)',
          backgroundColor: '#f6f6f4'
        }}>
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          <div className="max-w-[1300px] mx-auto">
            {/* Section Title */}
            <div className="text-left mb-16">
              <h3 className="text-2xl tracking-tight md:text-3xl font-normal font-inter mb-4" style={{ color: '#000000' }}>
                Secure by design. Scalable by default.
              </h3>
              <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-inter max-w-3xl">
                Tenant isolation, key encryption, and enterprise authentication built into every request. Schlep-Engine is production-ready security infrastructure, not an afterthought.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={feature.name} className="text-left border-l border-gray-200 dark:border-gray-700 pl-6">
                  <h3 className="text-base font-normal text-gray-900 dark:text-white mb-3 font-inter">
                    {feature.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
