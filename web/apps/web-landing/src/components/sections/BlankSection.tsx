import React from 'react'

export default function BlankSection() {
  return (
    <section className="py-2 bg-[#f6f6f4] text-gray-900">
      <div className="mx-auto max-w-[1350px] px-4 sm:px-6 lg:px-8">
        <div className="relative bg-[#f6f6f4] px-4 md:px-8 lg:px-12 py-8 md:py-12 lg:py-16" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Decorative Corner Accents */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="w-full px-0">
            {/* Vertical Divider positioned at center - full height from top to bottom of frame */}
            <div className="absolute top-0 bottom-0 left-1/3 hidden lg:block" style={{
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              transform: 'translateX(-33.33%)'
            }}></div>

            {/* Two-column layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:min-h-[750px]">

              {/* Left Column - Text Content */}
              <div className="text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex flex-col justify-center lg:min-h-[750px]">
                <h3 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Verified Providers, BYOK Safe
                </h3>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter mb-4">
                  Every connected provider is validated for uptime, latency, and output integrity before it joins your routing network.
                </p>
                <p className="text-sm md:text-lg text-gray-600 dark:text-gray-400 font-inter">
                  With the Open BYOK registry, you can onboard new providers while Igris Inertial automatically performs continuous trust checks, keeping your stack clean and stable.
                </p>
              </div>

              {/* Right Column - Empty */}
              <div className="lg:col-span-2 relative flex items-center justify-center pl-0 md:pl-4 lg:pl-8">
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
