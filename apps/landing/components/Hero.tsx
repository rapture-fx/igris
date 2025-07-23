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
    <section className="pt-32 pb-16 bg-gradient-to-br from-blue-50/50 via-white to-blue-100/40 min-h-screen flex items-center">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center">
          <h1 className="text-2xl md:text-4xl font-semibold text-gray-900 mb-6 leading-tight">
            Messy data to ML-ready in API calls.
          </h1>

          <p className="text-base md:text-lg text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Eliminate time wasted on data cleaning. Schlep-engine automates data profiling, transformation, and labeling via API. Focus on building models with scalable, intelligent preprocessing for production pipelines.
          </p>

          <div className="flex justify-center mb-16">
            <Link
              href="#get-started"
              className="bg-[#468BE6] text-white px-8 py-3 rounded-lg hover:bg-[#3a7bd5] transition-all duration-200 font-medium text-base shadow-sm hover:shadow-md"
            >
              Get Started for Free
            </Link>
          </div>

          <div className="relative mx-auto max-w-4xl">
            <div className="bg-white/80 backdrop-blur-sm border border-gray-200/50 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                  <span className="ml-2 text-xs text-gray-500 font-medium">Terminal</span>
                </div>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center space-x-1.5 bg-[#468BE6] text-white px-3 py-1.5 rounded-md hover:bg-[#3a7bd5] transition-colors duration-200 text-xs font-medium"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copied ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
              <div className="text-left">
                <div className="text-gray-800 font-mono text-xs leading-relaxed">
                  <div className="mb-1"><span className="text-[#468BE6] font-medium">$</span> curl -X POST https://api.schlep-engine.com/v1/transform \</div>
                  <div className="mb-1 ml-3 text-gray-600">-H "Authorization: Bearer your-api-key" \</div>
                  <div className="mb-1 ml-3 text-gray-600">-F "file=@messy_data.csv" \</div>
                  <div className="mb-3 ml-3 text-gray-600">-F "format=tensorflow"</div>
                  <div className="border-t border-gray-200 pt-3 mt-3">
                    <div className="text-gray-700">
                      <div className="text-[#468BE6] font-medium">{"{"}</div>
                      <div className="ml-2 text-green-600">"status": "success",</div>
                      <div className="ml-2 text-green-600">"processing_time": "2.3s",</div>
                      <div className="ml-2 text-green-600">"quality_score": 0.98,</div>
                      <div className="ml-2 text-green-600">"download_url": "https://api.schlep-engine.com/download/abc123"</div>
                      <div className="text-[#468BE6] font-medium">{"}"}</div>
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