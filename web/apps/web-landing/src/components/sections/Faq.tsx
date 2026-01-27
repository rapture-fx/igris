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

interface FaqSection {
  title: string;
  entries: FaqEntry[];
}

const faqSections: FaqSection[] = [
  {
    title: "Getting Started & Trial",
    entries: [
      {
        question: "Do you offer a free tier?",
        answer: "Yes. Igris offers a free tier with limited usage, designed for early evaluation, development, and non-production testing.",
        type: "text"
      },
      {
        question: "What's the difference between the free tier and the trial?",
        answer: "The free tier provides ongoing access with strict usage limits. The 14-day trial temporarily unlocks full feature access so teams can evaluate Igris under real workloads before upgrading.",
        type: "text"
      },
      {
        question: "What happens after my 14-day trial ends?",
        answer: "After the trial ends, your account automatically reverts to the free tier. All configurations and historical data are preserved. Production SLAs apply only to paid plans.",
        type: "text"
      },
      {
        question: "Is the free tier suitable for production?",
        answer: "No. The free tier is intended for development, experimentation, and validation. Production workloads require a paid plan to access SLAs, higher limits, and compliance features.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "Why is the free tier limited?",
        answer: "Igris operates production-grade routing and execution infrastructure. The free tier is intentionally constrained to ensure platform stability while allowing teams to validate integration and value.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade my plan?",
        answer: "Yes. Upgrades take effect immediately with prorated billing. Downgrades apply at the start of your next billing cycle. No data or configuration is lost.",
        type: "text"
      },
      {
        question: "Who pays for the underlying model usage?",
        answer: "You retain direct relationships with your AI providers. Igris routes and executes requests but does not resell model usage.",
        type: "text"
      },
      {
        question: "Can I cancel anytime?",
        answer: "Yes. Paid plans can be canceled at any time. Access remains active through the end of the billing period.",
        type: "text"
      }
    ]
  },
  {
    title: "Product & Architecture",
    entries: [
      {
        question: "What's the difference between Overture, Runtime, and Hybrid?",
        answer: "Overture determines the optimal provider for each request. Runtime securely executes those decisions. Hybrid connects decision and execution into a closed-loop system that improves automatically over time. Hybrid represents the complete Igris value proposition.",
        type: "text"
      },
      {
        question: "Can I use Overture or Runtime independently?",
        answer: "Yes. Both are available as standalone products. Hybrid is optional but delivers compounding performance improvements.",
        type: "text"
      },
      {
        question: "How does Igris choose the best model for every request?",
        answer: "Igris uses Bayesian Thompson Sampling informed by real-time latency, cost, quality, and recent performance signals. Routing adapts continuously without manual tuning.",
        type: "text"
      }
    ]
  },
  {
    title: "Reliability, Security & Failure Handling",
    entries: [
      {
        question: "What happens if a model starts hallucinating or degrading in quality?",
        answer: "Igris continuously monitors quality and consistency signals. When degradation is detected, traffic is automatically reweighted away from the affected provider. If quality thresholds are breached, the system falls back to a known-safe configuration to protect downstream applications.",
        type: "text"
      },
      {
        question: "What happens if an AI provider slows down or fails?",
        answer: "Igris detects provider degradation within seconds and automatically shifts traffic to healthier providers. Circuit breakers prevent cascading failures.",
        type: "text"
      },
      {
        question: "What happens if the Igris control plane becomes unavailable?",
        answer: "Igris is designed with a fail-safe architecture. If the control plane becomes unavailable, Runtime continues operating using the last known safe routing configuration. Customer traffic is never blocked. Once the control plane recovers, learning and optimization resume automatically.",
        type: "text"
      },
      {
        question: "Can a bad routing decision take my system down?",
        answer: "No. Routing decisions are bounded by policy constraints and enforced at execution time. Quotas, isolation, and circuit breakers ensure that no single decision can cause cascading failures. In worst-case scenarios, Igris reverts to customer-defined fallback behavior.",
        type: "text"
      },
      {
        question: "What uptime guarantees do you provide?",
        answer: "Paid plans include SLAs ranging from 99.0% to 99.9%, depending on tier. The free tier and trials do not include uptime guarantees.",
        type: "text"
      }
    ]
  },
  {
    title: "Operations, Control & Trust",
    entries: [
      {
        question: "Do I lose control over routing decisions?",
        answer: "No. You define policies, constraints, and fallback rules. Igris optimizes strictly within those boundaries.",
        type: "text"
      },
      {
        question: "Can I observe and audit routing behavior?",
        answer: "Yes. All routing and execution outcomes are observable through logs and dashboards.",
        type: "text"
      },
      {
        question: "Do you train models on my data?",
        answer: "No. Igris does not train foundation models or share customer data. Data handling follows provider-specific policies and customer-defined retention settings.",
        type: "text"
      }
    ]
  }
];

export default function Faq() {
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(0);

  const toggleSection = (index: number) => {
    setOpenSectionIndex(openSectionIndex === index ? null : index);
  };

    return (
     <section id="faq" className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
       <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
           <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[750px]">

           {/* Mobile Layout - Title first, then FAQ items */}
           <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
             {/* Title Section - Shows first on mobile */}
             <div className="mb-8 text-left">
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Questions and answers
               </h2>
             </div>

             {/* FAQ Items - Shows after title on mobile */}
             <div className="space-y-4">
               {faqSections.map((section, sectionIndex) => (
                 <div key={sectionIndex}>
                   {/* Section Title - Clickable */}
                   <button
                     onClick={() => toggleSection(sectionIndex)}
                     className="w-full text-left px-4 py-3 flex items-center justify-between gap-2 hover:opacity-80 transition-opacity border section-border bg-[#f6f6f4] dark:bg-[#1b1912]"
                   >
                     <h3 className="text-base font-semibold font-inter text-[#000000] dark:text-[#f6f6f4]">
                       {section.title}
                     </h3>
                     <ChevronDown
                       className={`flex-shrink-0 transition-transform duration-200 ${
                         openSectionIndex === sectionIndex ? 'rotate-180' : ''
                       }`}
                       style={{ color: 'rgba(156, 163, 175, 0.6)' }}
                       size={20}
                     />
                   </button>

                   {/* Section FAQ Items - Collapsible */}
                   <div
                     className={`overflow-hidden transition-all duration-300 ${
                       openSectionIndex === sectionIndex ? 'max-h-[3000px]' : 'max-h-0'
                     }`}
                   >
                     <div className="mt-2 space-y-2">
                       {section.entries.map((faq, entryIndex) => (
                         <div key={entryIndex} className="border section-border bg-[#f6f6f4] dark:bg-[#1b1912] p-4">
                           <p className="text-sm font-medium font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                             {faq.question}
                           </p>
                           {faq.type === 'text' ? (
                             <p className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                               {faq.answer}
                             </p>
                           ) : faq.type === 'code' ? (
                             <div className="space-y-3">
                               <p className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                                 {faq.answerText}
                               </p>
                               <div className="rounded-lg p-3 font-mono text-xs overflow-x-auto bg-black/[0.03] dark:bg-white/[0.03]">
                                 <div className="mb-2">
                                   <span className="text-gray-500 dark:text-[#a8a898]"># Old</span>
                                   <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.old}</div>
                                 </div>
                                 <div>
                                   <span className="text-gray-500 dark:text-[#a8a898]"># New</span>
                                   <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.new}</div>
                                 </div>
                               </div>
                               <p className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                                 {faq.answerFooter}
                               </p>
                             </div>
                           ) : null}
                         </div>
                       ))}
                     </div>
                   </div>
                 </div>
               ))}
             </div>
           </div>

           {/* Desktop Layout - Two-column grid */}
           <div className="hidden md:grid md:grid-cols-3 gap-0 absolute inset-0">
             {/* Left Column - FAQ Items (2 columns wide) */}
               <div className="hidden md:flex md:col-span-2 flex-col justify-start items-center" style={{
                 paddingTop: '3rem',
                 paddingBottom: '3rem',
                 paddingRight: '1.5rem'
               }}>
               <div className="space-y-3 w-full max-w-md">
                 {faqSections.map((section, sectionIndex) => (
                   <div key={sectionIndex}>
                     {/* Section Title - Clickable */}
                     <button
                       onClick={() => toggleSection(sectionIndex)}
                       className="w-full text-left px-3 py-2.5 flex items-center justify-between gap-2 hover:opacity-80 transition-opacity border section-border bg-[#f6f6f4] dark:bg-[#1b1912]"
                     >
                       <h3 className="text-sm font-semibold font-inter text-[#000000] dark:text-[#f6f6f4]">
                         {section.title}
                       </h3>
                       <ChevronDown
                         className={`flex-shrink-0 transition-transform duration-200 ${
                           openSectionIndex === sectionIndex ? 'rotate-180' : ''
                         }`}
                         style={{ color: 'rgba(156, 163, 175, 0.6)' }}
                         size={18}
                       />
                     </button>

                     {/* Section FAQ Items - Collapsible */}
                     <div
                       className={`overflow-hidden transition-all duration-300 ${
                         openSectionIndex === sectionIndex ? 'max-h-[3000px]' : 'max-h-0'
                       }`}
                     >
                       <div className="mt-2 space-y-2">
                         {section.entries.map((faq, entryIndex) => (
                           <div key={entryIndex} className="border section-border bg-[#f6f6f4] dark:bg-[#1b1912] p-3">
                             <p className="text-sm font-medium font-inter mb-1.5 text-[#000000] dark:text-[#f6f6f4]">
                               {faq.question}
                             </p>
                             {faq.type === 'text' ? (
                               <p className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                                 {faq.answer}
                               </p>
                             ) : faq.type === 'code' ? (
                               <div className="space-y-2">
                                 <p className="text-xs text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed">
                                   {faq.answerText}
                                 </p>
                                 <div className="rounded-lg p-2 font-mono text-xs overflow-x-auto bg-black/[0.03] dark:bg-white/[0.03]">
                                   <div className="mb-2">
                                     <span className="text-gray-500 dark:text-[#a8a898]"># Old</span>
                                     <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.old}</div>
                                   </div>
                                   <div>
                                     <span className="text-gray-500 dark:text-[#a8a898]"># New</span>
                                     <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.new}</div>
                                   </div>
                                 </div>
                                 <p className="text-xs text-gray-700 dark:text-gray-300 font-inter leading-relaxed">
                                   {faq.answerFooter}
                                 </p>
                               </div>
                             ) : null}
                           </div>
                         ))}
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {/* Right Column - Title (Desktop only) */}
             <div className="hidden md:flex text-left md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5 border-gray-300" style={{
               paddingTop: '3rem',
               paddingBottom: '3rem',
               paddingLeft: '1rem'
             }}>
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Questions and answers
               </h2>
             </div>
           </div>
        </div>
      </div>
    </section>
  );
}
