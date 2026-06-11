'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useTheme } from 'next-themes';

const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

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
        answer: "Seed is the paid developer entry tier for validating recoverable agent actions, signed receipts, and task inspection. Teams evaluating Igris for production or private deployment can request a guided private preview.",
        type: "text"
      },
      {
        question: "Who is Seed for?",
        answer: "Seed is for individual builders testing one project, one execution environment, signed receipts, action evidence, and basic receipt verification.",
        type: "text"
      },
      {
        question: "How is Igris different from using OpenAI or Anthropic directly?",
        answer: "Direct provider calls are enough for simple chat or low-risk generation. Igris is for when agent output becomes real work: reading files, calling APIs, updating records, recovering from failure, and proving what happened afterward.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "What is an execution environment?",
        answer: "An execution environment is a configured place where Igris can run or coordinate agent task execution, such as a hosted, local, or private deployment surface.",
        type: "text"
      },
      {
        question: "What is an agent task run?",
        answer: "An agent task run is one submitted task executed through Igris. A run may include multiple committed actions, action evidence, signed receipts, and verification state.",
        type: "text"
      },
      {
        question: "What is a verified task run?",
        answer: "A verified task run is a completed run with inspectable execution metadata and a signed receipt that can be checked after execution.",
        type: "text"
      },
      {
        question: "Do I pay for model inference?",
        answer: "No. Igris pricing does not include provider inference costs. You bring your own provider keys or configured execution path, and provider usage is billed separately by the provider.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade?",
        answer: "Yes. Plan changes can adjust project limits, execution environments, task volume, retention, and team access. Downgrades apply according to the billing cycle and current account state.",
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
        answer: "Igris produces signed receipts and execution evidence for important task runs, so teams can inspect and verify what happened after execution. Verification behavior depends on the deployment surface and proof path used.",
        type: "text"
      },
      {
        question: "Does Igris make the model smarter?",
        answer: "No. Igris does not improve model intelligence or text quality. It makes agent execution more recoverable, inspectable, and verifiable once model output becomes work.",
        type: "text"
      },
      {
        question: "Does Igris handle fallback automatically?",
        answer: "Igris supports configured recovery and failure paths, but behavior depends on your deployment and proof setup. Recovery-sensitive behavior should be validated in your environment before production reliance.",
        type: "text"
      },
      {
        question: "Can I use Igris without the dashboard?",
        answer: "Yes. Igris can be used through the API or SDK. The console adds operator visibility for task runs, action evidence, receipts, verification state, and account controls.",
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
        answer: "That depends on the execution surface you configure. Provider-backed execution sends requests to the selected provider. Local or private execution keeps work closer to the configured environment. Igris should be configured according to your data and security requirements.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. Igris does not train foundation models on your data. If you use external providers, their data handling depends on the provider and account settings you choose.",
        type: "text"
      },
      {
        question: "What security controls are available?",
        answer: "Igris is designed around controlled execution, permission checks, signed receipts, recovery evidence, and operator visibility. Specific controls depend on the deployment mode and plan.",
        type: "text"
      }
    ]
  }
];

export default function Faq({ large = false }: { large?: boolean }) {
  const { theme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(null);

  useEffect(() => { setMounted(true); }, []);

  const isDark = mounted && theme === 'dark';

  // `large` keeps the exact pricing-page design but scales the type up for
  // the landing-page placement.
  const maxW = large ? 'max-w-[760px]' : 'max-w-[700px]';
  const titleCls = large ? 'text-2xl md:text-3xl lg:text-4xl' : 'text-xl md:text-2xl lg:text-3xl';
  const sectionTitleCls = large ? 'text-base md:text-lg' : 'text-sm';
  const questionCls = large ? 'text-sm md:text-base' : 'text-xs';
  const answerCls = large ? 'text-sm md:text-[15px]' : 'text-xs';
  const chevronSize = large ? 18 : 14;

  const toggleSection = (index: number) => {
    setOpenSectionIndex(openSectionIndex === index ? null : index);
  };

  return (
    <>
      <section id="faq" className="bg-white dark:bg-[#110f0f] text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="mx-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-2 md:px-4 lg:px-6 min-h-0 flex flex-col">
            <div className="flex flex-col items-center py-24 md:py-40">

              {/* Title */}
              <div className={`w-full ${maxW} text-left mb-8`}>
                <h2
                  className={`${titleCls} text-[#000000] dark:text-[#f6f6f4]`}
                  style={{ fontFamily: SANS }}
                >
                  Questions and answers
                </h2>
              </div>

              {/* Vertical stack */}
              <div className={`w-full ${maxW} px-0 space-y-4`}>
                {faqSections.map((section, sectionIndex) => (
                  <div
                    key={sectionIndex}
                    className="rounded-3xl border border-gray-200 dark:border-[#2a2a2a] shadow overflow-hidden bg-white dark:bg-[#1a1a1a] flex flex-col"
                  >
                    {/* Header strip — matches pricing card tier name row */}
                    <button
                      onClick={() => toggleSection(sectionIndex)}
                      className="w-full text-left px-5 py-6 flex items-center justify-between gap-2 transition-colors"
                      style={{ fontFamily: SANS }}
                    >
                      <span className={`${sectionTitleCls} font-semibold text-black dark:text-[#f6f6f4]`}>
                        {section.title}
                      </span>
                      <ChevronDown
                        className={`flex-shrink-0 transition-transform duration-200 ${
                          openSectionIndex === sectionIndex ? 'rotate-180' : ''
                        }`}
                        style={{ color: 'rgba(156, 163, 175, 0.6)' }}
                        size={chevronSize}
                      />
                    </button>

                    {/* Expandable inner panel — matches pricing card nested gray panel */}
                    <div
                      className={`overflow-hidden transition-all duration-300 ${
                        openSectionIndex === sectionIndex ? 'max-h-[3000px]' : 'max-h-0'
                      }`}
                    >
                      <div
                        className="border-t border-gray-200 dark:border-[#2a2a2a] rounded-t-3xl px-5 pt-5 pb-6 space-y-4"
                        style={{ backgroundColor: isDark ? '#111' : '#f9fafb' }}
                      >
                        {section.entries.map((faq, entryIndex) => (
                          <div
                            key={entryIndex}
                            className={entryIndex > 0 ? 'border-t border-gray-200 dark:border-[#f6f6f4]/5 pt-4' : ''}
                          >
                            <p
                              className={`${questionCls} font-semibold mb-1.5 text-black dark:text-[#f6f6f4]`}
                              style={{ fontFamily: SANS }}
                            >
                              {faq.question}
                            </p>
                            {faq.type === 'text' && (
                              <p
                                className={`${answerCls} text-gray-600 dark:text-[#a8a898] leading-relaxed`}
                                style={{ fontFamily: SANS }}
                              >
                                {faq.answer}
                              </p>
                            )}
                            {faq.type === 'code' && (
                              <div className="space-y-3">
                                <p
                                  className={`${answerCls} text-gray-600 dark:text-[#a8a898] leading-relaxed`}
                                  style={{ fontFamily: SANS }}
                                >
                                  {faq.answerText}
                                </p>
                                <div className="rounded-xl p-3 font-mono text-xs overflow-x-auto bg-black/[0.03] dark:bg-white/[0.03]">
                                  <div className="mb-2">
                                    <span className="text-gray-500 dark:text-[#a8a898]"># Old</span>
                                    <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.old}</div>
                                  </div>
                                  <div>
                                    <span className="text-gray-500 dark:text-[#a8a898]"># New</span>
                                    <div className="text-gray-900 dark:text-[#c8c8b8] mt-1 break-all">{faq.codeExample?.new}</div>
                                  </div>
                                </div>
                                <p
                                  className={`${answerCls} text-gray-600 dark:text-[#a8a898] leading-relaxed`}
                                  style={{ fontFamily: SANS }}
                                >
                                  {faq.answerFooter}
                                </p>
                              </div>
                            )}
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
