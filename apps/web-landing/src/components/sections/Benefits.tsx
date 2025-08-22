'use client'

import { Clock, Brain, Target, Shield, Zap, Key } from 'lucide-react'
import { useState } from 'react'

export default function Benefits() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const benefits = [
    {
      icon: Clock,
      title: "80% Time Savings",
      description: "Transform weeks of manual data cleaning into minutes of API calls"
    },
    {
      icon: Brain,
      title: "AI-Powered Quality",
      description: "Smart algorithms detect and fix data issues you might miss"
    },
    {
      icon: Target,
      title: "ML-Ready Output",
      description: "Export directly to scikit-learn, TensorFlow, PyTorch and more"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "SOC2 compliant with field-level encryption and audit trails"
    },
    {
      icon: Zap,
      title: "Real-time Processing",
      description: "Background job processing with live status updates"
    },
    {
      icon: Key,
      title: "No Vendor Lock-in",
      description: "Standard formats, easy migration, your data stays yours"
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-white text-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-gray-900 mb-4 text-left">
            Data ready for what's next
          </h2>
          <p className="text-xl text-gray-700 max-w-2xl text-left">
            Built for data teams who need reliable, scalable data preparation without the hassle
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start mb-20">
          {/* Left Column - Benefits List */}
          <div className="space-y-8">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon
              return (
                <div 
                  key={index}
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  className={`group p-4 rounded-lg transition-all duration-300 hover:scale-[1.02] hover:bg-gray-50 hover:shadow-lg ${hoveredIndex !== null && hoveredIndex !== index ? 'opacity-50' : ''}`}
                >
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-0.5">
                      {benefit.title}
                    </h3>
                    <p className="text-gray-700 leading-relaxed text-xs">
                      {benefit.description}
                    </p>
                    <div className="w-full h-0.5 bg-gray-200 mt-2"></div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Right Column - Empty for now */}
          <div>
            {/* Content for the right column will go here */}
          </div>
        </div>

        
      </div>
    </section>
  )
}