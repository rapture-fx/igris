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
        answer: "No. The runtime operates fully offline with local LLM inference via llama.cpp. When connectivity is available, it routes to cloud providers for better results. The switch between local and cloud is automatic — same API either way.",
        type: "text"
      },
      {
        question: "What models can I use?",
        answer: "Any GGUF format model — Llama, Mistral, Phi-3, Qwen, and thousands more from HuggingFace. You can also fine-tune on-device with QLoRA and use your own custom models. Bring your own model, no vendor lock-in.",
        type: "text"
      },
      {
        question: "How is this different from using OpenAI/Anthropic directly?",
        answer: "We sit between your application and providers. Thompson Sampling learns which provider performs best for your workload. You get automatic failover, cost optimization, local fallback when cloud is down, and features like Council Mode and Speculative Execution that no single provider offers.",
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
        answer: "A Bayesian learning algorithm that routes each request to the best provider based on observed latency, cost, error rate, and quality. It learns your specific workload patterns — starting with cautious exploration and converging to optimal routing after ~500 requests.",
        type: "text"
      },
      {
        question: "What are Speculative Execution and Council Mode?",
        answer: "Speculative Execution races 2-3 providers in parallel and returns the fastest quality response. Council Mode sends a request to multiple providers, has them evaluate each other's answers, then synthesizes the best response. Speed vs. quality — you choose per request.",
        type: "text"
      },
      {
        question: "How do the AI agents work?",
        answer: "Planning agents break complex tasks into steps using chain-of-thought reasoning. Reflection agents self-critique and regenerate until quality thresholds are met. Swarm agents run multiple perspectives in parallel with consensus voting. All agents support tool use (HTTP, shell, filesystem) with sandboxed execution.",
        type: "text"
      },
      {
        question: "What are Behavior Trees?",
        answer: "A hybrid execution engine combining deterministic control flow (sequence, selector, parallel nodes) with LLM-powered adaptive reasoning. The LLM can generate and modify subtrees at runtime, with watchdog safety and bounded execution guarantees.",
        type: "text"
      },
      {
        question: "Can I use it without the dashboard?",
        answer: "Yes. The runtime operates completely standalone. The dashboard is optional for fleet management and provides visibility into routing decisions, device health, and audit trails when you need to manage multiple devices.",
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
        answer: "A 72-hour encrypted response cache (AES-256-GCM) that activates when all providers fail. Pre-cached responses keep your system operational during extended outages. Combined with local LLM fallback, the platform degrades gracefully rather than failing.",
        type: "text"
      },
      {
        question: "What is Gold Code?",
        answer: "An Ed25519-signed emergency override protocol. Gold Code patches are cryptographically verified before execution — only patches signed by your authorized keys are accepted. This gives you a secure way to push emergency fixes to fleet devices.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. We never train models on your data. QLoRA fine-tuning happens entirely on your device. Federated learning shares only encrypted model weight updates across your fleet — raw data never leaves the device.",
        type: "text"
      }
    ]
  },
  {
    title: "Deployment & Operations",
    entries: [
      {
        question: "What happens if a device goes offline?",
        answer: "The runtime continues operating with local LLM inference, cached responses via EscapeVector, and local agent execution. All decisions are still cryptographically signed. When connectivity returns, the device syncs telemetry and audit logs with the dashboard automatically.",
        type: "text"
      },
      {
        question: "How does fleet management work?",
        answer: "Devices register with Ed25519 signatures via the fleet API. The dashboard shows device health, telemetry, and configuration. You can push model updates, configuration changes, and emergency patches (Gold Code) to individual devices or your entire fleet with cryptographic verification.",
        type: "text"
      },
      {
        question: "Can I self-host?",
        answer: "Yes. The Infinite plan includes on-premise deployment. Enterprise plans support air-gapped operation with no external dependencies. The entire stack — runtime, routing, fleet management — runs within your infrastructure.",
        type: "text"
      },
      {
        question: "What observability do I get?",
        answer: "Prometheus-compatible metrics (150+), distributed request tracing, per-request cost tracking, routing decision audit logs, and provider performance leaderboards. The Cognitive Advisor (Infinite tier) automatically proposes optimizations based on observed patterns.",
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
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
      <section id="faq" className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 min-h-0 flex flex-col" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>

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
                    className={`rounded-xl border transition-all duration-300 ${
                      openSectionIndex === sectionIndex
                        ? 'border-gray-300 dark:border-[#f6f6f4]/10 shadow-sm'
                        : 'border-gray-200 dark:border-[#f6f6f4]/5 hover:shadow-sm'
                    } bg-[#f9f9fa] dark:bg-[rgba(246,246,244,0.05)]`}
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
