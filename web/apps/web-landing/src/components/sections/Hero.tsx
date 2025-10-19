'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const pythonCode = `<code><span style="color: #114dcd;">import</span> asyncio
<span style="color: #6b7280;">from</span> schlep_engine <span style="color: #114dcd;">import</span> InferenceClient

<span style="color: #6b7280;"># Connect to inference optimization fabric</span>
client = <span style="color: #114dcd;">InferenceClient</span>(
    <span style="color: #4b5563;">'wss://fabric.schlep-engine.com'</span>,
    api_key=<span style="color: #4b5563;">'INFERENCE_KEY'</span>
)

<span style="color: #6b7280;"># Deploy model with automatic optimization</span>
<span style="color: #114dcd;">await</span> client.<span style="color: #4b5563;">deploy_model</span>(
    model_path=<span style="color: #4b5563;">'resnet50.pt'</span>,
    optimization=<span style="color: #6b7280;">'cost'</span>,  <span style="color: #6b7280;"># or 'latency' or 'throughput'</span>
    replicas=<span style="color: #114dcd;">3</span>
)

<span style="color: #6b7280;"># Real-time inference with routing</span>
prediction = <span style="color: #114dcd;">await</span> client.<span style="color: #4b5563;">predict</span>(
    input_data=image_tensor,
    model=<span style="color: #4b5563;">'resnet50_v2'</span>
)

<span style="color: #114dcd;">print</span>(<span style="color: #4b5563;">f"Class: {prediction.class}, Confidence: {prediction.confidence}"</span>)
<span style="color: #114dcd;">print</span>(<span style="color: #4b5563;">f"Latency: {prediction.latency}ms, Cost: $" + str(prediction.cost)</span>)

<span style="color: #114dcd;"># → Class: "golden_retriever", Confidence: 0.94, Latency: 8ms, Cost: $0.0004</span>
</code>`

const curlCode = `<code><span style="color: #6b7280;"># Deploy model to inference fabric</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'https://fabric.schlep-engine.com/v1/models/deploy'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer INFERENCE_KEY'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{"model_path": "resnet50.pt", "optimization": "cost"}'</span>

<span style="color: #6b7280;"># Run optimized inference</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'https://fabric.schlep-engine.com/v1/predict'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer INFERENCE_KEY'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{"input": [0.1, 0.2, 0.3], "model": "resnet50_v2"}'</span>

<span style="color: #114dcd;"># → {"class": "cat", "confidence": 0.89, "latency_ms": 8, "cost_usd": 0.0004}</span>
</code>`

const streamingCode = `<code><span style="color: #6b7280;">// Real-time inference orchestration</span>
<span style="color: #114dcd;">const</span> ws = <span style="color: #114dcd;">new</span> <span style="color: #4b5563;">WebSocket</span>(<span style="color: #4b5563;">'wss://fabric.schlep-engine.com/orchestrator'</span>)

<span style="color: #4b5563;">ws</span>.<span style="color: #4b5563;">on</span>(<span style="color: #4b5563;">'open'</span>, () => {
  <span style="color: #6b7280;">// Subscribe to optimization events</span>
  <span style="color: #4b5563;">ws</span>.<span style="color: #4b5563;">send</span>(<span style="color: #114dcd;">JSON</span>.<span style="color: #4b5563;">stringify</span>({
    <span style="color: #4b5563;">type</span>: <span style="color: #6b7280;">'subscribe'</span>,
    <span style="color: #4b5563;">events</span>: [<span style="color: #4b5563;">'model_routing'</span>, <span style="color: #4b5563;">'cost_alerts'</span>, <span style="color: #4b5563;">'scaling'</span>]
  }))
})

<span style="color: #4b5563;">ws</span>.<span style="color: #4b5563;">on</span>(<span style="color: #4b5563;">'message'</span>, (event) => {
  <span style="color: #114dcd;">const</span> data = <span style="color: #114dcd;">JSON</span>.<span style="color: #4b5563;">parse</span>(event.data)

  <span style="color: #114dcd;">switch</span> (data.<span style="color: #4b5563;">type</span>) {
    <span style="color: #114dcd;">case</span> <span style="color: #4b5563;">'model_routing'</span>:
      <span style="color: #114dcd;">console</span>.<span style="color: #4b5563;">log</span>(<span style="color: #4b5563;">'Routed ' + data.total_requests + ' to ' + data.optimal_model</span>)
      <span style="color: #114dcd;">break</span>
    <span style="color: #114dcd;">case</span> <span style="color: #4b5563;">'cost_alert'</span>:
      <span style="color: #114dcd;">console</span>.<span style="color: #4b5563;">log</span>(<span style="color: #4b5563;">'Cost spike: ' + data.increase + '% - auto-scaling triggered'</span>)
      <span style="color: #114dcd;">break</span>
  }
})

<span style="color: #114dcd;">// → Live: "Routed 15,432 requests to resnet50_v2 (94% cache hit)"</span>
</code>`

const frameworksCode = `<code><span style="color: #6b7280;"># SDK Integration for popular frameworks</span>
<span style="color: #114dcd;">from</span> schlep_engine <span style="color: #114dcd;">import</span> FabricSDK

<span style="color: #6b7280;"># Initialize with your inference fabric</span>
fabric = FabricSDK(
    endpoint=<span style="color: #4b5563;">"wss://fabric.schlep-engine.com"</span>,
    api_key=<span style="color: #4b5563;">"FABRIC_KEY"</span>
)

<span style="color: #6b7280;"># Wrap PyTorch model for automatic optimization</span>
<span style="color: #114dcd;">import</span> torch
model = torch.<span style="color: #4b5563;">load</span>(<span style="color: #4b5563;">"resnet50.pt"</span>)
optimized_model = fabric.<span style="color: #4b5563;">optimize</span>(model, target=<span style="color: #4b5563;">"cost_efficient"</span>)

<span style="color: #6b7280;"># Deploy with one line - handles routing, scaling, monitoring</span>
service = fabric.<span style="color: #4b5563;">deploy</span>(
    model=optimized_model,
    name=<span style="color: #4b5563;">"image_classifier_v2"</span>,
    autoscaling=<span style="color: #114dcd;">True</span>
)

<span style="color: #114dcd;"># → Running on fabric with 99.9% uptime, 8ms latency, $0.0004 per request</span>
</code>`

export default function Hero() {
  const [activeTab, setActiveTab] = useState('python');

  const getActiveCode = () => {
    switch (activeTab) {
      case 'python': return pythonCode;
      case 'curl': return curlCode;
      case 'streaming': return streamingCode;
      case 'frameworks': return frameworksCode;
      default: return pythonCode;
    }
  };

  const handleCopyClick = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(getActiveCode().replace(/<[^>]*>/g, ''));
    }
  };

  return (
    <div
      className="relative overflow-visible dark:bg-gray-900 pt-16"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      <div className="relative z-20 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="text-left pt-8">
          <div className="mt-0 mx-auto relative">
            <div className="text-left relative">
              {/* Content Container with Updated Width */}
              <div className="w-full max-w-full overflow-hidden">
                <h1
                  style={{ color: '#1f53d0' }}
                  className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
                >
                  The Routing Engine and Control Plane for AI Inference
                </h1>

                <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-12 max-w-3xl leading-relaxed font-inter">
                  Schlep-engine optimize and orchestrate LLM requests across providers with routing intelligence, shadow testing, and rollback safety.
                </p>

                <div className="flex justify-start gap-4 mb-12">
                  <Link
                    href="/auth/register"
                    style={{ backgroundColor: '#1f53d0' }}
                    className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  >
                    Start Optimizing
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                  <Link
                    href="https://github.com/schlep-engine"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ backgroundColor: '#24292e' }}
                    className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-lg hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  >
                    GitHub
                  </Link>
                </div>

                <div className="relative z-10 rounded-xl overflow-hidden" style={{ backgroundColor: '#f7f7f3', minHeight: '600px', padding: '40px' }}>
                  {/* IDE-style header with window controls */}
                  <div className="flex items-center justify-between px-4 py-1 border-b border-gray-300" style={{ backgroundColor: '#f2f1ed' }}>
                    <div className="flex items-center space-x-2">
                      {/* Window controls */}
                      <div className="flex space-x-2">
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                        <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                      </div>
                    </div>
                    <div className="absolute left-1/2 transform -translate-x-1/2">
                      <span className="text-sm text-gray-500 font-medium">Schlep-engine</span>
                    </div>
                    <button
                      className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors rounded"
                      onClick={handleCopyClick}
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                        />
                      </svg>
                    </button>
                  </div>


                  <div className="flex flex-col lg:flex-row min-h-96 w-full">
                    {/* Directory/File Explorer */}
                    <div className="w-full md:w-64 border-r border-gray-300 p-3 md:block hidden" style={{ backgroundColor: '#f2f1ed' }}>

                      {/* Mobile File Tabs */}
                      <div className="md:hidden mb-4">
                        <div className="flex space-x-2 overflow-x-auto pb-2 whitespace-nowrap">
                          <button
                            onClick={() => setActiveTab('python')}
                            className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                              activeTab === 'python'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Python
                          </button>
                          <button
                            onClick={() => setActiveTab('curl')}
                            className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                              activeTab === 'curl'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            cURL
                          </button>
                          <button
                            onClick={() => setActiveTab('streaming')}
                            className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                              activeTab === 'streaming'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Streaming
                          </button>
                          <button
                            onClick={() => setActiveTab('frameworks')}
                            className={`px-3 py-1 text-xs rounded whitespace-nowrap ${
                              activeTab === 'frameworks'
                                ? 'bg-gray-800 text-white'
                                : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            Frameworks
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                          </svg>
                          <span className="font-medium text-gray-500">schlep-engine</span>
                        </div>

                        {/* src folder */}
                        <div className="ml-6 space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                            </svg>
                            <span className="font-medium text-gray-500">src/</span>
                          </div>

                          {/* Source files */}
                          <div className="ml-6 space-y-1">
                            <div
                              className="flex items-center space-x-2 text-sm hover:text-gray-700 cursor-pointer"
                              onClick={() => setActiveTab('python')}
                            >
                              <img src="/PYthon.svg" alt="Python" className="w-4 h-4" />
                              <span className={activeTab === 'python' ? 'text-gray-900 font-medium' : 'text-gray-500'}>main.py</span>
                            </div>
                            <div
                              className="flex items-center space-x-2 text-sm hover:text-gray-700 cursor-pointer"
                              onClick={() => setActiveTab('frameworks')}
                            >
                              <img src="/PYthon.svg" alt="Python" className="w-4 h-4" />
                              <span className={activeTab === 'frameworks' ? 'text-gray-900 font-medium' : 'text-gray-500'}>ml_frameworks.py</span>
                            </div>
                            <div
                              className="flex items-center space-x-2 text-sm hover:text-gray-700 cursor-pointer"
                              onClick={() => setActiveTab('streaming')}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
                              </svg>
                              <span className={activeTab === 'streaming' ? 'text-gray-900 font-medium' : 'text-gray-500'}>stream_client.js</span>
                            </div>
                          </div>
                        </div>

                        {/* scripts folder */}
                        <div className="ml-6 space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                            </svg>
                            <span className="font-medium text-gray-500">scripts/</span>
                          </div>

                          <div className="ml-6 space-y-1">
                            <div
                              className="flex items-center space-x-2 text-sm hover:text-gray-700 cursor-pointer"
                              onClick={() => setActiveTab('curl')}
                            >
                              <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
                              </svg>
                              <span className={activeTab === 'curl' ? 'text-gray-900 font-medium' : 'text-gray-500'}>request.sh</span>
                            </div>
                          </div>
                        </div>

                        {/* Config files */}
                        <div className="ml-6 space-y-1">
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                            </svg>
                            <span className="text-gray-500">requirements.txt</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                            </svg>
                            <span className="text-gray-500">package.json</span>
                          </div>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path>
                            </svg>
                            <span className="text-gray-500">README.md</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Code area with tabs */}
                    <div className="flex-1" style={{ backgroundColor: '#f2f1ed' }}>
                      {/* Tabs above code */}
                      <div className="relative flex items-end hidden md:flex" style={{ backgroundColor: '#f2f1ed', paddingLeft: '44px' }}>
                        {/* Line numbers area background */}
                        <div className="absolute top-0 bottom-0" style={{ left: 0, width: '44px', backgroundColor: '#f7f7f3' }}></div>
                        {/* Vertical border extension */}
                        <div
                          className="absolute top-0 bottom-0 w-px bg-gray-300"
                          style={{ left: '44px', zIndex: 1 }}
                        ></div>
                        {/* Horizontal divider line */}
                        <div className="absolute bottom-0 h-px bg-gray-300" style={{ left: '44px', right: 0, zIndex: 1 }}></div>

                        <button
                          className={`flex items-center justify-between px-3 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                            activeTab === 'python'
                              ? 'text-gray-900'
                              : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: activeTab === 'python' ? '#f7f7f3' : 'transparent',
                            border: activeTab === 'python' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                            borderBottom: activeTab === 'python' ? 'none' : '1px solid #e5e7eb',
                            borderRadius: '4px 4px 0 0',
                            minWidth: '100px',
                            zIndex: 2
                          }}
                          onClick={() => setActiveTab('python')}
                        >
                          <span>Python</span>
                          <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                          </svg>
                        </button>
                        <button
                          className={`flex items-center justify-between px-3 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                            activeTab === 'frameworks'
                              ? 'text-gray-900'
                              : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: activeTab === 'frameworks' ? '#f7f7f3' : 'transparent',
                            border: activeTab === 'frameworks' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                            borderBottom: activeTab === 'frameworks' ? 'none' : '1px solid #e5e7eb',
                            borderRadius: '4px 4px 0 0',
                            minWidth: '100px',
                            zIndex: 2
                          }}
                          onClick={() => setActiveTab('frameworks')}
                        >
                          <span>Frameworks</span>
                          <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                          </svg>
                        </button>
                        <button
                          className={`flex items-center justify-between px-3 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                            activeTab === 'curl'
                              ? 'text-gray-900'
                              : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: activeTab === 'curl' ? '#f7f7f3' : 'transparent',
                            border: activeTab === 'curl' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                            borderBottom: activeTab === 'curl' ? 'none' : '1px solid #e5e7eb',
                            borderRadius: '4px 4px 0 0',
                            minWidth: '100px',
                            zIndex: 2
                          }}
                          onClick={() => setActiveTab('curl')}
                        >
                          <span>cURL</span>
                          <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                          </svg>
                        </button>
                        <button
                          className={`flex items-center justify-between px-3 py-1.5 text-sm transition-all duration-200 relative focus:outline-none ${
                            activeTab === 'streaming'
                              ? 'text-gray-900'
                              : 'text-gray-600 hover:text-gray-700 hover:bg-gray-100'
                          }`}
                          style={{
                            backgroundColor: activeTab === 'streaming' ? '#f7f7f3' : 'transparent',
                            border: activeTab === 'streaming' ? '1px solid #e5e7eb' : '1px solid #e5e7eb',
                            borderBottom: activeTab === 'streaming' ? 'none' : '1px solid #e5e7eb',
                            borderRadius: '4px 4px 0 0',
                            minWidth: '100px',
                            zIndex: 2
                          }}
                          onClick={() => setActiveTab('streaming')}
                        >
                          <span>Streaming</span>
                          <svg className="w-3 h-3 text-gray-400 hover:text-gray-600 ml-2" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"></path>
                          </svg>
                        </button>
                      </div>

                      {/* Code content */}
                      <div className="p-4 pb-8 lg:pb-32 relative" style={{ backgroundColor: '#f7f7f3', minHeight: '400px', maxHeight: '600px', overflow: 'auto' }}>
                        {/* Full-height vertical border */}
                        <div
                          className="absolute top-0 bottom-0 w-px bg-gray-300"
                          style={{ left: '44px' }}
                        ></div>
                        <div className="flex md:flex-row flex-col" style={{ minHeight: '500px' }}>
                          <div
                            className="flex-shrink-0 pr-2 text-right mr-2 w-8 relative md:block hidden"
                            style={{ color: '#6b7280' }}
                          >
                            <div
                              className="text-sm leading-relaxed whitespace-pre select-none"
                              id="line-numbers"
                            >
                              {(() => {
                                const lines = getActiveCode().split('\n').length;
                                return Array.from({ length: lines }, (_, i) => i + 1).join('\n');
                              })()}
                            </div>
                          </div>
                          <div className="flex-1 overflow-auto pl-6 md:pl-6 pl-0">
                            <pre
                              className="text-xs md:text-sm leading-relaxed whitespace-pre break-all md:whitespace-pre"
                              style={{ color: '#374151' }}
                              dangerouslySetInnerHTML={{
                                __html: getActiveCode()
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right sidebar */}
                    <div className="w-full lg:w-80 xl:w-[28rem] border-l border-gray-300 p-3 hidden lg:block" style={{ backgroundColor: '#f2f1ed' }}>
                      <h3 className="text-sm font-medium text-gray-600 mb-4 text-left">
                        Built for MLOps engineers managing model deployments.
                      </h3>
                      <p className="text-sm text-gray-600 text-left leading-relaxed mb-6">
                        Optimize ML inference routing and reduce infrastructure overhead. We handle the complex orchestration so you can focus on model performance and accuracy.
                      </p>

                      {/* Cards */}
                      <div className="space-y-3">
                        <div className="border border-gray-200 rounded-lg p-4" style={{ backgroundColor: '#f7f7f3' }}>
                          <h4 className="text-sm font-medium text-gray-600 mb-2">API-First Architecture</h4>
                          <p className="text-xs text-gray-600">REST APIs for data and ML workflows. Upload CSVs, train models, and get predictions with simple HTTP calls.</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4" style={{ backgroundColor: '#f7f7f3' }}>
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Developer Experience</h4>
                          <p className="text-xs text-gray-600">APIs that hide the heavy lifting. Focus on your data and logic, not infrastructure setup or maintenance.</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4" style={{ backgroundColor: '#f7f7f3' }}>
                          <h4 className="text-sm font-medium text-gray-600 mb-2">Data to Model Pipeline</h4>
                          <p className="text-xs text-gray-600">From messy CSVs to trained models. Automate processing and training through API calls—no complex pipeline setup required.</p>
                        </div>
                      </div>

                      {/* Explore link */}
                      <div className="mt-6">
                        <div className="flex items-center text-sm cursor-pointer" style={{ color: '#1f53d0' }}>
                          <span>Explore Schlep-engine</span>
                          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
