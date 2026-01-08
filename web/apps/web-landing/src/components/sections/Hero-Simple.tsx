'use client'

import React from 'react'
import Link from 'next/link'
import { useModal } from '../../contexts/ModalContext'
import HeroInertial from '../ui/HeroInertial'

export default function Hero() {
  const { openEarlyAccessModal } = useModal();
  return (
    <section className="pt-0 pb-0 bg-[#f6f6f4] text-gray-900 relative overflow-visible -mt-[72px]" style={{
        backgroundImage: 'linear-gradient(rgba(246, 246, 244, 0.3), rgba(246, 246, 244, 0.3)), url(/cloudbg.png)',
        backgroundSize: 'cover',
        backgroundPosition: 'center top -100px',
        backgroundRepeat: 'no-repeat'
      }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 pb-0 bg-transparent z-10 overflow-visible" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          <div className="max-w-[1100px] mx-auto pt-20 px-0 md:px-8 lg:px-16">
            <div className="pt-12 mb-6">
              <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6">
                <div className="text-left">
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-medium text-[#111111] leading-[1.2]">
                    Reliable AI Inference — Cloud or Edge
                  </h1>
                  <h2 className="text-lg md:text-xl lg:text-2xl font-medium text-[#666666] leading-[1.2] mt-2">
                    Designed to keep working when parts fail
                  </h2>
                </div>
                <p className="text-sm md:text-base text-gray-700 max-w-md leading-relaxed text-left">
                  Built for AI systems that operate across cloud, edge, and autonomous environments, with control over execution, routing, and failure states.
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
          <div className="w-full relative mt-8 -mx-4 md:-mx-8 lg:-mx-12" style={{ height: '700px' }}>
            <HeroInertial />
          </div>
        </div>
      </div>
    </section>
  )
}
