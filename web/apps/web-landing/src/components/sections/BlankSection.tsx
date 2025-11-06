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
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-12 py-16" style={{
          borderTop: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderBottom: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderLeft: '0.3px solid rgba(156, 163, 175, 0.2)',
          borderRight: '0.3px solid rgba(156, 163, 175, 0.2)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            {/* Section Title */}
            <div className="text-center mb-8">
              <h3 className="text-xl tracking-tight md:text-2xl font-normal font-inter mb-4" style={{ color: '#000000' }}>
                Verified Providers :
              </h3>
            </div>

            {/* Logo Row */}
            <div className="flex flex-wrap justify-center items-center gap-4 max-w-full mx-auto">
              {providers.map((provider) => (
                <div
                  key={provider}
                  className="flex flex-shrink-0 items-center justify-center w-36 h-16 px-6 py-4 rounded-lg border border-gray-300/60 bg-[#f6f6f4]/50 hover:bg-[#f6f6f4]/80 transition-all duration-300"
                >
                  <span className="text-sm font-medium text-gray-700 font-inter text-center whitespace-nowrap">
                    {provider}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
