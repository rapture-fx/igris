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
    <section className="pt-64 pb-16 bg-[#111111] min-h-screen flex items-center relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-0 sm:px-0 lg:px-0">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-beige-secondary mb-4 leading-tight">
            Messy data to ML-ready in API calls.
          </h1>

          <p className="text-base md:text-lg text-gray-300 mb-16 max-w-3xl mx-auto leading-relaxed">
            Accelerate your machine learning workflows.<br />
            Schlep-engine simplifies complex data handling through a unified API.
          </p>

          <div className="flex justify-center gap-3">
            <Link
              href="#get-started"
              className="bg-[#1A5799] text-beige-secondary px-5 py-2.5 rounded-xl hover:bg-[#154A85] transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
            >
              Get Started for Free
            </Link>
            <Link
              href="http://localhost:3001"
              className="bg-beige-secondary text-custom-gray px-5 py-2.5 rounded-xl hover:bg-gray-200 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg"
            >
              API Documentation
            </Link>
          </div>
          <img src="/Hero Prop.svg" alt="Hero Prop" className="mx-auto mt-0 w-full h-auto" style={{ maskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)', maskSize: '100% 100%' }} />
        </div>
      </div>
    </section>

    
    </>
  )
}