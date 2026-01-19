'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
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
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b section-border" style={{
          height: '750px'
        }}>

          {/* Content Section - Shows first on mobile */}
          <div className="md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
                  <div className="space-y-20 text-xs text-gray-600 dark:text-[#a8a898] relative pl-8 md:pl-8 lg:pl-8">
                  </div>
                <Link href="/use-cases" className="group inline-flex items-center mt-16 pl-8 md:pl-8 lg:pl-8">
                   <span className="text-sm text-gray-900 dark:text-[#f6f6f4] font-inter">
                     Explore Use Cases
                   </span>
                   <ChevronRight className="ml-1 h-3 w-3" />
                 </Link>

          {/* Title Section - Shows last on mobile */}
                <div className="mt-12 text-left">
               <p className="text-base text-[#5fdfeb] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  03. FLOW
                </p>
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-2 text-[#000000] dark:text-[#f6f6f4]">
                  How It Works
                </h3>
                 <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter">
                   Igris operates between applications and AI providers, managing how AI requests are routed and executed across cloud and edge environments.
                 </p>
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
                    <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912]" style={{ height: '210px' }}>
                    </div>
                    <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912]" style={{ height: '210px' }}>
                    </div>
                    <div className="w-full border border-[#f6f6f4]/5 bg-[#1b1912]" style={{ height: '210px' }}>
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
