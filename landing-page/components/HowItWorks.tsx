'use client'

import { motion } from 'framer-motion'
import { Upload, Brain, Download, ArrowRight } from 'lucide-react'

export default function HowItWorks() {
  const steps = [
    {
      icon: Upload,
      title: "Upload Your Data",
      description: "Drop your CSV, JSON, Excel files or connect your databases. We support all major data formats and sources.",
      code: `# Upload via API
response = client.upload(
    file="messy_data.csv",
    source="sales_database"
)`,
      color: "from-blue-500 to-cyan-500"
    },
    {
      icon: Brain,
      title: "AI Analyzes & Cleans",
      description: "Our AI profiles your data, identifies issues, and applies intelligent transformations automatically.",
      code: `# AI processing
job = client.process(
    upload_id=response.id,
    target_format="tensorflow",
    quality_threshold=0.95
)`,
      color: "from-purple-500 to-pink-500"
    },
    {
      icon: Download,
      title: "Export ML-Ready Data",
      description: "Download your cleaned, transformed data in the format you need for your ML framework.",
      code: `# Download results
client.download(
    job_id=job.id,
    format="tfrecord",
    split="train,val,test"
)`,
      color: "from-green-500 to-emerald-500"
    }
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2
      }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6
      }
    }
  }

  return (
    <section id="how-it-works" className="section-padding bg-gray-50">
      <div className="max-w-7xl mx-auto container-padding">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-white text-soft-blue text-sm font-medium mb-6 shadow-sm"
          >
            <Brain className="w-4 h-4 mr-2" />
            How It Works
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-section font-bold text-gray-900 mb-6"
          >
            Three steps to perfect data
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto"
          >
            Transform your messy data into ML-ready formats in minutes, not hours. 
            Our AI handles the complexity while you focus on building great models.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-12"
        >
          {steps.map((step, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className={`flex flex-col ${index % 2 === 0 ? 'lg:flex-row' : 'lg:flex-row-reverse'} items-center gap-12`}
            >
              <div className="flex-1">
                <div className="flex items-center mb-6">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${step.color} flex items-center justify-center mr-6`}>
                    <step.icon className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-soft-blue mb-2">
                      Step {index + 1}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {step.title}
                    </h3>
                  </div>
                </div>

                <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                  {step.description}
                </p>

                <div className="bg-white rounded-xl p-6 shadow-sm border">
                  <div className="flex items-center space-x-2 mb-4">
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  </div>
                  <pre className="text-sm text-gray-800 font-mono whitespace-pre-wrap">
                    {step.code}
                  </pre>
                </div>
              </div>

              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-soft-blue to-blue-600 transform rotate-2 rounded-2xl"></div>
                  <div className="relative bg-white rounded-2xl p-8 shadow-xl">
                    <div className="h-48 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center">
                      <div className="text-gray-500 text-center">
                        <div className="w-16 h-16 bg-gray-300 rounded-full mx-auto mb-4 flex items-center justify-center">
                          <step.icon className="w-8 h-8" />
                        </div>
                        <div className="text-sm">
                          {step.title} Visualization
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className="hidden lg:block absolute left-1/2 transform -translate-x-1/2 mt-8">
                  <div className="w-12 h-12 bg-soft-blue rounded-full flex items-center justify-center">
                    <ArrowRight className="w-6 h-6 text-white" />
                  </div>
                </div>
              )}
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
          <div className="bg-white rounded-2xl p-8 shadow-lg border">
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              Ready to transform your data?
            </h3>
            <p className="text-gray-600 mb-6">
              Join thousands of data scientists and ML engineers who trust Schlep Engine
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="#"
                className="button-primary text-lg px-8 py-3 inline-flex items-center"
              >
                Start Free Trial
                <ArrowRight className="ml-2 w-5 h-5" />
              </a>
              <a
                href="#"
                className="button-secondary text-lg px-8 py-3"
              >
                Schedule Demo
              </a>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}