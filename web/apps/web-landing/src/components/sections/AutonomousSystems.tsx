'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function AutonomousSystems() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title */}
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <div>
              <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                One Runtime. Any Autonomous System.
              </h2>
            </div>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start p-4 md:pl-8 lg:pl-12" style={{ borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
              <h3 className="text-base md:text-lg mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                The same 16MB binary runs everywhere.
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                The same 16MB binary runs AI agents on servers and robots on physical hardware. Execution rules, routing behavior, verification, and fleet coordination remain identical across environments.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Language models generate decisions. Behavior trees structure execution. The runtime enforces limits and records every action. Whether intelligence runs in software or moves in space, execution remains deterministic and provable.
              </p>
            </div>
            {/* Col 2 - Image */}
            <div className="p-4 md:pr-8 lg:pr-12" style={{ height: '320px' }}>
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-transparent">
                {/* Blank image placeholder */}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width middle border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Row 2 */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
            {/* Col 1 - Text */}
            <div className="flex flex-col justify-start p-4 md:pl-8 lg:pl-12" style={{ borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              Deploy to servers, edge devices, or robotic hardware with identical guarantees. Manage diverse autonomous systems from a single control plane with bounded behavior and cryptographically verified actions.
            </p>
          </div>
          {/* Col 2 - Image */}
          <div className="p-4 md:pr-8 lg:pr-12" style={{ height: '320px' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-transparent">
              {/* Blank image placeholder */}
            </div>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
