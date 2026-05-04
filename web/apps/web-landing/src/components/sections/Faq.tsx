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
        question: "Can I try Igris before paying?",
        answer: "Yes. Every plan includes a 7-day free trial — no credit card required to start. You get full access to your chosen tier during the trial. If you don't subscribe, your account downgrades to Seed at the end of the trial.",
        type: "text"
      },
      {
        question: "What hardware do I need?",
        answer: "Any x86_64 or ARM64 device running Linux or macOS with at least 512MB RAM. Tested on Raspberry Pi 4, NVIDIA Jetson, Apple Silicon, and standard servers. The runtime binary is under 16MB.",
        type: "text"
      },
      {
        question: "Do I need internet connectivity?",
        answer: "Not always. Hosted provider-backed execution requires connectivity, while local execution can run where you configure it. Exact cloud-to-local fallback behavior depends on deployment mode and proof status, so treat local fallback claims carefully unless you have validated them in your environment.",
        type: "text"
      },
      {
        question: "What models can I use?",
        answer: "Any GGUF format model — Llama, Mistral, Phi-3, Qwen, and thousands more from HuggingFace. You can also fine-tune on-device with QLoRA and use your own custom models. Bring your own model, no vendor lock-in.",
        type: "text"
      },
      {
        question: "How is this different from using OpenAI/Anthropic directly?",
        answer: "Direct provider calls are fine for simple chat. Igris is for workloads where AI output starts doing work and you need governed execution, execution events, signed records, and verification-ready receipts. If you configure multiple providers, advanced path selection can help choose between them, but that is implementation detail rather than the whole product story.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "What is a runtime instance?",
        answer: "A runtime instance is a deployed Igris runtime executing autonomous workloads on a server, edge device, robot, or agent host.",
        type: "text"
      },
      {
        question: "Do I pay for inference?",
        answer: "No. Igris does not host AI models. You provide your own model providers such as OpenAI, Anthropic, DeepSeek, Gemini, or local models.",
        type: "text"
      },
      {
        question: "Can I scale beyond 500 instances?",
        answer: "Yes. Enterprise deployments can scale beyond 500 instances with volume pricing.",
        type: "text"
      },
      {
        question: "What happens if I exceed my instance limit?",
        answer: "Overage pricing applies at $2/device/month for Horizon and $1.50/device/month for Infinite. You'll only pay for the additional instances you use.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade?",
        answer: "Yes. Upgrades take effect immediately. Downgrades apply at the start of your next billing cycle. No configuration or data is lost when changing plans.",
        type: "text"
      }
    ]
  },
  {
    title: "Platform & Features",
    entries: [
      {
        question: "What is Thompson Sampling?",
        answer: "An advanced adaptive path-selection strategy used in some Igris configurations. It is one possible implementation detail inside the Execute stage, not a required part of using Igris.",
        type: "text"
      },
      {
        question: "What are Speculative Execution and Council Mode?",
        answer: "They are advanced or preview-oriented execution patterns for parallel path testing or multi-path review. Treat them as specialized workflows rather than default behavior, and avoid assuming broad performance gains unless you have benchmarked them yourself.",
        type: "text"
      },
      {
        question: "How do the AI agents work?",
        answer: "Igris supports AI tasks that can plan, reflect, and use tools such as HTTP, shell, or filesystem access when policy allows. The important part is that tool use stays bounded by permissions, events are recorded, and the run remains inspectable afterward.",
        type: "text"
      },
      {
        question: "What are Behavior Trees?",
        answer: "A hybrid execution engine combining deterministic control flow (sequence, selector, parallel nodes) with LLM-powered adaptive reasoning. The LLM can generate and modify subtrees at runtime, with watchdog safety and bounded execution guarantees.",
        type: "text"
      },
      {
        question: "Can I use it without the dashboard?",
        answer: "Yes. Local execution surfaces can run without the console. The console adds operator visibility for runs, execution events, signed records, environment status, and account controls when you need them.",
        type: "text"
      }
    ]
  },
  {
    title: "Security & Privacy",
    entries: [
      {
        question: "How secure is the platform?",
        answer: "Every routing decision is cryptographically signed with Ed25519. API keys are encrypted at rest with AES-256-GCM. The runtime uses post-quantum TLS (Rustls + AWS-LC-RS). JWT authentication with token blacklisting protects all API endpoints. Tool execution runs in sandboxed environments with enforced resource limits on memory, CPU, and execution time.",
        type: "text"
      },
      {
        question: "Is my data sent to the cloud?",
        answer: "AI execution on-device stays on-device. Only metadata (device health, performance metrics, audit logs) syncs with the dashboard when online. If you route requests through cloud providers, that data goes to the provider you selected — we don't intercept or store it. Provider API keys are stored encrypted in your own vault.",
        type: "text"
      },
      {
        question: "What is EscapeVector?",
        answer: "An advanced cache-oriented component in the codebase. Treat it as specialized failure-path support rather than a blanket availability guarantee.",
        type: "text"
      },
      {
        question: "What is Gold Code?",
        answer: "An Ed25519-signed emergency override protocol. Gold Code patches are cryptographically verified before execution — only patches signed by your authorized keys are accepted. This gives you a secure way to push emergency fixes to fleet devices.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. We do not train foundation models on your data. If you explore local fine-tuning or aggregation-style workflows, treat those capabilities according to the current proof-status and preview labels rather than assuming general availability.",
        type: "text"
      }
    ]
  },
  {
    title: "Deployment & Operations",
    entries: [
      {
        question: "What happens if a device goes offline?",
        answer: "Local execution can continue where your deployment is configured for it. The exact failure-path behavior depends on whether you rely on hosted providers, local models, cached state, or hybrid coordination. Use the proof-status language in the docs instead of assuming every cloud-to-local path is already proven.",
        type: "text"
      },
      {
        question: "How does fleet management work?",
        answer: "Registered execution environments report health and status through coordination surfaces. The dashboard shows environment visibility, events, and related operator state. Stronger claims around automated rollout, config push, or OTA-style updates depend on deployment reality and current proof status.",
        type: "text"
      },
      {
        question: "Can I self-host?",
        answer: "Yes. The Infinite plan includes on-premise deployment. Enterprise plans support air-gapped operation with no external dependencies. The entire stack — runtime, routing, fleet management — runs within your infrastructure.",
        type: "text"
      },
      {
        question: "What observability do I get?",
        answer: "Operators can inspect execution runs, execution events, signed records, tracing data, and path-selection metadata where configured. Additional optimization or advisor-style surfaces should be treated as advanced workflows rather than assumed defaults.",
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
