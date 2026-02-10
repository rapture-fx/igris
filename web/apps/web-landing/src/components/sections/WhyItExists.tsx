'use client'

import React from 'react'

export default function WhyItExists() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 mobile-auto-height" style={{ minHeight: '600px', borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', borderBottom: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          <img
            src="/rock.png"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ opacity: 1 }}
          />
        </div>
      </div>
    </section>
  )
}
