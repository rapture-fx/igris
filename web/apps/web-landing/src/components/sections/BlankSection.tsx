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
              <div className="text-left lg:col-span-1 pr-8 flex flex-col justify-center" style={{ minHeight: '750px' }}>
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

              {/* Right Column - Provider List */}
              <div className="lg:col-span-2 relative flex items-center justify-start pl-8">
                <ul className="space-y-3">
                  {providers.map((provider) => (
                    <li key={provider} className="flex items-center text-base font-normal text-gray-800">
                      <span className="w-2 h-2 bg-gray-800 rounded-full mr-3 flex-shrink-0"></span>
                      {provider}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
