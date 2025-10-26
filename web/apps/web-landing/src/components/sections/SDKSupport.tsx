'use client'

import React, { useState } from 'react'
import { Code, Package, Zap, CheckCircle, ArrowUpRight, Copy } from 'lucide-react'
import Link from 'next/link'

const basicInferenceCode = `curl -X POST "https://api.schlep.engine/v1/chat/completions" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "What is machine learning?"}
    ],
    "temperature": 0.7,
    "max_tokens": 500
  }'

{
  "id": "chatcmpl-abc123",
  "object": "chat.completion",
  "created": 1729347296,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Machine learning is a subset of artificial intelligence..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  },
  "metadata": {
    "provider": "openai",
    "latency_ms": 234,
    "cost_usd": 0.00171,
    "route_decision": "thompson-sampling",
    "trace_id": "550e8400-e29b-41d4-a716-446655440000"
  }
}`;

const pythonCode = `# Python SDK Example
from schlep_engine import SchlepEngine

client = SchlepEngine(api_key="your-api-key")

response = client.chat.completions.create(
    model="gpt-4",
    messages=[
        {"role": "user", "content": "Hello!"}
    ],
    policy={
        "optimize_for": "cost",
        "fallback_enabled": true
    }
)

# Response includes routing metadata
print("Cost: $" + str(response.metadata.cost_usd))
print("Provider: " + response.metadata.provider)
print("Latency: " + str(response.metadata.latency_ms) + "ms")`;

const sdks = [
  { name: 'Python', logo: '/PYthon.svg' },
  { name: 'JavaScript', logo: '/NODE.svg' },
  { name: 'Rust', logo: '/RUST.svg' },
  { name: 'Go', logo: '/GO.svg' },
];

export default function SDKSupport() {
  const [activeTab, setActiveTab] = useState('sdk');

  const getActiveCode = () => {
    switch (activeTab) {
      case 'sdk': return pythonCode;
      case 'api': return basicInferenceCode;
      default: return pythonCode;
    }
  };

  const handleCopyClick = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getActiveCode().replace(/<[^>]*>/g, ''));
    }
  };

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-12 items-start relative">
              {/* Left Column - Title, SDKs, and Code Example */}
              <div className="text-left lg:col-span-1 px-4 lg:px-8">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Client Libraries & SDKs</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Native SDKs for your stack
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-8">
                  Idiomatic SDKs for every major language — type-safe, async-native, and built for real-time inference.
                  Each client includes built-in routing metadata, latency tracking, and tenant isolation.
                </p>

                {/* SDK Logos and Installations */}
                <div className="space-y-3 max-w-md mb-8 relative">
                  {[
                    { name: 'Python', logo: '/PYthon.svg', install: 'pip install schlep-engine', size: 'w-12 h-12' },
                    { name: 'Node.js', logo: '/NODE.svg', install: 'npm install schlep-engine', size: 'w-12 h-12' },
                    { name: 'Rust', logo: '/RUST.svg', install: 'cargo add schlep-engine', size: 'w-12 h-12' },
                    { name: 'Go', logo: '/GO.svg', install: 'go get schlep-engine/go', size: 'w-14 h-14' }
                  ].map((sdk) => (
                    <div key={sdk.name} className="flex items-start gap-3">
                      {/* Logo inside the card */}
                      <div className="flex-1 min-w-0">
                        <div className="px-2 py-1.5 border" style={{ backgroundColor: '#f7f7f3', borderColor: '#299a93', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center flex-shrink-0">
                              <img src={sdk.logo} alt={sdk.name} className={`object-contain ${sdk.size}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-black leading-tight font-mono break-words"><code className="text-xs font-mono" style={{ color: 'black' }}>{sdk.install}</code></p>
                            </div>
                            <button
                              className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded"
                              onClick={() => {
                                if (navigator.clipboard) {
                                  navigator.clipboard.writeText(sdk.install);
                                }
                              }}
                            >
                              <Copy className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Column - REST API Section */}
              <div className="text-left lg:col-span-1 px-4 lg:px-8">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">REST API</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Unified Inference API.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  A single API for every model, provider, and route. Schlep-engine abstracts provider differences and returns detailed metadata — including latency, cost, and routing decisions.
                </p>

                {/* API Code Example */}
                <div
                  className="text-left relative z-10 overflow-hidden mb-4 shadow-lg"
                  style={{
                    width: '90%',
                    backgroundColor: '#f7f7f3',
                    border: '1px solid #299a93'
                  }}
                >
                  <div 
                    className="p-5 overflow-auto hide-scrollbar" 
                    style={{ 
                      height: '400px',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      '&::-webkit-scrollbar': { display: 'none' }
                    }}
                  >
                    <pre
                      className="text-xs leading-relaxed"
                      style={{ 
                        color: '#1a1a1a',
                        whiteSpace: 'pre',
                        fontFamily: 'monospace'
                      }}
                    >
                      {basicInferenceCode}
                    </pre>
                  </div>
                </div>

                {/* API Documentation Link */}
                <div className="mt-6">
                  <Link
                    href="/docs/api"
                    className="inline-flex items-center text-sm transition-all duration-200 font-medium font-inter hover:underline"
                    style={{ color: '#1f53d0' }}
                  >
                    View API Documentation
                    <ArrowUpRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </div>
            {/* Vertical divider line in the middle */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-gray-300 opacity-30 transform -translate-x-1/2 hidden lg:block"></div>
          </div>
        </div>
      </div>
    </section>
  )
}
