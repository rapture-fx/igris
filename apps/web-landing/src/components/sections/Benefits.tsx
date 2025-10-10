'use client'

import { Clock, Brain, Target, Shield, Zap, Key, Activity, TrendingUp, Cpu, Network } from 'lucide-react'
import { useState } from 'react'

export default function Benefits() {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  const benefits = [
    {
      icon: Activity,
      title: "Intelligent Model Routing",
      description: "Thompson sampling router directs requests to optimal models based on performance and cost"
    },
    {
      icon: TrendingUp,
      title: "Real-time Cost Optimization",
      description: "Automatic cost reduction through smart caching, model selection, and resource allocation"
    },
    {
      icon: Cpu,
      title: "Multi-Tier Cache System",
      description: "L1/L2/L3 cache coherence delivers 99.9% cache hit rates and sub-10ms response times"
    },
    {
      icon: Network,
      title: "Adaptive Worker Pools",
      description: "Auto-scaling inference workers that respond to demand patterns and traffic spikes"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "JWT authentication, API key management, and comprehensive audit logging"
    },
    {
      icon: Zap,
      title: "Sub-10ms Latency",
      description: "High-performance fabric delivers real-time inference with guaranteed service levels"
    }
  ]

  return (
    <section className="py-16 md:py-24 bg-white text-gray-900 dark:bg-black dark:text-white">
      <div className="max-w-[1300px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-16">
          <h2 className="text-3xl md:text-4xl font-semibold text-[#565656] mb-4 text-left">
            AI Inference Optimization Benefits
          </h2>
          <p className="text-xl text-[#565656] max-w-2xl text-left">
            Enterprise-grade AI infrastructure that makes every model faster, cheaper, and smarter to operate
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