'use client'

import React from 'react'
import { Terminal, Download, GitBranch } from 'lucide-react'

export default function Installation() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r section-border min-h-[600px]">

          {/* Mobile Layout */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <div className="mb-8">
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                06. INSTALLATION
              </p>
              <h3 className="text-lg md:text-xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Quick Install
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed">
                Download and run in one command. 16MB binary with zero dependencies.
              </p>
            </div>

            <div className="space-y-6">
              {/* One-line Install */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-gray-50 dark:bg-[#1b1912]/50">
                <div className="flex items-center gap-2 mb-3">
                  <Terminal className="w-4 h-4 text-[#c5b0cd]" />
                  <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4]">One-Line Install</h4>
                </div>
                <div className="bg-[#14120a] text-[#a8a898] p-3 rounded font-mono text-xs overflow-x-auto">
                  <p className="text-[#c5b0cd]"># Download and install</p>
                  <p>curl -sSL https://raw.githubusercontent.com/igrisinertial/igris-runtime/main/install.sh | sh</p>
                  <p className="mt-2">igris-runtime serve</p>
                </div>
              </div>

              {/* Build from Source */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-gray-50 dark:bg-[#1b1912]/50">
                <div className="flex items-center gap-2 mb-3">
                  <GitBranch className="w-4 h-4 text-[#c5b0cd]" />
                  <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4]">Build from Source</h4>
                </div>
                <div className="bg-[#14120a] text-[#a8a898] p-3 rounded font-mono text-xs overflow-x-auto">
                  <p className="text-[#c5b0cd]"># Requires Rust 1.75+</p>
                  <p>git clone https://github.com/igrisinertial/igris-runtime.git</p>
                  <p>cd igris-runtime && cargo build --release</p>
                  <p className="mt-2">./target/release/igris-runtime serve</p>
                </div>
              </div>

              {/* Docker */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-gray-50 dark:bg-[#1b1912]/50">
                <div className="flex items-center gap-2 mb-3">
                  <Download className="w-4 h-4 text-[#c5b0cd]" />
                  <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4]">Docker</h4>
                </div>
                <div className="bg-[#14120a] text-[#a8a898] p-3 rounded font-mono text-xs overflow-x-auto">
                  <p>docker run -p 8080:8080 igris/inertial:latest</p>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-[#a8a898]">
                Requires: BYOM (GGUF model) or BYOK (cloud API keys in config.json5)
              </p>
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Content (2 columns wide) */}
            <div className="md:col-span-2 flex flex-col justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              
              {/* Three columns for install methods */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
                {/* One-line Install */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-gray-50 dark:bg-[#1b1912]/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Terminal className="w-5 h-5 text-[#c5b0cd]" />
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] font-inter">One-Line Install</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                    16MB static binary. Zero dependencies.
                  </p>
                  <div className="bg-[#14120a] text-[#a8a898] p-4 rounded font-mono text-xs overflow-x-auto">
                    <p className="text-[#c5b0cd] mb-2"># Install</p>
                    <p>curl -sSL https://raw.githubusercontent.com/</p>
                    <p>igrisinertial/igris-runtime/main/</p>
                    <p>install.sh | sh</p>
                    <p className="text-[#c5b0cd] mt-3 mb-2"># Run</p>
                    <p>igris-runtime serve</p>
                  </div>
                </div>

                {/* Build from Source */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-gray-50 dark:bg-[#1b1912]/50">
                  <div className="flex items-center gap-2 mb-4">
                    <GitBranch className="w-5 h-5 text-[#c5b0cd]" />
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] font-inter">Build Source</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                    Requires Rust 1.75+
                  </p>
                  <div className="bg-[#14120a] text-[#a8a898] p-4 rounded font-mono text-xs overflow-x-auto">
                    <p className="text-[#c5b0cd] mb-2"># Clone</p>
                    <p>git clone https://github.com/</p>
                    <p>igrisinertial/igris-runtime.git</p>
                    <p className="text-[#c5b0cd] mt-3 mb-2"># Build</p>
                    <p>cd igris-runtime</p>
                    <p>cargo build --release</p>
                  </div>
                </div>

                {/* Docker */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-gray-50 dark:bg-[#1b1912]/50">
                  <div className="flex items-center gap-2 mb-4">
                    <Download className="w-5 h-5 text-[#c5b0cd]" />
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] font-inter">Docker</h4>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                    Containerized deployment
                  </p>
                  <div className="bg-[#14120a] text-[#a8a898] p-4 rounded font-mono text-xs overflow-x-auto">
                    <p className="text-[#c5b0cd] mb-2"># Pull and run</p>
                    <p>docker run -p 8080:8080 \</p>
                    <p>igris/inertial:latest</p>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-4">
                    Pre-configured with health checks
                  </p>
                </div>
              </div>

              {/* Requirements Note */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-[#f6f6f4] dark:bg-[#1b1912]">
                <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter">
                  <strong>Requirements:</strong> BYOM (Bring Your Own Model - local GGUF) or BYOK (Bring Your Own Keys - cloud API keys in config.json5). 
                  See <a href="https://docs.igrisinertial.com/runtime/quickstart" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Quick Start Guide</a> for configuration.
                </p>
              </div>
            </div>

            {/* Right Column - Title */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                06. INSTALLATION
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Quick Install
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed mb-4">
                Download and run in minutes. Multiple installation methods to fit your workflow.
              </p>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Single 16MB binary with no containers, no dependencies, no cloud required.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
