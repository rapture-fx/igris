import React from 'react'

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-12 md:py-16 lg:py-20 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4',
          minHeight: '600px'
        }}>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center */}
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-33.33%)'
            }}></div>

            {/* Title Section - Shows first on mobile, last on desktop */}
            <div className="text-left mb-6 lg:mb-0 lg:hidden">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                How It Works
              </h3>
              <div className="space-y-4 text-sm md:text-base text-gray-600 dark:text-gray-400">
                <div>
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Your application sends a request</h4>
                  <p className="text-sm">
                    Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                  </p>
                </div>

                <div>
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Igris makes the decision</h4>
                  <p className="text-sm">
                    Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                  </p>
                </div>

                <div>
                  <h4 className="font-normal text-gray-900 dark:text-white mb-2">Traffic reroutes on failure</h4>
                  <p className="text-sm">
                    If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                  </p>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>
              {/* Left Column - Section Title (Desktop only) */}
              <div className="hidden lg:flex text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-6" style={{ color: '#000000' }}>
                  How It Works
                </h3>
                <div className="space-y-6 text-sm md:text-base text-gray-600 dark:text-gray-400">
                  <div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Your application sends a request</h4>
                    <p className="text-sm">
                      Use OpenAI-compatible API calls. Igris intercepts them before they reach any provider.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Igris makes the decision</h4>
                    <p className="text-sm">
                      Thompson Sampling evaluates providers based on cost, quality, latency, and availability. The best option is selected automatically.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-normal text-gray-900 dark:text-white mb-2">Traffic reroutes on failure</h4>
                    <p className="text-sm">
                      If a provider fails, Igris instantly switches to the next best option or falls back to on-device models. No manual intervention required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right Column - Diagram and Explanation */}
              <div className="lg:col-span-2 relative flex items-center justify-center">
                <div className="w-full relative z-10">
                  <img
                    src="/flow.png"
                    alt="Igris Inertial Flow Diagram"
                    width={700}
                    height={500}
                    className="w-full h-auto rounded-lg"
                    style={{ maxHeight: '500px', objectFit: 'contain' }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
