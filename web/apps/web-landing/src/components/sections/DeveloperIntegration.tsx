'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

const basicInferenceCode = `<code><span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'http://localhost:8080/v1/chat/completions'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer your-api-key'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Explain Thompson Sampling in AI routing"}
    ],
    "max_tokens": 500,
    "temperature": 0.7,
    "stream": false
  }'</span>

<span style="color: #6b7280;"># Response with Schlep-engine optimization metadata:</span>
{
  "id": "chatcmpl-schlep-123",
  "object": "chat.completion",
  "created": 1699014083,
  "model": "gpt-4",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant", 
      "content": "Thompson Sampling is a Bayesian..."
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 12, 
    "completion_tokens": 156, 
    "total_tokens": 168
  },
  <span style="color: #1f53d0;">"metadata": {</span>
    <span style="color: #1f53d0;">"provider": "benchmark-openai",</span>
    <span style="color: #1f53d0;">"latency_ms": 234,</span>
    <span style="color: #1f53d0;">"cost_usd": 0.00134,</span>
    <span style="color: #1f53d0;">"routing_decision": "thompson-sampling",</span>
    <span style="color: #1f53d0;">"trace_id": "550e8400-e29b-41d4-a716-446655440000"</span>
  <span style="color: #1f53d0;">}</span>
}

<span style="color: #6b7280;"># Check provider stats:</span>
<span style="color: #114dcd;">curl</span> <span style="color: #4b5563;">'http://localhost:8080/v1/providers/stats'</span>
</code>`

const optimizedCode = `<code><span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'http://localhost:8080/v1/chat/completions'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'X-Schlep-Optimization: cost'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{
    "model": "auto",
    "messages": [
      {"role": "system", "content": "You are an expert copywriter."},
      {"role": "user", "content": "Write a product description for an AI router"}
    ],
    "max_tokens": 300,
    <span style="color: #1f53d0;">"optimization": {
      "goal": "cost",
      "constraints": {
        "max_latency_ms": 2000,
        "max_cost_per_request": 0.01,
        "min_quality_score": 0.8
      }
    }</span>
  }'</span>

<span style="color: #6b7280;"># Thompson Sampling automatically selects:</span>
<span style="color: #6b7280;"># - Models with best cost/latency tradeoff</span>
<span style="color: #6b7280;"># - Learns from real performance data</span>
<span style="color: #6b7280;"># - Balances exploration vs exploitation</span>
<span style="color: #6b7280;"># - Respects your optimization constraints</span>

<span style="color: #6b7280;"># Response shows routing decision:</span>
{
  <span style="color: #1f53d0;">"metadata": {</span>
    <span style="color: #1f53d0;">"selected_model": "gpt-3.5-turbo",</span>
    <span style="color: #1f53d0;">"selected_provider": "anthropic",</span>
    <span style="color: #1f53d0;">"optimization_score": 0.94,</span>
    <span style="color: #1f53d0;">"cost_saved": 0.0042</span>
  <span style="color: #1f53d0;">}</span>
}
</code>`

const pythonCode = `<code><span style="color: #1f53d0;"># Python client - drop-in OpenAI replacement</span>
<span style="color: #114dcd;">import</span> os
<span style="color: #114dcd;">import</span> openai
<span style="color: #114dcd;">from</span> openai <span style="color: #114dcd;">import</span> OpenAI

<span style="color: #6b7280;"># Configure Schlep-engine client</span>
client = OpenAI(
    api_key=os.environ.get(<span style="color: #4b5563;">"OPENAI_API_KEY"</span>, <span style="color: #4b5563;">"your-api-key"</span>),
    base_url=<span style="color: #4b5563;">"http://localhost:8080/v1"</span>,
    timeout=<span style="color: #114dcd;">30</span>
)

<span style="color: #114dcd;">def</span> generate_text(prompt, optimize_for=<span style="color: #4b5563;">"cost"</span>):
    <span style="color: #114dcd;">try</span>:
        response = client.chat.completions.create(
            model=<span style="color: #4b5563;">"auto"</span>,  <span style="color: #6b7280;"># Let Schlep-engine select best model</span>
            messages=[
                {<span style="color: #4b5563;">"role"</span>: <span style="color: #4b5563;">"user"</span>, <span style="color: #4b5563;">"content"</span>: prompt}
            ],
            max_tokens=<span style="color: #114dcd;">500</span>,
            temperature=<span style="color: #114dcd;">0.7</span>,
            <span style="color: #6b7280;"># Pass optimization preferences to Schlep-engine</span>
            extra_headers={<span style="color: #4b5563;">"X-Schlep-Goal"</span>: optimize_for}
        )
        
        <span style="color: #114dcd;">return</span> {
            <span style="color: #4b5563;">"content"</span>: response.choices[<span style="color: #114dcd;">0</span>].message.content,
            <span style="color: #4b5563;">"provider"</span>: response.model,
            <span style="color: #4b5563;">"tokens"</span>: response.usage.total_tokens,
            <span style="color: #4b5563;">"trace_id"</span>: response.id
        }
        
    <span style="color: #114dcd;">except Exception as e</span>:
        <span style="color: #114dcd;">print</span>(<span style="color: #4b5563;">f"Error: {e}"</span>)
        <span style="color: #114dcd;">return None</span>

<span style="color: #6b7280;"># Example usage with cost optimization</span>
result = generate_text(
    <span style="color: #4b5563;">"Explain how Thompson Sampling optimizes AI routing"</span>,
    optimize_for=<span style="color: #4b5563;">"cost"</span>
)

<span style="color: #114dcd;">if</span> result:
    <span style="color: #114dcd;">print</span>(<span style="color: #4b5563;">"Response:"</span>, result[<span style="color: #4b5563;">"content"</span>])
    <span style="color: #114dcd;">print</span>(<span style="color: #4b5563;">"Used provider:"</span>, result[<span style="color: #4b5563;">"provider"</span>])
</code>`

const javascriptCode = `<code><span style="color: #1f53d0;">// JavaScript/TypeScript - drop-in OpenAI replacement</span>
<span style="color: #114dcd;">import</span> OpenAI <span style="color: #114dcd;">from</span> <span style="color: #4b5563;">'openai'</span>;

<span style="color: #6b7280;">// Configure Schlep-engine client</span>
<span style="color: #114dcd;">const</span> client = <span style="color: #114dcd;">new</span> OpenAI({
  apiKey: process<span style="color: #114dcd;">.env</span>.OPENAI_API_KEY,
  baseURL: <span style="color: #4b5563;">'http://localhost:8080/v1'</span>,  <span style="color: #6b7280;">// Schlep-engine endpoint</span>
  timeout: <span style="color: #114dcd;">30000</span>,
  maxRetries: <span style="color: #114dcd;">2</span>
});

<span style="color: #114dcd;">class</span> SchlepRouter {
  <span style="color: #114dcd;">constructor</span>(client) {
    <span style="color: #114dcd;">this</span>.client = client;
    <span style="color: #114dcd;">this</span>.stats = {
      requests: <span style="color: #114dcd;">0</span>,
      totalCost: <span style="color: #114dcd;">0</span>,
      providers: {}
    };
  }

  <span style="color: #114dcd;">async</span> generateText(prompt, options = {}) {
    <span style="color: #114dcd;">const</span> {
      model = <span style="color: #4b5563;">'auto'</span>,  <span style="color: #6b7280;">// Let Schlep-engine choose best model</span>
      optimizeFor = <span style="color: #4b5563;">'cost'</span>,
      ...openAIOptions
    } = options;

    <span style="color: #114dcd;">try</span> {
      <span style="color: #114dcd;">const</span> completion = <span style="color: #114dcd;">await</span> <span style="color: #114dcd;">this</span>.client.chat.completions.create({
        model,
        messages: [{ role: <span style="color: #4b5563;">'user'</span>, content: prompt }],
        ...openAIOptions,
        <span style="color: #6b7280;">// Send optimization preferences to Schlep-engine</span>
        headers: {
          <span style="color: #4b5563;">'X-Schlep-Goal'</span>: optimizeFor
        }
      });

      <span style="color: #6b7280;">// Update stats with optimization metadata</span>
      <span style="color: #114dcd;">this</span>.stats.requests++;
      <span style="color: #114dcd;">this</span>.stats.totalCost += completion.usage.total_tokens * <span style="color: #114dcd;">0.00002</span>;
      
      <span style="color: #114dcd;">const</span> selectedProvider = completion.model;
      <span style="color: #114dcd;">this</span>.stats.providers[selectedProvider] = 
        (<span style="color: #114dcd;">this</span>.stats.providers[selectedProvider] || <span style="color: #114dcd;">0</span>) + <span style="color: #114dcd;">1</span>;

      <span style="color: #114dcd;">return</span> {
        content: completion.choices[<span style="color: #114dcd;">0</span>].message.content,
        <span style="color: #1f53d0;">provider: selectedProvider</span>,
        <span style="color: #1f53d0;">tokens: completion.usage.total_tokens</span>,
        <span style="color: #1f53d0;">traceId: completion.id</span>,
        <span style="color: #1f53d0;">optimization: completion.metadata?.routing_decision</span>
      };

    } <span style="color: #114dcd;">catch</span> (error) {
      console.<span style="color: #114dcd;">error</span>(<span style="color: #4b5563">'Schlep-engine API Error:'</span>, error);
      <span style="color: #114dcd;">throw</span> error;
    }
  }

  <span style="color: #6b7280;">// Get optimization statistics</span>
  getStats() {
    <span style="color: #114dcd;">return</span> {
      ...<span style="color: #114dcd;">this</span>.stats,
      averageCostPerRequest: <span style="color: #114dcd;">this</span>.stats.totalCost / <span style="color: #114dcd;">this</span>.stats.requests
    };
  }
}

<span style="color: #6b7280;">// Example usage</span>
<span style="color: #114dcd;">const</span> router = <span style="color: #114dcd;">new</span> SchlepRouter(client);

<span style="color: #114dcd;">async</span> <span style="color: #114dcd;">function</span> example() {
  <span style="color: #114dcd;">const</span> result = <span style="color: #114dcd;">await</span> router.generateText(
    <span style="color: #4b5563;">"How does Thompson Sampling work in production?"</span>,
    { optimizeFor: <span style="color: #4b5563;">"cost"</span> }
  );
  
  console.<span style="color: #114dcd;">log</span>(<span style="color: #4b5563;">"Response:"</span>, result.content);
  console.<span style="color: #114dcd;">log</span>(<span style="color: #4b5563;">"Routed via:"</span>, result.provider);
  console.<span style="color: #114dcd;">log</span>(<span style="color: #4b5563;">"Stats:"</span>, router.getStats());
}
</code>`

export default function DeveloperIntegration() {
  const [activeTab, setActiveTab] = useState('basic');

  const getActiveCode = () => {
    switch (activeTab) {
      case 'basic': return basicInferenceCode;
      case 'cost': return optimizedCode;
      case 'python': return pythonCode;
      case 'javascript': return javascriptCode;
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
              {/* Left Column - Code Examples */}
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
                      Basic API
                    </button>
                    <button
                      onClick={() => setActiveTab('cost')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'cost' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Cost Optimization
                    </button>
                    <button
                      onClick={() => setActiveTab('python')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'python' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Python Client
                    </button>
                    <button
                      onClick={() => setActiveTab('javascript')}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        activeTab === 'javascript' ? 'text-gray-900 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      JavaScript/TS
                    </button>
                  </div>

                  {/* Code area */}
                  <div className="p-4" style={{ backgroundColor: '#f7f7f3', height: '450px', overflow: 'auto' }}>
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

              {/* Right Column - Title and Description */}
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
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
