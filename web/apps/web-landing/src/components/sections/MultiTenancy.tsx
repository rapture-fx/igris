import React from 'react'
import { DollarSign, Shield, Database, KeyRound } from 'lucide-react';

const features = [
  {
    name: 'Bring Your Own Keys',
    description: 'Full ownership of provider API keys and local models. AES-256 encrypted vaults for cloud credentials. Models stay on your devices. Zero vendor lock-in.',
    icon: KeyRound,
  },
  {
    name: 'Multi-Tenant Isolation',
    description: 'Complete separation of tenant data, policies, and budgets at the database level. Each workspace operates independently with row-level security policies.',
    icon: Database,
  },
  {
    name: 'Encrypted Model Storage',
    description: 'Runtime encrypts on-device LoRA adapters and training data with AES-256-GCM. Device-specific keys ensure models trained on one edge device stay locked to that device.',
    icon: Shield,
  },
  {
    name: 'Zero-Trust Architecture',
    description: 'JWT-based authentication with per-request validation. Every API call verified within tenant context. Budget limits enforced automatically to prevent overspending.',
    icon: DollarSign,
  },
];

export default function MultiTenancy() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
        <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          height: '100%'
        }}>

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden pl-4 md:pl-8 lg:pl-12 text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000', fontFamily: 'Roboto Mono, monospace' }}>
                Secure by default. Built to scale.
              </h3>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-inter mb-8" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                Multi-tenant isolation, encrypted key storage, and zero-trust architecture are built in from day one. From cloud control planes to edge devices, your workloads stay protected as you scale.
              </p>

              {/* Features - Mobile */}
              <div className="flex flex-col gap-8 text-left">
                {features.map((feature, index) => (
                  <div key={feature.name}>
                    <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {feature.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1" style={{ height: '100%' }}>
              {/* Left Column - Features (2 columns wide) */}
              <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start pl-4 md:pl-8 lg:pl-12" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem' }}>
                  <div className="w-full max-w-[320px] mr-auto">
                  <div className="flex flex-col gap-8">
                    {features.map((feature, index) => (
                      <div key={feature.name} className="text-left">
                        <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                          {feature.name}
                        </h3>
                        <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Title and Intro (Desktop only) */}
              <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '16rem', paddingBottom: '3rem', paddingLeft: '1rem', height: '100%' }}>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000', fontFamily: 'Roboto Mono, monospace' }}>
                  Secure by default. Built to scale.
                </h3>
                  <p className="text-[10px] md:text-xs text-gray-600 dark:text-gray-400 font-inter leading-relaxed" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                  Multi-tenant isolation, encrypted key storage, and zero-trust architecture are built in from day one. From cloud control planes to edge devices, your workloads stay protected as you scale.
                </p>
              </div>
            </div>
        </div>
      </div>
    </section>
  );
}
