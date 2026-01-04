'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          <div className="max-w-[1100px] mx-auto pt-24 px-0 md:px-8 lg:px-16">
            <div className="pt-24 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                <div className="text-left">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2]">
                    Handle AI Failures Automatically
                  </h1>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-medium text-[#666666] leading-[1.2] mt-2">
                    Designed to keep working when parts fail
                  </h2>
                </div>
                <p className="text-sm md:text-sm text-gray-700 max-w-md leading-relaxed text-left">
                  Designed to support production AI workloads that run across cloud, edge, and autonomous environments over time.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-start mb-6">
              <Link href="/overture">
                <button
                  className="inline-flex items-center justify-center bg-black text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg font-inter"
                >
                  Get Started
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
