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
    <section className="py-8 bg-[#f6f6f4] text-gray-900">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative border border-gray-300/20 bg-[#f6f6f4] px-8 md:px-12 py-16">
          {/* Decorative Corner Accents */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8 border-t border-gray-900"></div>
            <div className="absolute top-0 left-3.5 h-8 border-l border-gray-900"></div>
          </div>
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8 border-b border-gray-900"></div>
            <div className="absolute bottom-0 right-3.5 h-8 border-r border-gray-900"></div>
          </div>

          <div className="max-w-6xl mx-auto space-y-8">
            <h3 className="text-xl md:text-2xl font-normal text-center text-black">
              Verified Providers
            </h3>

            <div className="flex flex-wrap justify-center items-center gap-4">
              {providers.map((provider) => (
                <div
                  key={provider}
                  className="flex items-center justify-center w-36 h-16 px-6 py-4 rounded-lg border border-gray-300/60 bg-[#f6f6f4]/50 transition-all duration-300"
                >
                  <span className="text-sm font-medium text-gray-700 text-center whitespace-nowrap">
                    {provider}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-sm text-gray-500 text-center">
              Provider verification as of the latest version of schlep-engine. Support expanding via Open BYOK Registry.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
