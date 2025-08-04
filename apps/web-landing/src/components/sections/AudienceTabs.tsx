'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Code, MousePointerClick, Terminal, Zap, Book, Github, Upload, Download, MousePointer, Copy, ArrowRight } from 'lucide-react'
import HeroGridBackground from '../ui/HeroGridBackground'

export default function AudienceTabs() {
  

  return (
    <>
      <section className="py-20 bg-[#111111] text-beige-secondary">
        <div className="max-w-6xl mx-auto px-6 sm:px-8 lg:px-12">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-beige-secondary mb-4 text-left">
              Who are you building for?
            </h2>
            <p className="text-xl text-beige-secondary max-w-2xl text-left">
              Schlep-engine empowers both technical and non-technical users to transform data effortlessly.
            </p>
          </div>

          

          <div className="grid lg:grid-cols-2 gap-12 items-start">
              <div className="rounded-2xl p-8 border border-gray-700 bg-gray-900 space-y-8">
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

              <div className="rounded-2xl p-8 border border-gray-700 bg-gray-900 space-y-8">
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
            </div>
        </div>
      </section>
    </>
  )
}