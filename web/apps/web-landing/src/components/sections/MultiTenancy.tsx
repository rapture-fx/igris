import React from 'react';

const features = [
  {
    name: 'Per-Tenant Budgets',
    description: 'Set individual spending limits for each tenant. Automatic enforcement prevents any tenant from exceeding their allocated budget.',
  },
  {
    name: 'Secure Key Storage',
    description: 'Vault-encrypted API key storage with AES-256 encryption. Keys never stored in plaintext and isolated per tenant.',
  },
  {
    name: '',
    description: '',
    icon: 'RB.svg',
  },
  {
    name: 'Complete Data Isolation',
    description: 'Tenant data, policies, and usage logs are completely isolated. No cross-tenant data leakage with database-level separation.',
  },
  {
    name: 'JWT Authentication',
    description: 'Enterprise-grade authentication with JSON Web Tokens. Secure tenant context propagation across all API calls.',
  },
];

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
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          <div className="max-w-[1300px] mx-auto">
            <div className="flex flex-col">
              <div className="text-left mb-8">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Multi-Tenancy</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Secure multi-tenant.<br />Scale with confidence.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  Complete tenant isolation with per-tenant controls. Production architecture designed for scale.
                </p>

                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-gray-500 dark:text-gray-400 font-mono mb-8">
                  <span className="text-gray-500 dark:text-gray-400">Designed for:</span>
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    <span className="inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      B2B AI platforms
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      SaaS applications with AI features
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      Enterprise deployments
                    </span>
                    <span className="inline-flex items-center">
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2"></span>
                      Companies building AI infrastructure
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-0 pl-0 pr-8 justify-start">
                {/* Left column: Per-Tenant Budgets and Secure Key Storage */}
                <div className="flex flex-col">
                  {features.slice(0, 2).map((feature, index) => (
                    <div
                      key={feature.name}
                      className={`flex flex-col p-4 ${index === 1 ? 'border-l border-t border-b border-r border-gray-200 mt-2' : 'border-l border-t border-b border-r border-gray-200'}`}
                      style={{
                        backgroundColor: '#f7f7f3',
                        minHeight: '180px'
                      }}
                    >
                      {index === 1 ? (
                        <div className="text-left mb-1 mt-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                            {feature.name}
                          </h3>
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                            {feature.description}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1"></div>
                          <div className="text-left mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                              {feature.name}
                            </h3>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                              {feature.description}
                            </p>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Middle: Resource Pooling with large SVG */}
                <div
                  className="flex flex-col p-4"
                  style={{
                    backgroundColor: '#f7f7f3',
                    minHeight: '380px',
                    minWidth: '450px'
                  }}
                >
                  <div className="flex-1 flex items-center justify-center">
                    <img 
                      src="/RB.svg"
                      alt="Resource Pooling"
                      className="object-contain"
                      style={{ height: '360px', width: '360px', opacity: '0.6' }}
                    />
                  </div>
                </div>

                {/* Right column: Complete Data Isolation and JWT Authentication */}
                <div className="flex flex-col">
                  {features.slice(3, 5).map((feature, index) => (
                    <div
                      key={feature.name}
                      className={`flex flex-col p-4 ${index === 0 ? 'border-l border-t border-b border-r border-gray-200' : 'border-l border-t border-b border-r border-gray-200 mt-2'}`}
                      style={{
                        backgroundColor: '#f7f7f3',
                        minHeight: '180px'
                      }}
                    >
                      {index === 1 ? (
                        <div className="text-left mb-1 mt-1">
                          <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                            {feature.name}
                          </h3>
                          <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                            {feature.description}
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="flex-1"></div>
                          <div className="text-left mb-1">
                            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                              {feature.name}
                            </h3>
                            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                              {feature.description}
                            </p>
                          </div>
                        </>
                      )}
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
