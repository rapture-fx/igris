'use client'

import React, { useState } from 'react'

export default function HowItWorks() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const steps = [
    {
      title: "Upload Your Data",
      description: "CSV, Excel, JSON - any format, any size up to 100MB",
      color: "#468BE6"
    },
    {
      title: "AI Analyzes & Cleans",
      description: "Our algorithms identify issues and apply intelligent fixes",
      color: "#1A5799"
    },
    {
      title: "Export ML-Ready Data",
      description: "Get clean data in your preferred format for immediate use",
      color: "#154A85"
    }
  ]

  return (
    <section className="py-20 md:py-32 bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 text-left">
            From Messy to ML-Ready in 3 Steps
          </h2>
          <p className="text-xl text-gray-700 max-w-2xl text-left">
            Transform your data pipeline from hours of manual work to minutes of automated processing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">
          {/* Left Column - Steps List */}
          <div className="relative space-y-8">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" aria-hidden="true"></div>
            {steps.map((step, index) => (
              <div 
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group relative p-6 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:bg-white hover:shadow-lg ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0 bg-white border-2 border-gray-200 z-10">
                    <span className="text-2xl font-bold text-gray-600">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <span className="text-sm font-bold text-gray-600">Step {index + 1}</span>
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-700 leading-relaxed text-sm">
                      {step.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right Column - Code Snippet */}
          <div className="flex items-center justify-center">
            <pre className="bg-gray-800 text-white p-4 rounded-lg overflow-x-auto w-full">
              <code>
                // Your API code snippet here
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
