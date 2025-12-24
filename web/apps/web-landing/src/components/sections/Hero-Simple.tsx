'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="py-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible">
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        {/* Main Content Box with Border */}
        <div className="relative pt-8 px-4 md:px-8 lg:px-12 pb-72 md:pb-96 lg:pb-[48rem] bg-transparent z-10" style={{
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
              opacity: 1
            }}
          />
          {/* Bottom blur effect */}
          <div 
            className="absolute left-0 right-0 bottom-0 h-4"
            style={{
              background: 'linear-gradient(to top, rgba(246, 246, 244, 1) 0%, rgba(246, 246, 244, 0) 100%)'
            }}
          />
          {/* Left blur effect */}
          <div 
            className="absolute top-0 bottom-0 left-0 w-4"
            style={{
              background: 'linear-gradient(to right, rgba(246, 246, 244, 1) 0%, rgba(246, 246, 244, 0) 100%)'
            }}
          />
          {/* Right blur effect */}
          <div 
            className="absolute top-0 bottom-0 right-0 w-4"
            style={{
              background: 'linear-gradient(to left, rgba(246, 246, 244, 1) 0%, rgba(246, 246, 244, 0) 100%)'
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
          <div className="max-w-[1300px] mx-auto pt-8 px-0 md:px-8 lg:px-16">
            <div className="pt-8 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                <div className="text-left">
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2]">
                    Control and execution platform
                  </h1>
                  <h1 className="text-2xl md:text-3xl lg:text-4xl font-medium text-[#111111] leading-[1.2] mt-2">
                    for production LLM systems.
                  </h1>
                </div>
                <p className="text-sm md:text-lg text-gray-700 max-w-md leading-relaxed text-left">

                </p>
              </div>
            </div>

            <div className="flex justify-start gap-4 mb-6">
              <button
                onClick={openEarlyAccessModal}
                className="inline-flex items-center justify-center bg-black text-white px-3 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl hover:opacity-90 transition-all duration-200 text-xs md:text-base shadow-sm md:shadow-md hover:shadow-lg font-inter"
                style={{ minHeight: '36px' }}
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
