import React from 'react'
import { Activity, BarChart3, Eye, DollarSign } from 'lucide-react'

const features = [
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
        <div className="relative p-40 px-12" style={{
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
          <div className="max-w-[1300px] mx-auto">
            {/* Section Title */}
            <div className="text-left mb-12">
              
              <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Full Visibility Across Cost, Performance, and Reliability
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Monitor every request, trace every inference, and maintain full visibility into cost, latency, and provider reliability — all in one view.
              </p>
            </div>

            {/* Features Horizontal Stack */}
            <div className="flex flex-col lg:flex-row gap-12 border-t border-b border-gray-200 dark:border-gray-700 py-24">
              {features.map((feature, index) => (
                <div key={feature.name} className="flex-1 text-left relative">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                    {feature.name}
                  </h3>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                    {feature.description}
                  </p>
                  {/* Add vertical line between items except last one */}
                  {index < features.length - 1 && (
                    <div className="hidden lg:block absolute -top-24 bottom-0 right-0 w-px bg-gray-200 dark:bg-gray-700" style={{ right: '-24px' }}></div>
                  )}
                </div>
              ))}
            </div>

            
          </div>
        </div>
      </div>
    </section>
  )
}
