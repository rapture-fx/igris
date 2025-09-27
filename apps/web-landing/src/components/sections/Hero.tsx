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
      className="relative overflow-visible dark:bg-gray-900 pt-36"
      style={{ backgroundColor: '#f7f7f3' }}
    >
      <div className="relative z-20 mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="text-left pt-8 font-ibm-plex-mono">
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
                className="bg-white text-left relative z-10 rounded-lg overflow-hidden"
                style={{
                  border: '1px solid #e5e7eb',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
                }}
              >
              {/* IDE-style header with window controls */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  {/* Window controls */}
                  <div className="flex space-x-2">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                </div>
                <div className="absolute left-1/2 transform -translate-x-1/2">
                  <span className="text-sm text-gray-700 font-mono font-medium">Schlep-engine</span>
                </div>
                <button
                  className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors rounded"
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

              {/* IDE-style tabs */}
              <div className="flex border-b border-gray-200 bg-white">
                <button
                  className={`px-4 py-2 text-sm font-medium border-r border-gray-200 transition-colors ${
                    activeTab === 'python'
                      ? 'bg-white text-gray-900 border-b-2 border-blue-500'
                      : 'bg-gray-50 text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => setActiveTab('python')}
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    <span>main.py</span>
                  </span>
                </button>
                <button
                  className={`px-4 py-2 text-sm font-medium border-r border-gray-200 transition-colors ${
                    activeTab === 'curl'
                      ? 'bg-white text-gray-900 border-b-2 border-blue-500'
                      : 'bg-gray-50 text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                  }`}
                  onClick={() => setActiveTab('curl')}
                >
                  <span className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    <span>terminal</span>
                  </span>
                </button>
              </div>

              <div className="flex min-h-96 max-w-full">
                {/* Directory/File Explorer */}
                <div className="w-64 bg-gray-100 border-r border-gray-200 p-3">
                  <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Explorer</div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 text-sm text-gray-700">
                      <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                      </svg>
                      <span className="font-medium">schlep-engine</span>
                    </div>
                    <div className="ml-6 space-y-1">
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2H4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd"></path>
                        </svg>
                        <span className={activeTab === 'python' ? 'text-blue-600 font-medium' : ''}>main.py</span>
                      </div>
                      <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd"></path>
                        </svg>
                        <span className={activeTab === 'curl' ? 'text-green-600 font-medium' : ''}>api_test.sh</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Code area */}
                <div className="flex-1 bg-gray-900">
                  <div className="p-4 pb-32 flex min-h-96">
                <div
                  className="flex-shrink-0 pr-4 text-right border-r border-gray-700 mr-4"
                  style={{ color: '#6b7280' }}
                >
                  <div
                    className="text-sm font-mono leading-relaxed whitespace-pre select-none"
                    id="line-numbers"
                  >
                    {activeTab === 'python' ? '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30' : '1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n16\n17\n18\n19\n20\n21\n22\n23\n24\n25\n26\n27\n28\n29\n30'}
                  </div>
                </div>
                <pre
                  className="text-sm overflow-x-auto font-mono leading-relaxed text-gray-100 whitespace-pre flex-grow min-w-0"
                  dangerouslySetInnerHTML={{
                    __html: activeTab === 'python' ? pythonCode : curlCode
                  }}
                />
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