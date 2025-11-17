import React from 'react'
import { Activity, BarChart3, Eye, DollarSign } from 'lucide-react'

const features = [
  {
    name: '',
    description: '',
    hasCustomIcon: true,
    isBlank: true,
  },
  {
    name: 'Real-Time Metrics',
    description: 'Track request volume, latency, and cost efficiency as they happen. Understand how your workloads perform across providers in real time.',
    hasCustomIcon: true,
  },
  {
    name: 'Traceable Requests',
    description: 'Follow every inference from input to response. Visualize routing paths and understand how traffic flows across models and regions.',
    hasCustomIcon: true,
  },
  {
    name: 'Cost Insights',
    description: 'See exactly where your AI spend goes. Break down costs by provider, model, or tenant to optimize usage and prevent waste.',
    hasCustomIcon: true,
  },
  {
    name: 'Performance Monitoring',
    description: 'Measure provider reliability, error rates, and consistency over time to ensure your workloads remain predictable and resilient.',
    hasCustomIcon: true,
  },
]

export default function Observability() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '750px',
          display: 'flex',
          alignItems: 'center'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full">
            <div className="max-w-[1300px] mx-auto">
              {/* Section Title */}
              <div className="text-center mb-12">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Full Visibility Across Cost, Performance, and Reliability
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                  Monitor every request, trace every inference, and maintain full visibility into cost, latency, and provider reliability — all in one view.
                </p>
              </div>

              {/* Features Grid */}
              <div className="grid grid-cols-1 md:grid-cols-6 gap-6 max-w-4xl mx-auto">
              {features.map((feature, index) => {
                let colSpan = 'md:col-span-2'; // default for second row cards
                if (index === 0) {
                  colSpan = 'md:col-span-4'; // blank card - wider
                } else if (index === 1) {
                  colSpan = 'md:col-span-2'; // first row second card
                }

                return (
                  <div
                    key={index}
                    className={`rounded-3xl ${feature.isBlank ? 'p-0 overflow-hidden flex items-center justify-center' : 'p-8'} border border-gray-300/60 dark:border-gray-600/60 shadow-sm hover:shadow-md transition-all duration-300 ${colSpan}`}
                    style={{ backgroundColor: '#f5f4f2', height: '200px' }}
                  >
                    {feature.isBlank ? (
                      <div className="w-full h-full" style={{
                        backgroundImage: 'url("/schlep-logo-54.svg")',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        opacity: 0.8
                      }} />
                    ) : (
                      <>
                        <h5 className="text-base font-medium text-gray-900 dark:text-white mb-3 font-inter">{feature.name}</h5>
                        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed font-inter">
                          {feature.description}
                        </p>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
