'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

const pythonCode = `<code><span style="color: #6b7280;"># From CSV to Model in one call.</span>
<span style="color: #114dcd;">import</span> requests

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

const curlCode = `<code><span style="color: #6b7280;"># From CSV to Model in one call.</span>

<span style="color: #6b7280;"># Upload a CSV, extract data</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST \
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/extract/csv'</span> \
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span> \
  <span style="color: #dc2626;">-F</span> <span style="color: #4b5563;">'file=@sales_data.csv'</span>

<span style="color: #6b7280;"># Train a model in one call</span>
<span style="color: #114dcd;">curl</span> <span style="color: #dc2626;">-X</span> POST \
  <span style="color: #4b5563;">'https://api.schlep-engine.com/api/v1/ml/train/new_pipeline'</span> \
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Authorization: Bearer API_KEY'</span> \
  <span style="color: #dc2626;">-H</span> <span style="color: #4b5563;">'Content-Type: application/json'</span> \
  <span style="color: #dc2626;">-d</span> <span style="color: #4b5563;">'{"features": [extracted_data], "target_column": "revenue_category"}'</span>

<span style="color: #114dcd;"># → {"accuracy": 0.89, "model_id": "rf_abc123"}</span>







</code>`

export default function Hero() {
  const [activeTab, setActiveTab] = useState('python');

  const handleCopyClick = () => {
    const codeToCopy = activeTab === 'python' ? pythonCode : curlCode;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeToCopy.replace(/<[^>]*>/g, ''));
    }
  };

  return (
    <div
      className="relative overflow-visible dark:bg-gray-900 pt-16"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      <div className="relative z-20 mx-auto max-w-[1450px] px-4 sm:px-6 lg:px-8">
        <div className="text-left pt-8 font-ibm-plex-mono">
          <div className="mt-0 max-w-[1450px] mx-auto relative">
            <div className="text-left p-4 relative" style={{
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

              {/* Content Container with Original Width */}
              <div className="max-w-[1300px] mx-auto">

              <h1
                style={{ color: '#1f53d0' }}
                className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter pt-8"
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
                className="bg-white text-left relative z-10"
                style={{
                  border: '1px solid #114dcd',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
              >
              <div className="flex items-center justify-between p-4">
                <div className="flex gap-1">
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded ${activeTab === 'python' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setActiveTab('python')}
                  >
                    Python
                  </button>
                  <button
                    className={`px-3 py-1 text-xs font-medium rounded ${activeTab === 'curl' ? 'text-blue-600 bg-blue-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}
                    onClick={() => setActiveTab('curl')}
                  >
                    cURL
                  </button>
                </div>
                <button
                  className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
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

              <div className="p-4 pb-20 flex min-h-96 max-w-full">
                <div
                  className="flex-shrink-0 pr-4 text-right border-r border-gray-200 mr-4"
                  style={{ color: '#9ca3af' }}
                >
                  <div
                    className="text-sm font-mono leading-relaxed whitespace-pre"
                    id="line-numbers"
                  >
                    {activeTab === 'python' ? '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30' : '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30'}
                  </div>
                </div>
                <pre
                  className="text-sm overflow-x-auto font-mono leading-relaxed text-gray-800 whitespace-pre flex-grow min-w-0"
                  dangerouslySetInnerHTML={{
                    __html: activeTab === 'python' ? pythonCode : curlCode
                  }}
                />
              </div>
              </div>
            </div>
            </div>

            {/* Company Logo Placeholders - Inside the frame */}
            <div className="mt-16 text-center relative p-8" style={{
              borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
              borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
            }}>

              <p className="text-sm mb-8 font-inter" style={{ color: 'black' }}>Plug into your stack instantly.</p>
              <div className="flex justify-center items-center gap-12 flex-wrap">
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="AI/ML Company"
                ></div>
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Manufacturing"
                ></div>
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Financial Services"
                ></div>
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="E-commerce"
                ></div>
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Tech Startup"
                ></div>
                <div
                  className="w-40 h-40 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Research Institution"
                ></div>
              </div>
              <div className="pb-8"></div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}