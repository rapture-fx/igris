'use client'

import React, { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { ChevronRight } from 'lucide-react'
import Link from 'next/link'

export default function AutonomousSystems() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
  const borderStyle = '0.5px solid rgba(209, 213, 219, 0.35)'

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: borderStyle }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <div>
              <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                One System. Two Environments.
              </h2>
            </div>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: borderStyle, width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ minHeight: '320px' }}>
            {/* Col 1 - Text */}
            <div className="flex flex-col pt-6 pb-8 pr-4" style={{ borderRight: borderStyle }}>
              <div className="max-w-md">
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  The same system governs AI execution in software and robotics environments.
                </p>
                <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                  If you're building AI agents that run on servers, see how execution, coordination, and verification apply to software-based systems.
                </p>
              </div>
            </div>
            {/* Col 2 - Empty space */}
            <div className="pt-6 pb-8 pl-4" />
          </div>
        </div>
      </div>

      {/* Full-width middle border */}
      <div style={{ borderTop: borderStyle }} />

      {/* Row 2 */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: borderStyle, borderRight: borderStyle, minHeight: '280px' }}>
          {/* Col 1 - Text */}
          <div className="flex flex-col pt-6 pb-8 pr-4 md:pl-8 lg:pl-12" style={{ borderRight: borderStyle }}>
            <div className="max-w-md">
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                If you're building robots or edge devices, see how the system integrates with ROS 2 and enforces safe, bounded AI execution in the physical world.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily }}>
                Different environments. The same nervous system.
              </p>
            </div>
          </div>
          {/* Col 2 - Empty space */}
          <div className="pt-6 pb-8 pl-4" />
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: borderStyle }} />
    </section>
  )
}
