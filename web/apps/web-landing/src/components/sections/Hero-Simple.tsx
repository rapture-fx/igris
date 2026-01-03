'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        {/* Main Content Box with Border */}
        <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-64 md:pb-80 lg:pb-[36rem] bg-transparent z-10" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Background image layer */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'url("/heroland.png")',
              backgroundSize: '100%',
              backgroundPosition: 'center top 100%',
              backgroundRepeat: 'no-repeat',
              opacity: 1,
              pointerEvents: 'none'
            }}
          />
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8 border-t-[0.5px] border-[#1a1e21]"></div>
            <div className="absolute top-0 left-3.5 h-8 border-l-[0.5px] border-[#1a1e21]"></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8 border-b-[0.5px] border-[#1a1e21]"></div>
            <div className="absolute bottom-0 right-3.5 h-8 border-r-[0.5px] border-[#1a1e21]"></div>
          </div>

          {/* Content Container */}
          <div className="max-w-[1100px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
            <div className="pt-8 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                <div className="text-left">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2]">
                    Igris Inertial makes AI inference reliable — anywhere.
                  </h1>
                </div>
                <p className="text-sm md:text-sm text-gray-700 max-w-md leading-relaxed text-left">

                </p>
              </div>
            </div>

            <div className="flex justify-start mb-6">
              <Link href="/auth?mode=signup">
                <button
                  className="inline-flex items-center justify-center bg-black text-white px-6 py-2.5 rounded-lg hover:bg-gray-800 transition-all duration-200 text-sm font-medium shadow-md hover:shadow-lg font-inter"
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
