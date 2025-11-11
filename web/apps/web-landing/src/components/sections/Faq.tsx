'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const faqEntries = [
  {
    question: "How much can I save?",
    answer: "Early customers typically save 30%+ monthly. Get your exact number - use our ROI calculator or book a free API log analysis to see your personalized savings estimate.",
    type: "text"
  },
  {
    question: "What happens during outages?",
    answer: "Automatic failover to backup providers maintains your service continuity. See it in action - we'll demonstrate live failover during your trial.",
    type: "text"
  },
  {
    question: "Engineering time savings?",
    answer: "Our customers report recovering 10-20+ hours weekly on AI infrastructure management. Verify for yourself - we'll connect you with similar companies to hear their experience.",
    type: "text"
  },
  {
    question: "Is this really just changing one URL?",
    type: "code",
    answerText: "Yes. Change your API base URL and you're routing intelligently in minutes.",
    codeExample: {
      old: "https://api.openai.com/v1",
      new: "https://api.schlep-engine.com/v1"
    },
    answerFooter: "No code changes, no SDK updates, no migration headaches."
  },
  {
    question: "What's the catch? Where's the hidden cost?",
    answer: "No hidden costs. Flat monthly pricing regardless of which providers you use. We don't markup API calls - you keep all your provider discounts and pay them directly.",
    type: "text"
  },
  {
    question: "How do you prove the ROI?",
    answer: "We provide real-time savings dashboards and detailed analytics. You can track exactly how much you're saving compared to your previous setup.",
    type: "text"
  },
  {
    question: "What if I'm locked into one provider?",
    answer: "We make provider diversification risk-free. Test new providers with zero commitment - route a small percentage of traffic to compare performance and cost.",
    type: "text"
  },
  {
    question: "How does caching reduce my costs?",
    answer: "Our multi-layer caching can significantly reduce redundant API calls. Cache performance depends on your request patterns and can be monitored in real-time.",
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
        <div className="relative py-16 px-12" style={{
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

          <div className="text-center mb-16">
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
                className="w-full text-left px-6 py-5 flex items-center justify-between hover:opacity-80 transition-opacity"
              >
                <span className="text-lg font-normal font-inter pr-8" style={{ color: '#000000' }}>
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
                <div className="px-6 pb-5 pt-0">
                  {faq.type === 'text' ? (
                    <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                      {faq.answer}
                    </p>
                  ) : faq.type === 'code' ? (
                    <div className="space-y-3">
                      <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                        {faq.answerText}
                      </p>
                      <div className="rounded-lg p-4 font-mono text-sm" style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}>
                        <div className="mb-2">
                          <span className="text-gray-500"># Old</span>
                          <div className="text-gray-900 mt-1">{faq.codeExample.old}</div>
                        </div>
                        <div>
                          <span className="text-gray-500"># New</span>
                          <div className="text-gray-900 mt-1">{faq.codeExample.new}</div>
                        </div>
                      </div>
                      <p className="text-base text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
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
