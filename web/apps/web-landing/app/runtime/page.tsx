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

  const coreCapabilities = [
    {
      name: 'Real-Time Performance',
      description: 'Critical operations complete in under 50ms. Priority-based task scheduling ensures your most important requests never wait.',
    },
    {
      name: 'Hardware Acceleration',
      description: 'Automatically detects and optimizes for your GPU. Works with NVIDIA, AMD, and Apple Silicon out of the box.',
    },
    {
      name: 'Continuous Learning',
      description: 'Train models on-device from your own data. LoRA adapters improve performance without sending data to the cloud.',
    },
    {
      name: 'Smart Tool Use',
      description: 'AI can make HTTP requests, execute commands, and manipulate files when needed. Sandboxed execution keeps your systems secure.',
    },
    {
      name: 'Robot Integration',
      description: 'Native ROS2 support for autonomous navigation and coordination. Deploy in safety-critical environments with deterministic latency guarantees.',
    },
    {
      name: 'Fleet Coordination',
      description: 'Manage thousands of edge devices as one intelligent swarm. Automatic leader election and conflict resolution.',
    },
  ]

  const advancedFeatures = [
    {
      name: 'Privacy-First Learning',
      description: 'Improve models across your entire fleet without sharing raw data. Federated learning with differential privacy keeps sensitive information on-device.',
    },
    {
      name: 'Human Oversight',
      description: 'Add approval workflows for decisions that need human judgment. AI handles routine requests automatically and escalates uncertain ones.',
    },
    {
      name: 'Test Before Deploy',
      description: 'Simulate hundreds of edge devices without buying hardware. Inject failures to see how your system responds.',
    },
    {
      name: 'Offline Operation',
      description: 'Works completely offline in secure or regulated environments. All data stays on your infrastructure.',
    },
  ]

  const deploymentOptions = [
    {
      name: 'Run Anywhere',
      description: 'Single binary works on Windows, Mac, and Linux. Compatible with Intel, AMD, and ARM chips.',
    },
    {
      name: 'Cloud Ready',
      description: 'Pre-built Docker images and Kubernetes configs for instant deployment. Scale horizontally as your traffic grows.',
    },
    {
      name: 'Edge Optimized',
      description: 'Deploy to Raspberry Pi, NVIDIA Jetson, or industrial edge devices. Runs efficiently on constrained hardware.',
    },
    {
      name: 'Air-Gap Compatible',
      description: 'Works completely offline in secure or regulated environments. No phone-home requirements or external dependencies.',
    },
  ]

  return (
    <>
      <div className="min-h-screen bg-[#f6f6f4]">
        <Header />
        <main className="pt-[70px]">

          {/* Hero Section */}
          <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]" style={{
            backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
            backgroundSize: 'cover',
            backgroundPosition: 'center top -100px',
            backgroundRepeat: 'no-repeat',
            borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)'
          }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
              <div className="relative px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
              }}>
                <div className="max-w-[1100px] mx-auto pt-24 px-0 md:px-8 lg:px-16 relative z-10">
                  <div className="pt-24 mb-6">
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
                          Execution Layer
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Edge runtime that routes to cloud providers or falls back to local models. Runs completely offline with llama.cpp. Has its own Thompson Sampling and speculative routing. Can operate independently or alongside Overture.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Core Capabilities Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Execution plane capabilities
                    </h3>

                    {/* Capabilities - Mobile */}
                    <div className="space-y-6">
                      {coreCapabilities.map((capability) => (
                        <div key={capability.name}>
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Capabilities (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {coreCapabilities.map((capability) => (
                            <div key={capability.name}>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                                {capability.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                                {capability.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Execution plane capabilities
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Advanced Features Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Advanced capabilities
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Privacy-preserving learning, human-in-the-loop workflows, and simulation testing for production readiness.
                    </p>

                    {/* Features - Mobile */}
                    <div className="space-y-6">
                      {advancedFeatures.map((item) => (
                        <div key={item.name}>
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                            {item.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Features (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {advancedFeatures.map((item) => (
                            <div key={item.name}>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                                {item.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                                {item.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Advanced capabilities
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Privacy-preserving learning, human-in-the-loop workflows, and simulation testing for production readiness.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Deployment Options Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Deployment options
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Flexible deployment options for any environment, from cloud servers to edge devices to completely offline facilities.
                    </p>

                    {/* Options - Mobile */}
                    <div className="space-y-6">
                      {deploymentOptions.map((item) => (
                        <div key={item.name}>
                          <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                            {item.name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {item.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Options (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {deploymentOptions.map((item) => (
                            <div key={item.name}>
                              <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                                {item.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                                {item.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Deployment options
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Flexible deployment options for any environment, from cloud servers to edge devices to completely offline facilities.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Overture Integration Section */}
          <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
            <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
              <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4',
                height: '100%'
              }}>

                {/* Content Container */}
                <div className="w-full px-0 flex flex-col md:flex-1">

                  {/* Title Section - Shows first on mobile, last on desktop */}
                  <div className="text-left mb-6 md:mb-0 md:hidden" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                    <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Standalone Runtime
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Runtime operates independently with its own routing logic. It can route to cloud providers or fall back to local models. Doesn't require Overture to function.
                    </p>

                    {/* Link - Mobile */}
                    <div className="mt-8">
                      <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                        Learn about Overture
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Link (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[320px] mx-auto text-center">
                        <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                          Learn about Overture
                          <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                      </div>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '23rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Standalone Runtime
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Runtime operates independently with its own routing logic. It can route to cloud providers or fall back to local models. Doesn't require Overture to function.
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
