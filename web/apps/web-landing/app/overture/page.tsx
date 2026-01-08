'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import CallToAction from '../../src/components/sections/CallToAction'
import EarlyAccessModal from '../../src/components/modals/EarlyAccessModal'
import { useModal } from '../../src/contexts/ModalContext'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function OverturePage() {
  const { isEarlyAccessModalOpen, closeEarlyAccessModal } = useModal();
  const router = useRouter();

  const coreCapabilities = [
    {
      name: 'Thompson Sampling',
      description: 'Selects providers using Beta distribution sampling from success and failure rates. Balances trying new options with using proven ones.',
    },
    {
      name: 'Policy Evaluation',
      description: 'Evaluates routing policies against incoming requests. Scores providers by cost, latency, availability, and throughput. Returns decisions with explanations.',
    },
    {
      name: 'Quality Scoring',
      description: 'Scores provider responses using reported quality metrics or heuristic analysis. Evaluates structure, coherence, and content quality.',
    },
    {
      name: 'Semantic Classification',
      description: 'Classifies requests by type and domain. Routes based on semantic class. Maintains separate performance tracking per class.',
    },
    {
      name: 'Cost Tracking',
      description: 'Tracks spending per provider and tenant. Compares actual costs against baseline. Calculates per-request cost attribution.',
    },
    {
      name: 'Subscription Enforcement',
      description: 'Enforces monthly request limits per tenant. Gates features by subscription tier. Tracks usage against quotas.',
    },
  ]

  const infrastructure = [
    {
      name: 'Provider Registry',
      description: 'Register providers with endpoint validation. Store credentials securely. Track provider health status.',
    },
    {
      name: 'Decision Telemetry',
      description: 'Record every routing decision with provider, policy, and scoring details. Track performance metrics per provider and semantic class.',
    },
    {
      name: 'Multi-Criteria Scoring',
      description: 'Score providers across latency, quality, and cost dimensions. Weight criteria by mode. Select based on composite score.',
    },
    {
      name: 'Policy Control API',
      description: 'Update routing policies via REST API. Inspect active configuration. Roll back to previous versions. External policy orchestration.',
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
                          Overture
                        </h1>
                        <h2 className="text-lg md:text-lg lg:text-2xl font-medium text-[#111111] leading-[1.2] mt-2 text-gray-600">
                          Decision and Control Layer
                        </h2>
                      </div>
                      <div className="text-left md:w-1/3">
                        <p className="text-sm md:text-base text-gray-700 max-w-3xl leading-relaxed text-left">
                          Cloud gateway that routes AI requests to cloud providers. Uses Thompson Sampling and semantic routing to select between OpenAI, Anthropic, and other cloud APIs. Handles multi-tenancy, cost enforcement, and observability.
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
                      Control plane capabilities
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
                        Control plane capabilities
                      </h3>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Decision Infrastructure Section */}
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
                      Decision Infrastructure
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Provider management, telemetry collection, scoring systems, and policy control surfaces.
                    </p>

                    {/* Infrastructure - Mobile */}
                    <div className="space-y-6">
                      {infrastructure.map((item) => (
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

                    {/* Left Column - Infrastructure (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {infrastructure.map((item) => (
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
                        Decision Infrastructure
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Provider management, telemetry collection, scoring systems, and policy control surfaces.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Decision Output Section */}
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
                      Works Independently
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Overture is a cloud gateway service. It doesn't require Runtime. Runtime is a separate edge product with its own routing capabilities that can work with or without Overture.
                    </p>

                    {/* Details - Mobile */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Cloud Gateway
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Overture acts as a routing service for cloud AI providers. It's deployed as a service that clients call.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Edge Runtime
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Runtime is a standalone binary for edge devices. It has its own routing, fallback logic, and local model execution.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Deployment Options
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Use Overture for centralized cloud routing, Runtime for edge/offline, or both for hybrid cloud-edge architectures.
                        </p>
                      </div>
                    </div>

                    {/* Link - Mobile */}
                    <div className="mt-8">
                      <Link href="/runtime" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                        Learn about Runtime
                        <ChevronRight className="ml-2 h-4 w-4" />
                      </Link>
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Output Details (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Cloud Gateway
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Overture acts as a routing service for cloud AI providers. It's deployed as a service that clients call.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Edge Runtime
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Runtime is a standalone binary for edge devices. It has its own routing, fallback logic, and local model execution.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Deployment Options
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Use Overture for centralized cloud routing, Runtime for edge/offline, or both for hybrid cloud-edge architectures.
                            </p>
                          </div>
                        </div>
                        <div className="mt-12 text-center">
                          <Link href="/runtime" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm md:text-base hover:translate-x-1 transition-transform">
                            Learn about Runtime
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Link>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '16rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Works Independently
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Overture is a cloud gateway service. It doesn't require Runtime. Runtime is a separate edge product with its own routing capabilities that can work with or without Overture.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Decision Flow Section */}
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
                      Decision Flow
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Each request flows through evaluation stages that produce a routing decision with full context.
                    </p>

                    {/* Flow Sequence - Mobile */}
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">1</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Request arrives</h4>
                          <p className="text-xs text-gray-600">Incoming request with model requirements and constraints</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">2</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Policy evaluation</h4>
                          <p className="text-xs text-gray-600">Check allowed providers, budget limits, and tenant policies</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">3</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Semantic classification</h4>
                          <p className="text-xs text-gray-600">Classify request by type and domain for targeted routing</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">4</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Provider scoring</h4>
                          <p className="text-xs text-gray-600">Thompson Sampling scores each provider based on success history</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">5</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Quality prediction</h4>
                          <p className="text-xs text-gray-600">Predict quality scores and performance metrics per provider</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">6</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Cost calculation</h4>
                          <p className="text-xs text-gray-600">Calculate estimated cost per provider against budget</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">7</div>
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Decision output</h4>
                          <p className="text-xs text-gray-600">Return selected provider with reasoning and alternatives</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Two-column layout */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 relative md:flex-1" style={{ height: '100%' }}>

                    {/* Left Column - Flow Sequence (2 columns wide) */}
                    <div className="hidden md:flex md:col-span-2 flex-col items-center justify-center" style={{
                      paddingTop: '3rem',
                      paddingBottom: '3rem',
                      paddingRight: '1rem',
                      paddingLeft: '0'
                    }}>
                      <div className="w-full max-w-[500px] mx-auto">
                        <div className="space-y-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">1</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Request arrives</h4>
                              <p className="text-sm text-gray-600">Incoming request with model requirements and constraints</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">2</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Policy evaluation</h4>
                              <p className="text-sm text-gray-600">Check allowed providers, budget limits, and tenant policies</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">3</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Semantic classification</h4>
                              <p className="text-sm text-gray-600">Classify request by type and domain for targeted routing</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">4</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Provider scoring</h4>
                              <p className="text-sm text-gray-600">Thompson Sampling scores each provider based on success history</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">5</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Quality prediction</h4>
                              <p className="text-sm text-gray-600">Predict quality scores and performance metrics per provider</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">6</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Cost calculation</h4>
                              <p className="text-sm text-gray-600">Calculate estimated cost per provider against budget</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-semibold">7</div>
                            <div className="flex-1">
                              <h4 className="text-base font-semibold text-gray-900 mb-1">Decision output</h4>
                              <p className="text-sm text-gray-600">Return selected provider with reasoning and alternatives</p>
                            </div>
                          </div>
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
                        Decision Flow
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Each request flows through evaluation stages that produce a routing decision with full context.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Observability Section */}
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
                      Full Visibility
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Monitor every request, trace every inference, and maintain full visibility into cost, latency, and provider reliability all in one view.
                    </p>

                    {/* Features - Mobile */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Real-Time Metrics
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Track request volume, latency, and cost efficiency as they happen. Understand how your workloads perform across providers in real time.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Traceable Requests
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Follow every inference from input to response. Visualize routing paths and understand how traffic flows across models and regions.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Cost Insights
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          See exactly where your AI spend goes. Break down costs by provider, model, or tenant to optimize usage and prevent waste.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Performance Monitoring
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Measure provider reliability, error rates, and consistency over time to ensure your workloads remain predictable and resilient.
                        </p>
                      </div>
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
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Real-Time Metrics
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Track request volume, latency, and cost efficiency as they happen. Understand how your workloads perform across providers in real time.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Traceable Requests
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Follow every inference from input to response. Visualize routing paths and understand how traffic flows across models and regions.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Cost Insights
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              See exactly where your AI spend goes. Break down costs by provider, model, or tenant to optimize usage and prevent waste.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Performance Monitoring
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Measure provider reliability, error rates, and consistency over time to ensure your workloads remain predictable and resilient.
                            </p>
                          </div>
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
                        Full Visibility
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Monitor every request, trace every inference, and maintain full visibility into cost, latency, and provider reliability all in one view.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Multi-Tenancy Section */}
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
                      Secure by default
                    </h3>
                    <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed mb-8">
                      Multi-tenant isolation, encrypted key storage, and zero-trust architecture are built in from day one. From cloud control planes to edge devices, your workloads stay protected as you scale.
                    </p>

                    {/* Features - Mobile */}
                    <div className="space-y-6">
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Bring Your Own Keys
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Full ownership of provider API keys and local models. AES-256 encrypted vaults for cloud credentials. Models stay on your devices. Zero vendor lock-in.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Multi-Tenant Isolation
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Complete separation of tenant data, policies, and budgets at the database level. Each workspace operates independently with row-level security policies.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Encrypted Model Storage
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          Runtime encrypts on-device LoRA adapters and training data with AES-256-GCM. Device-specific keys ensure models trained on one edge device stay locked to that device.
                        </p>
                      </div>
                      <div>
                        <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                          Zero-Trust Architecture
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                          JWT-based authentication with per-request validation. Every API call verified within tenant context. Budget limits enforced automatically to prevent overspending.
                        </p>
                      </div>
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
                      <div className="w-full max-w-[400px] mx-auto">
                        <div className="space-y-8">
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Bring Your Own Keys
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Full ownership of provider API keys and local models. AES-256 encrypted vaults for cloud credentials. Models stay on your devices. Zero vendor lock-in.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Multi-Tenant Isolation
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Complete separation of tenant data, policies, and budgets at the database level. Each workspace operates independently with row-level security policies.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Encrypted Model Storage
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              Runtime encrypts on-device LoRA adapters and training data with AES-256-GCM. Device-specific keys ensure models trained on one edge device stay locked to that device.
                            </p>
                          </div>
                          <div>
                            <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-2 font-inter">
                              Zero-Trust Architecture
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                              JWT-based authentication with per-request validation. Every API call verified within tenant context. Budget limits enforced automatically to prevent overspending.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column - Title and Description (Desktop only) */}
                    <div className="hidden md:flex text-left md:col-span-1 flex-col justify-start" style={{
                      borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
                      paddingTop: '16rem',
                      paddingBottom: '3rem',
                      paddingLeft: '1rem',
                      height: '100%'
                    }}>
                      <h3 className="text-2xl md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                        Secure by default
                      </h3>
                      <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter leading-relaxed">
                        Multi-tenant isolation, encrypted key storage, and zero-trust architecture are built in from day one. From cloud control planes to edge devices, your workloads stay protected as you scale.
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
