'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Code, MousePointerClick, Terminal, Zap, Book, Github, Upload, Download, MousePointer, Copy, ArrowRight } from 'lucide-react'

export default function AudienceTabs() {
  const [activeTab, setActiveTab] = useState('developer') // 'developer' or 'nocode'
  const [copied, setCopied] = useState('')

  const codeExamples = {
    curl: `curl -X POST https://api.schlep-engine.com/v1/transform \
  -H "Authorization: Bearer sk-proj-abc123..." \
  -F "file=@data.csv" \
  -F "format=tensorflow" \
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
    
    fmt.Printf("Quality Score: %.2f\n", result.QualityScore)
    fmt.Printf("Download URL: %s\n", result.DownloadURL)
}`
  }

  const copyCode = (language: string) => {
    navigator.clipboard.writeText(codeExamples[language as keyof typeof codeExamples])
    setCopied(language)
    setTimeout(() => setCopied(''), 2000)
  }

  return (
    <section className="py-20 bg-[#111111] text-beige-secondary">
      <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-beige-secondary mb-4">
            Who are you building for?
          </h2>
          <p className="text-xl text-beige-secondary max-w-2xl mx-auto">
            Schlep-engine empowers both technical and non-technical users to transform data effortlessly.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-4 mb-16">
          <button
            onClick={() => setActiveTab('developer')}
            className={`flex items-center space-x-3 px-6 py-3 rounded-lg font-semibold text-lg transition-colors duration-200 ${
              activeTab === 'developer'
                ? 'bg-[#468BE6] text-beige-secondary shadow-lg'
                : 'border border-[#468BE6] text-[#468BE6] hover:bg-[#468BE6] hover:text-beige-secondary'
            }`}
          >
            <Code className="w-6 h-6" />
            <span>I'm a Developer</span>
          </button>
          <button
            onClick={() => setActiveTab('nocode')}
            className={`flex items-center space-x-3 px-6 py-3 rounded-lg font-semibold text-lg transition-colors duration-200 ${
              activeTab === 'nocode'
                ? 'bg-[#468BE6] text-beige-secondary shadow-lg'
                : 'border border-[#468BE6] text-[#468BE6] hover:bg-[#468BE6] hover:text-beige-secondary'
            }`}
          >
            <MousePointerClick className="w-6 h-6" />
            <span>I'm a Business User</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'developer' && (
          <div className="grid lg:grid-cols-2 gap-12 items-start">
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

              <div className="flex flex-wrap gap-4">
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
                <Link 
                  href="/contact" 
                  className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors font-medium flex items-center space-x-2"
                >
                  <span>Request a Demo</span>
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
        )}

        {activeTab === 'nocode' && (
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="flex items-start space-x-4">
                <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                  <Upload className="w-6 h-6 text-[#468BE6]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                    Simple Upload
                  </h3>
                  <p className="text-beige-secondary">
                    Drag and drop your CSV, Excel, or JSON files. No technical setup required.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                  <MousePointer className="w-6 h-6 text-[#468BE6]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                    Point & Click Configuration
                  </h3>
                  <p className="text-beige-secondary">
                    Select transformations, handle missing values, and configure outputs with visual tools.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                  <Zap className="w-6 h-6 text-[#468BE6]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                    AI-Powered Processing
                  </h3>
                  <p className="text-beige-secondary">
                    Our AI automatically detects data patterns and suggests optimal transformations.
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-4">
                <div className="bg-[#468BE6]/10 p-3 rounded-lg">
                  <Download className="w-6 h-6 text-[#468BE6]" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                    Ready-to-Use Output
                  </h3>
                  <p className="text-beige-secondary">
                    Download clean data in formats ready for Excel, Tableau, or any analytics tool.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-gray-900 rounded-2xl shadow-lg p-8 border">
              <div className="space-y-6">
                <div className="border-2 border-dashed border-[#468BE6]/30 rounded-lg p-8 text-center bg-[#468BE6]/5">
                  <Upload className="w-12 h-12 text-[#468BE6] mx-auto mb-4" />
                  <p className="text-beige-secondary font-medium">Drop your data file here</p>
                  <p className="text-sm text-beige-secondary mt-1">CSV, Excel, JSON supported</p>
                </div>
                
                <div className="space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-beige-secondary">Data Quality Check</span>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">98%</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-beige-secondary">Missing Values</span>
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded">Auto-Fill</span>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-beige-secondary">Output Format</span>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">TensorFlow</span>
                    </div>
                  </div>
                </div>

                <button className="w-full bg-[#468BE6] text-beige-secondary py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium">
                  Process Data
                </button>
                <Link 
                  href="/contact" 
                  className="w-full text-center border border-[#468BE6] text-[#468BE6] px-6 py-3 rounded-lg hover:bg-[#468BE6] hover:text-beige-secondary transition-colors font-medium mt-4"
                >
                  Request a Demo
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Common CTA for both sections */}
        <div className="mt-20 bg-gradient-to-r from-[#468BE6]/10 to-blue-100/50 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-semibold text-beige-secondary mb-4">
            Ready to Transform Your Data?
          </h3>
          <p className="text-beige-secondary mb-6 max-w-2xl mx-auto">
            Whether you're a developer building complex pipelines or a business user needing quick insights,
            Schlep-engine has the tools to simplify your data preparation.
          </p>
          <Link 
            href="#get-started" 
            className="inline-flex items-center space-x-2 bg-[#468BE6] text-beige-secondary px-6 py-3 rounded-lg hover:bg-[#3a7bd5] transition-colors font-medium"
          >
            <span>Get Started for Free</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}