'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import HeroInertial from '../ui/HeroInertial'

export default function AutonomousSystems() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const borderStyle = '0.5px solid rgba(209, 213, 219, 0.35)'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8 pt-12 pb-6 md:pb-12">
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              One System.<br className="hidden md:block" />
              Two Environments.
            </h2>
            <p className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4] max-w-md md:text-right" style={{ fontFamily }}>
              The same nervous system governs AI execution—whether your system thinks in code or moves in space.
            </p>
          </div>
        </div>
      </div>

      {/* Full-width border below title */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>

          {/* Row 1 - AI Agents */}
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:300px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)]">
              <div className="max-w-md">
                <h3 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For AI Agents
                </h3>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Run on servers or edge. Every execution is isolated and time-bounded. Exceed limits and the task terminates — not retried silently.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                  Signed envelopes provide verifiable audit trails. Survive outages with local fallback. No runaway loops. No undefined state.
                </p>
              </div>
            </div>
            {/* Col 2 - Image + Button */}
            <div className="relative rounded-r-2xl overflow-hidden min-h-[200px] md:min-h-0">
              <div 
                className="absolute top-2 bottom-2 left-2 right-0 bg-cover bg-center rounded-xl"
                style={{ 
                  backgroundImage: 'url(/sft.png)',
                  opacity: 0.9,
                  boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                }}
              />
              <div className="absolute inset-0 z-[5] flex items-center justify-center">
                <HeroInertial />
              </div>
              <div className="absolute top-4 right-4 z-10">
                <Link
                  href="https://docs.igrisinertial.com/docs/agents/"
                  className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border ml-2 md:ml-4"
                  style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily }}
                >
                  AI Agents
                  <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width middle border */}
      <div style={{ borderTop: borderStyle }} />

      {/* Row 2 - Robots */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          <div className="grid grid-cols-1 md:grid-cols-2 md:[min-height:300px]">
            {/* Col 1 - Text */}
            <div className="flex flex-col pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)]">
              <div className="max-w-md">
                <h3 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For Robots
                </h3>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Behavior Trees govern motion. Safety logic is deterministic and LLM-independent — violations trigger immediate halt regardless of network state.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                  ROS 2 integration bridges reasoning to actuation. Signed violations include execution context. Offline by default. Sync when available.
                </p>
              </div>
            </div>
            {/* Col 2 - Full Background Image */}
            <div className="relative flex flex-col justify-end items-end rounded-r-2xl overflow-visible min-h-[120px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <Image
                  src="/rozf.png"
                  alt="Robotics"
                  fill
                  className="object-cover"
                  style={{ opacity: 0.9 }}
                />
              </div>
              <Link
                href="https://docs.igrisinertial.com/docs/robotics/"
                className="relative z-10 inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border ml-2 mr-2 mb-6 md:ml-4 md:mr-4 md:mb-8"
                style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily }}
              >
                Robotics
                <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
