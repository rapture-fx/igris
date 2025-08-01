'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Copy } from 'lucide-react'
import HeroGridBackground from '../ui/HeroGridBackground'

export default function Hero() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = () => {
    const codeText = `curl -X POST https://api.schlep-engine.com/v1/process \
  -H "Authorization: Bearer your-api-key" \
  -F "files=@sales.csv,@support_calls.mp3,@logs.json" \
  -F "mode=realtime_stream" \
  -F "auto_ml=production_ready"`
    navigator.clipboard.writeText(codeText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <section className="relative min-h-screen overflow-hidden bg-[#111111] pt-60 pb-16">
      {/* Layer 1: Background Grid */}
      <div className="absolute inset-0 z-0">
        <HeroGridBackground />
      </div>

      {/* Layer 2: SVG Image */}
      <div className="absolute bottom-0 left-0 w-full z-10 pointer-events-none">
        <img
          src="/Hero Prop.svg"
          alt="Hero Prop"
          className="h-auto w-full"
          style={{
            maskImage: 'linear-gradient(to right, transparent, black 20%, black 80%, transparent)',
            maskSize: '100% 100%',
          }}
        />
      </div>

      {/* Layer 3: Content */}
      <div className="relative z-20 mx-auto max-w-7xl px-0 sm:px-0 lg:px-0">
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-semibold text-beige-secondary mb-2 leading-tight py-8">
            Messy data to ML-ready in API calls.
          </h1>
          <p className="text-base md:text-lg text-gray-300 mb-8 max-w-3xl mx-auto leading-relaxed">
            Accelerate your machine learning workflows.<br />
            Schlep-engine simplifies complex data handling through a unified API.
          </p>
          <div className="flex justify-center gap-3">
            <Link
              href="/dashboard"
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
        </div>
      </div>
    </section>
  )
}