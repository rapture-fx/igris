'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import ClosingPosition from '../../src/components/sections/ClosingPosition'

const runtimeCapabilities = [
  {
    title: '16MB Binary, Zero Dependencies',
    description: 'Deploy AI to any device without Docker or complex setup.',
    how: 'Single static binary compiled for Linux, macOS, and ARM architectures. No runtime dependencies, no package managers, no version conflicts. Just download and run.',
    features: [
      'Single 16MB executable',
      'Linux, macOS, ARM support',
      'No Docker required',
      'Static compilation'
    ]
  },
  {
    title: 'BYOM - Bring Your Own Model',
    description: 'Run any GGUF model locally. Use open-source models or your own fine-tuned weights.',
    how: 'Load GGUF format models from HuggingFace, local files, or your own training pipeline. Runtime handles model quantization, memory management, and inference optimization automatically.',
    features: [
      'GGUF model support',
      'Phi-3, Llama, Mistral compatible',
      '4-bit and 8-bit quantization',
      'Automatic memory management'
    ]
  },
  {
    title: 'Works Offline',
    description: 'Execute AI without internet connectivity. Perfect for remote, mobile, and air-gapped environments.',
    how: 'All inference happens locally on-device. Models run entirely in memory with no cloud calls required. Cache persists across restarts. Network outages don\'t stop execution.',
    features: [
      '100% offline operation',
      'No cloud dependencies',
      'Persistent local cache',
      'Network-fail resilient'
    ]
  },
  {
    title: 'Sandboxed Execution',
    description: 'Secure, isolated AI execution with enforced safety boundaries.',
    how: 'Every AI workload runs in a sandboxed environment with configurable limits on execution time, memory usage, and output size. Prevents resource exhaustion and runaway processes.',
    features: [
      'Resource limits enforcement',
      'Execution timeouts',
      'Memory boundaries',
      'Safe process isolation'
    ]
  },
  {
    title: 'Fleet Dashboard Integration',
    description: 'Auto-sync with fleet dashboard when online. Included free.',
    how: 'When devices have connectivity, Runtime automatically syncs status, telemetry, and logs with the fleet dashboard. Push model updates and configuration changes to your entire fleet. QR code pairing for instant device linking.',
    features: [
      'Zero-config sync',
      'Real-time status monitoring',
      'Over-the-air model updates',
      'QR code device pairing',
      'Included free with Runtime'
    ]
  },
];

const fleetCapabilities = [
  {
    title: 'Zero-Config Fleet Management',
    description: 'Manage all your Runtime devices from a single dashboard. No setup required.',
    how: 'Runtime devices automatically connect and report status when online. View all your devices, their health, model versions, and activity in real-time. No manual configuration needed.',
    features: [
      'Automatic device discovery',
      'Real-time status monitoring',
      'Device health tracking',
      'Model version overview'
    ]
  },
  {
    title: 'QR Code Device Pairing',
    description: 'Add new devices to your fleet in seconds with QR code linking.',
    how: 'Generate a QR code from the dashboard, scan it with your device, and it\'s instantly linked to your fleet. No API keys to copy, no config files to edit. Perfect for field deployment.',
    features: [
      'Instant QR code pairing',
      'No manual configuration',
      'Bulk device onboarding',
      'Field-deployment ready'
    ]
  },
  {
    title: 'Over-the-Air Model Updates',
    description: 'Deploy new models to your entire fleet with a single click.',
    how: 'Upload GGUF models to the dashboard and push them to selected devices or your entire fleet. Runtime devices download and verify updates automatically. Rollback if issues occur.',
    features: [
      'Single-click model deployment',
      'Selective or fleet-wide updates',
      'Automatic verification',
      'Safe rollback capability'
    ]
  },
  {
    title: 'Configuration Sync',
    description: 'Keep device configurations consistent across your fleet.',
    how: 'Define configuration templates in the dashboard and apply them to groups of devices. Runtime syncs configs when online and caches them for offline operation. Changes propagate automatically.',
    features: [
      'Configuration templates',
      'Group-based management',
      'Automatic sync when online',
      'Offline config caching'
    ]
  },
  {
    title: 'Fleet Analytics & Logs',
    description: 'Monitor performance and troubleshoot issues across your entire fleet.',
    how: 'Aggregate logs, metrics, and telemetry from all Runtime devices. View execution stats, error rates, resource usage, and model performance. Export data for external analysis.',
    features: [
      'Centralized log aggregation',
      'Performance metrics',
      'Error tracking',
      'Data export (CSV, JSON)'
    ]
  },
  {
    title: 'Included with Runtime',
    description: 'The dashboard unlocks automatically when you scale. No separate purchase.',
    how: 'The fleet dashboard is not a separate product\u2014it\'s part of Runtime. Free tier gets basic dashboard access. Pro and Enterprise unlock advanced features. No separate billing.',
    features: [
      'Included with Runtime',
      'No additional cost',
      'Scales with your plan',
      'Unlocks automatically'
    ]
  },
];

function CapabilityItem({ capability }: { capability: { title: string; description: string; how: string; features: string[] } }) {
  return (
    <div className="grid grid-cols-1 gap-0 relative border-t border-gray-200 dark:border-[#f6f6f4]/5 h-auto py-6">
      <div className="flex flex-col justify-start">
        <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-2 font-geist-sans text-left">
          {capability.title}
        </h4>
        <div className="space-y-3">
          <div>
            <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">What It Does</h5>
            <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.description}</p>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">How It Works</h5>
            <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans max-w-lg">{capability.how}</p>
          </div>
          <div>
            <h5 className="text-sm font-medium text-gray-900 dark:text-[#f6f6f4] mb-1 font-geist-sans">Key Features</h5>
            <ul className="space-y-1">
              {capability.features.map((feature) => (
                <li key={feature} className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans flex items-start">
                  <span className="mr-2">&bull;</span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RuntimePage() {
  return (
    <div className="min-h-screen bg-[#f6f6f4] dark:bg-dark-bg transition-colors duration-200">
      <Header />
      <main>
        {/* Runtime Section */}
        <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
          <div style={{ borderTop: 'var(--section-border)' }} />
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <div className="mx-auto w-full" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
                <div className="text-left">
                  <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: 'var(--font-geist-pixel-square)', letterSpacing: '0.1em' }}>
                    Igris Runtime
                  </h1>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                    Secure AI execution for edge devices.
                  </h2>
                  <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-geist-sans">
                    Deploy AI anywhere with a 16MB binary. Run GGUF models locally, work offline, and manage your fleet from the cloud when needed. Fleet dashboard included free.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12 pt-0 pb-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              {runtimeCapabilities.map((capability) => (
                <CapabilityItem key={capability.title} capability={capability} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12 py-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-3 font-geist-sans">
                Get Started with Runtime
              </h4>
              <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans leading-relaxed mb-4">
                Download the Runtime binary for your platform, add your GGUF models, and deploy to any device. The fleet dashboard is included free for cloud-based fleet management.
              </p>
              <a
                href="https://docs.igrisinertial.com/runtime/quickstart"
                className="inline-flex items-center justify-start bg-[#14120a] dark:bg-[#f6f6f4] text-white dark:text-black px-4 py-2 hover:opacity-90 transition-all duration-200 text-sm font-medium shadow-md rounded-md w-fit"
              >
                Download Runtime
              </a>
            </div>
          </div>
        </section>

        {/* Fleet Dashboard Section */}
        <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
          <div style={{ borderTop: 'var(--section-border)' }} />
          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <div className="mx-auto w-full" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
                <div className="text-left">
                  <h1 className="text-sm md:text-base font-medium text-[#c5b0cd] leading-[1.2] uppercase" style={{ fontFamily: 'var(--font-geist-pixel-square)', letterSpacing: '0.1em' }}>
                    Fleet View
                  </h1>
                  <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2] mt-2" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                    The horizon that appears when you scale.
                  </h2>
                  <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4 font-geist-sans">
                    When you have multiple Runtime devices, this is the command center. Not a separate product. Not an integration. Just the natural evolution of running more than one thing.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12 pt-0 pb-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              {fleetCapabilities.map((capability) => (
                <CapabilityItem key={capability.title} capability={capability} />
              ))}
            </div>
          </div>

          <div style={{ borderTop: 'var(--section-border)' }} />

          <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
            <div className="px-4 md:px-8 lg:px-12 py-8" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
              <h4 className="text-sm md:text-base font-medium text-[#111111] dark:text-[#f6f6f4] mb-3 font-geist-sans">
                The view unlocks when you scale
              </h4>
              <p className="text-sm text-gray-600 dark:text-[#c8c8b8] font-geist-sans leading-relaxed mb-4">
                The fleet dashboard is included with Runtime. There is no separate pricing\u2014the view scales with your plan. Free tier includes basic dashboard features. Pro and Enterprise unlock advanced fleet management capabilities.
              </p>
              <a
                href="https://docs.igrisinertial.com/overture"
                className="inline-flex items-center justify-start bg-[#14120a] dark:bg-[#f6f6f4] text-white dark:text-black px-4 py-2 hover:opacity-90 transition-all duration-200 text-sm font-medium shadow-md rounded-md w-fit"
              >
                View Fleet Documentation
              </a>
            </div>
          </div>
        </section>

        <ClosingPosition />
      </main>
      <Footer />
    </div>
  );
}
