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
    question: "How does Schelp-engine choose the best model for every request?",
    answer: "We use Bayesian Thompson Sampling with real-time quality scoring. Latency, accuracy, cost, and recent performance shifts all influence routing. The engine learns continuously and self-tunes without requiring manual adjustments.",
    type: "text"
  },
  {
    question: "What happens if a provider slows down or starts hallucinating?",
    answer: "Our adaptive optimizer detects degradation within seconds. Traffic is automatically reweighted toward healthier providers. If SLO thresholds are breached, the circuit breaker reverts to a safe configuration to protect quality.",
    type: "text"
  },
  {
    question: "How does Schelp-engine behave during an outage?",
    answer: "EscapeVector Mode keeps full routing intelligence alive for 72 hours using cached Bayesian parameters. Even if our control plane is offline, your traffic continues normally with no fallback to round-robin or naive heuristics.",
    type: "text"
  },
  {
    question: "Can I bypass Schelp-engine instantly?",
    answer: "Yes. Gold Code Override gives you a one-variable, instant full bypass. Enterprises use this as part of their break-glass protocols for compliance and incident response.",
    type: "text"
  },
  {
    question: "Do you store or manage my provider API keys?",
    answer: "No. With BYOK, keys never leave your environment. You own authentication, data access, and rotation windows. Schelp-engine handles orchestration without ever touching your credentials.",
    type: "text"
  },
  {
    question: "How do you keep traffic isolated across providers?",
    answer: "Requests undergo provider-specific validation before routing. Each provider is sandboxed with strict quotas, error fencing, and health checks. Failures remain isolated and never cascade across models.",
    type: "text"
  },
  {
    question: "Can I test routing changes safely before deploying them?",
    answer: "Shadow Mode allows new routing strategies to run in parallel with production. All decisions are validated against real traffic with zero risk of user impact. Automatic rollback is triggered on any SLO violation.",
    type: "text"
  },
  {
    question: "What is Council Mode and why does it matter?",
    answer: "Council Mode runs multiple models in parallel and synthesizes a consensus answer. It is ideal for high-stakes workflows where accuracy matters more than speed or cost.",
    type: "text"
  },
  {
    question: "Is it easy to switch from OpenAI, Azure, Anthropic, or others?",
    type: "code",
    answerText: "Yes. Replace your base URL and you're done.",
    codeExample: {
      old: "https://api.openai.com/v1",
      new: "https://api.schelp-engine.com/v1"
    },
    answerFooter: "No SDK rewrites, no migration scripts, no vendor lock-in. You can integrate in under five minutes."
  },
  {
    question: "Will Schelp-engine increase my latency?",
    answer: "No. In most cases, routing reduces mean latency by selecting the fastest healthy provider at the moment of execution. Parallel execution and partial streaming keep responses responsive under load.",
    type: "text"
  },
  {
    question: "How does Rust WASM improve frontend performance?",
    answer: "EscapeVector runs as a compact Rust-compiled WASM module under 150 KB. It performs optimization 3–5x faster than TypeScript equivalents and brings full resilience to browser frameworks like Next.js or Remix.",
    type: "text"
  },
  {
    question: "How do you bill for usage beyond plan limits?",
    answer: "Overages are billed in simple, transparent units per 1,000 requests. No token markup, no hidden multipliers.",
    type: "text"
  }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section id="faq" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-12" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>

          <div className="text-center mb-8 md:mb-12 lg:mb-16">
            <h2 className="text-2xl md:text-2xl lg:text-3xl font-inter mb-4" style={{ color: '#000000' }}>
              Questions and answers
            </h2>
          </div>

          <div className="max-w-4xl mx-auto space-y-4">
          {faqEntries.map((faq, index) => (
            <div
              key={index}
              className="transition-all duration-200"
              style={{
                backgroundColor: '#f6f6f4',
                border: '1px solid rgba(156, 163, 175, 0.3)'
              }}
            >
              <button
                onClick={() => toggleFaq(index)}
                className="w-full text-left px-4 md:px-6 py-4 md:py-5 flex items-center justify-between gap-4 hover:opacity-80 transition-opacity"
              >
                <span className="text-base md:text-base font-normal font-inter flex-1" style={{ color: '#000000' }}>
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
