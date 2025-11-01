import React from 'react'
import { Shield, Box } from 'lucide-react'

const capabilities = [
  {
    name: 'Intelligent Routing Engine',
    description: 'Schlep-Engine intelligently selects the best AI provider for every request using adaptive routing logic. It balances performance, reliability, and cost automatically — no manual configuration required.',
  },
  {
    name: 'Multi-Tenant Budget Control',
    description: 'Each tenant runs within defined cost and usage limits. Real-time enforcement protects workloads from cost overruns while keeping performance stable across customers.',
  },
  {
    name: 'Smart Quota Management',
    description: 'Automatically manages token usage and rate limits across providers. Requests are adjusted on the fly to stay within quota, preventing interruptions and failed calls.',
  },
  {
    name: 'Shadow Mode Validation',
    description: 'Validate routing decisions in real time without affecting live traffic. Shadow requests run safely in the background to improve accuracy and reliability before deployment.',
  },
]

export default function CoreCapabilities() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
          <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          transform: 'translateX(-66.67%)'
          }}></div>

          {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              
              {/* Left Column - Vertical Text Stack */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                {/* Background SVG positioned absolutely */}
                
                <div className="flex gap-4 justify-center w-full max-w-xl mx-auto">
                    <div className="flex flex-col gap-4">
                      {capabilities.slice(0, 2).map((capability, index) => (
                        <div key={capability.name} className="backdrop-blur-md bg-f6f6f4/80 dark:bg-gray-900/80 rounded-2xl p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-md" style={{ padding: '24px 20px', width: '280px', height: '180px' }} >
                          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-col gap-4">
                      {capabilities.slice(2, 4).map((capability, index) => (
                        <div key={capability.name} className="backdrop-blur-md bg-f6f6f4/80 dark:bg-gray-900/80 rounded-2xl p-6 border border-gray-300/60 dark:border-gray-600/60 shadow-md" style={{ padding: '24px 20px', width: '280px', height: '180px' }} >
                          <h3 className="text-base font-medium text-gray-900 dark:text-white mb-2 font-inter">
                            {capability.name}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-inter">
                            {capability.description}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
              </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-8 flex flex-col justify-end" style={{ minHeight: '600px' }}>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                  Built for Intelligent, Reliable AI Infrastructure
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Schlep-engine combines adaptive routing, quota-aware control, and real-time validation to keep your AI workloads efficient and predictable — even at scale.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* New Section with Placeholder */}
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
          <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          transform: 'translateX(-66.67%)'
          }}></div>

          {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '400px' }}>
              
              {/* Left Column - Placeholder */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div 
                  className="absolute left-16 right-16 top-12 bottom-2 pointer-events-none max-w-[1200px] mx-auto"
                  style={{
                    borderTop: '1px solid #d1d5db',
                    borderLeft: '1px solid #d1d5db', 
                    borderRight: '1px solid #d1d5db',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    backgroundColor: '#f6f6f4',
                    boxShadow: '0 -3px 6px -1px rgba(0, 0, 0, 0.12), -2px 0 3px -1px rgba(0, 0, 0, 0.08), 2px 0 3px -1px rgba(0, 0, 0, 0.08)',
                    zIndex: 5
                  }}
                >
                  {/* SVG inside placeholder */}
                  <div 
                    className="absolute inset-0 p-4"
                    style={{ 
                      backgroundImage: 'url("/HRLN.svg")',
                      backgroundPosition: 'bottom center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '50%',
                      opacity: 0.6,
                      zIndex: 6
                    }}
                  />
                </div>
              </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-8 flex flex-col justify-end" style={{ minHeight: '400px' }}>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                  Infrastructure That Scales With Your Ambition
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Built to handle enterprise workloads while maintaining simplicity. Focus on your models, we'll handle the orchestration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* New Section with Placeholder */}
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
          <div className="absolute top-0 bottom-0 left-2/3 hidden lg:block" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          transform: 'translateX(-66.67%)'
          }}></div>

          {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '400px' }}>
              
              {/* Left Column - Placeholder */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div 
                  className="absolute left-16 right-16 top-12 bottom-2 pointer-events-none max-w-[1200px] mx-auto"
                  style={{
                    borderTop: '1px solid #d1d5db',
                    borderLeft: '1px solid #d1d5db', 
                    borderRight: '1px solid #d1d5db',
                    borderTopLeftRadius: '16px',
                    borderTopRightRadius: '16px',
                    backgroundColor: '#f6f6f4',
                    boxShadow: '0 -3px 6px -1px rgba(0, 0, 0, 0.12), -2px 0 3px -1px rgba(0, 0, 0, 0.08), 2px 0 3px -1px rgba(0, 0, 0, 0.08)',
                    zIndex: 5
                  }}
                >
                  {/* SVG inside placeholder */}
                  <div 
                    className="absolute inset-0 p-4"
                    style={{ 
                      backgroundImage: 'url("/HRLN.svg")',
                      backgroundPosition: 'bottom center',
                      backgroundRepeat: 'no-repeat',
                      backgroundSize: '50%',
                      opacity: 0.6,
                      zIndex: 6
                    }}
                  />
                </div>
              </div>

              {/* Right Column - Section Title */}
              <div className="text-left lg:col-span-1 pl-8 flex flex-col justify-end" style={{ minHeight: '400px' }}>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                  Infrastructure That Scales With Your Ambition
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Built to handle enterprise workloads while maintaining simplicity. Focus on your models, we'll handle the orchestration.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
