'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] relative overflow-visible -mt-[72px]" style={{
        backgroundImage: 'url(/cloudbg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top -100px',
        backgroundRepeat: 'no-repeat'
      }}>
      <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-[rgba(246,246,244,0.5)] to-[#f6f6f4] dark:from-transparent dark:via-[rgba(27,25,18,0.5)] dark:to-[#1b1912]"></div>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent dark:bg-[#1b1912] z-10 overflow-visible flex flex-col border-l border-r border-b section-border" style={{
          minHeight: '600px'
        }}>
          <div className="flex-1" style={{ paddingTop: '100px' }}>
          </div>
          <div className="max-w-[1100px] mx-auto w-full" style={{ paddingBottom: '2rem' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-lg md:text-xl lg:text-2xl font-medium text-[#111111] dark:text-[#f6f6f4] leading-[1.2]">
                  Control how AI systems behave<br />in production
                </h1>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] max-w-md leading-relaxed text-left mt-4">
                  A decision control, governed execution, and verification across modern AI stacks.
                </p>
              </div>
            </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/overture">
                  <button
                    className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                    style={{ marginBottom: '5rem' }}
                  >
                    Get Started
                  </button>
                </Link>
             </div>
             <div className="-mx-4 md:-mx-8 lg:-mx-12" style={{ paddingBottom: '6rem', marginBottom: '1.5rem' }}></div>
          </div>
        </div>
      </div>
    </section>
  )
}
