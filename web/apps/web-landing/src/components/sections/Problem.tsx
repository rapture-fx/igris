import React from 'react'

export default function Problem() {
  const observations = [
    'Provider outages occur without advance notice',
    'Model output quality can vary across requests',
    'API costs change as usage patterns shift',
    'Failover between providers often requires manual intervention'
  ]

  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '400px'
        }}>

          {/* Content Container */}
          <div className="w-full px-0">
            <div className="max-w-3xl mx-auto text-center">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-6" style={{ color: '#000000' }}>
                Common challenges when running AI in production
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                {observations.map((observation, index) => (
                  <div
                    key={index}
                    className="text-left p-4 rounded-lg border border-gray-300/40"
                    style={{ backgroundColor: 'rgba(255, 255, 255, 0.5)' }}
                  >
                    <p className="text-sm text-gray-700 dark:text-gray-300 font-inter">
                      {observation}
                    </p>
                  </div>
                ))}
              </div>

              <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                Teams running AI in critical paths often implement routing, failover, and cost control infrastructure to address these operational realities.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
