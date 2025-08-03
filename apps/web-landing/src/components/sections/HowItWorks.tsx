'use client'

import { Upload, Brain, Download, ArrowRight } from 'lucide-react'
import React from 'react'

export default function HowItWorks() {
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

        <div className="relative grid md:grid-cols-[1fr_auto_1fr_auto_1fr] gap-4 items-center justify-center">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <React.Fragment key={index}>
                <div className="flex-1 text-center relative p-6 rounded-lg">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6" style={{ backgroundColor: step.color + '20' }}>
                    <Icon className="w-10 h-10" style={{ color: step.color }} />
                  </div>
                  <h3 className="text-xl font-semibold text-beige-secondary mb-3">
                    {step.title}
                  </h3>
                  <p className="text-beige-secondary leading-relaxed">
                    {step.description}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div className="hidden md:flex items-center justify-center">
                    <ArrowRight className="w-8 h-8 text-beige-secondary" />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>

        
      </div>
    </section>
  )
}