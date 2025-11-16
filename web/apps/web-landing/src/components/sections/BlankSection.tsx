import React from 'react'

const providers = [
  'OpenAI',
  'Anthropic',
  'xAI',
  'Gemini',
  'Kimi',
  'Qwen',
  'Mistral',
  'DeepSeek',
  'Zhipu AI',
  'Meta'
]

export default function BlankSection() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 bg-[#f6f6f4] text-gray-900">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative bg-[#f6f6f4] px-8 md:px-12 py-16" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          minHeight: '750px'
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ minHeight: '750px' }}>

              {/* Left Column - Text Content */}
              <div className="text-left lg:col-span-1 pr-0 md:pr-4 lg:pr-8 flex flex-col justify-center" style={{ minHeight: '750px' }}>
                <h3 className="text-2xl tracking-tight md:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
                  Verified Providers — BYOK Safe
                </h3>
                <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-inter mb-4">
                  Every connected provider is validated for uptime, latency, and output integrity before it joins your routing network.
                </p>
                <p className="text-base leading-7 text-gray-600 dark:text-gray-400 font-inter">
                  With the Open BYOK registry, you can onboard new providers while Schlep-engine automatically performs continuous trust checks — keeping your stack clean and stable.
                </p>
              </div>

              {/* Right Column - Provider Cards */}
              <div className="lg:col-span-2 relative flex items-center justify-center pl-0 md:pl-4 lg:pl-8">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 w-full max-w-3xl">
                  {providers.map((provider) => (
                    <div
                      key={provider}
                      className="bg-[#f6f6f4] border border-gray-200 rounded-lg px-2 py-3 md:px-4 text-center shadow-sm hover:shadow-md transition-shadow flex items-center justify-center min-h-[60px]"
                    >
                      <p className="text-xs md:text-sm font-medium text-gray-800 break-words">{provider}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
