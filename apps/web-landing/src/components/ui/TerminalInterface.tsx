'use client'

import React, { useState } from 'react'
import { Copy } from 'lucide-react'

export default function TerminalInterface() {
  const [copied, setCopied] = useState(false)

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const apiCall = `curl -X POST https://api.schlep-engine.com/v1/process \\
  -H "Authorization: Bearer your-api-key" \\
  -F "files=@sales_data.csv,@customer_calls.mp3,@logs.json" \\
  -F "mode=realtime_stream" \\
  -F "auto_ml=production_ready"`

  return (
    <div className="w-full max-w-6xl mx-auto">
      <div className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden border border-gray-800">
        {/* Terminal Header */}
        <div className="bg-gray-800 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-gray-300 text-sm ml-4">Terminal</span>
          </div>
          <button
            onClick={() => copyToClipboard(apiCall)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded"
            title="Copy to clipboard"
          >
            <Copy size={16} />
          </button>
        </div>

        {/* Terminal Content */}
        <div className="p-6 bg-gray-900 text-green-400 font-mono text-sm">
          <div className="mb-4">
            <span className="text-blue-400">$</span> <span className="text-white">
              # Process messy data from multiple sources
            </span>
          </div>
          
          <div className="mb-6">
            <pre className="text-gray-300 whitespace-pre-wrap">
{apiCall}
            </pre>
          </div>

          <div className="mb-4">
            <span className="text-green-400">✓ Processing files...</span>
          </div>

          <div className="mb-4">
            <span className="text-gray-400">Response:</span>
          </div>

          <div className="bg-gray-800 p-4 rounded border-l-4 border-blue-500">
            <pre className="text-gray-300 text-xs">
{`{
  "status": "success",
  "processed_files": 3,
  "ml_ready_features": {
    "sales_metrics": ["revenue", "conversion_rate", "customer_segments"],
    "audio_insights": ["sentiment_score", "call_duration", "keywords"],
    "log_analytics": ["error_patterns", "performance_metrics", "user_actions"]
  },
  "output_format": "ml_ready_dataset.json",
  "processing_time": "2.3s"
}`}
            </pre>
          </div>

          <div className="mt-4">
            <span className="text-green-400">✓ Ready for ML training in production</span>
          </div>
        </div>
      </div>
    </div>
  )
}