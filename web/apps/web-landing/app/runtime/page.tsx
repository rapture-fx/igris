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
      name: 'Real-Time Performance',
      description: 'Critical operations complete in under 50ms. Priority-based task scheduling ensures your most important requests never wait. Built for robotics, drones, and industrial automation where milliseconds matter.',
    },
    {
      name: 'Hardware Acceleration',
      description: 'Automatically detects and optimizes for your GPU. Works with NVIDIA, AMD, and Apple Silicon out of the box. Get 2-5x faster inference without manual configuration.',
    },
    {
      name: 'Continuous Learning',
      description: 'Train models on-device from your own data. LoRA adapters improve performance without sending data to the cloud. Models get smarter with every interaction while keeping your information private.',
    },
    {
      name: 'Smart Tool Use',
      description: 'AI can make HTTP requests, execute commands, and manipulate files when needed. Turns language models into action-taking agents. Sandboxed execution keeps your systems secure.',
    },
    {
      name: 'Robot & Drone Integration',
      description: 'Native ROS2 support for autonomous navigation and coordination. Control fleets of robots with natural language. Deploy in safety-critical environments with deterministic latency guarantees.',
    },
    {
      name: 'Fleet Coordination',
      description: 'Manage thousands of edge devices as one intelligent swarm. Automatic leader election and conflict resolution. Push updates fleet-wide and monitor health in real-time.',
    },
    {
      name: 'Privacy-First Learning',
      description: 'Improve models across your entire fleet without sharing raw data. Federated learning with differential privacy keeps sensitive information on-device. Compliant with GDPR and data sovereignty requirements.',
    },
    {
      name: 'Human Oversight',
      description: 'Add approval workflows for decisions that need human judgment. AI handles routine requests automatically and escalates uncertain ones. Audit trail for every decision shows who approved what.',
    },
    {
      name: 'Test Before You Deploy',
      description: 'Simulate hundreds of edge devices without buying hardware. Inject failures to see how your system responds. Find problems in testing instead of production.',
    },
  ]

  const routingModes = [
    {
      name: 'Never Stop Working',
      description: 'Automatically falls back to on-device models when the cloud is unreachable. Your applications keep running through network outages, API failures, or complete internet loss.',
    },
    {
      name: 'Optimize Every Request',
      description: 'Learns which providers deliver the best speed and quality for each type of task. Routes requests intelligently based on actual performance data, not static rules.',
    },
    {
      name: 'Get Multiple Perspectives',
      description: 'Run the same request through different models and combine their insights. Higher quality responses for critical decisions where accuracy matters more than speed.',
    },
    {
      name: 'Fastest Response Wins',
      description: 'Race multiple providers simultaneously and use whoever responds first. Automatically cancels slower requests to avoid wasting money on responses you won\'t use.',
    },
  ]

  const deploymentOptions = [
    {
      name: 'Run Anywhere',
      description: 'Single binary works on Windows, Mac, and Linux. Compatible with Intel, AMD, and ARM chips. Download and start—no complex installation or dependencies.',
    },
    {
      name: 'Cloud Ready',
      description: 'Pre-built Docker images and Kubernetes configs for instant deployment. Scale horizontally as your traffic grows. Update models without rebuilding containers.',
    },
    {
      name: 'Edge Optimized',
      description: 'Deploy to Raspberry Pi, NVIDIA Jetson, or industrial edge devices. Runs efficiently on constrained hardware. Purpose-built for robotics, drones, and IoT.',
    },
    {
      name: 'Air-Gap Compatible',
      description: 'Works completely offline in secure or regulated environments. All data stays on your infrastructure. No phone-home requirements or external dependencies.',
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px] space-y-1">
          {/* Hero Section */}
          <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
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

                <div className="max-w-[1100px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
                  <div className="pt-8 mb-6">
                    <button 
                      onClick={() => router.push('/')}
                      className="text-sm text-gray-600 hover:text-gray-900 hover:underline mb-4 inline-flex items-center transition-colors cursor-pointer bg-transparent border-none p-0"
                    >
                      ← Back to platform
                    </button>
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mt-4">
                      <div className="text-left md:w-2/3">
                        <h1 className="text-2xl md:text-2xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                          Runtime
                        </h1>
                        <h2 className="text-lg md:text-lg lg:text-2xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Execution Plane
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Deploy AI at the edge with guaranteed response times. Runs completely offline when needed. Train models on your data without sending it anywhere. Built for robotics, drones, and systems where reliability isn't optional.
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
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
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
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
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
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
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Routing modes
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
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
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Routing modes
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
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
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Deployment options
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
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
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Deployment options
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
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
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
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
                    <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                      Works with Overture
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter mb-6">
                      Runtime provides local AI capabilities as backup for Overture's cloud routing. Together they ensure your AI applications stay online.
                    </p>
                    <div className="text-left">
                      <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                        Learn about Overture
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
                    {/* Left Column - Empty space */}
                    <div className="lg:col-span-2 relative flex items-center justify-center">
                    </div>

                    {/* Right Column - Section Title (Desktop only) */}
                    <div className="hidden lg:flex text-left lg:col-span-1 pl-0 md:pl-4 lg:pl-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                      <h3 className="text-lg md:text-lg lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                        Works with Overture
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter mb-6">
                        Runtime provides local AI capabilities as backup for Overture's cloud routing. Together they ensure your AI applications stay online.
                      </p>
                      <div className="text-left">
                        <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                          Learn about Overture
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
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

