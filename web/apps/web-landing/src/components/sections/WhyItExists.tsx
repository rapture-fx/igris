'use client'

import React from 'react'

export default function WhyItExists() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 mobile-auto-height" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingTop: '2rem', paddingBottom: '2rem' }}>
          <div className="rounded-2xl overflow-hidden relative" style={{ height: 'clamp(280px, 50vw, 600px)' }}>
            <img
              src="/rock.png"
              alt=""
              className="absolute inset-0 w-full h-full object-cover rounded-2xl"
              style={{ opacity: 1 }}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
