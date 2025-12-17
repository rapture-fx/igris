'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function RuntimePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();

  const features = [
    {
      name: 'Multiple Local Models',
      description: 'Run Phi-3, Qwen, DeepSeek, GLM-4, Llama, and Mistral models locally. Choose the right model for your task. Switch models without changing code or restarting.',
    },
    {
      name: 'Automatic Cloud Backup',
      description: 'Seamlessly switches to local models when cloud providers fail or are unreachable. Works completely offline once models are downloaded. No interruption to your application.',
    },
    {
      name: 'AI Agents Built-In',
      description: 'Built-in capabilities for planning, tool calling, and self-correction. Models can critique and improve their own outputs automatically. Better results with less manual prompt engineering.',
    },
    {
      name: 'Swarm Intelligence',
      description: 'Connect multiple Runtime instances to share context automatically. No configuration needed—they find each other on your network. Encrypted communication keeps your data secure.',
    },
    {
      name: 'Learns From Usage',
      description: 'Automatically fine-tunes local models based on your actual usage. Creates specialized versions that understand your domain. All training happens on-device with encrypted storage.',
    },
    {
      name: 'Runs Anywhere',
      description: 'Single lightweight binary works on servers, laptops, edge devices, and embedded systems. Fast inference even on CPU. Supports x86, ARM, Raspberry Pi, and Jetson.',
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
              <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-8 md:pb-20 bg-transparent z-10" style={{
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

                <div className="max-w-[1300px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
                  <div className="pt-8 mb-6">
                    <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 mb-4 inline-flex items-center">
                      ← Back to platform
                    </Link>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                          Runtime
                        </h1>
                        <h2 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Execution Plane
                        </h2>
                        <p className="text-sm md:text-lg text-gray-700 max-w-2xl leading-relaxed text-left mt-6">
                          Edge runtime that runs AI models locally with automatic cloud backup. Keeps working offline, learns from your usage, and coordinates with other instances. Built for environments where reliability matters.
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

