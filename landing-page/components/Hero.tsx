'use client'

import { motion } from 'framer-motion'
import { ArrowRight, Play, Zap, Target, Shield } from 'lucide-react'

export default function Hero() {
  return (
    <section className="relative pt-20 pb-16 md:pt-24 md:pb-24 lg:pt-32 lg:pb-32 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-indigo-50"></div>
      <div className="relative max-w-7xl mx-auto container-padding">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-blue-100 text-soft-blue text-sm font-medium mb-8"
          >
            <Zap className="w-4 h-4 mr-2" />
            AI-Powered Data Preparation Platform
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-hero font-bold text-gray-900 mb-6 max-w-4xl mx-auto"
          >
            Transform messy data into{' '}
            <span className="gradient-text">ML-ready formats</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed"
          >
            Eliminate 80% of data preparation time with intelligent pattern recognition 
            and automated workflows. Your data, perfectly prepared for machine learning.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
          >
            <a
              href="#"
              className="button-primary text-lg px-10 py-4 inline-flex items-center group"
            >
              Start Free Trial
              <ArrowRight className="ml-2 w-5 h-5 transition-transform group-hover:translate-x-1" />
            </a>
            <a
              href="#"
              className="button-secondary text-lg px-10 py-4 inline-flex items-center group"
            >
              <Play className="mr-2 w-5 h-5" />
              Watch Demo
            </a>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto"
          >
            <div className="flex items-center justify-center md:justify-start">
              <Target className="w-6 h-6 text-soft-blue mr-3" />
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">95%</div>
                <div className="text-sm text-gray-600">Time Reduction</div>
              </div>
            </div>
            <div className="flex items-center justify-center md:justify-start">
              <Shield className="w-6 h-6 text-soft-blue mr-3" />
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">99.5%</div>
                <div className="text-sm text-gray-600">Accuracy</div>
              </div>
            </div>
            <div className="flex items-center justify-center md:justify-start">
              <Zap className="w-6 h-6 text-soft-blue mr-3" />
              <div className="text-left">
                <div className="text-2xl font-bold text-gray-900">1M+</div>
                <div className="text-sm text-gray-600">Records/Min</div>
              </div>
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20"
        >
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-r from-soft-blue to-blue-600 transform rotate-1 rounded-2xl"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl p-8 border">
              <div className="flex items-center space-x-2 mb-6">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              </div>
              <div className="bg-gray-900 rounded-lg p-6">
                <div className="text-green-400 font-mono text-sm">
                  <div className="mb-2">$ import schlep_engine</div>
                  <div className="mb-2">$ # Transform messy CSV to ML-ready format</div>
                  <div className="mb-2">$ result = schlep_engine.transform(</div>
                  <div className="mb-2 ml-4">data_source="customer_data.csv",</div>
                  <div className="mb-2 ml-4">target_format="tensorflow",</div>
                  <div className="mb-2 ml-4">quality_threshold=0.95</div>
                  <div className="mb-2">$ )</div>
                  <div className="mb-2">$ print(result.summary)</div>
                  <div className="text-blue-400">
                    <div>✓ Dataset ready: customer_data_tf_ready.tfrecord</div>
                    <div>✓ Quality score: 0.98</div>
                    <div>✓ Processing time: 2.3 seconds</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}