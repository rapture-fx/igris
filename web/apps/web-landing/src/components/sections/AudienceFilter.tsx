import React from 'react'

export default function AudienceFilter() {
  const lessRelevant = [
    'Single-provider API usage',
    'Prototype or demo applications',
    'Personal projects without production requirements'
  ]

  const moreRelevant = [
    'Multi-provider AI deployments',
    'Systems requiring consistent uptime',
    'Edge or robotics applications',
    'Environments with compliance or security constraints'
  ]

  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', height: '800px', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8" style={{ height: '100%' }}>
        <div className="relative px-4 md:px-4 lg:px-6 flex flex-col" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          height: '100%'
        }}>

          {/* Content Container */}
          <div className="w-full px-0 md:px-8 lg:px-8" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-10">
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Intended use cases
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Less Relevant */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4 font-inter">
                    Less relevant for:
                  </h4>
                  <div className="space-y-3">
                    {lessRelevant.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg border border-gray-300/40"
                        style={{ backgroundColor: 'rgba(255, 255, 255, 0.3)' }}
                      >
                        <p className="text-sm text-gray-600 dark:text-gray-400 font-inter">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* More Relevant */}
                <div>
                  <h4 className="text-base font-medium text-gray-900 dark:text-white mb-4 font-inter">
                    More relevant for:
                  </h4>
                  <div className="space-y-3">
                    {moreRelevant.map((item, index) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg border border-gray-400/50"
                        style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}
                      >
                        <p className="text-sm text-gray-800 dark:text-gray-200 font-inter font-medium">
                          {item}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-10 text-center">
                <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                  Designed for teams running AI workloads where provider reliability, cost predictability, and operational control matter.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
