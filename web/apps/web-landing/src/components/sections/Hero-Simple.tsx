'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]" style={{
        backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top -100px',
        backgroundRepeat: 'no-repeat',
        borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)'
      }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          <div className="max-w-[1100px] mx-auto" style={{ paddingTop: '400px' }}>
            <div className="mb-6 text-left">
              <div>
                <h1 className="text-lg md:text-xl lg:text-2xl font-medium text-[#111111] leading-[1.2]" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                  Control how AI systems behave in production
                </h1>
                <p className="text-sm md:text-base text-gray-700 max-w-md leading-relaxed text-left mt-4" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                  A decision control, governed execution, and verification across modern AI stacks.
                </p>
              </div>
            </div>

             <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <Link href="/overture">
                <button
                  className="inline-flex items-center justify-center bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  style={{ fontFamily: 'Roboto Mono, monospace' }}
                >
                  Get Started
                </button>
              </Link>
            </div>
          </div>
          <div className="w-full relative mt-8 -mx-4 md:-mx-8 lg:-mx-12" style={{ height: '200px' }}>
          </div>
        </div>
      </div>
    </section>
  )
}
