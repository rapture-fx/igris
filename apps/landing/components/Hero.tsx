'use client'

import Link from 'next/link'

export default function Hero() {
  return (
    <section className="pt-24 pb-16 md:pt-32 md:pb-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6 leading-tight">
            Stop Wrestling With{' '}
            <span className="text-[#1A5799]">Messy Data</span>.{' '}
            <br className="hidden sm:block" />
            Start Building AI.
          </h1>

          <p className="text-xl text-gray-600 mb-12 max-w-3xl mx-auto leading-relaxed">
            Schlep-Engine helps you auto-clean messy data, fix quality issues and generate 
            ML-ready datasets with our AI-powered API and integrations.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <Link
              href="#get-started"
              className="bg-[#1A5799] text-white px-8 py-4 rounded-lg hover:bg-[#1e3a8a] transition-colors duration-200 font-medium text-lg inline-flex items-center"
            >
              Get Started for Free
            </Link>
          </div>

          <div className="relative mx-auto max-w-4xl mt-16">
            <div className="bg-gray-900 rounded-lg p-6 shadow-2xl">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-left">
                <div className="text-green-400 font-mono text-sm">
                  <div className="mb-2">$ curl -X POST https://api.schlepengine.com/v1/transform \</div>
                  <div className="mb-2 ml-4">-H "Authorization: Bearer your-api-key" \</div>
                  <div className="mb-2 ml-4">-F "file=@messy_data.csv" \</div>
                  <div className="mb-2 ml-4">-F "format=tensorflow"</div>
                  <div className="mb-4"></div>
                  <div className="text-blue-400">
                    <div>{"{"}</div>
                    <div className="ml-2">"status": "success",</div>
                    <div className="ml-2">"processing_time": "2.3s",</div>
                    <div className="ml-2">"quality_score": 0.98,</div>
                    <div className="ml-2">"download_url": "https://api.schlepengine.com/download/abc123"</div>
                    <div>{"}"}</div>
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