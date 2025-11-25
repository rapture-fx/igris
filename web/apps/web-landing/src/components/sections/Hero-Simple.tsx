'use client'

import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Main Content Box with Border */}
        <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-8 md:pb-20 bg-transparent z-10" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
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
          <div className="max-w-[1300px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
            <div className="pt-8 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                <div className="text-left">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                    Your unified control plane
                  </h1>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2] mt-2">
                    for smarter, optimized AI model allocation.
                  </h1>
                </div>
                <p className="text-sm md:text-lg text-gray-700 max-w-md leading-relaxed text-left">
                  Schlep-engine is a quality-aware routing engine that dynamically allocates inference requests across providers, optimizing for cost, latency, and output quality in real time.
                </p>
              </div>
            </div>

            <div className="flex justify-start gap-4 mb-6">
              <button
                onClick={openEarlyAccessModal}
                className="inline-flex items-center justify-center bg-black text-white px-3 py-1.5 md:px-4 md:py-2 rounded-md md:rounded-lg hover:opacity-90 transition-all duration-200 font-medium text-xs md:text-sm shadow-sm md:shadow-md hover:shadow-lg"
                style={{ minHeight: '36px' }}
              >
                Get Early Access
                <ChevronRight className="ml-1 h-3 w-3 md:ml-2 md:h-4 md:w-4" />
              </button>
            </div>

            {/* Hero diagram - visible on mobile, hidden on larger screens */}
            <div className="block md:hidden">
              <div className="relative w-full h-[400px] border border-gray-300 rounded-2xl bg-[#f6f6f4]">
                <div
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    backgroundImage: 'url("/schlep-logo-47.svg")',
                    backgroundPosition: 'center center',
                    backgroundRepeat: 'no-repeat',
                    backgroundSize: 'cover',
                    opacity: 0.8,
                  }}
                />
              </div>
            </div>

            {/* Hero content area - spacing for background on desktop */}
            <div className="bg-transparent hidden md:block min-h-[500px]">
              <div className="flex items-center justify-center h-full"></div>
            </div>
          </div>
        </div>

        {/* HERO diagram background - positioned below main box (desktop only) */}
        <div className="hidden md:block absolute left-4 right-4 md:left-12 md:right-12 lg:left-24 lg:right-24 bottom-8 pointer-events-none max-w-[1200px] mx-auto z-[5] h-[500px]">
          <div className="relative w-full h-full border border-gray-300 rounded-2xl bg-[#f6f6f4]">
            {/* Schlep Engine diagram SVG */}
            <div
              className="absolute inset-0 rounded-2xl"
              style={{
                backgroundImage: 'url("/schlep-logo-47.svg")',
                backgroundPosition: 'center center',
                backgroundRepeat: 'no-repeat',
                backgroundSize: 'cover',
                opacity: 0.8,
                zIndex: 5
              }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
