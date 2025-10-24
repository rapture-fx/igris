'use client'

import React, { useState } from 'react'
import { Code, Package, Zap, CheckCircle, ArrowUpRight, Copy } from 'lucide-react'
import Link from 'next/link'

const basicInferenceCode = `curl -X POST 'http://localhost:8080/v1/chat/completions' \\
  -H 'Content-Type: application/json' \\
  -H 'Authorization: Bearer your-api-key' \\
  -d '{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain Thompson Sampling in AI routing"}
    ],
    "max_tokens": 500,
    "temperature": 0.7,
    "stream": false
  }'

# Response with comprehensive Schlep-engine metadata:
{
  "id": "chatcmpl-schlep-550e8400e29b",
  "object": "chat.completion",
  "created": 1699014083,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant", 
      "content": "Thompson Sampling is a Bayesian approach..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12, 
    "completion_tokens": 156, 
    "total_tokens": 168
  },
  "metadata": {
    "provider": "openai",
    "region": "us-west-2", 
    "model_used": "gpt-4",
    "route_decision": "Rust Thompson Sampling: action-123",
    "latency_ms": 1567,
    "queue_time_ms": 34,
    "inference_time_ms": 1533,
    "ttft_ms": 234,
    "cost_usd": 0.01038,
    "quality_score": 0.85,
    "cache_hit": false,
    "cache_key": "",
    "optimizer_action": "thompson_sampling",
    "reward_signal": 0.0,
    "exploration_bonus": 0.15,
    "request_id": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2024-10-24T12:34:43Z",
    "retry_count": 0,
    "fallback": false,
    "fallback_reason": ""
  }
}

# Available models include:
# OpenAI: gpt-4, gpt-4-turbo, gpt-4-turbo-preview, gpt-3.5-turbo, gpt-3.5-turbo-16k
# Anthropic: claude-3-opus, claude-3-opus-20240229, claude-3-sonnet, claude-3-sonnet-20240229, claude-3-haiku, claude-3-haiku-20240307
# Each model has optimized cost estimation and latency profiles`;

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
                  Idiomatic client libraries for every major language. Type-safe, well-documented, and production-ready.
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
                        <div className="px-2 py-1.5 rounded-lg border border-gray-200" style={{ backgroundColor: '#f7f7f3', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)' }}>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center flex-shrink-0">
                              <img src={sdk.logo} alt={sdk.name} className={`object-contain ${sdk.size}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-gray-700 leading-tight font-mono break-words"><code className="text-xs font-mono" style={{ color: '#114dcd' }}>{sdk.install}</code></p>
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
                  OpenAI-compatible API.<br />Drop-in replacement for existing clients.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  Use standard chat completions endpoints with added optimization controls. Response metadata includes provider, latency, cost, and routing decisions.
                </p>

                {/* API Code Example */}
                <div
                  className="text-left relative z-10 overflow-hidden mb-6 shadow-lg"
                  style={{
                    width: '100%',
                    backgroundColor: '#f7f7f3',
                    border: '1px solid #299a93'
                  }}
                >
                  <div 
                    className="p-4 overflow-auto hide-scrollbar" 
                    style={{ 
                      height: '400px',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                      '&::-webkit-scrollbar': { display: 'none' }
                    }}
                  >
                    <pre
                      className="text-xs leading-relaxed"
                    >
                      {basicInferenceCode}
                    </pre>
                  </div>
                </div>

                {/* API Documentation Link */}
                <div className="mt-20">
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
