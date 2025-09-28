'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const pythonCode = `<code><span style="color: #114dcd;">import</span> requests

<span style="color: #6b7280;"># Upload a CSV, extract data</span>
files = {<span style="color: #4b5563;">'file'</span>: <span style="color: #114dcd;">open</span>(<span style="color: #4b5563;">'sales_data.csv'</span>, <span style="color: #4b5563;">'rb'</span>)}
res = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/extract/csv'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  files=files
)

<span style="color: #6b7280;"># Train a model in one call</span>
train = {
  <span style="color: #4b5563;">"features"</span>: <span style="color: #114dcd;">res.json</span>()[<span style="color: #4b5563;">"data"</span>],
  <span style="color: #4b5563;">"target_column"</span>: <span style="color: #4b5563;">"revenue_category"</span>
}
ml = <span style="color: #114dcd;">requests.post</span>(
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline'</span>,
  headers={<span style="color: #4b5563;">'Authorization'</span>: <span style="color: #4b5563;">'Bearer API_KEY'</span>},
  json=train
)

<span style="color: #114dcd;">print</span>(f<span style="color: #4b5563;">"Accuracy: {ml.json()['accuracy']:.2f}"</span>)

<span style="color: #114dcd;"># → Accuracy: 0.89</span>
</code>`

const curlCode = `<code><span style="color: #6b7280;"># Upload CSV and trigger training</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/upload'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-F</span> <span style="color: #4b5563;">'file=@data.csv'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-F</span> <span style="color: #4b5563;">'target=revenue'</span>

<span style="color: #6b7280;"># Get trained model</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> GET <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/models/latest'</span> <span style="color: #dc2626;">\\</span>
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span>

<span style="color: #114dcd;"># → {"model_id": "abc123", "accuracy": 0.89}</span>
</code>`

const streamingCode = `<code><span style="color: #6b7280;">// Real-time data streaming</span>
<span style="color: #114dcd;">const</span> <span style="color: #4b5563;">WebSocket</span> = <span style="color: #114dcd;">require</span>(<span style="color: #4b5563;">'ws'</span>)

<span style="color: #114dcd;">const</span> <span style="color: #4b5563;">ws</span> = <span style="color: #114dcd;">new</span> <span style="color: #4b5563;">WebSocket</span>(<span style="color: #4b5563;">'wss://stream.schlep-engine.com'</span>)

<span style="color: #4b5563;">ws</span>.<span style="color: #4b5563;">on</span>(<span style="color: #4b5563;">'open'</span>, () => {
  <span style="color: #6b7280;">// Stream live data</span>
  <span style="color: #4b5563;">ws</span>.<span style="color: #4b5563;">send</span>(<span style="color: #114dcd;">JSON</span>.<span style="color: #4b5563;">stringify</span>({
    <span style="color: #4b5563;">event</span>: <span style="color: #4b5563;">'data_point'</span>,
    <span style="color: #4b5563;">data</span>: { <span style="color: #4b5563;">price</span>: 1200, <span style="color: #4b5563;">volume</span>: 500 }
  }))
})

<span style="color: #114dcd;">// → Real-time ML predictions</span>
</code>`

const frameworksCode = `<code><span style="color: #6b7280;"># Export to ML frameworks</span>
<span style="color: #114dcd;">from</span> schlep_engine <span style="color: #114dcd;">import</span> SchlepClient

<span style="color: #4b5563;">client</span> = <span style="color: #4b5563;">SchlepClient</span>(<span style="color: #4b5563;">api_key</span>=<span style="color: #4b5563;">"API_KEY"</span>)
<span style="color: #4b5563;">dataset</span> = <span style="color: #4b5563;">client</span>.<span style="color: #4b5563;">get_processed_data</span>(<span style="color: #4b5563;">"dataset_id"</span>)

<span style="color: #6b7280;"># Export to TensorFlow</span>
<span style="color: #4b5563;">tf_dataset</span> = <span style="color: #4b5563;">dataset</span>.<span style="color: #4b5563;">to_tensorflow</span>()

<span style="color: #6b7280;"># Export to PyTorch</span>
<span style="color: #4b5563;">torch_dataset</span> = <span style="color: #4b5563;">dataset</span>.<span style="color: #4b5563;">to_pytorch</span>()

<span style="color: #114dcd;"># → Ready for your ML pipeline</span>
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
      className="relative overflow-visible dark:bg-gray-900 pt-36"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      <div className="relative z-20 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="text-left pt-8">
          <div className="mt-0 mx-auto relative">
            <div className="text-left relative">
              {/* Content Container with Original Width */}
              <div className="w-full">
                <h1
                  style={{ color: '#1f53d0' }}
                  className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
                >
                  Messy Data to ML-ready in API Calls.
                </h1>

                <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-12 max-w-3xl leading-relaxed font-inter">
                  API-first pipeline for speed: messy inputs in, ML-ready outputs out. <br /> Focus on modeling, not data prep.
                </p>

                <div className="flex justify-start gap-4 mb-12">
                  <Link
                    href="http://localhost:3004"
                    style={{ backgroundColor: '#1f53d0' }}
                    className="inline-flex items-center justify-center text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg font-inter"
                  >
                    Get Started
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>

                <div
                  className="text-left relative z-10 rounded-xl overflow-hidden"
                  style={{
                    backgroundColor: '#f2f1ed',
                    border: '1px solid #e5e7eb',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 -10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                >
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


                  <div className="flex min-h-96 max-w-full">
                    {/* Directory/File Explorer */}
                    <div className="w-64 border-r border-gray-300 p-3" style={{ backgroundColor: '#f2f1ed' }}>
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
                      <div className="relative flex items-end" style={{ backgroundColor: '#f2f1ed', paddingLeft: '44px' }}>
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
                      <div className="p-4 pb-32 relative" style={{ backgroundColor: '#f7f7f3', minHeight: '600px', overflow: 'hidden' }}>
                        {/* Full-height vertical border */}
                        <div
                          className="absolute top-0 bottom-0 w-px bg-gray-300"
                          style={{ left: '44px' }}
                        ></div>
                        <div className="flex" style={{ minHeight: '500px' }}>
                          <div
                            className="flex-shrink-0 pr-2 text-right mr-2 w-8 relative"
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
                          <div className="flex-1 overflow-auto pl-6">
                            <pre
                              className="text-sm leading-relaxed whitespace-pre"
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
                    <div className="w-[28rem] border-l border-gray-300 p-3" style={{ backgroundColor: '#f2f1ed' }}>
                      <h3 className="text-sm font-medium text-gray-600 mb-4 text-left">
                        Built for engineers shipping ML at speed.
                      </h3>
                      <p className="text-sm text-gray-600 text-left leading-relaxed mb-6">
                        Most ML projects stall on infrastructure. Schlep-engine removes that bottleneck with simple APIs that take you from messy data to working models—fast.
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