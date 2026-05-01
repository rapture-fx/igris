'use client'

import React from 'react'

export default function WhyItExists() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 mobile-auto-height" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', paddingTop: '2rem', paddingBottom: '2rem' }}>
          <div className="flex flex-col gap-8">
            <div>
              <div className="rounded-lg overflow-hidden relative p-4" style={{ height: 'clamp(280px, 40vw, 500px)' }}>
                <img
                  src="/rockz.png"
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover rounded-lg"
                  style={{ opacity: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
