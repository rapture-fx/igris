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
      className="relative min-h-screen overflow-visible dark:bg-gray-900 pt-16 pb-16"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      <div className="relative z-20 mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="text-left pt-40 font-ibm-plex-mono">
          <h1
            style={{ color: '#1f53d0' }}
            className="text-2xl md:text-3xl font-normal text-gray-900 dark:text-white mb-8 leading-tight font-inter"
          >
            Messy Data to ML-ready in API Calls.
          </h1>

          <p className="text-base md:text-lg text-gray-700 dark:text-gray-200 mb-12 max-w-3xl leading-relaxed font-inter">
            API-first pipeline for speed: messy inputs in, ML-ready outputs out. <br /> Focus on modeling, not data prep.
          </p>

          <div className="flex justify-start gap-4">
            <Link
              href="http://localhost:3004"
              className="inline-flex items-center justify-center text-gray-700 px-5 py-2.5 rounded-lg hover:bg-gray-50 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg bg-white dark:text-gray-300 dark:hover:bg-gray-800 font-inter border border-gray-200 dark:border-gray-700"
            >
              Get Started &gt;
            </Link>
          </div>

          <div className="mt-24 max-w-[1300px] mx-auto relative">

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

              <div className="p-4 flex min-h-96 max-w-full">
                <div
                  className="flex-shrink-0 pr-4 text-right border-r border-gray-200 mr-4"
                  style={{ color: '#9ca3af' }}
                >
                  <div
                    className="text-sm font-mono leading-relaxed whitespace-pre"
                    id="line-numbers"
                  >
                    {activeTab === 'python' ? '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25' : '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25'}
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

            {/* Company Logo Placeholders */}
            <div className="mt-16 text-center">
              <p className="text-sm text-gray-500 mb-6 font-inter">Trusted by data engineers, scientists, and AI researchers at</p>
              <div className="flex justify-center items-center gap-8 flex-wrap">
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="AI/ML Company"
                ></div>
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Manufacturing"
                ></div>
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Financial Services"
                ></div>
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="E-commerce"
                ></div>
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Tech Startup"
                ></div>
                <div
                  className="w-16 h-16 rounded"
                  style={{ backgroundColor: '#edece9' }}
                  title="Research Institution"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}