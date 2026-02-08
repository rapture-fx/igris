import React from 'react'

const features = [
  {
    title: 'Air-gapped operation',
    description: 'The system is designed to operate independently of network access. Deploy in secure facilities, remote environments, or fully offline locations. Execution continues uninterrupted when connectivity is unavailable or restricted.',
  },
  {
    title: 'Zero-trust device enrollment',
    description: 'Devices authenticate cryptographically before joining a fleet. Each device is verified individually. Untrusted or compromised hardware is rejected automatically. No device is trusted implicitly.',
  },
  {
    title: 'Device-bound encryption',
    description: 'Models and execution data are encrypted and bound to specific hardware. If a device is lost or removed, its data remains inaccessible. Cryptographic keys are generated and stored on-device and are never transmitted over the network.',
  },
  {
    title: 'Verified updates',
    description: 'Model updates and configuration changes require cryptographic signatures. Unsigned or modified artifacts are rejected before deployment. Only approved updates are allowed to execute across the fleet.',
  },
  {
    title: 'Verified fleet synchronization',
    description: 'When connectivity is available, fleet state and configuration changes are verified before being applied. Only signed and authorized updates propagate to devices. Execution guarantees remain unchanged regardless of network state.',
  },
]

export default function MultiTenancy() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b section-border" style={{ paddingTop: '1rem', paddingBottom: '1rem' }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left side - Intro */}
            <div className="text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ letterSpacing: '0.05em' }}>
                03. PROOF
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontWeight: 400 }}>
                Verifiable execution by design
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, maxWidth: '360px' }}>
                Every decision is recorded. Every update is signed. Execution can be inspected after the fact—without relying on trust, assumptions, or continuous connectivity.
              </p>
            </div>

            {/* Right side - Features */}
            <div className="relative">
                <img
                  src="/hrllg.png"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                />
              <div className="relative z-10">
                <div className="w-full max-w-xl space-y-4">
                  {features.map((feature) => (
                    <div key={feature.title} className="border border-white/50 dark:border-[#f6f6f4]/25 rounded-lg p-4 bg-white/60 dark:bg-[#1b1912]/60 backdrop-blur-md">
                      <h4 className="text-sm font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">
                        {feature.title}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400 }}>
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
  )
}
