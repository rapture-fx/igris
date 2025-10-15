'use client'

import { motion } from 'framer-motion'
import { 
  Brain, 
  Zap, 
  Shield, 
  Target, 
  Database, 
  Cpu,
  BarChart3,
  GitBranch,
  Lock,
  Globe,
  ArrowRight
} from 'lucide-react'

export default function Features() {
  const features = [
    {
      icon: Activity,
      title: "Thompson Sampling Router",
      description: "Intelligent model routing based on real-time performance metrics and cost optimization.",
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: TrendingUp,
      title: "Cost Optimization Engine",
      description: "Dynamic cost reduction through smart caching, model selection, and resource allocation.",
      color: "from-soft-blue to-blue-600"
    },
    {
      icon: Cpu,
      title: "Multi-Tier Cache System",
      description: "L1/L2/L3 cache coherence delivers 99.9% cache hit rates and sub-10ms response times.",
      color: "from-green-500 to-emerald-500"
    },
    {
      icon: Network,
      title: "Adaptive Worker Pools",
      description: "Auto-scaling inference workers that respond to demand patterns and traffic spikes.",
      color: "from-orange-500 to-red-500"
    },
    {
      icon: Brain,
      title: "Real-time Orchestration",
      description: "WebSocket-based monitoring and control for live optimization and performance tuning.",
      color: "from-cyan-500 to-blue-500"
    },
    {
      icon: GitBranch,
      title: "Version Control",
      description: "Track data lineage, compare transformations, and maintain reproducible ML pipelines with git-like versioning.",
      color: "from-indigo-500 to-purple-500"
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.5
      }
    }
  }

  return (
    // Visual Enhancement Suggestion: Consider adding a diagram or a short video here
    // that visually explains how these features work together to prepare data for ML.
    <section id="features" className="section-padding bg-custom-gray">
      <div className="max-w-[1400px] mx-auto container-padding">
        <div className="mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-soft-gray text-soft-blue text-sm font-medium mb-6 transition-colors duration-300"
          >
            <Cpu className="w-4 h-4 mr-2" />
            Powerful Features
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-section font-bold text-gray-900 mb-6 transition-colors duration-300 text-left"
          >
            Everything you need to prepare data for ML
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-3xl transition-colors duration-300 text-left"
          >
            From messy spreadsheets to production-ready datasets. Our AI-powered platform 
            handles the heavy lifting so you can focus on building amazing models.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="group relative bg-gray-900 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-700 card-hover"
            >
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-6`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-4 transition-colors duration-300">
                {feature.title}
              </h3>
              
              <p className="text-beige-secondary leading-relaxed transition-colors duration-300">
                {feature.description}
              </p>

              <div className="mt-6 flex items-center text-soft-blue group-hover:text-blue-600 transition-colors">
                <span className="text-sm font-medium">Learn more</span>
                <ArrowRight className="w-4 h-4 ml-1 transition-transform group-hover:translate-x-1" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="bg-gradient-to-r from-soft-blue to-blue-600 rounded-2xl p-8 text-white transition-colors duration-300">
            <div className="flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 mr-3" />
              <h3 className="text-2xl font-bold">Enterprise Ready</h3>
            </div>
            <p className="text-lg mb-6 opacity-90">
              SOC 2 compliant, GDPR ready, and built for scale with 99.9% uptime SLA
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center">
                <Lock className="w-4 h-4 mr-2" />
                End-to-end encryption
              </div>
              <div className="flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Global infrastructure
              </div>
              <div className="flex items-center">
                <Shield className="w-4 h-4 mr-2" />
                24/7 monitoring
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}