import React from 'react'
import Link from 'next/link'

export default function ForDevelopers() {
  const features = [
    {
      title: 'OpenAI-Compatible API',
      description: 'Standard /v1/chat/completions endpoint works with existing client libraries. Drop-in replacement with streaming support and tool calling.',
    },
    {
      title: 'Bring Your Own Keys & Models',
      description: 'Use your own API keys for OpenAI, Anthropic, Groq, and others. Add custom models via provider registry with health monitoring.',
    },
    {
      title: 'Automatic Fallback',
      description: 'Runtime falls back to local Phi-3 Mini models (llama.cpp) when all cloud providers fail. Guaranteed response even offline.',
    },
    {
      title: 'Swarm Coordination',
      description: 'Multiple Runtime instances auto-discover via mDNS/UDP multicast. Share encrypted context and coordinate failover without configuration.',
    },
    {
      title: 'Deployment Options',
      description: 'Single 12MB Rust binary, Docker containers, or Kubernetes. Runs on x86_64, ARM64, Raspberry Pi, and NVIDIA Jetson with GPU offload.',
    },
    {
      title: 'Policy-Driven Routing',
      description: 'YAML-based policies control provider selection, retry chains, cost budgets, and region constraints. Hot-reload without downtime.',
    },
  ]

  return (
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
          <div className="w-full px-0">
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-33.33%)'
            }}></div>

            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                For Developers & Engineers
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter">
                Open standards. Full control. Deploy anywhere.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              <div className="hidden lg:flex text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  For Developers & Engineers
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter mb-6">
                  Open standards. Full control. Deploy anywhere.
                </p>
                <a href="https://docs.igrisinertial.com/docs/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-gray-900 dark:text-white font-inter text-sm hover:opacity-70 transition-opacity">
                  View documentation →
                </a>
              </div>

              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                  {features.map((feature) => (
                    <div key={feature.title} className="rounded-3xl p-4 md:p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                      <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                        {feature.title}
                      </h5>
                      <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 font-inter">
                        {feature.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
