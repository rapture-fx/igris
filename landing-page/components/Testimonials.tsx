'use client'

import { motion } from 'framer-motion'
import { Star, Quote } from 'lucide-react'

export default function Testimonials() {
  const testimonials = [
    {
      name: "Sarah Chen",
      role: "Senior Data Scientist",
      company: "TechCorp",
      avatar: "SC",
      content: "Schlep Engine reduced our data prep time from days to hours. The AI automatically caught issues we would have missed and the quality of our models improved significantly.",
      rating: 5
    },
    {
      name: "Marcus Rodriguez",
      role: "ML Engineer",
      company: "DataFlow Inc",
      avatar: "MR",
      content: "The API integration was seamless. We plugged it into our existing pipeline and immediately saw a 10x improvement in data processing speed. Game-changer for our team.",
      rating: 5
    },
    {
      name: "Dr. Emily Watson",
      role: "Research Director",
      company: "BioTech Labs",
      avatar: "EW",
      content: "As a research team, data quality is crucial. Schlep Engine's intelligent profiling helped us identify and fix data issues that would have compromised our entire study.",
      rating: 5
    },
    {
      name: "Alex Thompson",
      role: "Head of Analytics",
      company: "FinanceAI",
      avatar: "AT",
      content: "The automated feature engineering saved us months of work. What used to take our team weeks now happens in minutes, and the results are consistently better.",
      rating: 5
    },
    {
      name: "Lisa Park",
      role: "Data Engineer",
      company: "CloudScale",
      avatar: "LP",
      content: "Finally, a tool that understands messy real-world data. The enterprise features and security compliance made it an easy choice for our organization.",
      rating: 5
    },
    {
      name: "James Wilson",
      role: "CTO",
      company: "StartupX",
      avatar: "JW",
      content: "Schlep Engine allowed our small team to compete with much larger organizations. The AI does the heavy lifting while we focus on building our core product.",
      rating: 5
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
    <section className="section-padding bg-gray-50">
      <div className="max-w-7xl mx-auto container-padding">
        <div className="text-center mb-16">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center px-4 py-2 rounded-full bg-white text-soft-blue text-sm font-medium mb-6 shadow-sm"
          >
            <Star className="w-4 h-4 mr-2" />
            Customer Stories
          </motion.div>

          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-section font-bold text-gray-900 mb-6"
          >
            Loved by data teams worldwide
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-600 max-w-3xl mx-auto"
          >
            Join thousands of data scientists, ML engineers, and researchers who trust 
            Schlep Engine to prepare their data for machine learning.
          </motion.p>
        </div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 card-hover"
            >
              <div className="flex items-center mb-6">
                <div className="w-12 h-12 bg-gradient-to-br from-soft-blue to-blue-600 rounded-full flex items-center justify-center mr-4">
                  <span className="text-white font-semibold text-sm">
                    {testimonial.avatar}
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600">
                    {testimonial.role} at {testimonial.company}
                  </p>
                </div>
              </div>

              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
                ))}
              </div>

              <div className="relative">
                <Quote className="absolute -top-2 -left-2 w-8 h-8 text-gray-200" />
                <p className="text-gray-700 leading-relaxed pl-6">
                  {testimonial.content}
                </p>
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
          <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center justify-center mb-6">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-6 h-6 text-yellow-400 fill-current" />
                ))}
              </div>
              <span className="ml-3 text-lg font-semibold text-gray-900">
                4.9/5 average rating
              </span>
            </div>
            <p className="text-gray-600 mb-6">
              Based on 500+ reviews from data professionals across 50+ countries
            </p>
            <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-500">
              <div>⭐ G2: 4.8/5</div>
              <div>⭐ Capterra: 4.9/5</div>
              <div>⭐ TrustPilot: 4.7/5</div>
              <div>⭐ Product Hunt: #1 Product of the Day</div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  )
}