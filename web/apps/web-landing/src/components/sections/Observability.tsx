import React from 'react'
import { Activity, BarChart3, Eye, DollarSign } from 'lucide-react'

const features = [
  {
    name: 'Prometheus Metrics',
    description: 'Real-time metrics for all operations. Request counts, latency histograms, error rates, and throughput. Grafana-ready.',
    icon: BarChart3,
  },
  {
    name: 'Distributed Tracing',
    description: 'Trace ID propagation across all requests. Track inference flow from gateway to provider with complete visibility.',
    icon: Activity,
  },
  {
    name: 'Cost Tracking',
    description: 'Per-request cost calculation and aggregation. Real-time budget monitoring with alerts. Complete cost visibility by tenant.',
    icon: DollarSign,
  },
  {
    name: 'Performance Monitoring',
    description: 'Track provider performance metrics. P50, P95, P99 latencies. Agreement rates for shadow mode. SLO breach detection.',
    icon: Eye,
  },
]

export default function Observability() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
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
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Observability</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Complete visibility into every request
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Production-grade observability with Prometheus metrics, distributed tracing, and real-time cost tracking. Know exactly what's happening in your AI infrastructure.
              </p>
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature) => (
                <div
                  key={feature.name}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
                  style={{
                    backgroundColor: '#f7f7f3',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    minHeight: '280px'
                  }}
                >
                  {/* Icon at top */}
                  <div
                    className="flex items-center justify-center p-8"
                    style={{
                      backgroundColor: '#f2f1ed',
                      backgroundImage: `repeating-linear-gradient(
                        45deg,
                        transparent,
                        transparent 2px,
                        rgba(0,0,0,0.02) 2px,
                        rgba(0,0,0,0.02) 4px
                      )`
                    }}
                  >
                    <feature.icon className="h-16 w-16 text-black" aria-hidden="true" />
                  </div>

                  {/* Title and Description */}
                  <div className="p-6 flex-1" style={{ backgroundColor: '#f7f7f3' }}>
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

            {/* Metrics Endpoints Info */}
            <div className="mt-8 p-6 rounded-lg border border-gray-200 dark:border-gray-700" style={{
              backgroundColor: '#f2f1ed'
            }}>
              <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 font-mono">Available Endpoints</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="text-blue-600 dark:text-blue-400">GET /metrics</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Prometheus format</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">GET /v1/metrics</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">JSON aggregated metrics</p>
                </div>
                <div>
                  <span className="text-blue-600 dark:text-blue-400">GET /v1/providers/stats</span>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">Provider performance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
