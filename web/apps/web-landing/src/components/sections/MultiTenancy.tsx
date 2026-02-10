import React from 'react'

const features = [
  {
    title: 'Air-gapped operation',
    description: 'The system is designed to operate independently of network access. Deploy in secure facilities, remote environments, or fully offline locations.',
  },
  {
    title: 'Zero-trust device enrollment',
    description: 'Devices authenticate cryptographically before joining a fleet. Each device is verified individually. Untrusted or compromised hardware is rejected automatically.',
  },
  {
    title: 'Device-bound encryption',
    description: 'Models and execution data are encrypted and bound to specific hardware. If a device is lost or removed, its data remains inaccessible.',
  },
  {
    title: 'Verified updates',
    description: 'Model updates and configuration changes require cryptographic signatures. Unsigned or modified artifacts are rejected before deployment.',
  },
  {
    title: 'Verified fleet synchronization',
    description: 'When connectivity is available, fleet state and configuration changes are verified before being applied. Only signed and authorized updates propagate.',
  },
]

export default function MultiTenancy() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12" style={{ paddingTop: '4rem', paddingBottom: '4rem', borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title */}
          <div className="text-left mb-8">
            <h3 className="text-xl md:text-2xl lg:text-3xl mb-4 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Verifiable execution by design
            </h3>
          </div>

          {/* Bento grid: 2 on top, 3 on bottom - compact centered */}
          <div className="max-w-[700px] mx-auto flex flex-col gap-4">
            {/* Top row - 2 items */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {features.slice(0, 2).map((feature) => (
                <div key={feature.title} className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-5 bg-[#edece9] dark:bg-[#1b1912]/60 hover:border-gray-300 dark:hover:border-[#f6f6f4]/15 transition-colors duration-200 min-h-[180px]">
                  <h4 className="text-sm md:text-base font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">
                    {feature.title}
                  </h4>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: 'var(--font-geist-sans)' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Bottom row - 3 items */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {features.slice(2).map((feature) => (
                <div key={feature.title} className="border border-gray-200 dark:border-[#f6f6f4]/8 rounded-2xl p-5 bg-[#edece9] dark:bg-[#1b1912]/60 hover:border-gray-300 dark:hover:border-[#f6f6f4]/15 transition-colors duration-200 min-h-[180px]">
                  <h4 className="text-sm md:text-base font-bold mb-2 text-[#000000] dark:text-[#f6f6f4]">
                    {feature.title}
                  </h4>
                  <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontWeight: 400, fontFamily: 'var(--font-geist-sans)' }}>
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
