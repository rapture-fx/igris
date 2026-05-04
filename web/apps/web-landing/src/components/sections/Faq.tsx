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
    title: "Getting Started",
    entries: [
      {
        question: "Can I try Igris before committing?",
        answer: "Seed is the paid developer entry tier for validating verified AI execution. Teams evaluating Igris for production or private deployment can request a guided private preview.",
        type: "text"
      },
      {
        question: "Who is Seed for?",
        answer: "Seed is for individual builders testing one project, one execution environment, signed execution records, execution events, and basic receipt verification.",
        type: "text"
      },
      {
        question: "How is Igris different from using OpenAI or Anthropic directly?",
        answer: "Direct provider calls are enough for simple chat. Igris is for when AI output starts doing work and you need governed execution, execution events, signed records, and verification-ready receipts.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "What is an execution environment?",
        answer: "An execution environment is a configured place where Igris can run or coordinate AI task execution, such as a hosted, local, or hybrid deployment surface.",
        type: "text"
      },
      {
        question: "What is a verified run?",
        answer: "A verified run is an AI task execution that returns inspectable execution metadata and a signed record or receipt that can be checked after the run.",
        type: "text"
      },
      {
        question: "Do I pay for model inference?",
        answer: "No. Igris pricing does not include provider inference costs. You bring your own provider keys or configured local model path, and provider usage is billed separately by the provider.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade?",
        answer: "Yes. Plan changes can adjust project limits, execution environments, verified run volume, retention, and team access. Downgrades apply according to the billing cycle and current account state.",
        type: "text"
      },
      {
        question: "Why is Infinite custom priced?",
        answer: "Private deployment, retention, support, audit exports, and governance needs vary by team. Custom pricing lets the deployment scope match the operational requirements instead of forcing every advanced customer into one flat plan.",
        type: "text"
      }
    ]
  },
  {
    title: "Execution & Verification",
    entries: [
      {
        question: "What does Igris verify?",
        answer: "Igris helps return execution metadata and signed records for critical runs, so teams can inspect what happened after execution. The exact verification behavior depends on the deployment surface and proof path used.",
        type: "text"
      },
      {
        question: "Does Igris make the model smarter?",
        answer: "No. Igris does not improve model intelligence or text quality. It makes AI execution more governed, inspectable, and verifiable once model output becomes work.",
        type: "text"
      },
      {
        question: "Does Igris handle fallback automatically?",
        answer: "Igris supports configured failure paths, but fallback behavior depends on your deployment and proof status. Stronger hosted-to-local or local-model fallback claims should be validated in your environment before relying on them.",
        type: "text"
      },
      {
        question: "Can I use Igris without the dashboard?",
        answer: "Yes. Igris can be used through the API or SDK. The console adds operator visibility for execution runs, events, signed records, environment status, and account controls.",
        type: "text"
      }
    ]
  },
  {
    title: "Deployment & Security",
    entries: [
      {
        question: "Can I self-host?",
        answer: "Private deployment is available through Infinite. The exact deployment model, retention policy, support scope, and security requirements are defined during evaluation.",
        type: "text"
      },
      {
        question: "Is my data sent to the cloud?",
        answer: "That depends on the execution surface you configure. Provider-backed execution sends requests to the selected provider. Local execution keeps work closer to the configured environment. Igris should be configured according to your data and security requirements.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. Igris does not train foundation models on your data. If you use external providers, their data handling depends on the provider and account settings you choose.",
        type: "text"
      },
      {
        question: "What security controls are available?",
        answer: "Igris is designed around governed execution, permission checks, signed records, and operator visibility. Specific controls depend on the deployment mode and plan.",
        type: "text"
      }
    ]
  }
];

export default function Faq() {
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(null);

  const toggleSection = (index: number) => {
    setOpenSectionIndex(openSectionIndex === index ? null : index);
  };

  return (
    <>
      {/* Full-width top border */}
      <div style={{ borderTop: 'var(--section-border)' }} />
      <section id="faq" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 min-h-0 flex flex-col" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>

            <div className="flex flex-col items-center" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
              {/* Title */}
              <div className="w-full max-w-[700px] text-left mb-8">
                <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Questions and answers
                </h2>
              </div>

              <div className="space-y-4 w-full max-w-[700px]">
                {faqSections.map((section, sectionIndex) => (
                  <div
                    key={sectionIndex}
                    className={`landing-surface-card rounded-xl border transition-all duration-300 ${
                      openSectionIndex === sectionIndex
                        ? 'shadow-sm'
                        : 'landing-surface-card-interactive hover:shadow-sm'
                    }`}
                  >
                    {/* Section Title */}
                    <button
                      onClick={() => toggleSection(sectionIndex)}
                      className="w-full text-left px-6 py-4 flex items-center justify-between gap-2 transition-colors"
                    >
                      <h3 className="text-sm font-medium text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                        {section.title}
                      </h3>
                      <ChevronDown
                        className={`flex-shrink-0 transition-transform duration-200 ${
                          openSectionIndex === sectionIndex ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'rgba(156, 163, 175, 0.6)' }}
                        size={16}
                      />
                    </button>

                    {/* Collapsible content */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSectionIndex === sectionIndex ? 'max-h-[3000px]' : 'max-h-0'
                      }`}
                    >
                      <div className="px-6 pb-5 space-y-4">
                        {section.entries.map((faq, entryIndex) => (
                          <div key={entryIndex} className="border-t border-gray-200 dark:border-[#f6f6f4]/5 pt-4">
                            <p className="text-sm font-medium mb-1.5 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                              {faq.question}
                            </p>
                            {faq.type === 'text' ? (
                              <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                                {faq.answer}
                              </p>
                            ) : faq.type === 'code' ? (
                              <div className="space-y-3">
                                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
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
                                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
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

          </div>
        </div>
      </section>
    </>
  );
}
