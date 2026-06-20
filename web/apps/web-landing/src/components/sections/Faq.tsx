'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { LandingSurfaceFrame } from '../ui/ProductConsoleShell'
import { LandingPillarHeader } from '../ui/LandingPillarSection'

const SANS = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

interface FaqEntry {
  question: string
  answer?: string
  type: 'text' | 'code'
  cta?: {
    text: string
    href: string
  }
  answerText?: string
  codeExample?: {
    old: string
    new: string
  }
  answerFooter?: string
}

interface FaqSection {
  title: string
  entries: FaqEntry[]
}

const faqSections: FaqSection[] = [
  {
    title: 'Getting Started',
    entries: [
      {
        question: 'Can I try Igris before committing?',
        answer:
          'Seed is the paid developer entry tier for validating recoverable agent actions, signed receipts, and task inspection. Teams evaluating Igris for production or private deployment can request a guided private preview.',
        type: 'text',
      },
      {
        question: 'Who is Seed for?',
        answer:
          'Seed is for individual builders testing one project, one execution environment, signed receipts, action evidence, and basic receipt verification.',
        type: 'text',
      },
      {
        question: 'How is Igris different from using OpenAI or Anthropic directly?',
        answer:
          'Direct provider calls are enough for simple chat or low-risk generation. Igris is for when agent output becomes real work: reading files, calling APIs, updating records, recovering from failure, and proving what happened afterward.',
        type: 'text',
      },
    ],
  },
  {
    title: 'Pricing & Billing',
    entries: [
      {
        question: 'What is an execution environment?',
        answer:
          'An execution environment is a configured place where Igris can run or coordinate agent task execution, such as a hosted, local, or private deployment surface.',
        type: 'text',
      },
      {
        question: 'What is an agent task run?',
        answer:
          'An agent task run is one submitted task executed through Igris. A run may include multiple committed actions, action evidence, signed receipts, and verification state.',
        type: 'text',
      },
      {
        question: 'What is a verified task run?',
        answer:
          'A verified task run is a completed run with inspectable execution metadata and a signed receipt that can be checked after execution.',
        type: 'text',
      },
      {
        question: 'Do I pay for model inference?',
        answer:
          'No. Igris pricing does not include provider inference costs. You bring your own provider keys or configured execution path, and provider usage is billed separately by the provider.',
        type: 'text',
      },
      {
        question: 'Can I upgrade or downgrade?',
        answer:
          'Yes. Plan changes can adjust project limits, execution environments, task volume, retention, and team access. Downgrades apply according to the billing cycle and current account state.',
        type: 'text',
      },
      {
        question: 'Why is Infinite custom priced?',
        answer:
          'Private deployment, retention, support, audit exports, and governance needs vary by team. Custom pricing lets the deployment scope match the operational requirements instead of forcing every advanced customer into one flat plan.',
        type: 'text',
      },
    ],
  },
  {
    title: 'Execution & Verification',
    entries: [
      {
        question: 'What does Igris verify?',
        answer:
          'Igris produces signed receipts and execution evidence for important task runs, so teams can inspect and verify what happened after execution. Verification behavior depends on the deployment surface and proof path used.',
        type: 'text',
      },
      {
        question: 'Does Igris make the model smarter?',
        answer:
          'No. Igris does not improve model intelligence or text quality. It makes agent execution more recoverable, inspectable, and verifiable once model output becomes work.',
        type: 'text',
      },
      {
        question: 'Does Igris handle fallback automatically?',
        answer:
          'Igris supports configured recovery and failure paths, but behavior depends on your deployment and proof setup. Recovery-sensitive behavior should be validated in your environment before production reliance.',
        type: 'text',
      },
      {
        question: 'Can I use Igris without the dashboard?',
        answer:
          'Yes. Igris can be used through the API or SDK. The console adds operator visibility for task runs, action evidence, receipts, verification state, and account controls.',
        type: 'text',
      },
    ],
  },
  {
    title: 'Deployment & Security',
    entries: [
      {
        question: 'Can I self-host?',
        answer:
          'Private deployment is available through Infinite. The exact deployment model, retention policy, support scope, and security requirements are defined during evaluation.',
        type: 'text',
      },
      {
        question: 'Is my data sent to the cloud?',
        answer:
          'That depends on the execution surface you configure. Provider-backed execution sends requests to the selected provider. Local or private execution keeps work closer to the configured environment. Igris should be configured according to your data and security requirements.',
        type: 'text',
      },
      {
        question: 'Do you train on my data?',
        answer:
          'No. Igris does not train foundation models on your data. If you use external providers, their data handling depends on the provider and account settings you choose.',
        type: 'text',
      },
      {
        question: 'What security controls are available?',
        answer:
          'Igris is designed around controlled execution, permission checks, signed receipts, recovery evidence, and operator visibility. Specific controls depend on the deployment mode and plan.',
        type: 'text',
      },
    ],
  },
]

export default function Faq({ large = false }: { large?: boolean }) {
  const [openSectionIndex, setOpenSectionIndex] = useState<number | null>(null)

  const sectionTitleSize = large ? 'clamp(1rem, 1.2vw, 1.1rem)' : '0.95rem'
  const questionSize = large ? '0.95rem' : '0.875rem'
  const answerSize = large ? '0.95rem' : '0.875rem'
  const chevronSize = large ? 16 : 14

  const toggleSection = (index: number) => {
    setOpenSectionIndex(openSectionIndex === index ? null : index)
  }

  return (
    <section
      id="faq"
      className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200"
    >
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="pt-24 md:pt-40 pb-10 md:pb-14">
          <LandingPillarHeader
            title="Questions"
            description="Common questions about getting started, pricing, execution, verification, and deployment."
          />

          <div className="mt-10 md:mt-12">
            <LandingSurfaceFrame>
              <div className="landing-surface-panel overflow-hidden">
                  {faqSections.map((section, sectionIndex) => {
                    const isOpen = openSectionIndex === sectionIndex
                    const isLast = sectionIndex === faqSections.length - 1

                    return (
                      <div
                        key={section.title}
                        className={!isLast ? 'border-b border-[var(--landing-surface-border)]' : ''}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSection(sectionIndex)}
                          className="w-full text-left px-6 md:px-8 py-5 md:py-6 flex items-center justify-between gap-4 transition-colors hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
                          style={{ fontFamily: SANS }}
                          aria-expanded={isOpen}
                        >
                          <span
                            className="text-black dark:text-[#f6f6f4]"
                            style={{
                              fontSize: sectionTitleSize,
                              fontWeight: 500,
                              lineHeight: 1.3,
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {section.title}
                          </span>
                          <ChevronDown
                            className={`flex-shrink-0 text-gray-500 dark:text-[#8a8a7a] transition-transform duration-200 ${
                              isOpen ? 'rotate-180' : ''
                            }`}
                            size={chevronSize}
                            strokeWidth={1.5}
                          />
                        </button>

                        <div
                          className={`overflow-hidden transition-all duration-300 ${
                            isOpen ? 'max-h-[3000px]' : 'max-h-0'
                          }`}
                        >
                          <div className="px-6 md:px-8 pt-2 pb-6 md:pb-8 space-y-5 border-t border-[var(--landing-surface-border)]">
                            {section.entries.map((faq, entryIndex) => (
                              <div
                                key={faq.question}
                                className={entryIndex > 0 ? 'pt-5 border-t border-[var(--landing-surface-border)]' : ''}
                              >
                                <p
                                  className="text-black dark:text-[#f6f6f4] mb-2"
                                  style={{
                                    fontFamily: SANS,
                                    fontSize: questionSize,
                                    fontWeight: 500,
                                    lineHeight: 1.4,
                                    letterSpacing: '-0.01em',
                                  }}
                                >
                                  {faq.question}
                                </p>
                                {faq.type === 'text' && (
                                  <p
                                    className="text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[62ch]"
                                    style={{ fontFamily: SANS, fontSize: answerSize, lineHeight: 1.6 }}
                                  >
                                    {faq.answer}
                                  </p>
                                )}
                                {faq.type === 'code' && (
                                  <div className="space-y-3">
                                    <p
                                      className="text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[62ch]"
                                      style={{ fontFamily: SANS, fontSize: answerSize, lineHeight: 1.6 }}
                                    >
                                      {faq.answerText}
                                    </p>
                                    <div className="rounded-md border border-[var(--landing-surface-border)] bg-black/[0.02] p-3 font-mono text-xs overflow-x-auto dark:bg-white/[0.02]">
                                      <div className="mb-2">
                                        <span className="text-gray-500 dark:text-[#8a8a7a]"># Old</span>
                                        <div className="text-black dark:text-[#f6f6f4] mt-1 break-all">
                                          {faq.codeExample?.old}
                                        </div>
                                      </div>
                                      <div>
                                        <span className="text-gray-500 dark:text-[#8a8a7a]"># New</span>
                                        <div className="text-black dark:text-[#f6f6f4] mt-1 break-all">
                                          {faq.codeExample?.new}
                                        </div>
                                      </div>
                                    </div>
                                    <p
                                      className="text-gray-600 dark:text-[#a8a898] leading-relaxed max-w-[62ch]"
                                      style={{ fontFamily: SANS, fontSize: answerSize, lineHeight: 1.6 }}
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
                    )
                  })}
              </div>
            </LandingSurfaceFrame>
          </div>
        </div>
      </div>
    </section>
  )
}