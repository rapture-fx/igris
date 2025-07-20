'use client'

import { Upload, Brain, Download, ArrowRight } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Your Data",
      description: "CSV, Excel, JSON - any format, any size up to 100MB"
    },
    {
      icon: Brain,
      title: "AI Analyzes & Cleans",
      description: "Our algorithms identify issues and apply intelligent fixes"
    },
    {
      icon: Download,
      title: "Export ML-Ready Data",
      description: "Get clean data in your preferred format for immediate use"
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            From Messy to ML-Ready in 3 Steps
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Transform your data pipeline from hours of manual work to minutes of automated processing
          </p>
        </div>

        <div className="relative">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-8 md:space-y-0 md:space-x-8">
            {steps.map((step, index) => {
              const Icon = step.icon
              return (
                <div key={index} className="flex-1 text-center relative">
                  <div className="w-20 h-20 bg-[#1A5799] bg-opacity-10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Icon className="w-10 h-10 text-[#1A5799]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-3">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">
                    {step.description}
                  </p>
                  
                  {index < steps.length - 1 && (
                    <div className="hidden md:block absolute top-10 -right-4 transform translate-x-1/2">
                      <ArrowRight className="w-6 h-6 text-gray-400" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="mt-16 text-center">
          <div className="bg-gray-50 rounded-lg p-8 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">
              See it in action
            </h3>
            <div className="bg-gray-900 rounded-lg p-6 text-left">
              <div className="text-green-400 font-mono text-sm">
                <div className="mb-2">→ Processing customer_data.csv...</div>
                <div className="mb-2">→ Detected 15,234 rows, 47 columns</div>
                <div className="mb-2">→ Found 3 quality issues: missing values, duplicates, format inconsistencies</div>
                <div className="mb-2">→ Applying AI fixes...</div>
                <div className="mb-4">→ Generating TensorFlow format...</div>
                <div className="text-blue-400">
                  <div>✓ Dataset ready: customer_data_clean.tfrecord</div>
                  <div>✓ Quality score: 98.5%</div>
                  <div>✓ Processing time: 2.3 seconds</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}