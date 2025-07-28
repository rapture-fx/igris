'use client'

import Link from 'next/link'
import { Copy } from 'lucide-react'
import { useState } from 'react'

export default function Hero() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    const codeText = `curl -X POST https://api.schlep-engine.com/v1/process \\
  -H "Authorization: Bearer your-api-key" \\
  -F "files=@sales.csv,@support_calls.mp3,@logs.json" \\
  -F "mode=realtime_stream" \\
  -F "auto_ml=production_ready"`
    navigator.clipboard.writeText(codeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
    <section className="pt-20 pb-16 bg-gradient-to-br from-blue-50/50 via-white to-blue-100/40 min-h-screen flex items-center relative overflow-hidden">
      {/* Subtle grid background */}
      <div 
        className="absolute inset-0 opacity-[0.12] -z-10 pointer-events-none"
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

          <div className="flex justify-center gap-3">
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
        </div>
      </div>
    </section>

    {/* Terminal Demo Section */}
    <section className="py-20 bg-gray-50/50">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4">
            See It In Action
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Multi-modal processing with real-time streaming and production-ready ML automation
          </p>
        </div>

        <div className="relative mx-auto max-w-8xl px-6">
          <div className="!bg-white backdrop-blur-sm border border-gray-200 rounded-2xl px-6 py-4 shadow-sm" style={{backgroundColor: 'white !important'}}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="w-2.5 h-2.5 bg-red-400 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-yellow-400 rounded-full"></div>
                <div className="w-2.5 h-2.5 bg-green-400 rounded-full"></div>
                <span className="ml-2 text-xs text-gray-600 font-medium">Terminal</span>
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
                <div className="mb-2"><span className="text-green-600 font-medium">$</span> curl -X POST https://api.schlep-engine.com/v1/process \</div>
                <div className="mb-2 ml-4 text-gray-600">-H "Authorization: Bearer your-api-key" \</div>
                <div className="mb-2 ml-4 text-gray-600">-F "files=@sales.csv,@support_calls.mp3,@logs.json" \</div>
                <div className="mb-2 ml-4 text-gray-600">-F "mode=realtime_stream" \</div>
                <div className="mb-4 ml-4 text-gray-600">-F "auto_ml=production_ready"</div>
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <div className="text-gray-700">
                    <div className="text-gray-800 font-medium">{"{"}</div>
                    <div className="ml-3 text-green-600">"status": "processing_complete",</div>
                    <div className="ml-3 text-cyan-600">"multi_modal_processing": {"{"}</div>
                    <div className="ml-6 text-yellow-600">"audio_transcribed": "47min → 99.2% accuracy",</div>
                    <div className="ml-6 text-yellow-600">"sentiment_analysis": "Real-time across 3 languages",</div>
                    <div className="ml-6 text-yellow-600">"cross_correlation": "CSV↔Audio↔JSON unified"</div>
                    <div className="ml-3 text-cyan-600">{"}"},</div>
                    <div className="ml-3 text-purple-600">"realtime_stream": {"{"}</div>
                    <div className="ml-6 text-orange-600">"throughput": "2.4M events/sec",</div>
                    <div className="ml-6 text-orange-600">"latency_p99": "8ms",</div>
                    <div className="ml-6 text-orange-600">"auto_scaling": "5→89 nodes (elastic)"</div>
                    <div className="ml-3 text-purple-600">{"}"},</div>
                    <div className="ml-3 text-blue-600">"ml_pipeline_generated": {"{"}</div>
                    <div className="ml-6 text-pink-600">"features_engineered": 1247,</div>
                    <div className="ml-6 text-pink-600">"model_architecture": "Custom transformer (auto-optimized)",</div>
                    <div className="ml-6 text-pink-600">"k8s_deployment": "manifests + CI/CD ready"</div>
                    <div className="ml-3 text-blue-600">{"}"},</div>
                    <div className="ml-3 text-red-600">"revenue_impact": "$8.7M identified via voice-pattern analysis",</div>
                    <div className="ml-3 text-green-600">"download_url": "https://api.schlep-engine.com/download/x9k2m"</div>
                    <div className="text-gray-800 font-medium">{"}"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
    </>
  )
}