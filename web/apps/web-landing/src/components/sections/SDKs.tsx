'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { useTheme } from 'next-themes'

export default function SDKs() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200 overflow-hidden">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Title */}
          <div className="text-left" style={{ paddingTop: '3rem', paddingBottom: '1rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Build on the Nervous System
            </h3>
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] mt-2" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Production SDKs for direct integration.
            </p>
          </div>

          {/* Full-width border below title */}
          <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          {/* Row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Col 1 - Image */}
            <div className="p-4 md:pl-8 lg:pl-12" style={{ height: '320px', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
              <div className="relative w-full h-full rounded-2xl overflow-hidden bg-transparent">
                {/* Blank image placeholder */}
              </div>
            </div>
            {/* Col 2 - Text */}
            <div className="flex flex-col justify-start pt-6 pb-6 px-4 md:px-8 lg:pr-12">
              <h3 className="text-base md:text-lg mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                Consistent API across all environments.
              </h3>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                The runtime exposes a consistent API surface that works identically across JavaScript, Python, Go, Rust, Java, Ruby, and C#. All SDKs make real HTTP calls to the same runtime and control plane.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                No feature disparity between languages. Develop locally and deploy anywhere with the same behavior, type-safe bindings, and modern async/await patterns.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Full-width middle border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      {/* Row 2 */}
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          {/* Col 1 - Image */}
          <div className="p-4 md:pl-8 lg:pl-12" style={{ height: '320px', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
            <div className="relative w-full h-full rounded-2xl overflow-hidden bg-transparent">
              {/* Blank image placeholder */}
            </div>
          </div>
          {/* Col 2 - Text */}
          <div className="flex flex-col justify-start py-6 px-4 md:px-8 lg:pr-12">
            <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              Deploy anywhere with consistent error handling and structured error responses across all supported languages.
            </p>
          </div>
        </div>
      </div>

    </section>
  )
}
