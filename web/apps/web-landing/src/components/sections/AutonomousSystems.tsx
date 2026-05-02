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
  const borderStyle = 'var(--section-border)'

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: 'var(--section-border)' }} />
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: borderStyle, borderRight: borderStyle }}>
          {/* Title */}
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 md:gap-8 pt-12 pb-6 md:pb-12">
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
              Built for AI agents.<br className="hidden md:block" />
              Designed for the edge.
            </h2>
            <p className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4] max-w-md md:text-right" style={{ fontFamily }}>
              Igris gives AI systems a governed execution layer across cloud, edge, and local environments — from software agents today to physical systems tomorrow.
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
            <div className="flex flex-col pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)] dark:border-[rgba(246,246,244,0.06)]">
              <div className="max-w-md">
                <h3 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For AI Agents
                </h3>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Run AI tasks with boundaries, fallback paths, and verifiable records.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Igris helps agentic systems execute work in a controlled environment instead of running unchecked model output. Define limits, inspect task outcomes, and generate signed records of what happened.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Use it for: production AI workflows, tool-calling agents, internal automation, edge-connected AI systems, workloads that need execution history and review
                </p>
              </div>
            </div>
            {/* Col 2 - Image + Button */}
            <div className="relative rounded-r-2xl overflow-hidden min-h-[220px] md:min-h-0">
              <div 
                className="absolute top-2 bottom-2 left-2 right-0 bg-cover bg-center rounded-xl"
                style={{ 
                  backgroundImage: `url(${mounted && theme === 'dark' ? '/Agent.jpg' : '/sft.png'})`,
                  opacity: 0.35,
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
                  style={{ backgroundColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily }}
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
            <div className="flex flex-col pt-6 pb-8 pr-4 border-b md:border-b-0 md:border-r border-[rgba(209,213,219,0.2)] dark:border-[rgba(246,246,244,0.06)]">
              <div className="max-w-md">
                <h3 className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily }}>
                  For Edge and Robotics Systems
                </h3>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Bring the same execution model closer to devices and physical environments.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Igris is being built for systems where AI reasoning needs to connect with constrained execution, safety boundaries, and offline operation. The goal is to support edge and robotics workflows without making the model the final authority over critical actions.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily }}>
                  Use it for: edge AI workloads, device-side execution, robotics research and prototypes, safety-gated action flows, environments where network failure cannot break the execution model
                </p>
              </div>
            </div>
            {/* Col 2 - Full Background Image */}
            <div className="relative flex flex-col justify-end items-end rounded-r-2xl overflow-visible min-h-[220px] md:min-h-0">
              <div className="absolute top-2 bottom-2 left-2 right-0 rounded-xl overflow-hidden" style={{ boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}>
                <Image
                  src={mounted && theme === 'dark' ? '/rozf.png' : '/rfoz.png'}
                  alt="Robotics"
                  fill
                  className="object-cover"
                  style={{ opacity: 0.9 }}
                />
              </div>
              <Link
                href="https://docs.igrisinertial.com/docs/robotics/"
                className="relative z-10 inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border ml-2 mr-2 mb-6 md:ml-4 md:mr-4 md:mb-8"
                style={{ backgroundColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily }}
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
