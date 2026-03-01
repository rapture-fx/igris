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
    <section className="bg-[#f7f7f3] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              One System.<br />
              Two Environments.
            </h2>
            <p className="text-base md:text-lg text-[#000000] dark:text-[#f6f6f4] max-w-md" style={{ fontFamily }}>
              The same nervous system governs AI execution—whether your system thinks in code or moves in space.
            </p>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: borderStyle, width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Row 1 - AI Agents */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: '280px' }}>
            {/* Col 1 - Text */}
            <div className="flex flex-col pt-6 pb-8 pr-4" style={{ borderRight: borderStyle }}>
              <div className="max-w-md">
                <h3 className="text-base md:text-lg mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For AI Agents
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Run on servers or edge. Every execution is isolated and time-bounded. Exceed limits and the task terminates — not retried silently.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                  Signed envelopes provide verifiable audit trails. Survive outages with local fallback. No runaway loops. No undefined state.
                </p>
              </div>
            </div>
            {/* Col 2 - Image + Button */}
            <div className="relative rounded-r-2xl overflow-hidden" style={{ minHeight: '280px' }}>
              <div 
                className="absolute top-2 bottom-2 left-2 right-0 bg-cover bg-center rounded-xl"
                style={{ 
                  backgroundImage: 'url(/sft.png)',
                  backgroundSize: '120%',
                  opacity: 0.9
                }}
              />
              <div className="absolute inset-2 z-[5] rounded-xl overflow-hidden">
                <div className="relative w-full h-full">
                  <HeroInertial />
                </div>
              </div>
              <div className="absolute top-4 right-4 z-10">
                <Link
                  href="/ai-agents"
                  className="inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border m-4"
                  style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f7f7f3', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily }}
                >
                  AI Agents
                  <ChevronRight className="ml-1 h-4 w-4" />
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
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: '280px' }}>
            {/* Col 1 - Text */}
            <div className="flex flex-col pt-6 pb-8 pr-4" style={{ borderRight: borderStyle }}>
              <div className="max-w-md">
                <h3 className="text-base md:text-lg mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For Robots
                </h3>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  ROS 2 binds reasoning to motor control. On violation, navigation cancels and zero velocity enforces within 50ms.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                  Safety logic is deterministic and LLM-independent. Signed violations include pose context. Offline by default. Sync when available.
                </p>
              </div>
            </div>
            {/* Col 2 - Full Background Image */}
            <div className="relative flex flex-col justify-end items-end rounded-r-2xl overflow-hidden" style={{ minHeight: '280px' }}>
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-xl overflow-hidden">
                <Image
                  src="/roz.png"
                  alt="Robotics"
                  fill
                  className="object-cover"
                  style={{ opacity: 0.9 }}
                />
              </div>
              <Link
                href="/robotics"
                className="relative z-10 inline-flex items-center justify-center px-4 py-2 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border m-4"
                style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f7f7f3', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily }}
              >
                Robotics
                <ChevronRight className="ml-1 h-4 w-4" />
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
