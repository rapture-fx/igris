'use client';

import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

interface FaqEntry {
  question: string;
  answer?: string;
  type: 'text' | 'code';
  cta?: {
    text: string;
    href: string;
  };
  answerText?: string;
  codeExample?: {
    old: string;
    new: string;
  };
  answerFooter?: string;
}

const faqEntries: FaqEntry[] = [
  {
    question: "How does intelligent quality routing work?",
    answer: "Schlep Engine automatically selects the best model for every request by analyzing performance, context, and historical outcomes. It optimizes for accuracy, speed, or cost based on your priorities with continuous learning built in, ensuring each request gets routed to the most appropriate model.",
    type: "text"
  },
  {
    question: "What is adaptive optimization and how does it maintain quality?",
    answer: "Our real-time quality scoring detects performance shifts across providers and dynamically adjusts routing to maintain your targets. This ensures consistent output quality and predictable latency without requiring manual tuning or constant monitoring.",
    type: "text"
  },
  {
    question: "How do I manage multiple providers in one place?",
    answer: "Schlep Engine provides one unified dashboard and API for cost governance, quotas, provider usage, and performance management. Multi-tenant isolation and automated failover ensure continuity even under provider outages, giving you complete control from a single interface.",
    type: "text"
  },
  {
    question: "How can I test new routing strategies without risking production?",
    answer: "Shadow Mode lets you test new routing strategies in parallel with production traffic without impacting end users. Automatic rollback on SLO violations ensures zero-downtime deployments while enabling continuous improvement and safe experimentation.",
    type: "text"
  },
  {
    question: "Do I need to share my API keys with Schlep Engine?",
    answer: "No. With our Bring Your Own Key (BYOK) architecture, you retain full control over your provider keys. We handle routing and optimization while you keep complete ownership of all credentials, data security, and access control.",
    type: "text"
  },
  {
    question: "How does parallel execution improve response times?",
    answer: "Parallel execution boosts responsiveness by running multiple providers simultaneously and streaming from the fastest result. Built-in fallback mechanisms prevent interruptions and ensure no dropped tokens, giving you faster responses without sacrificing reliability.",
    type: "text"
  },
  {
    question: "What is Council Mode and when should I use it?",
    answer: "Council Mode upgrades accuracy for complex queries by running multiple models simultaneously and synthesizing the best answer. It's ideal for high-stakes workflows in medical, legal, financial, and other mission-critical decision-making scenarios where accuracy is paramount.",
    type: "text"
  },
  {
    question: "How does Schlep Engine learn and improve over time?",
    answer: "Our Cognitive Advisor is a built-in intelligence layer that monitors intent patterns, detects degradation, predicts optimal routing strategies, and recommends configuration updates. All recommendations are safely validated in shadow mode before being applied to production.",
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
            <h2 className="text-xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
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
