'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const basicInferenceCode = `<code><span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'http://localhost:8080/v1/infer'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "What is 2+2?"}
    ],
    "max_tokens": 500
  }'</span>

<span style="color: #6b7280;"># Response includes optimization metadata:</span>
{
  "id": "req-trace-123",
  "model": "gpt-4",
  "choices": [{
    "message": {"role": "assistant", "content": "..."},
    "finish_reason": "stop"
  }],
  "metadata": {
    "provider": "benchmark-openai",
    "latency_ms": 1234,
    "cost_usd": 0.003642
  }
}
</code>`

const optimizedCode = `<code><span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'http://localhost:8080/v1/infer'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "model": "gpt-3.5-turbo",
    "messages": [...],
    "policy": {
      "optimize_for": "cost"
    }
  }'</span>

<span style="color: #6b7280;"># Automatically selects cheapest provider/model</span>
<span style="color: #6b7280;"># Thompson Sampling learns over time</span>
</code>`

const adminControlCode = `<code><span style="color: #6b7280;"># Update optimizer mode (hot-reload, no restart)</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'http://localhost:8080/admin/optimizer'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'X-Admin-Token: $ADMIN_TOKEN'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "mode": "rust",
    "sample_rate": 0.25
  }'</span>

<span style="color: #6b7280;"># Response confirms activation</span>
{
  "status": "ok",
  "current_mode": "rust",
  "sample_rate": 0.25
}

<span style="color: #6b7280;"># Check optimizer status anytime</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> GET <span style="color: #4b5563;">'http://localhost:8080/admin/optimizer/status'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'X-Admin-Token: $ADMIN_TOKEN'</span>
</code>`

export default function DeveloperIntegration() {
  const [activeTab, setActiveTab] = useState('basic');

  const getActiveCode = () => {
    switch (activeTab) {
      case 'basic': return basicInferenceCode;
      case 'optimized': return optimizedCode;
      case 'admin': return adminControlCode;
      default: return basicInferenceCode;
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Left Column - Title and Description */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Developer Integration</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  OpenAI-compatible API.<br />Drop-in replacement for existing clients.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  Use standard chat completions endpoints with added optimization controls. Response metadata includes provider, latency, cost, and routing decisions.
                </p>

                <div className="mb-6">
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

              {/* Right Column - Code Examples */}
              <div className="lg:col-span-3">
                <div
                  className="text-left relative z-10 rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: '#f2f1ed',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1)'
                  }}
                >
                  {/* Terminal header */}
                  <div className="flex items-center justify-between px-4 py-2 border-b border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                    <div className="flex items-center space-x-2">
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      </div>
                    </div>
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                      <span className="text-sm text-gray-500 font-medium">API Examples</span>
                    </div>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded"
                      onClick={handleCopyClick}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </button>
                  </div>

                  {/* Tabs */}
                  <div className="flex border-b border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                    <button
                      onClick={() => setActiveTab('basic')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'basic' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Basic Inference
                    </button>
                    <button
                      onClick={() => setActiveTab('optimized')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'optimized' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Cost Optimized
                    </button>
                    <button
                      onClick={() => setActiveTab('admin')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'admin' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Admin Control
                    </button>
                  </div>

                  {/* Code area */}
                  <div className="p-4" style={{ backgroundColor: '#f7f7f3', minHeight: '300px', maxHeight: '400px', overflow: 'auto' }}>
                    <pre
                      className="text-xs md:text-sm leading-relaxed"
                      style={{ color: '#374151' }}
                      dangerouslySetInnerHTML={{
                        __html: getActiveCode()
                      }}
                    />
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
