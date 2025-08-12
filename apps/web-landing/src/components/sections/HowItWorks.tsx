'use client'

import { Upload, Brain, Download } from 'lucide-react'
import React, { useState } from 'react'

export default function HowItWorks() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const steps = [
    {
      icon: Upload,
      title: "Upload Your Data",
      description: "CSV, Excel, JSON - any format, any size up to 100MB",
      color: "#468BE6"
    },
    {
      icon: Brain,
      title: "AI Analyzes & Cleans",
      description: "Our algorithms identify issues and apply intelligent fixes",
      color: "#1A5799"
    },
    {
      icon: Download,
      title: "Export ML-Ready Data",
      description: "Get clean data in your preferred format for immediate use",
      color: "#154A85"
    }
  ]

  return (
    <section className="py-20 md:py-32 bg-[#111111]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-beige-secondary mb-4 text-left">
            From Messy to ML-Ready in 3 Steps
          </h2>
          <p className="text-xl text-beige-secondary max-w-2xl text-left">
            Transform your data pipeline from hours of manual work to minutes of automated processing
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">
          {/* Left Column - Steps List */}
          <div className="space-y-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div 
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`group p-6 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:bg-[#161616] hover:shadow-lg ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: step.color + '20' }}>
                      <Icon className="w-8 h-8" style={{ color: step.color }} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="text-sm font-bold text-gray-400">Step {index + 1}</span>
                      </div>
                      <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                        {step.title}
                      </h3>
                      <p className="text-beige-secondary leading-relaxed text-sm">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  <div className="w-full h-0.5 bg-[#1f1f1f] mt-4"></div>
                </div>
              )
            })}
          </div>

          {/* Right Column - Visual or additional content */}
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="w-64 h-64 bg-gradient-to-br from-[#468BE6]/20 to-[#154A85]/20 rounded-xl flex items-center justify-center mb-6">
                <div className="text-6xl text-[#468BE6]">⚡</div>
              </div>
              <h3 className="text-xl font-semibold text-beige-secondary mb-2">
                Automated Pipeline
              </h3>
              <p className="text-beige-secondary text-sm">
                Your data flows seamlessly through our intelligent processing pipeline
              </p>
            </div>
          </div>
        </div>

        
      </div>
    </section>
  )
}