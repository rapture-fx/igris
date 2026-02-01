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
        answer: "Yes. The Seed. One instance. Full power. The view sleeps—you don't need it yet. Community support, full offline capability. Perfect for building in the quiet.",
        type: "text"
      },
      {
        question: "What hardware do I need?",
        answer: "Anything with 512MB of breath. Raspberry Pi. NVIDIA Jetson. That weird ARM board gathering dust. The binary is 16MB—lighter than a photo. Or run it on your servers for deterministic software agents.",
        type: "text"
      },
      {
        question: "Does this work for software agents or just robots?",
        answer: "Both. Runtime enforces deterministic limits on customer service bots, trading algorithms, and logistics AI running in data centers—just as easily as it runs vision models on drones. The nervous system doesn't care if the muscle is a motor or a database.",
        type: "text"
      },
      {
        question: "What makes this 'deterministic'?",
        answer: "Hard resource limits (memory, CPU, execution time) enforced at the OS level. Sandboxed execution. No random crashes. Predictable latency. The same input produces the same output, every time, with cryptographic proof.",
        type: "text"
      },
      {
        question: "Do I need internet connectivity?",
        answer: "No. Runtime works in the silence between connections. Download the binary, add your models, deploy. Internet optional. The view syncs when the world returns.",
        type: "text"
      },
      {
        question: "What models can I use?",
        answer: "Any GGUF model. Llama. Mistral. Phi-3. Thousands from HuggingFace. Your own fine-tuned weights. Bring your own models. No vendor lock-in.",
        type: "text"
      }
    ]
  },
  {
    title: "Pricing & Billing",
    entries: [
      {
        question: "How does pricing work?",
        answer: "Pay for presence. The Seed: $0 forever (one instance). The Horizon: $49/instance/month (up to 100 instances, the view awakens). The Infinite: Custom pricing for unbounded reach.",
        type: "text"
      },
      {
        question: "When do I unlock the dashboard?",
        answer: "When you have more than one instance to manage. Upgrade to Horizon, and the view unfolds automatically. It's not a separate purchase—it's the natural evolution of having a fleet.",
        type: "text"
      },
      {
        question: "Is the dashboard a separate product?",
        answer: "No. It's Runtime seeing itself at scale. One binary on many devices—physical or digital. One view to guide them. The view unlocks automatically when you upgrade to Horizon.",
        type: "text"
      },
      {
        question: "Can I upgrade or downgrade?",
        answer: "Yes. Upgrades breathe immediately. Downgrades take effect at your next billing cycle. Nothing is lost when you change horizons.",
        type: "text"
      },
      {
        question: "Are there any hidden fees?",
        answer: "No. You pay per instance. The view is included. No request-based pricing, no overage charges, no hidden fees.",
        type: "text"
      },
      {
        question: "Do I pay for cloud AI providers separately?",
        answer: "Runtime runs models locally—no cloud required. If you choose to use cloud APIs, you pay them directly. We don't markup provider costs. Software that doesn't hold you hostage.",
        type: "text"
      }
    ]
  },
  {
    title: "Product & Architecture",
    entries: [
      {
        question: "Can I use Runtime without the dashboard?",
        answer: "Yes. Runtime works completely standalone. Many users run single instances in the dark, offline forever. The view only matters when you have a fleet.",
        type: "text"
      },
      {
        question: "How does device pairing work?",
        answer: "QR code pairing. Generate a code. Scan it with your device. It joins your fleet instantly. No manual configuration. No copying API keys. Devices join in seconds.",
        type: "text"
      },
      {
        question: "Can I deploy models to my entire fleet?",
        answer: "Yes. Upload GGUF models. Push them across the fleet. One instance or one thousand. Instances download and verify automatically. Rollback if needed.",
        type: "text"
      },
      {
        question: "What happens when I scale from one instance to many?",
        answer: "The horizon appears. Upgrade to Horizon tier, and the view awakens automatically. See all your instances breathing. Manage them all. From anywhere.",
        type: "text"
      },
      {
        question: "How do I prove compliance with regulations?",
        answer: "Every decision is cryptographically signed and logged. The audit trail is tamper-evident and immutable. When regulators or lawyers ask 'what did your AI decide and why,' you show them mathematical proof—not server logs.",
        type: "text"
      },
      {
        question: "Can I use this in safety-critical applications?",
        answer: "Runtime provides deterministic execution and cryptographic audit trails—the foundation of safety-critical systems. However, you remain responsible for model validation and system integration. Many customers pair Runtime with existing safety-certified hardware.",
        type: "text"
      }
    ]
  },
  {
    title: "Security & Reliability",
    entries: [
      {
        question: "How secure is Runtime?",
        answer: "Trust no one. Sandboxed execution. Enforced resource limits. Models run in isolated environments with boundaries on memory, CPU, execution time. Your models and data stay on your devices. Cryptographically signed. Keys never leave.",
        type: "text"
      },
      {
        question: "What happens if an instance goes offline?",
        answer: "Runtime keeps breathing. All AI execution happens locally. When the instance returns, it syncs automatically. The world goes quiet. Runtime doesn't care.",
        type: "text"
      },
      {
        question: "Is my data sent to the cloud?",
        answer: "No. AI inference happens locally. Only metadata (instance status, model versions, logs) syncs when online. Your actual data and AI workloads never leave the instance. Unless you choose cloud providers—then it's your call.",
        type: "text"
      },
      {
        question: "What about air-gapped deployments?",
        answer: "Air-gapped factory with paranoid IT? Runtime never needed the internet anyway. Deploy. Execute. Sleep at night. The binary runs in the silence.",
        type: "text"
      }
    ]
  },
  {
    title: "Operations & Control",
    entries: [
      {
        question: "Do I retain control of my models?",
        answer: "Yes. You bring your own models. Models are stored on your instances, not our servers. Update, replace, remove them at any time. No vendor lock-in. Software that doesn't hold you hostage.",
        type: "text"
      },
      {
        question: "Can I monitor instance performance?",
        answer: "Yes. When the view awakens (Horizon tier), see real-time status, resource usage, model performance, execution logs for all your instances. Export data for external analysis.",
        type: "text"
      },
      {
        question: "Do you train on my data?",
        answer: "No. We don't train models on your data. Your data stays on your instances. Runtime executes your models locally without sending data to us or anyone else. Trust no one.",
        type: "text"
      },
      {
        question: "Can I self-host?",
        answer: "Yes. The Infinite tier includes on-premise deployment. Run the entire stack within your own infrastructure. No external dependencies. The view on your own servers.",
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
           <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[750px] flex flex-col">

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
             <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5 h-full" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
               <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                 05. FAQ
               </p>
               <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Questions and answers
               </h3>
               <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                 Common questions about deterministic AI execution, cryptographic provenance, and the view that unfolds when you scale.
               </p>
             </div>
           </div>

         </div>
       </div>
     </section>
   );
 }
