'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function HowItWorks() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <section id="how-it-works" className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border min-h-[750px] md:h-[750px]">

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>

          {/* Title Section - Shows first on mobile */}
                <div className="mb-8 text-left">
               <p className="text-base text-[#5fdfeb] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  03. FLOW
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                  How It Works
                </h3>
                 <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-8">
                   Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                 </p>
                </div>

                {/* Mobile Content - Three Steps */}
                <div className="space-y-8">
                  {/* Step 1: Decide */}
                  <div>
                    <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                      <Image
                        src="/ovr.png"
                        alt="Control Plane"
                        fill
                        className="opacity-80"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Decide (Control Plane)</h4>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                      The application sends an AI request. The cloud control plane evaluates policies, budgets, safety rules, and performance constraints, then decides how, where, and whether the request should run.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                      This is where governance, routing, and risk control happen—before anything executes.
                    </p>
                  </div>

                  {/* Step 2: Execute */}
                  <div>
                    <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                      <Image
                        src="/ex.png"
                        alt="Runtime Plane"
                        fill
                        className="opacity-80"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Execute (Runtime Plane)</h4>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                      The runtime executes the decision close to the application. It runs the task using cloud models or local models, coordinates tools and agents, and automatically falls back if connectivity or providers fail.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                      This guarantees reliable execution—even offline or under failure conditions.
                    </p>
                  </div>

                  {/* Step 3: Verify & Improve */}
                  <div>
                    <div className="border border-gray-300 dark:border-[#f6f6f4]/5 mb-4 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{ height: '150px', position: 'relative', overflow: 'hidden' }}>
                      <Image
                        src="/lo.png"
                        alt="Feedback Loop"
                        fill
                        className="opacity-100"
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                    <h4 className="text-sm font-semibold text-[#000000] dark:text-[#f6f6f4] mb-3 font-inter">Verify & Improve (Feedback Loop)</h4>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4 leading-relaxed font-inter">
                      Execution results, telemetry, and metrics flow back to the control plane. Policies, routing logic, and configurations are continuously refined and pushed back to the runtime.
                    </p>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter italic">
                      The system learns, adapts, and stays compliant in production.
                    </p>
                  </div>
                </div>
            </div>

           {/* Two-column layout - Matching Products section */}
            <div className="hidden md:grid md:grid-cols-3 gap-0 md:flex-1">
             {/* Left Column - Content (2 columns wide) */}
              <div className="md:col-span-2 flex flex-col justify-start relative" style={{
                padding: '3rem 2rem 3rem 0',
                backgroundImage: mounted && theme === 'dark' ? 'none' : 'radial-gradient(circle, rgba(0, 0, 0, 0.1) 1px, transparent 1px)',
                backgroundSize: '20px 20px',
                backgroundPosition: '1rem 3rem'
              }}>
                {/* Dark mode frames */}
                {mounted && theme === 'dark' && (
                   <div className="flex flex-col gap-4 w-full">
                     <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912] flex" style={{ height: '210px' }}>
                        <div className="w-3/5 p-6 flex flex-col justify-between overflow-hidden">
                          <div>
                            <Image
                              src="/ovr.png"
                             alt="Control Plane"
                             width={450}
                             height={450}
                              className="mb-4 object-contain opacity-80"
                            />
                          </div>
                          <div className="mt-auto">
                            <p className="text-xs text-[#a8a898] leading-relaxed line-clamp-2">
                              This is where governance, routing, and risk control happen—before anything executes.
                            </p>
                          </div>
                        </div>
                       <div className="w-2/5 p-6">
                         <h4 className="text-sm font-medium text-[#f6f6f4] mb-3 font-inter">Decide (Control Plane)</h4>
                         <p className="text-xs text-[#a8a898] mb-2 leading-relaxed">
                           The application sends an AI request.<br/>
                           The cloud control plane evaluates policies, budgets, safety rules, and performance constraints, then decides how, where, and whether the request should run.
                         </p>
                       </div>
                     </div>
                      <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912] flex" style={{ height: '210px' }}>
                       <div className="w-3/5 p-6 flex flex-col justify-between">
                         <div>
                           <Image
                             src="/ex.png"
                             alt="Runtime Plane"
                             width={450}
                             height={450}
                             className="mb-4 object-contain opacity-80"
                          />
                        </div>
                        <div className="mt-auto">
                          <p className="text-xs text-[#a8a898] leading-relaxed">
                            This guarantees reliable execution—even offline or under failure conditions.
                          </p>
                        </div>
                      </div>
                      <div className="w-2/5 p-6">
                        <h4 className="text-sm font-medium text-[#f6f6f4] mb-3 font-inter">Execute (Runtime Plane)</h4>
                        <p className="text-xs text-[#a8a898] mb-2 leading-relaxed">
                          The runtime executes the decision close to the application.<br/>
                          It runs the task using cloud models or local models, coordinates tools and agents, and automatically falls back if connectivity or providers fail.
                        </p>
                      </div>
                    </div>
                     <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912] flex" style={{ height: '210px' }}>
                       <div className="w-3/5 p-6 flex flex-col justify-between">
                         <div>
                           <Image
                             src="/lo.png"
                             alt="Feedback Loop"
                             width={450}
                             height={450}
                             className="mb-4 object-contain opacity-100"
                           />
                         </div>
                         <div className="mt-auto">
                           <p className="text-xs text-[#a8a898] leading-relaxed">
                             The system learns, adapts, and stays compliant in production.
                           </p>
                         </div>
                       </div>
                      <div className="w-2/5 p-6">
                        <h4 className="text-sm font-medium text-[#f6f6f4] mb-3 font-inter">Verify & Improve (Feedback Loop)</h4>
                        <p className="text-xs text-[#a8a898] mb-2 leading-relaxed">
                          Execution results, telemetry, and metrics flow back to the control plane.<br/>
                          Policies, routing logic, and configurations are continuously refined and pushed back to the runtime.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column - Title (1 column wide with left border) */}
               <div className="md:col-span-1 md:border-l flex flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                <p className="text-base text-[#5fdfeb] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  03. FLOW
                </p>
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 How It Works
               </h2>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                  Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
