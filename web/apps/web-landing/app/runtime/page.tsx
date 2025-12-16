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
      name: 'Multi-Model Support',
      description: '6 production-ready models: Phi-3 Mini, Qwen3-8B/14B, DeepSeek-V3.2-7B, GLM-4-9B. Config-driven selection with automatic context size detection. 40-70% quality improvement over baseline.',
    },
    {
      name: 'Automatic Local Fallback',
      description: 'When cloud providers fail, Runtime instantly activates on-device models. Works 100% offline with Phi-3, Llama, Mistral. Zero-downtime in air-gapped environments.',
    },
    {
      name: 'Agentic Capabilities',
      description: 'Built-in planning agent, tool calling, and reflection loops. Generate → critique → regenerate cycle improves output quality by 15-30%. Autonomous task execution.',
    },
    {
      name: 'MCP Swarm Mode',
      description: 'Peer-to-peer AI coordination with zero configuration. Auto-discovery via mDNS/UDP. Real-time context sync across instances with AES-256-GCM encryption.',
    },
    {
      name: 'On-Device QLoRA Training',
      description: 'Automatic fine-tuning after N requests. Creates domain-specialized adapters (< 64 MB). Device-specific encryption prevents model theft. No data exfiltration.',
    },
    {
      name: 'Extreme Efficiency',
      description: 'Pure Rust binary: 16 MB release, ~4 MB with UPX. 30-85 tokens/sec on laptop CPU. No external dependencies. Runs on Raspberry Pi, Jetson, x86, ARM64.',
    },
  ]

  const routingModes = [
    {
      name: 'Speculative Execution',
      description: 'Launch multiple cloud providers in parallel, stream from the fastest. Cancels slower providers when first completes.',
    },
    {
      name: 'Thompson Sampling',
      description: 'Bayesian multi-armed bandit learns optimal provider selection over time. Balances exploration and exploitation automatically.',
    },
    {
      name: 'Council Mode',
      description: 'Run request through multiple providers simultaneously. Chairman model synthesizes best response for complex reasoning.',
    },
    {
      name: 'Local Fallback',
      description: 'Automatic switch to on-device Phi-3 model when all cloud providers fail. Works 100% offline with no API keys required.',
    },
  ]

  const deploymentOptions = [
    {
      name: 'Standalone Binary',
      description: 'Single 16 MB executable (4 MB with UPX). Runs on x86_64, ARM64, macOS, Linux, Windows. No dependencies except model files. systemd service included.',
    },
    {
      name: 'Docker/Kubernetes',
      description: 'Scratch-based image for minimal attack surface. Helm charts and K8s manifests included. ConfigMaps for configuration, PVCs for models. Production-ready.',
    },
    {
      name: 'Edge & Robotics',
      description: 'Optimized for Raspberry Pi 5, Jetson Nano/Orin, autonomous vehicles, drones. 2-3 GB RAM, 4K-16K context. 15-30 tokens/sec on Pi 5.',
    },
    {
      name: 'Air-Gapped Environments',
      description: '100% offline operation after model download. No telemetry, no phone-home. Encrypted local storage with AES-256-GCM. Perfect for secure facilities.',
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
                          Offline-capable edge runtime with automatic local LLM fallback, agentic features, peer-to-peer swarm intelligence, and on-device fine-tuning. Pure Rust with streaming, GPU acceleration, and zero-downtime when cloud fails.
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
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full">
                  <div className="text-center mb-12">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Execution plane capabilities
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
              </div>
            </div>
          </section>

          {/* Routing Modes */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full">
                  <div className="text-center mb-12">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Routing modes
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                      Multiple routing strategies with automatic local fallback when cloud providers fail.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </div>
          </section>

          {/* Deployment Options */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full">
                  <div className="text-center mb-12">
                    <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                      Deployment options
                    </h3>
                    <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                      Deploy Runtime anywhere: local machines, edge devices, Docker containers, or offline environments.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              </div>
            </div>
          </section>

          {/* Integration with Overture */}
          <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
            <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
              <div className="relative py-8 px-4 md:px-8 lg:px-12" style={{
                borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
                backgroundColor: '#f6f6f4'
              }}>
                <div className="absolute -top-4 -left-4 w-8 h-8">
                  <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
                </div>
                <div className="absolute -bottom-4 -right-4 w-8 h-8">
                  <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
                  <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
                </div>

                <div className="max-w-[1300px] mx-auto w-full text-center">
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                    Works with Overture
                  </h3>
                  <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto mb-8">
                    Runtime provides automatic local fallback when Overture's cloud providers fail. Together, they deliver zero-downtime LLM operations.
                  </p>
                  <Link href="/overture" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                    Learn about Overture
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
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

