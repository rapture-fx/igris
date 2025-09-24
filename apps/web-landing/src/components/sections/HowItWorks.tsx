'use client'

import React from 'react'
import { Upload, Cpu, FileCheck } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Your Data",
      description: "Submit CSV, Excel, or JSON files through the API or web interface",
    },
    {
      icon: Cpu,
      title: "Process & Clean",
      description: "Automated validation and cleaning based on configurable rules",
    },
    {
      icon: FileCheck,
      title: "Download Results",
      description: "Receive processed data in standard formats",
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
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-4">
            How It Works
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            A straightforward process for cleaning and preparing your data
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="relative">
            <div className="space-y-12">
              {steps.map((step, index) => (
                <div key={index} className="relative flex items-start gap-6">
                  {/* Connecting line for visual flow */}
                  {index < steps.length - 1 && (
                    <div className="absolute left-6 top-12 w-0.5 h-12 bg-gradient-to-b from-blue-200 to-blue-100 dark:from-blue-800 dark:to-blue-900 z-0"></div>
                  )}
                  <div className="flex-shrink-0 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center z-10 border-2 border-blue-200 dark:border-blue-800">
                    <step.icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white dark:bg-gray-800/50 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        {step.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        {step.description}
                      </p>
                    </div>
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
