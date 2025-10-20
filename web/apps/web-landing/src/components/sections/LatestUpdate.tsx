
import React from 'react'

const updates = [
  {
    title: 'Multi-Tenancy Architecture',
    description: 'Complete multi-tenant support with isolated workspaces, custom domains, and per-tenant resource allocation. Production-ready security with JWT authentication.',
    date: 'October 20, 2024'
  },
  {
    title: 'Rust Optimization Engine',
    description: 'High-performance Rust-based routing engine with Thompson sampling. 40% faster processing and 20% cost reduction compared to Go routing.',
    date: 'October 15, 2024'
  },
  {
    title: 'Advanced Monitoring Dashboard',
    description: 'Real-time metrics, cost tracking, and performance analytics. Integrated with Prometheus and Grafana for complete observability.',
    date: 'October 10, 2024'
  }
]

export default function LatestUpdate() {
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
              <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Recent Development</h2>
              <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                Latest Updates & Improvements.<br />Always evolving for better performance.
              </h3>
              <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter max-w-3xl">
                Stay updated with our latest features, performance improvements, and architectural enhancements. Continuous development to deliver the best AI routing experience.
              </p>
            </div>

            {/* Update Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {updates.map((update, index) => (
                <div
                  key={index}
                  className="rounded-lg border border-gray-200 dark:border-gray-700 flex flex-col justify-between overflow-hidden"
                  style={{
                    backgroundColor: '#f7f7f3',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                    minHeight: '300px'
                  }}
                >
                  {/* Date Badge */}
                  <div
                    className="flex items-center justify-center p-4"
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
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400 font-mono">
                      {update.date}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="p-6" style={{ backgroundColor: '#f7f7f3' }}>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 font-mono">
                      {update.title}
                    </h3>
                    <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">
                      {update.description}
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
