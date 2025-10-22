import React from 'react'
import { Code, Package, Zap, CheckCircle } from 'lucide-react'

const sdks = [
  { name: 'Python', logo: '/PYthon.svg' },
  { name: 'JavaScript', logo: '/NODE.svg' },
  { name: 'Rust', logo: '/RUST.svg' },
  { name: 'Go', logo: '/GO.svg' },
]

const codeExample = `<code><span style="color: #1f53d0;"># Python SDK Example</span>
<span style="color: #114dcd;">from</span> schlep_engine <span style="color: #114dcd;">import</span> SchlepEngine

client = SchlepEngine(api_key=<span style="color: #4b5563;">"your-api-key"</span>)

response = client.chat.completions.create(
    model=<span style="color: #4b5563;">"gpt-4"</span>,
    messages=[
        {<span style="color: #4b5563;">"role"</span>: <span style="color: #4b5563;">"user"</span>, <span style="color: #4b5563;">"content"</span>: <span style="color: #4b5563;">"Hello!"</span>}
    ],
    <span style="color: #1f53d0;">policy</span>={
        <span style="color: #4b5563;">"optimize_for"</span>: <span style="color: #4b5563;">"cost"</span>,
        <span style="color: #4b5563;">"fallback_enabled"</span>: <span style="color: #114dcd;">true</span>
    }
)

<span style="color: #6b7280;"># Response includes routing metadata</span>
<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Cost: </span>$<span style="color: #4b5563;">{response.metadata.cost_usd}"</span>)
<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Provider: {response.metadata.provider}"</span>)
<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Latency: {response.metadata.latency_ms}ms"</span>)
</code>`

export default function SDKSupport() {
  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
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
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
              {/* Left Column - Title, SDKs, and Features */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Client Libraries & SDKs</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Native SDKs for your stack
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
                  Idiomatic client libraries for every major language. Type-safe, well-documented, and production-ready.
                </p>

                {/* SDK Logos */}
                <div className="flex gap-4 mb-8">
                  {sdks.map((sdk) => (
                    <div
                      key={sdk.name}
                      className="flex items-center justify-center"
                    >
                      <img src={sdk.logo} alt={sdk.name} className={`object-contain ${sdk.name === 'Go' ? 'w-28 h-28' : 'w-20 h-20'}`} />
                    </div>
                  ))}
                </div>

                {/* Key Features */}
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 font-inter">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>OpenAI-compatible API</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Type-safe with full IntelliSense</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Streaming support included</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span>Async/await where applicable</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Code Example */}
              <div className="lg:col-span-3">
                <div
                  className="text-left relative z-10 rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: '#f2f1ed',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {/* Terminal header */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      </div>
                    </div>
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                      <span className="text-sm text-gray-500 font-medium">example.py</span>
                    </div>
                  </div>

                  {/* Code area */}
                  <div className="p-6" style={{ minHeight: '380px', overflow: 'auto', backgroundColor: '#f7f7f3' }}>
                    <pre
                      className="text-xs md:text-sm leading-relaxed"
                      style={{ color: '#374151' }}
                      dangerouslySetInnerHTML={{
                        __html: codeExample
                      }}
                    />
                  </div>

                  {/* Installation note */}
                  <div className="px-6 pb-6" style={{ backgroundColor: '#f7f7f3' }}>
                    <div className="p-3 rounded border border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                      <p className="text-xs text-gray-600 font-mono mb-2">Installation:</p>
                      <code className="text-xs font-mono" style={{ color: '#114dcd' }}>pip install schlep-engine</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
