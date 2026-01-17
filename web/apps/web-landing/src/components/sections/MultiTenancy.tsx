import React from 'react'
import { DollarSign, Shield, Database, KeyRound } from 'lucide-react';

const features = [
  {
    name: 'Your Keys, Your Control',
    description: 'Use your own provider API keys. They\'re stored encrypted and keep working even if our servers are down. No vendor lock-in.',
    icon: KeyRound,
  },
  {
    name: 'Complete Isolation',
    description: 'Your data never touches another customer\'s. Budget alerts at 75%, 90%, and 100% prevent surprises. Per-customer rate limits keep traffic separate.',
    icon: Database,
  },
  {
    name: 'Edge-First Security',
    description: 'Models running on your devices stay encrypted with keys that never leave. Training data stays local — only model updates are synced.',
    icon: Shield,
  },
  {
    name: 'Every Request Verified',
    description: 'Each API call is authenticated in context. If a provider goes down, traffic reroutes automatically. Hard limits prevent runaway costs.',
    icon: DollarSign,
  },
];

export default function MultiTenancy() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912]" style={{
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
            height: '750px'
          }}>

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                <p className="text-base text-[#700a0a] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  04. SECURITY
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Secure by default. Built to scale.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter mb-8">
                Security isn't optional — it's how the system is built. Your data, keys, and models stay yours, whether you're running in the cloud or on edge devices.
              </p>

              {/* Features - Mobile */}
              <div className="flex flex-col gap-8 text-left">
                {features.map((feature, index) => (
                  <div key={feature.name}>
                    <h3 className="text-sm font-normal text-gray-900 dark:text-[#f6f6f4] mb-3 font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {feature.name}
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1">
               {/* Left Column - Features (2 columns wide) */}
               <div className="hidden md:flex md:col-span-2 flex-col justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '1rem' }}>
                    <div className="w-full max-w-[320px]">
                   <div className="flex flex-col gap-8">
                    {features.map((feature, index) => (
                      <div key={feature.name} className="text-left">
                    <h3 className="text-sm font-semibold mb-3 font-inter text-[#000000] dark:text-[#f6f6f4]">
                      {feature.name}
                    </h3>
                   <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                      {feature.description}
                    </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Right Column - Title and Intro (Desktop only) */}
                <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                <p className="text-base text-[#700a0a] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  04. SECURITY
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                  Secure by default. Built to scale.
                </h3>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                  Security isn't optional — it's how the system is built. Your data, keys, and models stay yours, whether you're running in the cloud or on edge devices.
                </p>
              </div>
            </div>
        </div>
      </div>
    </section>
  );
}
