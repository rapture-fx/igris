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

  return (
    <section className="py-2 sm:py-3 lg:py-4 bg-white dark:bg-black">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="relative p-40" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1300px] mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-center">
              {/* Left Column - Title and Description */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">How It Works</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Clean your data in<br />three simple steps.
                </h3>

                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter mb-6">
                  Upload your files and let our AI-powered engine clean, validate, and prepare your data for analysis. No manual work required.
                </p>
              </div>

              {/* Right Column - Steps as Cards with SVG Background */}
              <div className="rounded-lg p-12 lg:col-span-3 min-h-[500px] flex items-center relative overflow-hidden" style={{
                backgroundImage: 'url("/How it works diagram.svg")',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat'
              }}>
                {/* Text overlay for readability */}
                <div className="absolute inset-0" style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.35)'
                }} />

                <div className="space-y-4 max-w-lg mx-auto w-full relative z-10">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 rounded-lg border border-gray-200 dark:border-gray-700" style={{ backgroundColor: '#ffffff', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 8px 8px -4px rgba(0, 0, 0, 0.04)' }}>
                      <div className="flex h-12 w-12 items-center justify-center flex-shrink-0">
                        <step.icon className="h-6 w-6 text-black" aria-hidden="true" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1 font-mono">
                          {step.title}
                        </h3>
                        <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed font-mono">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
