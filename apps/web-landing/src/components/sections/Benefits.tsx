'use client'

import { Clock, Brain, Target, Shield, Zap, Key } from 'lucide-react'

export default function Benefits() {
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
    <section className="py-16 md:py-24 bg-black">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Why Choose Schlep-engine?
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Built for data teams who need reliable, scalable data preparation without the hassle
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {benefits.map((benefit, index) => {
            const Icon = benefit.icon
            return (
              <div 
                key={index}
                className="bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-600 hover:shadow-md transition-shadow duration-200"
              >
                <div className="w-12 h-12 bg-[#468BE6] bg-opacity-10 rounded-lg flex items-center justify-center mb-6">
                  <Icon className="w-6 h-6 text-[#468BE6]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">
                  {benefit.title}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-16 text-center">
          <div className="bg-gray-800 rounded-lg p-8 shadow-sm border border-gray-600 max-w-4xl mx-auto">
            <h3 className="text-2xl font-bold text-white mb-4">
              Trusted by companies at
            </h3>
            <div className="flex justify-center items-center space-x-8 opacity-60">
              <div className="text-gray-400 font-semibold">scikit-learn</div>
              <div className="text-gray-400 font-semibold">TensorFlow</div>
              <div className="text-gray-400 font-semibold">PyTorch</div>
              <div className="text-gray-400 font-semibold">pandas</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}