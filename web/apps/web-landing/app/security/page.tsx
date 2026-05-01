'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import ClosingPosition from '../../src/components/sections/ClosingPosition'

const features = [
  {
    title: 'Air-gapped operation',
    description: 'The system is designed to operate independently of network access. Deploy in secure facilities, remote environments, or fully offline locations.',
    details: [
      'All inference and execution happens locally on-device with zero cloud dependencies.',
      'Models, configuration, and execution state are stored entirely on the device.',
      'No telemetry, no phone-home, no external service calls. The runtime is fully self-contained.',
      'Ideal for classified environments, remote field operations, and locations without reliable connectivity.',
    ],
  },
  {
    title: 'Zero-trust device enrollment',
    description: 'Devices authenticate cryptographically before joining a fleet. Each device is verified individually. Untrusted or compromised hardware is rejected automatically.',
    details: [
      'Each device generates a unique cryptographic identity during enrollment.',
      'Fleet membership requires mutual authentication\u2014the device verifies the fleet, and the fleet verifies the device.',
      'Revocation is immediate. Compromised devices are excluded from fleet operations without affecting other members.',
      'No shared secrets, no static API keys, no implicit trust.',
    ],
  },
  {
    title: 'Device-bound encryption',
    description: 'Models and execution data are encrypted and bound to specific hardware. If a device is lost or removed, its data remains inaccessible.',
    details: [
      'Encryption keys are derived from hardware-specific identifiers. Data cannot be decrypted on a different device.',
      'Model weights, execution logs, and configuration are all encrypted at rest.',
      'If a device is physically stolen, the data on it is cryptographically useless without the original hardware context.',
      'Key rotation happens automatically without service interruption.',
    ],
  },
  {
    title: 'Verified updates',
    description: 'Model updates and configuration changes require cryptographic signatures. Unsigned or modified artifacts are rejected before deployment.',
    details: [
      'Every update\u2014model weights, configuration, firmware\u2014must be signed by an authorized key.',
      'The runtime verifies signatures before applying any change. Tampered artifacts are rejected outright.',
      'Signing keys are managed separately from deployment infrastructure for defense in depth.',
      'Update history is logged and auditable. You can verify exactly what was deployed and when.',
    ],
  },
  {
    title: 'Verified fleet synchronization',
    description: 'When connectivity is available, fleet state and configuration changes are verified before being applied. Only signed and authorized updates propagate.',
    details: [
      'Fleet sync uses the same cryptographic verification as local updates. No separate trust model.',
      'Configuration changes propagate only after verification by each receiving device.',
      'Partial fleet updates are supported\u2014devices that can\'t verify an update simply don\'t apply it.',
      'Sync state is logged on both the device and fleet dashboard for full auditability.',
    ],
  },
]

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
      <Header />
      <main>
        <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
          <div style={{ borderTop: 'var(--section-border)' }} />
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <div style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
                <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: 'var(--font-geist-pixel-square)', letterSpacing: '0.1em' }}>
                  Security
                </h1>
                <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                  Verifiable execution by design.
                </h2>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-lg leading-relaxed text-left mt-4 font-geist-sans">
                  Security is not a layer added on top. It is built into every part of the system\u2014from device enrollment to model updates to fleet synchronization. Every operation is cryptographically verifiable.
                </p>
              </div>
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12 pt-0 pb-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              {features.map((feature) => (
                <div key={feature.title} className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
                  <div className="flex flex-col justify-start">
                    <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-geist-sans text-left">
                      {feature.title}
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{feature.description}</p>
                      </div>
                      <div>
                        <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">Details</h5>
                        <ul className="space-y-1">
                          {feature.details.map((detail, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans flex items-start">
                              <span className="mr-2">&bull;</span>
                              <span>{detail}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <ClosingPosition />
      </main>
      <Footer />
    </div>
  );
}
