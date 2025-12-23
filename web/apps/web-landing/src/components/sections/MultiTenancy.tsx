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
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white overflow-hidden" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
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

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
            <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-66.67%)'
            }}></div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>

              {/* Left Column - Image */}
              <div className="lg:col-span-2 relative flex items-center justify-start pl-0 md:pl-4 lg:pl-8">
                {/* Background image layer */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'url("/human.png")',
                    backgroundSize: '40%',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                    borderRadius: '0',
                    left: '-2rem',
                    right: 'auto',
                    width: 'calc(100% + 2rem)',
                    opacity: 1
                  }}
                />
              </div>

              {/* Right Column - Section Title and Features */}
              <div className="text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Secure by default. Built to scale.
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter mb-12">
                  Multi-tenant isolation, encrypted key storage, and zero-trust architecture are built in from day one. From cloud control planes to edge devices, your workloads stay protected as you scale.
                </p>

                {/* Features Grid */}
                <div className="flex flex-col gap-8">
                  {features.map((feature, index) => (
                    <div key={feature.name} className="text-left">
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
        </div>
      </div>
    </section>
  );
}
