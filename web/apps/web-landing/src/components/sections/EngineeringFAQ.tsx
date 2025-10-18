'use client'

import React, { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

export default function EngineeringFAQ() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const faqData = [
    {
      question: "Does Schlep-engine host or run AI models?",
      answer: "No. Schlep-engine does not host or serve AI models. You bring your own provider credentials (BYOK), and Schlep-engine handles routing, optimization, and control between providers like OpenAI and Anthropic."
    },
    {
      question: "Does Schlep-engine generate any additional API cost?",
      answer: "No. In Benchmark Mode, all responses are simulated with zero cost. In Live Mode, all token usage is billed directly to your own provider accounts."
    },
    {
      question: "Can I use my OpenAI or Anthropic API keys?",
      answer: "Yes. Live provider mode supports BYOK (Bring Your Own Key), allowing Schlep-engine to route requests securely through your existing accounts."
    },
    {
      question: "Is Schlep safe for production traffic?",
      answer: "Yes. Schlep-engine includes shadow mode, phased activation, and automatic fallback for safety. You control rollout and SLO guardrails."
    },
    {
      question: "How do I get support or ask architectural questions?",
      answer: "You can reach the engineering team at support@schlep-engine.com."
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
                <h2 className="text-sm leading-7 text-gray-500 dark:text-gray-400 font-inter mb-4">Engineering FAQ</h2>
                <h3 className="text-xl tracking-tight md:text-2xl font-inter mb-4" style={{ color: '#114dcd' }}>
                  Frequently Asked Questions
                </h3>
                <p className="text-lg leading-8 text-gray-700 dark:text-gray-300 font-inter">
                  Get answers to common questions about Schlep-engine's architecture, capabilities, and implementation.
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
          </div>
        </div>
      </div>
    </section>
  )
}
