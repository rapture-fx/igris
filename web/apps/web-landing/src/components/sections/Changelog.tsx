'use client'

import React from 'react'
import { History } from 'lucide-react'

const changelog = [
  {
    version: 'v1.6.1',
    date: 'Current',
    status: 'Production',
    changes: [
      'Production-ready: local inference',
      'SSE streaming support',
      'Tool calling implementation',
      'Security hardening',
      'Cryptographic proof layer'
    ]
  },
  {
    version: 'v1.4.0',
    date: 'Feb 2026',
    status: 'Stable',
    changes: [
      'Multi-model registry (6 models)',
      'Reflection loops',
      'Benchmarking suite',
      'Advanced routing'
    ]
  },
  {
    version: 'v1.3.0',
    date: 'Dec 2025',
    status: 'Stable',
    changes: [
      'On-device QLoRA training',
      'Adapter hot-swap capability',
      'Encrypted adapter storage'
    ]
  },
  {
    version: 'v1.2.0',
    date: 'Oct 2025',
    status: 'Legacy',
    changes: [
      'MCP Swarm Mode',
      'Model Context Protocol',
      'Distributed context sync'
    ]
  },
  {
    version: 'v1.1.0',
    date: 'Aug 2025',
    status: 'Legacy',
    changes: [
      'Local LLM fallback (Phi-3)',
      'Speculative execution',
      'GPU Metal support'
    ]
  }
]

export default function Changelog() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[500px]">

          {/* Mobile Layout */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <div className="mb-8">
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                07. CHANGELOG
              </p>
              <h3 className="text-lg md:text-xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Release History
              </h3>
            </div>

            <div className="space-y-4">
              {changelog.map((release, index) => (
                <div key={index} className="border border-gray-300 dark:border-[#f6f6f4]/5 p-4 bg-gray-50 dark:bg-[#1b1912]/50">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] font-mono">
                        {release.version}
                      </h4>
                      <p className="text-xs text-gray-500 dark:text-[#a8a898]">{release.date}</p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      release.status === 'Production' 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                        : release.status === 'Stable'
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                    }`}>
                      {release.status}
                    </span>
                  </div>
                  <ul className="text-xs text-gray-600 dark:text-[#a8a898] space-y-1">
                    {release.changes.map((change, changeIndex) => (
                      <li key={changeIndex} className="flex items-start gap-2">
                        <span className="text-[#c5b0cd] mt-1">•</span>
                        {change}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Desktop Layout */}
          <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
            {/* Left Column - Content (2 columns wide) */}
            <div className="md:col-span-2 flex flex-col justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 bg-gray-50 dark:bg-[#1b1912]/50">
                <div className="p-4 border-b border-gray-300 dark:border-[#f6f6f4]/5 bg-[#f6f6f4] dark:bg-[#1b1912]">
                  <div className="grid grid-cols-12 gap-4 text-xs font-semibold text-gray-600 dark:text-[#a8a898] font-mono">
                    <div className="col-span-2">Version</div>
                    <div className="col-span-2">Date</div>
                    <div className="col-span-2">Status</div>
                    <div className="col-span-6">Key Features</div>
                  </div>
                </div>
                
                {changelog.map((release, index) => (
                  <div 
                    key={index} 
                    className={`p-4 ${index !== changelog.length - 1 ? 'border-b border-gray-300 dark:border-[#f6f6f4]/5' : ''}`}
                  >
                    <div className="grid grid-cols-12 gap-4 items-start">
                      <div className="col-span-2">
                        <span className="text-sm font-mono text-[#000000] dark:text-[#f6f6f4]">
                          {release.version}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-sm text-gray-600 dark:text-[#a8a898]">
                          {release.date}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <span className={`text-xs px-2 py-1 rounded font-medium ${
                          release.status === 'Production' 
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' 
                            : release.status === 'Stable'
                            ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                            : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                        }`}>
                          {release.status}
                        </span>
                      </div>
                      <div className="col-span-6">
                        <p className="text-sm text-gray-600 dark:text-[#a8a898]">
                          {release.changes.join(' • ')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <p className="text-xs text-gray-500 dark:text-[#a8a898] mt-4">
                Full changelog available on <a href="https://github.com/igrisinertial/igris-runtime/releases" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">GitHub Releases</a>
              </p>
            </div>

            {/* Right Column - Title */}
            <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <div className="flex items-center gap-2 mb-4">
                <History className="w-5 h-5 text-[#c5b0cd]" />
              </div>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                07. CHANGELOG
              </p>
              <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                Release History
              </h3>
              <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Track our evolution from local inference to the complete nervous system for AI agents.
              </p>
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}
