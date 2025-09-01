'use client'

import React from 'react'
import { Upload, Cpu, FileCheck } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Your Data",
      description: "CSV, Excel, JSON - any format, any size up to 100MB",
    },
    {
      icon: Cpu,
      title: "AI Analyzes & Cleans",
      description: "Our algorithms identify issues and apply intelligent fixes",
    },
    {
      icon: FileCheck,
      title: "Export ML-Ready Data",
      description: "Get clean data in your preferred format for immediate use",
    }
  ]

  const codeSnippet = `import schlep_engine as se

# 1. Upload your data
file = se.upload("my_data.csv")

# 2. AI analyzes and cleans
cleaned_file = se.clean(file)

# 3. Export ML-ready data
cleaned_file.download("cleaned_data.csv")`

  return (
    <section className="py-20 md:py-32 bg-white dark:bg-black">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-teal-400 mb-4">
            From Messy to ML-Ready in 3 Steps
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Transform your data pipeline from hours of manual work to minutes of automated processing
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="relative">
            
            <div className="space-y-12">
              {steps.map((step, index) => (
                <div key={index} className="relative flex items-start gap-6">
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center z-10">
                    <step.icon className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {step.title}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <div className="bg-gray-900 px-4 py-2 flex items-center justify-between">
              <span className="text-xs text-gray-400">example.py</span>
              <button className="text-xs text-gray-400 hover:text-white">Copy</button>
            </div>
            <pre className="p-4 text-sm text-white overflow-x-auto">
              <code dangerouslySetInnerHTML={{ __html: codeSnippet.replace(/\n/g, '<br />') }} />
            </pre>
          </div>
        </div>
      </div>
    </section>
  )
}
