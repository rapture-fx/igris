'use client'

import Link from 'next/link'
import { Copy } from 'lucide-react'
import { useState } from 'react'

export default function Hero() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    const codeText = `curl -X POST https://api.schlep-engine.com/v1/transform \\
  -H "Authorization: Bearer your-api-key" \\
  -F "file=@messy_data.csv" \\
  -F "format=tensorflow"`
    navigator.clipboard.writeText(codeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="pt-24 pb-16 bg-gradient-to-br from-blue-50/50 via-white to-blue-100/40 min-h-screen flex items-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div 
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(59, 130, 246, 0.6) 1px, transparent 1px),
            linear-gradient(90deg, rgba(59, 130, 246, 0.6) 1px, transparent 1px)
          `,
          backgroundSize: '20px 20px',
          maskImage: 'linear-gradient(to bottom, transparent 0%, black 35%, black 80%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 35%, black 80%, transparent 100%)'
        }}
      ></div>
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-semibold text-gray-900 mb-4 leading-tight">
            Messy data to ML-ready in API calls.
          </h1>

          <p className="text-base md:text-lg text-gray-600 mb-16 max-w-3xl mx-auto leading-relaxed">
            Build and ship your model faster.<br />
            Schlep-engine handles data preparation through a simple API.
          </p>

          <div className="flex justify-center gap-3 mb-16">
            <Link
              href="#get-started"
              className="bg-[#1A5799] text-white px-6 py-2.5 rounded-md hover:bg-[#154A85] transition-all duration-200 font-medium text-sm shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1),0_1px_3px_0_rgba(0,0,0,0.1)] hover:shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1),0_2px_6px_0_rgba(0,0,0,0.15)] backdrop-blur-sm"
            >
              Get Started for Free
            </Link>
            <Link
              href="http://localhost:3001"
              className="bg-white text-gray-800 border border-gray-200 px-6 py-2.5 rounded-md hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 font-medium text-sm shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1),0_1px_3px_0_rgba(0,0,0,0.1)] hover:shadow-[inset_0_-1px_0_0_rgba(0,0,0,0.1),0_2px_6px_0_rgba(0,0,0,0.15)] backdrop-blur-sm"
            >
              API Documentation
            </Link>
          </div>

          <div className="relative mx-auto max-w-7xl px-4">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                  <span className="ml-2 text-xs text-gray-500 font-medium">Terminal</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1.5 text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-md transition-colors duration-200 text-xs font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-left">
                <div className="text-gray-800 font-mono text-sm leading-relaxed">
                  <div className="mb-2"><span className="text-gray-800 font-medium">$</span> curl -X POST https://api.schlep-engine.com/v1/transform \</div>
                  <div className="mb-2 ml-4 text-gray-600">-H "Authorization: Bearer your-api-key" \</div>
                  <div className="mb-2 ml-4 text-gray-600">-F "file=@messy_data.csv" \</div>
                  <div className="mb-4 ml-4 text-gray-600">-F "format=tensorflow"</div>
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <div className="text-gray-700">
                      <div className="text-gray-800 font-medium">{"{"}</div>
                      <div className="ml-3 text-green-600">"status": "success",</div>
                      <div className="ml-3 text-green-600">"processing_time": "2.3s",</div>
                      <div className="ml-3 text-green-600">"quality_score": 0.98,</div>
                      <div className="ml-3 text-green-600">"download_url": "https://api.schlep-engine.com/download/abc123"</div>
                      <div className="text-gray-800 font-medium">{"}"}</div>
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