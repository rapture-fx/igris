'use client'

import { Clock, Brain, Target, Shield, Zap, Key } from 'lucide-react'
import { useState } from 'react'

export default function Benefits() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const benefits = [
    {
      icon: Clock,
      title: "Faster Data Preparation",
      description: "Automate repetitive data cleaning tasks with API-driven processing"
    },
    {
      icon: Brain,
      title: "Automated Data Quality",
      description: "Built-in validation and cleaning algorithms for common data issues"
    },
    {
      icon: Target,
      title: "Standard Output Formats",
      description: "Export data in CSV, JSON, and other formats for downstream use"
    },
    {
      icon: Shield,
      title: "Security Features",
      description: "Authentication, encryption, and audit logging capabilities"
    },
    {
      icon: Zap,
      title: "Asynchronous Processing",
      description: "Handle larger datasets with background job processing"
    },
    {
      icon: Key,
      title: "Open Data Formats",
      description: "Use standard formats and APIs - no proprietary lock-in"
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-white text-gray-900 dark:bg-black dark:text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#565656] mb-4 text-left">
            Core Data Processing Features
          </h2>
          <p className="text-xl text-[#565656] max-w-2xl text-left">
            Tools for cleaning, validating, and preparing data for analysis and machine learning
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-20">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div 
                key={index}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
                className={`group p-6 rounded-xl border border-gray-200 dark:border-gray-800 transition-all duration-300 hover:scale-[1.02] hover:bg-gray-50 dark:hover:bg-gray-900 hover:shadow-lg ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-60' : ''}`}
              >
                <div className="flex items-start space-x-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-semibold text-[#565656] mb-2">
                      {benefit.title}
                    </h3>
                    <p className="text-[#565656] leading-relaxed text-sm">
                      {benefit.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        
      </div>
    </section>
  )
}