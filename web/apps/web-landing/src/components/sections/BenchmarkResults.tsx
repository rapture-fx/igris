import React from 'react'

const comparisonData = [
  {
    scenario: 'Direct GPT-4',
    cost: '$2.15',
    description: 'Baseline (OpenAI billing)',
    percentage: 100
  },
  {
    scenario: 'Mixed Routing',
    cost: '$1.10',
    description: 'Balanced GPT-4 + Claude-3 routing',
    percentage: 51
  },
  {
    scenario: 'Schlep-Engine',
    cost: '$0.066',
    description: 'Verified (Claude-3 Haiku live benchmark)',
    percentage: 3,
    isHighlighted: true
  }
]

const metricHighlights = [
  {
    title: 'Cost Savings',
    value: '40–70% average, up to 97% for compatible workloads'
  },
  {
    title: 'Latency',
    value: '19.3% faster average response (1,800ms → 1,452ms)'
  },
  {
    title: 'Reliability',
    value: '100% success rate with zero rate-limit errors'
  }
]

export default function BenchmarkResults() {
  return (
    <>
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.8s ease-out forwards;
        }
      `}</style>
      <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', padding: '1px 0' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-12 py-20" style={{
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
            {/* Vertical Divider positioned at 1/3 - full height from top to bottom of frame */}
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(191, 191, 191, 0.3)',
              transform: 'translateX(-20%)'
            }}></div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column */}
              <div className="lg:col-span-1 text-left flex flex-col justify-center pr-8">
                {/* Section Header */}
                <div className="mb-12 opacity-0 animate-fadeIn" style={{ animationDelay: '200ms' }}>
                  <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                    Measured in Production
                  </h3>
                  
                  <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                    Benchmarks using OpenAI and Anthropic APIs confirm measurable cost savings, improved latency, and fault-tolerant reliability in production.
                  </p>
                </div>

                {/* Metric Highlights */}
                <div className="mb-12 opacity-0 animate-fadeIn space-y-6" style={{ animationDelay: '0ms' }}>
                  {metricHighlights.map((metric, index) => (
                    <div key={index} className={`flex flex-col ${metric.title === 'Cost Savings' || metric.title === 'Latency' || metric.title === 'Reliability' ? 'mt-2' : ''}`}>
                      <h4 className="text-base font-normal text-gray-900 dark:text-white mb-1">{metric.title}</h4>
                      {metric.title === 'Cost Savings' && (
                        <p className="text-3xl text-gray-900 dark:text-white mb-2">40–70% average</p>
                      )}
                      {metric.title === 'Latency' && (
                        <p className="text-3xl text-gray-900 dark:text-white mb-2">19.3% faster</p>
                      )}
                      {metric.title === 'Reliability' && (
                        <p className="text-3xl text-gray-900 dark:text-white mb-2">99.9%+ success rate observed</p>
                      )}
                      <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                        {metric.title === 'Cost Savings' ? 'up to 97% for compatible workloads' : 
                         metric.title === 'Latency' ? 'average response (1,800ms → 1,452ms)' :
                         metric.title === 'Reliability' ? 'with zero rate-limit errors' :
                         metric.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - Combined Benchmark Visualization */}
              <div className="lg:col-span-2 flex items-center justify-center">
                <div className="w-full max-w-2xl opacity-0 animate-fadeIn" style={{ animationDelay: '400ms' }}>
                  <div className="bg-[#f6f6f4] dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 shadow-lg">
                    <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-6 text-center">
                      Cost Comparison Analysis
                    </h3>
                    <div className="space-y-6">
                      {comparisonData.map((item, index) => (
                        <div key={index} className="border-b border-gray-100 dark:border-gray-700 last:border-b-0 pb-6 last:pb-0">
                          <div className="flex justify-between items-center mb-2">
                            <h4 className={`text-lg font-medium ${item.isHighlighted ? 'text-green-600 dark:text-green-400 font-bold' : 'text-gray-900 dark:text-white'}`}>
                              {item.scenario}
                            </h4>
                            <div className="text-right">
                              <span className={`text-2xl font-bold ${item.isHighlighted ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'} mr-2`}>
                                {item.cost}
                              </span>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                ({item.percentage}%)
                              </span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {item.description}
                          </p>
                          <div className="flex items-center">
                            <p className="text-2xl font-mono text-gray-400 dark:text-gray-500" style={{ letterSpacing: '0.2em' }}>
                              {Array.from({ length: 10 }, (_, i) => (i < Math.round(item.percentage / 10) ? '⋮' : '.')).join('')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  )
}
