import React from 'react'
import { KeyRound, Database, Shield, Lock } from 'lucide-react';

const features = [
  {
    name: 'Air-Gap Ready',
    description: 'Never needs to call home. Your AI runs in the void. Internet goes dark? Runtime keeps breathing. Paranoid IT loves this.',
    icon: KeyRound,
  },
  {
    name: 'Zero-Trust by Default',
    description: 'Every device cryptographically signs. Compromised hardware tries to phone home? The network rejects it. Trust nothing. Verify everything.',
    icon: Database,
  },
  {
    name: 'Offline-First Encryption',
    description: 'Models die with the device. Lose hardware to the desert? The model\'s already dead. Keys never leave. Data never leaks.',
    icon: Shield,
  },
  {
    name: 'Signed Updates Only',
    description: 'Model updates are cryptographically signed. Unsigned code dies at the gate. Only verified changes reach your fleet.',
    icon: Lock,
  },
];

export default function MultiTenancy() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[800px] md:h-[800px]">

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
              04. SECURITY
            </p>
            <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
              Trust no one. Verify everything.
            </h3>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter mb-8">
              Your AI runs in places you can't physically guard. So we built it to guard itself.
            </p>

            {/* Features - Mobile */}
            <div className="flex flex-col gap-8 text-left">
              {features.map((feature, index) => (
                <div key={feature.name}>
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-[#f6f6f4] mb-3 font-inter">
                    {feature.name}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Two-column layout */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Features (2 columns wide) */}
            <div className="hidden md:flex md:col-span-2 flex-col" style={{ paddingTop: '3rem', paddingRight: '2rem' }}>
              {/* Section 1: First 2 features with frame */}
              <div className="flex gap-6 mb-6">
                <div className="w-[250px] h-auto border border-[rgba(156,163,175,0.3)] dark:border-[rgba(246,246,244,0.05)] flex-shrink-0 overflow-hidden">
                  <img src="/si.png" alt="" className="w-full h-auto object-contain" style={{ opacity: 1 }} />
                </div>
                <div className="flex-1">
                  <div className="flex flex-col gap-6">
                    {features.slice(0, 2).map((feature) => (
                      <div key={feature.name} className="text-left pb-6 border-b border-[rgba(156,163,175,0.3)] dark:border-[rgba(246,246,244,0.05)] last:border-0">
                        <h3 className="text-sm font-semibold mb-3 font-inter text-[#000000] dark:text-[#f6f6f4]">
                          {feature.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Section 2: Last 2 features with frame */}
              <div className="flex gap-6">
                <div className="flex-1">
                  <div className="flex flex-col gap-6">
                    {features.slice(2, 4).map((feature) => (
                      <div key={feature.name} className="text-left pb-6 border-b border-[rgba(156,163,175,0.3)] dark:border-[rgba(246,246,244,0.05)] last:border-0">
                        <h3 className="text-sm font-semibold mb-3 font-inter text-[#000000] dark:text-[#f6f6f4]">
                          {feature.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                          {feature.description}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="w-[250px] h-[200px] border border-[rgba(156,163,175,0.3)] dark:border-[rgba(246,246,244,0.05)] flex-shrink-0 overflow-hidden flex flex-col justify-end items-center">
                  <img src="/de.png" alt="" className="w-[120%] h-auto object-contain" style={{ opacity: 0.85 }} />
                </div>
              </div>
              {/* Bottom Frame */}
              <div className="w-full flex-shrink-0 border-l border-r border-b border-t border-[rgba(156,163,175,0.3)] dark:border-[rgba(246,246,244,0.05)] mt-6 relative overflow-hidden" style={{ height: '250px' }}>
                <img src="/co.png" alt="" className="absolute inset-0 w-full h-full" style={{ opacity: 0.8, objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.1)' }} />
                <div className="absolute bottom-4 left-4 text-left max-w-xs">
                  <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">
                    Verified Fleet Sync
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                    When connected, Runtime verifies all dashboard updates before applying them. Only signed, approved changes reach your devices.
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Title and Intro (Desktop only) */}
            <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                04. SECURITY
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Trust no one. Verify everything.
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Your AI runs in places you can't physically guard. So we built it to guard itself.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
