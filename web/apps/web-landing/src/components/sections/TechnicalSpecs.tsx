'use client'

import React from 'react'

export default function TechnicalSpecs() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[600px]">

          {/* Mobile Layout */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <div className="mb-8">
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                TECHNICAL SPECIFICATIONS
              </p>
              <h3 className="text-lg md:text-xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Machine-Readable Data
              </h3>
            </div>

            {/* Specs Grid */}
            <div className="space-y-6">
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4">
                <h4 className="text-sm font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Product Info</h4>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] font-mono space-y-1">
                  <p>name: Igris Inertial</p>
                  <p>version: v1.6.1</p>
                  <p>license: MIT OR Apache-2.0</p>
                  <p>binary_size: ~16MB</p>
                </div>
              </div>

              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4">
                <h4 className="text-sm font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">Capabilities</h4>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] font-mono space-y-1">
                  <p>deployment: Edge, cloud, air-gapped</p>
                  <p>models: BYOM (GGUF) + BYOK (cloud)</p>
                  <p>offline: true</p>
                  <p>inference: Local + Cloud fallback</p>
                </div>
              </div>

              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-gray-50 dark:bg-[#1b1912]/50">
                <h4 className="text-sm font-semibold mb-3 text-[#000000] dark:text-[#f6f6f4]">API Endpoints</h4>
                <div className="text-xs text-gray-600 dark:text-[#a8a898] font-mono overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-300 dark:border-[#f6f6f4]/10">
                        <th className="text-left py-2 pr-2">Endpoint</th>
                        <th className="text-left py-2 pr-2">Method</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr><td className="py-1 pr-2">/v1/infer</td><td>POST</td></tr>
                      <tr><td className="py-1 pr-2">/v1/chat/completions</td><td>POST</td></tr>
                      <tr><td className="py-1 pr-2">/v1/health</td><td>GET</td></tr>
                      <tr><td className="py-1 pr-2">/v1/plan</td><td>POST</td></tr>
                      <tr><td className="py-1 pr-2">/v1/reflect</td><td>POST</td></tr>
                      <tr><td className="py-1 pr-2">/metrics</td><td>GET</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-3">
                  Full API docs: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com</a>
                </p>
              </div>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Content (2 columns wide) */}
            <div className="md:col-span-2 flex flex-col justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Product Info */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-[#f6f6f4] dark:bg-[#1b1912]">
                  <h4 className="text-sm font-semibold mb-4 text-[#000000] dark:text-[#f6f6f4] font-inter">Product Information</h4>
                  <div className="text-sm text-gray-600 dark:text-[#a8a898] font-mono space-y-2">
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>Name</span>
                      <span>Igris Inertial</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>Version</span>
                      <span>v1.6.1</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>License</span>
                      <span>MIT / Apache-2.0</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Binary Size</span>
                      <span>~16MB</span>
                    </div>
                  </div>
                </div>

                {/* Capabilities */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-[#f6f6f4] dark:bg-[#1b1912]">
                  <h4 className="text-sm font-semibold mb-4 text-[#000000] dark:text-[#f6f6f4] font-inter">Capabilities</h4>
                  <div className="text-sm text-gray-600 dark:text-[#a8a898] font-mono space-y-2">
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>Deployment</span>
                      <span>Edge, Cloud, Air-Gap</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>Models</span>
                      <span>BYOM + BYOK</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>Offline</span>
                      <span>Yes (Indefinite)</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Inference</span>
                      <span>Local + Cloud</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* API Endpoints */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-gray-50 dark:bg-[#1b1912]/50">
                <h4 className="text-sm font-semibold mb-4 text-[#000000] dark:text-[#f6f6f4] font-inter">API Endpoints</h4>
                <div className="text-sm text-gray-600 dark:text-[#a8a898] font-mono">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>POST /v1/infer</span>
                      <span className="text-gray-500">Inference</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>POST /v1/chat/completions</span>
                      <span className="text-gray-500">Chat (OpenAI)</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>GET /v1/health</span>
                      <span className="text-gray-500">Health</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>POST /v1/plan</span>
                      <span className="text-gray-500">Planning</span>
                    </div>
                    <div className="flex justify-between border-b border-gray-200 dark:border-[#f6f6f4]/10 pb-1">
                      <span>POST /v1/reflect</span>
                      <span className="text-gray-500">Reflection</span>
                    </div>
                    <div className="flex justify-between">
                      <span>GET /metrics</span>
                      <span className="text-gray-500">Prometheus</span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-4">
                  OpenAI-compatible inference endpoints. Full reference: <a href="https://docs.igrisinertial.com/runtime/docs/" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">docs.igrisinertial.com</a>
                </p>
              </div>
            </div>

            {/* Right Column - Title */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#85612c] dark:text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                05. TECHNICAL SPECS
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Machine-Readable Data
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Structured product information, API endpoints, and technical specifications for integration and automated systems.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
