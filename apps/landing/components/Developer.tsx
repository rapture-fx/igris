'use client'

import { useState } from 'react'
import { Code, Terminal, Zap, Copy, Book, Github } from 'lucide-react'
import Link from 'next/link'

export default function Developer() {
  const [activeTab, setActiveTab] = useState('curl')
  const [copied, setCopied] = useState('')

  const codeExamples = {
    curl: `curl -X POST https://api.schlep-engine.com/v1/transform \\
  -H "Authorization: Bearer sk-proj-abc123..." \\
  -F "file=@data.csv" \\
  -F "format=tensorflow" \\
  -F "transformations=normalize,handle_missing"`,
    python: `import requests

# Initialize the client
url = "https://api.schlep-engine.com/v1/transform"
headers = {"Authorization": "Bearer sk-proj-abc123..."}

# Upload and transform data
with open("data.csv", "rb") as f:
    files = {"file": f}
    data = {
        "format": "tensorflow",
        "transformations": "normalize,handle_missing"
    }
    
response = requests.post(url, headers=headers, files=files, data=data)
result = response.json()

print(f"Quality Score: {result['quality_score']}")
print(f"Download URL: {result['download_url']}")`,
    javascript: `import { SchlepEngine } from '@schlep-engine/sdk';

const client = new SchlepEngine({
  apiKey: 'sk-proj-abc123...'
});

// Transform data
const result = await client.transform({
  file: './data.csv',
  format: 'tensorflow',
  transformations: ['normalize', 'handle_missing']
});

console.log('Quality Score:', result.qualityScore);
console.log('Download URL:', result.downloadUrl);`,
    go: `package main

import (
    "github.com/schlep-engine/go-sdk"
    "fmt"
)

func main() {
    client := schlepengine.New("sk-proj-abc123...")
    
    result, err := client.Transform(&schlepengine.TransformRequest{
        FilePath: "./data.csv",
        Format: "tensorflow",
        Transformations: []string{"normalize", "handle_missing"},
    })
    
    if err != nil {
        panic(err)
    }
    
    fmt.Printf("Quality Score: %.2f\\n", result.QualityScore)
    fmt.Printf("Download URL: %s\\n", result.DownloadURL)
}`
  }

  const copyCode = (language: string) => {
    navigator.clipboard.writeText(codeExamples[language as keyof typeof codeExamples])
    setCopied(language)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <section className="py-20 bg-gray-900 text-white">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold mb-6">
            For <span className="text-[#468BE6]">Developers</span>
          </h2>
          <p className="text-lg text-gray-300 max-w-3xl mx-auto">
            Integrate powerful data processing into your applications with our RESTful API 
            and comprehensive SDKs. Built for scale, designed for simplicity.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start mb-16">
          <div className="space-y-8">
            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/20 p-3 rounded-lg">
                <Terminal className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  RESTful API
                </h3>
                <p className="text-gray-300">
                  Simple HTTP endpoints with comprehensive documentation. Get started in minutes.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/20 p-3 rounded-lg">
                <Code className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  Multiple SDKs
                </h3>
                <p className="text-gray-300">
                  Native libraries for Python, JavaScript, Go, and more. Type-safe and well-documented.
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-4">
              <div className="bg-[#468BE6]/20 p-3 rounded-lg">
                <Zap className="w-6 h-6 text-[#468BE6]" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">
                  High Performance
                </h3>
                <p className="text-gray-300">
                  Process large datasets in seconds. Built on modern infrastructure with auto-scaling.
                </p>
              </div>
            </div>

            <div className="flex space-x-4">
              <Link 
                href="http://localhost:3001" 
                className="bg-[#468BE6] text-white px-6 py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium flex items-center space-x-2"
              >
                <Book className="w-4 h-4" />
                <span>View Docs</span>
              </Link>
              <Link 
                href="/playground" 
                className="border border-[#468BE6] text-[#468BE6] px-6 py-3 rounded-lg hover:bg-[#468BE6] hover:text-white transition-colors font-medium flex items-center space-x-2"
              >
                <Terminal className="w-4 h-4" />
                <span>Try Playground</span>
              </Link>
            </div>
          </div>

          <div className="bg-gray-800 rounded-2xl overflow-hidden border border-gray-700">
            <div className="flex items-center justify-between p-4 bg-gray-800 border-b border-gray-700">
              <div className="flex space-x-2">
                {Object.keys(codeExamples).map((lang) => (
                  <button
                    key={lang}
                    onClick={() => setActiveTab(lang)}
                    className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                      activeTab === lang
                        ? 'bg-[#468BE6] text-white'
                        : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    {lang === 'curl' ? 'cURL' : lang.charAt(0).toUpperCase() + lang.slice(1)}
                  </button>
                ))}
              </div>
              <button
                onClick={() => copyCode(activeTab)}
                className="flex items-center space-x-1.5 bg-gray-700 text-gray-300 px-3 py-1.5 rounded hover:bg-gray-600 transition-colors text-sm"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copied === activeTab ? 'Copied!' : 'Copy'}</span>
              </button>
            </div>
            <div className="p-6">
              <pre className="text-sm text-gray-100 overflow-x-auto">
                <code>{codeExamples[activeTab as keyof typeof codeExamples]}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="bg-[#468BE6]/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Terminal className="w-6 h-6 text-[#468BE6]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Webhook Support</h3>
            <p className="text-gray-300 text-sm">
              Get real-time notifications when processing completes. Perfect for async workflows.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="bg-[#468BE6]/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Zap className="w-6 h-6 text-[#468BE6]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Batch Processing</h3>
            <p className="text-gray-300 text-sm">
              Process multiple files simultaneously with our batch endpoints for maximum efficiency.
            </p>
          </div>

          <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
            <div className="bg-[#468BE6]/20 w-12 h-12 rounded-lg flex items-center justify-center mb-4">
              <Github className="w-6 h-6 text-[#468BE6]" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Open Source SDKs</h3>
            <p className="text-gray-300 text-sm">
              All our SDKs are open source. Contribute, customize, or build your own integrations.
            </p>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#468BE6]/20 to-blue-900/30 rounded-2xl p-8 text-center border border-[#468BE6]/20">
          <h3 className="text-xl font-semibold mb-4">
            Enterprise Features
          </h3>
          <div className="flex flex-wrap justify-center gap-6 mb-6">
            {[
              'Rate Limiting', 
              'Custom Transformations', 
              'Priority Support', 
              'SLA Guarantees',
              'On-Premise Deployment',
              'Custom Integrations'
            ].map((feature) => (
              <div key={feature} className="bg-gray-800/50 px-4 py-2 rounded-lg border border-gray-600">
                <span className="text-sm font-medium">{feature}</span>
              </div>
            ))}
          </div>
          <Link 
            href="/pricing" 
            className="inline-flex items-center space-x-2 bg-[#468BE6] text-white px-6 py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium"
          >
            <span>View Enterprise Plans</span>
          </Link>
        </div>
      </div>
    </section>
  )
}