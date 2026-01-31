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
        question: "Is there a free tier?",
        answer: "Yes. The Free plan includes 1 Runtime device, the Overture Fleet Dashboard (basic features), community support, and full offline capability. Perfect for development and testing.",
        type: "text"
      },
      {
        question: "What hardware do I need?",
        answer: "Runtime runs on any Linux, macOS, or ARM device with at least 512MB RAM. Tested on Raspberry Pi 4, NVIDIA Jetson, edge servers, and standard x86 hardware. The binary is only 16MB.",
        type: "text"
      },
      {
        question: "Do I need internet connectivity?",
        answer: "No. Runtime works completely offline. Download the binary, add your GGUF models, and deploy. The Overture Fleet Dashboard is optional—devices sync when online but operate independently when offline.",
        type: "text"
      },
      {
        question: "What models can I use?",
        answer: "Any GGUF format model. This includes Llama, Mistral, Phi-3, and thousands of models from HuggingFace. You can also use your own fine-tuned models converted to GGUF format.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "How does pricing work?",
        answer: "Simple per-device pricing. Free: 1 device at $0. Pro: $49/device/month for up to 100 devices with priority support and advanced analytics. Enterprise: Custom pricing for unlimited devices with SLA guarantees.",
        type: "text"
      },
      {
        question: "Is the Fleet Dashboard really free?",
        answer: "Yes. The Overture Fleet Dashboard is included at no extra cost with every Runtime license. Free tier gets basic dashboard access. Pro and Enterprise unlock advanced fleet management features.",
        type: "text"
      },
      {
        question: "What's the difference between Free and Pro?",
        answer: "Free supports 1 device with community support and basic dashboard. Pro supports up to 100 devices with priority email support, advanced analytics, model deployment management, and 7-day log retention.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade?",
        answer: "Yes. Upgrades take effect immediately. Downgrades apply at the start of your next billing cycle. No configuration or data is lost when changing plans.",
        type: "text"
      },
      {
        question: "Are there any hidden fees?",
        answer: "No. You pay per Runtime device. The Fleet Dashboard is included. No request-based pricing, no overage charges, no surprise bills.",
        type: "text"
      },
      {
        question: "Do I pay for cloud AI providers separately?",
        answer: "Runtime runs models locally—no cloud AI provider required. If you choose to use cloud APIs from OpenAI, Anthropic, etc., you pay them directly. Igris does not markup provider costs.",
        type: "text"
      }
    ]
  },
  {
    title: "Product & Architecture",
    entries: [
      {
        question: "What's the difference between Runtime and the Fleet Dashboard?",
    "answer": "Runtime is the primary product—a 16MB binary that executes AI on your devices. The Overture Fleet Dashboard is included management software that lets you monitor and manage Runtime devices from the cloud. Think of Runtime as the engine, and the Dashboard as the dashboard in your car—both included together.",
        type: "text"
      },
      {
        question: "Can I use Runtime without the Dashboard?",
        answer: "Yes. Runtime works completely standalone. The Dashboard is optional for fleet management. Many users deploy Runtime independently for single-device or offline scenarios.",
        type: "text"
      },
      {
        question: "How does device pairing work?",
        answer: "Simple QR code pairing. Generate a code in the Dashboard, scan it with your device camera, and the device automatically joins your fleet. No manual configuration, no copying API keys.",
        type: "text"
      },
      {
        question: "Can I deploy models to my entire fleet?",
        answer: "Yes. Upload GGUF models to the Dashboard and push them to one device or your entire fleet. Devices download and verify models automatically. You can also rollback if issues occur.",
        type: "text"
      }
    ]
  },
  {
    title: "Security & Reliability",
    entries: [
      {
        question: "How secure is Runtime?",
        answer: "Runtime uses sandboxed execution with enforced resource limits. Models run in isolated environments with boundaries on memory, CPU, and execution time. Your models and data stay on your devices.",
        type: "text"
      },
      {
        question: "What happens if a device goes offline?",
        answer: "Runtime continues operating normally. All AI execution happens locally. When the device comes back online, it syncs status and any pending updates with the Dashboard automatically.",
        type: "text"
      },
      {
        question: "Is my data sent to the cloud?",
    "answer": "No. AI inference happens entirely on-device. Only metadata (device status, model versions, logs) syncs with the Dashboard when online. Your actual data and AI workloads never leave the device unless you choose cloud providers.",
        type: "text"
      },
      {
        question: "What uptime guarantees do you provide?",
        answer: "Free tier has no SLA. Pro tier includes best-effort support. Enterprise includes custom SLA guarantees with 24/7 dedicated support and 99.9% uptime commitment for the Dashboard.",
        type: "text"
      }
    ]
  },
  {
    title: "Operations & Control",
    entries: [
      {
        question: "Do I retain control of my models?",
        answer: "Yes. You bring your own GGUF models. Models are stored on your devices, not on our servers. You can update, replace, or remove models at any time.",
        type: "text"
      },
      {
        question: "Can I monitor device performance?",
        answer: "Yes. The Fleet Dashboard shows real-time status, resource usage, model performance, and execution logs for all your devices. Export data for external analysis.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. Igris does not train models on your data. Your data stays on your devices. Runtime executes your models locally without sending data to Igris or any third party.",
        type: "text"
      },
      {
        question: "Can I self-host?",
        answer: "Yes. Enterprise plans include on-premise deployment options. Run the entire stack within your own infrastructure with no external dependencies.",
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

           {/* Two-column layout - Matching other sections */}
           <div className="hidden md:grid md:grid-cols-3 gap-0 relative flex-1">
             {/* Left Column - FAQ Content (2 columns wide) */}
             <div className="md:col-span-2" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
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

             {/* Right Column - Title and Intro (Desktop only) */}
             <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
               <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                 05. FAQ
               </p>
               <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Questions and answers
               </h3>
               <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                 Common questions about Runtime deployment, pricing, and the included Fleet Dashboard.
               </p>
             </div>
           </div>

         </div>
       </div>
     </section>
   );
 }
