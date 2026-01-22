import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useProductPopup } from '../../contexts/ProductPopupContext'

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { openOverture, openRuntime } = useProductPopup()

  useEffect(() => {
    setMounted(true)
  }, [])
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border min-h-[800px] md:h-[800px]">

          {/* Title Section - Shows first on mobile, last on desktop */}
           <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
               <p className="text-base text-[#5fdfeb] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                 01. PRODUCT
               </p>
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Decision and Execution
               </h2>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed mb-8">
              Overture decides what to route and where. Runtime executes with governance and safety. Deploy independently or together with Hybrid enforcement.
            </p>

               {/* Products - Mobile */}
              <div className="space-y-12 text-left">
                {/* Overture */}
                  <div className="text-left">
                    <h3 className="text-lg md:text-xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                      Overture
                    </h3>
                    <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                      Decision Layer
                    </p>
                    <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                      <Image
                        src={mounted && theme === 'dark' ? '/ov.png' : '/overtureframe.png'}
                        alt="Overture Decision Layer"
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                   <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                     Decision intelligence and routing control plane. Trust-aware provider selection with cost, quality, and latency optimization. Explainable decisions with full observability.
                   </p>
                    <button
                      onClick={openOverture}
                      className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                    >
                      <span className="font-inter">
                        Explore Overture
                      </span>
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </button>
                 </div>

                    {/* Runtime */}
                    <div>
                      <h3 className="text-lg md:text-xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                        Runtime
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                        Execution Layer
                      </p>
                     <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                       <Image
                         src={mounted && theme === 'dark' ? '/lig.png' : '/runtimeframe.png'}
                         alt="Runtime Execution Layer"
                         fill
                         style={{ objectFit: 'cover' }}
                       />
                     </div>
                 <p className="text-xs text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                   Licensed governed execution engine. Secure defaults and enforced limits. Deterministic execution envelopes with telemetry-backed execution.
                 </p>
                    <button
                      onClick={openRuntime}
                      className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                    >
                       <span className="font-inter">
                         Explore Runtime
                       </span>
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </button>
              </div>
            </div>
          </div>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 md:flex-1">

            {/* Left Column: Overture and Runtime - 2 columns wide (Desktop only) */}
            <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{ paddingTop: '3rem', paddingBottom: '4rem', paddingRight: '2rem' }}>
                <div className="w-full space-y-12">

                  {/* Overture */}
                   <div>
                     <h3 className="text-lg md:text-xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                       Overture
                     </h3>
                     <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                       Decision Layer
                     </p>
                    <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                      <Image
                        src={mounted && theme === 'dark' ? '/ov.png' : '/overtureframe.png'}
                        alt="Overture Decision Layer"
                        fill
                        style={{ objectFit: 'cover' }}
                      />
                    </div>
                   <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                     Decision intelligence and routing control plane. Trust-aware provider selection with cost, quality, and latency optimization. Explainable decisions with full observability.
                   </p>
                    <button
                      onClick={openOverture}
                      className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                    >
                       <span className="font-inter">
                         Explore Overture
                       </span>
                       <ChevronRight className="ml-1 h-3 w-3" />
                     </button>
                 </div>

                    {/* Runtime */}
                    <div>
                      <h3 className="text-lg md:text-xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                        Runtime
                      </h3>
                      <p className="text-xs text-gray-600 dark:text-[#a8a898] mb-4">
                        Execution Layer
                      </p>
                      <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '1rem', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                        <Image
                          src={mounted && theme === 'dark' ? '/lig.png' : '/runtimeframe.png'}
                          alt="Runtime Execution Layer"
                          fill
                          style={{ objectFit: 'cover', objectPosition: 'center' }}
                        />
                      </div>
                    <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                      Licensed governed execution engine. Secure defaults and enforced limits. Deterministic execution envelopes with telemetry-backed execution.
                    </p>
                    <button
                      onClick={openRuntime}
                      className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                    >
                       <span className="font-inter">
                         Explore Runtime
                       </span>
                      <ChevronRight className="ml-1 h-3 w-3" />
                    </button>
                 </div>

               </div>
             </div>

               {/* Right Column: Title and Description (Desktop only) */}
               <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
                <p className="text-base text-[#5fdfeb] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  01. COMPONENTS
                </p>
               <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                 Decision and Execution
               </h2>
               <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                 Overture decides what to route and where. Runtime executes with governance and safety. Deploy independently or together with Hybrid enforcement.
               </p>
             </div>

           </div>

         </div>
       </div>
     </section>
   )
 }

