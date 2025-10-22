import React from 'react'
import { Users, Lock, Shield, Settings } from 'lucide-react'

const features = [
  {
    name: 'Per-Tenant Budgets',
    description: 'Set individual spending limits for each tenant. Automatic enforcement prevents any tenant from exceeding their allocated budget.',
    icon: Settings,
  },
  {
    name: 'Secure Key Storage',
    description: 'Vault-encrypted API key storage with AES-256 encryption. Keys never stored in plaintext and isolated per tenant.',
    icon: Lock,
  },
  {
    name: 'Complete Data Isolation',
    description: 'Tenant data, policies, and usage logs are completely isolated. No cross-tenant data leakage with database-level separation.',
    icon: () => (
      <img 
        src="/Data Isolation.svg" 
        alt="Complete Data Isolation" 
        className="h-24 w-24" 
        style={{ width: '96px', height: '96px' }}
      />
    ),
  },
  {
    name: 'JWT Authentication',
    description: 'Enterprise-grade authentication with JSON Web Tokens. Secure tenant context propagation across all API calls.',
    icon: Users,
  },
]

export default function MultiTenancy() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
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

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Left Column - Features */}
              <div className="lg:col-span-3">
                <div className="relative">
                  {/* Background Placeholder */}
                  <div className="absolute inset-0 rounded-lg overflow-hidden" style={{
                    backgroundColor: '#f2f1ed',
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 2px,
                      rgba(0,0,0,0.02) 2px,
                      rgba(0,0,0,0.02) 4px
                    )`
                  }}>
                  </div>
                  
                  {/* Cards Grid on top */}
                  <div className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-4 p-8">
                    {features.map((feature) => {
    // First two cards (top row) - text at top
    if (feature.name === 'Per-Tenant Budgets' || feature.name === 'Secure Key Storage') {
      return (
        <div key={feature.name} className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col" style={{
          backgroundColor: '#f7f7f3',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
          minHeight: '280px'
        }}>
          {/* Top Text Area */}
          <div className="flex mb-6">
            <div className="text-left">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono" style={{ height: '20px', lineHeight: '20px', overflow: 'hidden' }}>
                {feature.name}
              </h3>
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono" style={{ height: '40px', lineHeight: '13px', overflow: 'hidden' }}>{feature.description}</p>
            </div>
          </div>
          
          {/* Bottom Placeholder Area */}
          <div className="flex-1 flex items-center justify-center">
            {/* Empty placeholder at bottom */}
          </div>
        </div>
      );
    }

    // Bottom two cards (bottom row) - text at bottom (original layout)
    return (
      <div key={feature.name} className="p-6 rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between" style={{
        backgroundColor: '#f7f7f3',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
        minHeight: '280px'
      }}>
        {/* Top Placeholder Area */}
        <div className="flex-1 flex items-center justify-center">
          {/* Empty placeholder for bottom cards */}
        </div>
        
        {/* Bottom Text Area */}
        <div className="flex">
          <div className="text-left">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono" style={{ height: '20px', lineHeight: '20px', overflow: 'hidden' }}>
              {feature.name}
            </h3>
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono" style={{ height: '40px', lineHeight: '13px', overflow: 'hidden' }}>{feature.description}</p>
          </div>
        </div>
      </div>
    );
  })}
                  </div>
                </div>
              </div>

              {/* Right Column - Title and Description */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Multi-Tenancy</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Secure multi-tenant.<br />Scale with confidence.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  Complete tenant isolation with per-tenant controls. Production architecture designed for scale.
                </p>

                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 font-inter">
                  <p><strong className="text-gray-900 dark:text-white">Perfect for:</strong></p>
                  <ul className="list-disc list-inside space-y-1 ml-2">
                    <li>B2B AI platforms</li>
                    <li>SaaS applications with AI features</li>
                    <li>Enterprise deployments</li>
                    <li>Companies building AI infrastructure</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
