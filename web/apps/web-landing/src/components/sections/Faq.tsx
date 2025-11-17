'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqEntries = [
  {
    question: "How much can I actually save?",
    answer: "Most teams cut AI costs by 25–40% while maintaining or improving output quality. Our intelligent routing eliminates wasted spending on overqualified models for simple tasks.",
    type: "text"
  },
  {
    question: "How does quality-aware routing work?",
    answer: "Each request is automatically classified by domain (code, creative, analytical) and complexity. Schlep-engine then routes it to the optimal model for that specific task — not just the cheapest, but the one that delivers the best results.",
    type: "text"
  },
  {
    question: "Will routing to cheaper models hurt my AI quality?",
    answer: "No — we only use cost-effective models for simple tasks where they perform well. Complex tasks automatically route to premium models. Most customers see 20–40% quality improvements overall.",
    type: "text"
  },
  {
    question: "How do I control the cost vs quality balance?",
    answer: "Choose from three optimization modes: Cost (maximum savings), Balanced (recommended), or Quality (best outcomes). Fine-tune via API with web console coming soon.",
    type: "text"
  },
  {
    question: "Is integration really this simple?",
    type: "code",
    answerText: "Yes. Change one URL and you're routing intelligently in minutes.",
    codeExample: {
      old: "https://api.openai.com/v1",
      new: "https://api.schlep-engine.com/v1"
    },
    answerFooter: "No SDK changes, no migration scripts, no lock-in."
  },
  {
    question: "How is this different from cost optimization?",
    answer: "Cost optimization finds the cheapest model. We find the best model for each task. The savings come from eliminating waste, not downgrading quality.",
    type: "text"
  },
  {
    question: "What about my existing provider discounts?",
    answer: "You keep 100% of your negotiated rates, startup credits, and usage discounts. We never mark up API calls — just a flat monthly fee.",
    type: "text"
  }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="py-2 sm:py-3 lg:py-4 dark:bg-gray-900" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-12" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.3px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.3px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.3px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.3px solid #1a1e21' }}></div>
          </div>

          <div className="text-center mb-8 md:mb-12 lg:mb-16">
            <h2 className="text-2xl tracking-tight md:text-3xl font-normal font-inter mb-4" style={{ color: '#000000' }}>
              Questions and answers
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
          {faqEntries.map((faq, index) => (
            <div
              key={index}
              className="rounded-lg transition-all duration-200"
              style={{
                backgroundColor: '#f6f6f4',
                border: '1px solid rgba(156, 163, 175, 0.3)'
              }}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full text-left px-4 md:px-6 py-4 md:py-5 flex items-center justify-between gap-4 hover:opacity-80 transition-opacity"
              >
                <span className="text-base md:text-lg font-normal font-inter flex-1" style={{ color: '#000000' }}>
                  {faq.question}
                </span>
                <ChevronDown
                  className={`flex-shrink-0 transition-transform duration-200 ${
                    openIndex === index ? 'rotate-180' : ''
                  }`}
                  style={{ color: 'rgba(156, 163, 175, 0.6)' }}
                  size={18}
                />
              </button>

              <div
                className={`overflow-hidden transition-all duration-200 ${
                  openIndex === index ? 'max-h-[500px]' : 'max-h-0'
                }`}
              >
                <div className="px-4 md:px-6 pb-4 md:pb-5 pt-0">
                  {faq.type === 'text' ? (
                    <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                      {faq.answer}
                    </p>
                  ) : faq.type === 'code' ? (
                    <div className="space-y-3">
                      <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                        {faq.answerText}
                      </p>
                      <div className="rounded-lg p-3 md:p-4 font-mono text-xs md:text-sm overflow-x-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}>
                        <div className="mb-2">
                          <span className="text-gray-500"># Old</span>
                          <div className="text-gray-900 mt-1 break-all">{faq.codeExample.old}</div>
                        </div>
                        <div>
                          <span className="text-gray-500"># New</span>
                          <div className="text-gray-900 mt-1 break-all">{faq.codeExample.new}</div>
                        </div>
                      </div>
                      <p className="text-sm md:text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                        {faq.answerFooter}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
