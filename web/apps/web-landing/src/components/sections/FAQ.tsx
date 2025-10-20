'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function FAQ() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const faqData = [
    {
      question: "What is Schlep Engine and how does it work?",
      answer: "Schlep Engine is an ML inference routing platform that uses Thompson Sampling (multi-armed bandit) to intelligently route your AI API requests across multiple providers like OpenAI and Anthropic. It automatically learns from performance to optimize for cost, speed, and reliability while giving you control over spending limits and safety features."
    },
    {
      question: "Do I need to change my existing integrations?",
      answer: "No. Schlep Engine provides an OpenAI-compatible API, making it a drop-in replacement for your existing OpenAI integrations. Simply change your API endpoint to your Schlep Engine instance and keep using the same request/response format."
    },
    {
      question: "How does Thompson Sampling improve my AI costs?",
      answer: "Thompson Sampling uses Bayesian optimization to balance exploration and exploitation. It continuously learns from each provider's performance (latency, cost, error rate) and automatically routes requests to the most cost-effective options while still exploring newer or potentially better providers."
    },
    {
      question: "Can I test without spending money on API calls?",
      answer: "Yes! Our Benchmark Mode simulates realistic API responses without actual provider calls. You get realistic latency profiles, token counting, and cost calculations perfect for development, load testing, and feature validation - all at zero cost."
    },
    {
      question: "How do budget protections work?",
      answer: "Set custom spending limits and token caps to prevent cost overruns. Schlep Engine provides real-time usage tracking, automatic alerts, and budget safeguards. You can configure both daily and monthly limits with automatic shutoff when thresholds are reached."
    },
    {
      question: "Is it safe for production use?",
      answer: "Yes. Schlep Engine includes multiple safety features: shadow mode (parallel validation without user impact), phased rollouts (1-100% traffic control), automatic fallback on performance degradation, and SLO guardrails. You maintain full control over rollout speed and can instantly revert changes."
    },
    {
      question: "What providers are supported?",
      answer: "Currently supports OpenAI and Anthropic with real API integration in development. The benchmark mode works with all providers for testing. Custom provider support is planned for future releases."
    },
    {
      question: "How do I get started?",
      answer: "You can start testing immediately in Benchmark Mode - no API keys required. For production use, simply bring your own OpenAI and Anthropic API keys (BYOK). We offer self-hosted deployment options and documentation for quick setup."
    },
    {
      question: "What's the pricing model?",
      answer: "Schlep Engine is open-source with free self-hosting options. No additional per-request fees - you only pay your existing AI provider costs. Enterprise support and managed hosting options are available for teams requiring additional support."
    },
    {
      question: "How does it compare to direct provider usage?",
      answer: "Schlep Engine adds value through intelligent routing (up to 40% cost savings), risk-free testing, budget protections, and unified API abstraction. The Thompson Sampling optimization typically pays for itself in cost savings while providing additional safety and observability features."
    }
  ]

  return (
    <section className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f7f7f3' }}>
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
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-12 items-start">
              {/* Left Column - Titles */}
              <div className="text-left lg:col-span-2">
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">FAQ</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Frequently Asked Questions
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Get answers to common questions about Schlep Engine, how it works, and how it can help optimize your AI costs and performance.
                </p>
              </div>

              {/* Right Column - FAQ Items */}
              <div className="lg:col-span-3">
                <div className="space-y-4">
                  {faqData.map((item, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg" style={{ backgroundColor: '#f2f1ed' }}>
                      <button
                        className="w-full flex items-center justify-between p-4 text-left hover:opacity-80 transition-opacity duration-200"
                        onClick={() => setActiveIndex(activeIndex === index ? null : index)}
                      >
                        <span className="text-gray-900 dark:text-white font-medium text-sm font-inter pr-8">
                          {item.question}
                        </span>
                        <span className="flex-shrink-0 text-gray-500 dark:text-gray-400">
                          {activeIndex === index ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </span>
                      </button>
                      
                      {activeIndex === index && (
                        <div className="px-4 pb-4 pt-0">
                          <div className="text-gray-700 dark:text-gray-300 text-sm font-inter leading-relaxed">
                            {item.answer}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CTA Section */}
            <div className="mt-16 text-center">
              <h3 className="text-4xl font-bold text-gray-900 dark:text-white mb-10">
                Ready to optimize your AI workflows?
              </h3>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
                <a
                  href="/dashboard"
                  className="bg-black text-white px-5 py-2.5 rounded-xl hover:bg-gray-800 transition-all duration-200 font-medium text-sm shadow-md hover:shadow-lg dark:bg-[#fcfcf7] dark:text-black"
                >
                  Get Started for Free
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}