import React from 'react'

export default function ResilienceCore() {
  return (
    <section className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 px-4 md:px-8 lg:px-12 border border-gray-300 dark:border-[#f6f6f4]/5" style={{
          backgroundColor: '#f6f6f4'
        }}>

          {/* Content Container */}
          <div className="max-w-[1100px] mx-auto w-full">
            <div className="text-center mb-12">
              <h3 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                Resilience Core
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 font-inter max-w-3xl mx-auto">
                Built-in reliability, fallback, and continuity mechanisms shared across Overture and Runtime.
              </p>
            </div>

            {/* 2x2 Grid Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Card 1: EscapeVector Mode */}
              <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300 dark:border-[#f6f6f4]/5 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">EscapeVector Mode</h5>
                <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                  Stay online even if the control plane goes offline. Cached Bayesian routing keeps quality, performance, and resilience intact for 72 hours without interruption.
                </p>
              </div>

              {/* Card 2: Gold Code Override */}
              <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300 dark:border-[#f6f6f4]/5 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">Gold Code Override</h5>
                <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                  One environment variable instantly bypasses the entire control plane. A required safety switch for enterprise security, audits, and regulated workloads.
                </p>
              </div>

              {/* Card 3: SLO Enforcer */}
              <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300 dark:border-[#f6f6f4]/5 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">SLO Enforcer</h5>
                <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                  Automatic guardrails monitor latency, cost drift, and reliability. Traffic shifts to safer paths the moment thresholds are crossed.
                </p>
              </div>

              {/* Card 4: Resilient Provider Health Checks */}
              <div className="rounded-3xl p-4 md:p-6 lg:p-8 border border-gray-300 dark:border-[#f6f6f4]/5 shadow-sm hover:shadow-md transition-all duration-300 min-h-[180px]" style={{ backgroundColor: '#f6f6f4' }}>
                <h5 className="text-sm md:text-base font-medium text-gray-900 dark:text-white mb-2 md:mb-3 font-inter">Resilient Provider Health Checks</h5>
                <p className="text-xs md:text-sm text-gray-800 dark:text-gray-200 mb-2 font-inter">
                  Continuous endpoint validation ensures only healthy providers receive traffic. Failed calls are detected and rerouted in real time.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

