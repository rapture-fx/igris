import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Intelligent Quality Routing',
    description: 'Thompson Sampling optimization selects the best model for every request across cloud and edge. Learns from performance, context, and outcomes to continuously improve accuracy, speed, and cost efficiency.',
  },
  {
    name: 'Guaranteed Response Times',
    description: 'Runtime executes critical AI tasks with latency guarantees down to 50ms. Priority-based scheduling ensures safety-critical operations complete on time. Perfect for real-time robotics and industrial automation.',
  },
  {
    name: 'Robot & Fleet Control',
    description: 'Runtime controls robots via ROS2 integration with Nav2 navigation. Manages thousands of edge devices from one dashboard. GPIO, camera, and LIDAR support for industrial automation with ISO 26262 compliance.',
  },
  {
    name: 'Privacy-Preserving Learning',
    description: 'Train AI across your fleet without centralizing data. Federated learning with differential privacy keeps sensitive data local. Improve models collaboratively while maintaining regulatory compliance.',
  },
  {
    name: 'Human Oversight Workflows',
    description: 'Add approval workflows for critical AI decisions. Auto-approve high-confidence tasks, escalate uncertain ones to humans. Perfect for safety-critical systems requiring human oversight and audit trails.',
  },
  {
    name: 'Chaos Testing & Simulation',
    description: 'Test AI systems with virtual swarms and failure injection before deployment. Simulate 100 robots without hardware. Benchmark performance under load and validate resilience in production scenarios.',
  },
]

export default function CoreCapabilities() {
  return (
    <>
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-4 lg:px-6" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4'
          }}>

            {/* Content Container */}
            <div className="w-full px-0">
              {/* No absolute divider - use border on right column instead */}

              {/* Title Section - Shows first on mobile, last on desktop */}
              <div className="text-left mb-6 md:mb-0 md:hidden">
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  System Capabilities
                </h3>
                <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter">
                  Built for teams deploying AI systems that cannot afford downtime, drift, or unpredictable costs.
                </p>
              </div>

               {/* Two-column layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative" style={{ minHeight: '600px' }}>
                {/* Left Column - 4x2 Grid (4 rows, 2 columns) */}
                <div className="md:col-span-2 relative flex items-start justify-center overflow-hidden" style={{
                  borderRadius: '16px',
                  paddingTop: '1rem',
                  paddingBottom: '1rem',
                  paddingRight: '1rem',
                  paddingLeft: '0'
                }}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-0 w-full relative z-10">
                    {capabilities.map((capability, index) => {
                      const hasRightBorder = index % 2 === 0;
                      const hasBottomBorder = index < capabilities.length - 2;

                      return (
                        <div
                          key={capability.name}
                          className="p-4 relative"
                          style={{
                            padding: '20px 24px',
                            minHeight: '145px'
                          }}
                        >
                          {/* Single dashed right border */}
                          {hasRightBorder && (
                            <div className="absolute top-0 bottom-0 right-0" style={{
                              borderRight: '1px dashed rgba(156, 163, 175, 0.6)'
                            }}></div>
                          )}

                          {/* Single dashed bottom border */}
                          {hasBottomBorder && (
                            <div className="absolute left-0 right-0 bottom-0" style={{
                              borderBottom: '1px dashed rgba(156, 163, 175, 0.6)'
                            }}></div>
                          )}
                          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                            {capability.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Right Column - Section Title (Desktop only) */}
                <div className="hidden md:flex text-left md:col-span-1 flex flex-col justify-start" style={{ borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)', minHeight: '600px', paddingTop: '1rem', paddingBottom: '1rem', paddingLeft: '1rem' }}>
                  <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                    System Capabilities
                  </h3>
                  <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter">
                    Built for teams deploying AI systems that cannot afford downtime, drift, or unpredictable costs.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* New Section - Full Width Placeholder */}
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
        <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="relative py-8 px-4 md:px-4 lg:px-6" style={{
            borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
            borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
            backgroundColor: '#f6f6f4'
          }}>

            <div className="w-full px-0">
              <h4 className="text-lg md:text-lg lg:text-2xl tracking-tight font-inter mb-6 md:mb-8 text-center" style={{ color: '#000000' }}>Fail-safe by design.</h4>

              <p className="text-base md:text-base leading-7 md:leading-8 text-gray-700 dark:text-gray-300 mb-6 md:mb-8 font-inter text-center max-w-3xl mx-auto">
                Igris Inertial applies automated safeguards across cloud and edge deployments, verifies routing behavior in real time, and ensures continuous operation through provider outages, network failures, and offline scenarios.
              </p>

              {/* Horizontal Stack Layout */}
              <div className="flex flex-col md:flex-row gap-4">
                {/* Card 1: EscapeVector Mode */}
                <div className="p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 transition-all duration-300 min-h-[320px] flex-1 flex flex-col relative" style={{ backgroundColor: '#f6f6f4', borderRadius: '0' }}>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10" style={{ height: '40%' }}>
                    {/* Title positioned at fixed distance from bottom - same for all cards */}
                    <div className="absolute left-6 md:left-8 lg:left-10" style={{ bottom: '110px', right: '24px' }}>
                      <h5 className="text-base md:text-base font-medium text-gray-900 dark:text-white font-inter">EscapeVector Mode</h5>
                    </div>
                    {/* Description positioned at bottom */}
                    <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-6 md:left-8 lg:left-10 right-6 md:right-8 lg:right-10">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
                        Overture caches routing intelligence for 72-hour offline operation. Your cloud control plane stays functional even when disconnected. Thompson Sampling routing continues uninterrupted.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 2: Local LLM Fallback */}
                <div className="p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 transition-all duration-300 min-h-[320px] flex-1 flex flex-col relative" style={{ backgroundColor: '#f6f6f4', borderRadius: '0' }}>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10" style={{ height: '40%' }}>
                    {/* Title positioned at fixed distance from bottom - same for all cards */}
                    <div className="absolute left-6 md:left-8 lg:left-10" style={{ bottom: '110px', right: '24px' }}>
                      <h5 className="text-base md:text-base font-medium text-gray-900 dark:text-white font-inter">Local LLM Fallback</h5>
                    </div>
                    {/* Description positioned at bottom */}
                    <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-6 md:left-8 lg:left-10 right-6 md:right-8 lg:right-10">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
                        Runtime automatically activates on-device models when cloud providers fail. Works 100% offline with Phi-3, Llama, and Mistral. Zero-downtime in air-gapped environments.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 3: SLO Enforcer */}
                <div className="p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 transition-all duration-300 min-h-[320px] flex-1 flex flex-col relative" style={{ backgroundColor: '#f6f6f4', borderRadius: '0' }}>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10" style={{ height: '40%' }}>
                    {/* Title positioned at fixed distance from bottom - same for all cards */}
                    <div className="absolute left-6 md:left-8 lg:left-10" style={{ bottom: '110px', right: '24px' }}>
                      <h5 className="text-base md:text-base font-medium text-gray-900 dark:text-white font-inter">SLO Enforcer</h5>
                    </div>
                    {/* Description positioned at bottom */}
                    <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-6 md:left-8 lg:left-10 right-6 md:right-8 lg:right-10">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
                        Automatic guardrails monitor latency, cost drift, and reliability. Traffic shifts to safer paths when thresholds are crossed. Ensures consistent performance without manual intervention.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Card 4: Gold Code Override */}
                <div className="p-6 md:p-8 lg:p-10 border border-gray-300/60 dark:border-gray-600/60 transition-all duration-300 min-h-[320px] flex-1 flex flex-col relative" style={{ backgroundColor: '#f6f6f4', borderRadius: '0' }}>
                  <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8 lg:p-10" style={{ height: '40%' }}>
                    {/* Title positioned at fixed distance from bottom - same for all cards */}
                    <div className="absolute left-6 md:left-8 lg:left-10" style={{ bottom: '110px', right: '24px' }}>
                      <h5 className="text-base md:text-base font-medium text-gray-900 dark:text-white font-inter">Gold Code Override</h5>
                    </div>
                    {/* Description positioned at bottom */}
                    <div className="absolute bottom-6 md:bottom-8 lg:bottom-10 left-6 md:left-8 lg:left-10 right-6 md:right-8 lg:right-10">
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
                        One environment variable instantly bypasses the control plane. Required safety switch for enterprise security audits, compliance validation, and regulated workloads.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
