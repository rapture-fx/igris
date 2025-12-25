'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RuntimePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const features = [
    {
      name: 'Guaranteed Response Times',
      description: 'Execute critical AI tasks with latency guarantees. Priority levels ensure safety-critical operations complete in < 50ms. Perfect for real-time robotics and industrial automation.',
    },
    {
      name: 'Auto GPU Optimization',
      description: 'Detects your hardware and configures itself for 2-5x faster inference. Works with NVIDIA, AMD, and Apple Silicon. Benchmarks performance and recommends optimal settings automatically.',
    },
    {
      name: 'Persistent Memory',
      description: 'Your AI remembers conversations across restarts. Semantic search over past interactions. Long-term context retention with encrypted storage. Never lose important context.',
    },
    {
      name: 'Smart Model Selection',
      description: 'Automatically picks the best model for each task. Fast model for simple questions, powerful model for complex reasoning. Switch models in < 200ms without restart.',
    },
    {
      name: 'Robot Control',
      description: 'Control robots and autonomous systems with AI. Connect to ROS2 for navigation and coordination. GPIO, camera, and LIDAR integration. Deploy in safety-critical environments with ISO 26262 compliance.',
    },
    {
      name: 'Fleet Management',
      description: 'Manage thousands of edge devices from one dashboard. Push updates fleet-wide. Monitor health and performance in real-time. Perfect for warehouse robots and industrial deployments.',
    },
    {
      name: 'Privacy-Preserving Learning',
      description: 'Train AI across multiple devices without sharing data. Federated learning with differential privacy. Improve models across your fleet while keeping sensitive data local.',
    },
    {
      name: 'Human Oversight',
      description: 'Add approval workflows for critical decisions. AI auto-approves when confident, escalates uncertain decisions to humans. Perfect for safety-critical systems and regulatory compliance.',
    },
    {
      name: 'Chaos Testing',
      description: 'Test your AI with virtual swarms and failure injection. Simulate 100 robots without buying hardware. Benchmark performance under load before deploying to production.',
    },
  ]

  const routingModes = [
    {
      name: 'Race Multiple Providers',
      description: 'Send your request to multiple cloud providers at once and use whichever responds first. Automatically cancels the slower ones to save costs.',
    },
    {
      name: 'Smart Provider Selection',
      description: 'Learns which providers work best for different types of requests. Automatically improves routing decisions over time based on actual performance.',
    },
    {
      name: 'Multi-Model Collaboration',
      description: 'Get responses from multiple AI models, then have one synthesize the best answer. Improves quality for complex questions and important decisions.',
    },
    {
      name: 'Offline Capability',
      description: 'Automatically switches to local models when cloud providers are unavailable. Keeps working completely offline with no API keys or internet required.',
    },
  ]

  const deploymentOptions = [
    {
      name: 'Simple Binary',
      description: 'Single executable file that runs on Windows, Mac, and Linux. Works on Intel, AMD, and ARM processors. Just download and run—no installation needed.',
    },
    {
      name: 'Containers',
      description: 'Docker images ready for production deployment. Kubernetes configurations included for scaling. Mount your models as volumes for easy updates.',
    },
    {
      name: 'Edge Devices',
      description: 'Runs on Raspberry Pi, NVIDIA Jetson, and other embedded hardware. Optimized for devices with limited memory and CPU. Perfect for robotics and IoT.',
    },
    {
      name: 'Secure Facilities',
      description: 'Operates completely offline after initial setup. No data sent outside your environment. Encrypted storage for all sensitive information. Ideal for regulated industries.',
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-72 md:pb-96 lg:pb-[48rem] bg-transparent z-10" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8 border-t-[0.5px] border-[#1a1e21]"></div>
                  <div className="absolute top-0 left-3.5 h-8 border-l-[0.5px] border-[#1a1e21]"></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8 border-b-[0.5px] border-[#1a1e21]"></div>
                  <div className="absolute bottom-0 right-3.5 h-8 border-r-[0.5px] border-[#1a1e21]"></div>
                </div>

                {/* Background image layer */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: 'url("/runland.png")',
                    backgroundSize: '100%',
                    backgroundPosition: 'center top 100%',
                    backgroundRepeat: 'no-repeat',
                    opacity: 1,
                    pointerEvents: 'none'
                  }}
                />

                <div className="max-w-[1300px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
                  <div className="pt-8 mb-6">
                    <button 
                      onClick={() => router.push('/')}
                      className="text-sm text-gray-600 hover:text-gray-900 hover:underline mb-4 inline-flex items-center transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      ← Back to platform
                    </button>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left md:w-2/3">
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-medium text-[#111111] leading-[1.2]">
                          Runtime
                        </h1>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Execution Plane
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-lg text-gray-700 max-w-3xl leading-relaxed text-left">
                          Edge runtime that runs AI locally with guaranteed response times. Controls robots, manages fleets, and learns across devices without sharing data. Built for safety-critical systems where reliability and performance matter.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Features */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Execution plane capabilities
                    </h3>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
                        {features.map((feature, index) => (
                          <div
                            key={feature.name}
                            className="p-4 relative"
                            style={{
                              padding: '20px 24px',
                              minHeight: '145px'
                            }}
                          >
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 font-inter">
                              {feature.name}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              {feature.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Execution plane capabilities
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Routing Modes */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Routing modes
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                      Flexible routing strategies that adapt to your needs. Always has a local backup ready when cloud services are unavailable.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {routingModes.map((mode) => (
                          <div key={mode.name} className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                            <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">{mode.name}</h5>
                            <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                              {mode.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Routing modes
                      </h3>
                      <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                        Flexible routing strategies that adapt to your needs. Always has a local backup ready when cloud services are unavailable.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Deployment Options */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Deployment options
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                      Flexible deployment options for any environment, from cloud servers to edge devices to completely offline facilities.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                        {deploymentOptions.map((option) => (
                          <div key={option.name} className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                            <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">{option.name}</h5>
                            <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                              {option.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Deployment options
                      </h3>
                      <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                        Flexible deployment options for any environment, from cloud servers to edge devices to completely offline facilities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Integration with Overture */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                minHeight: '600px'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="w-full px-0">
                  {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
                  <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
                    borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                    transform: 'translateX(-66.67%)'
                  }}></div>

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 lg:mb-0 lg:hidden">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Works with Overture
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                      Runtime provides local AI capabilities as backup for Overture's cloud routing. Together they ensure your AI applications stay online.
                    </p>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Content */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                      <div className="w-full text-center">
                        <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                          Learn about Overture
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Works with Overture
                      </h3>
                      <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                        Runtime provides local AI capabilities as backup for Overture's cloud routing. Together they ensure your AI applications stay online.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <CallToAction />
        </main>
        <Footer />
      </div>
      <EarlyAccessModal
        isOpen={isEarlyAccessModalOpen}
        onClose={closeEarlyAccessModal}
      />
    </>
  );
}

