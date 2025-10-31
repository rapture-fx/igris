import React from 'react'
import { Activity, BarChart3, Eye, DollarSign } from 'lucide-react'

const features = [
  {
    name: 'Prometheus Metrics',
    description: 'Real-time metrics for all operations. Request counts, latency histograms, error rates, and throughput. Grafana-ready.',
    hasCustomIcon: true,
  },
  {
    name: 'Distributed Tracing',
    description: 'Trace ID propagation across all requests. Track inference flow from gateway to provider with complete visibility.',
    hasCustomIcon: true,
  },
  {
    name: 'Cost Tracking',
    description: 'Per-request cost calculation and aggregation. Real-time budget monitoring with alerts. Complete cost visibility by tenant.',
    hasCustomIcon: true,
  },
  {
    name: 'Performance Monitoring',
    description: 'Track provider performance metrics. P50, P95, P99 latencies. Agreement rates for shadow mode. SLO breach detection.',
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
              
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
                Full Visibility Across Cost, Performance, and Reliability
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Monitor every request, trace every inference, and keep full visibility across performance and cost.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                  style={{
                    backgroundColor: '#f6f6f4',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    minHeight: '260px'
                  }}
                >
                  <div className="flex-1 flex items-center justify-center relative" style={{
                    backgroundColor: '#f6f6f4',
                    backgroundImage: `repeating-linear-gradient(
                      45deg,
                      transparent,
                      transparent 2px,
                      rgba(0,0,0,0.02) 2px,
                      rgba(0,0,0,0.02) 4px
                    )`
                  }}>
                    {feature.hasCustomIcon && feature.name === 'Prometheus Metrics' ? (
                      <img
                        src="/metrics.svg"
                        alt="Prometheus Metrics"
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] object-contain"
                      />
                    ) : feature.hasCustomIcon && feature.name === 'Distributed Tracing' ? (
                      <img
                        src="/Distribute.svg"
                        alt="Distributed Tracing"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : feature.hasCustomIcon && feature.name === 'Cost Tracking' ? (
                      <img
                        src="/costtrackerdia.svg"
                        alt="Cost Tracking"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    ) : feature.hasCustomIcon && feature.name === 'Performance Monitoring' ? (
                      <img
                        src="/observe.svg"
                        alt="Performance Monitoring"
                        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] object-contain"
                      />
                    ) : (
                      <feature.icon className="h-16 w-16 text-black" aria-hidden="true" />
                    )}
                  </div>
                  
                  {/* Title and Description */}
                  <div className="p-6">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2 font-mono">
                      {feature.name}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            
          </div>
        </div>
      </div>
    </section>
  )
}
