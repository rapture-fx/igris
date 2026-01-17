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
    question: "What happens after my 14-day trial ends?",
    answer: "Your trial access expires automatically. To continue using Igris, you must upgrade to a paid plan. All configuration and data are preserved for 30 days after trial expiration.",
    type: "text"
  },
  {
    question: "Why is there no free tier?",
    answer: "Overture and Runtime require infrastructure with hard guarantees. A free tier cannot support the reliability and security standards we maintain. The trial provides full feature access so you can validate value before committing.",
    type: "text"
  },
  {
    question: "What are the trial usage limits?",
    answer: "Trials enforce hard usage caps on decision volume and execution resources. These caps prevent runaway costs while allowing comprehensive testing of all features.",
    type: "text"
  },
  {
    question: "Can I upgrade or downgrade between tiers?",
    answer: "Yes. Upgrades take effect immediately with prorated billing. Downgrades apply at the start of your next billing cycle. No data loss occurs during tier changes.",
    type: "text"
  },
  {
    question: "What's the difference between Overture, Runtime, and Hybrid?",
    answer: "Overture makes routing decisions. Runtime executes those decisions securely. Hybrid combines both into a closed-loop system where execution feeds learning. Hybrid is the complete Igris value proposition.",
    type: "text"
  },
  {
    question: "Can I buy Overture or Runtime separately?",
    answer: "Yes. Both are available as standalone products. However, the closed-loop intelligence available only in Hybrid compounds value over time and provides verifiable trust.",
    type: "text"
  },
  {
    question: "How does Hybrid improve over time?",
    answer: "Every execution outcome is linked to its originating decision through cryptographic signatures. This data continuously improves routing models without manual intervention.",
    type: "text"
  },
  {
    question: "What production guarantees do you provide?",
    answer: "Paid tiers include SLA guarantees ranging from 99.0% to 99.9% uptime. Trials provide full feature access with no production guarantees. Compliance-ready execution is available in the Scale Hybrid tier.",
    type: "text"
  },
  {
    question: "How does Overture choose the best model for every request?",
    answer: "We use Bayesian Thompson Sampling with real-time quality scoring. Latency, accuracy, cost, and recent performance shifts all influence routing. The engine learns continuously and self-tunes without requiring manual adjustments.",
    type: "text"
  },
  {
    question: "What happens if a provider slows down or starts hallucinating?",
    answer: "Our adaptive optimizer detects degradation within seconds. Traffic is automatically reweighted toward healthier providers. If SLO thresholds are breached, the circuit breaker reverts to a safe configuration to protect quality.",
    type: "text"
  },
  {
    question: "How do you keep traffic isolated across providers?",
    answer: "Requests undergo provider-specific validation before routing. Each provider is sandboxed with strict quotas, error fencing, and health checks. Failures remain isolated and never cascade across models.",
    type: "text"
  }
];

export default function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

    return (
     <section id="faq" className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
       <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
         <div className="relative py-8 md:py-12 lg:py-16 px-4 md:px-8 lg:px-12 border border-gray-300 dark:border-[#f6f6f4]/30" style={{
           backgroundColor: '#f6f6f4'
         }}>

           <div className="text-center mb-8 md:mb-12 lg:mb-16">
             <h2 className="text-xl md:text-xl lg:text-2xl font-inter mb-4" style={{ color: '#000000' }}>
               Questions and answers
             </h2>
           </div>

           <div className="max-w-3xl mx-auto space-y-2">
           {faqEntries.map((faq, index) => (
             <div
               key={index}
               className="transition-all duration-200 border border-gray-300 dark:border-[#f6f6f4]/30"
               style={{
                 backgroundColor: '#f6f6f4'
               }}
             >
               <button
                 onClick={() => toggleFaq(index)}
                 className="w-full text-left px-4 md:px-4 py-3 md:py-4 flex items-center justify-between gap-4 hover:opacity-80 transition-opacity"
               >
                 <span className="text-sm md:text-sm font-normal font-inter flex-1" style={{ color: '#000000' }}>
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
                 <div className="px-4 md:px-4 pb-3 md:pb-4 pt-0">
                   {faq.type === 'text' ? (
                     <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                       {faq.answer}
                     </p>
                   ) : faq.type === 'code' ? (
                     <div className="space-y-3">
                       <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                         {faq.answerText}
                       </p>
                      <div className="rounded-lg p-3 md:p-4 font-mono text-xs overflow-x-auto" style={{ backgroundColor: 'rgba(0, 0, 0, 0.03)' }}>
                        <div className="mb-2">
                          <span className="text-gray-500"># Old</span>
                          <div className="text-gray-900 mt-1 break-all">{faq.codeExample.old}</div>
                        </div>
                        <div>
                          <span className="text-gray-500"># New</span>
                          <div className="text-gray-900 mt-1 break-all">{faq.codeExample.new}</div>
                        </div>
                      </div>
                       <p className="text-xs md:text-sm text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
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
