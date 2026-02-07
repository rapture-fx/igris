'use client'

import React from 'react'

export default function HowItChangesDevelopment() {
  const withoutLines = [
    "Intelligence is impressive but unreliable."
  ]
  const withLines = [
    "Intelligence becomes infrastructure.",
    "Develop once.",
    "Run everywhere.",
    "Operate offline.",
    "Prove what happened.",
    "The glue does not let go."
  ]

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <div>
                <p className="text-sm font-inter text-[#85612c] dark:text-[#c5b0cd] mb-4" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  WITHOUT THIS LAYER
                </p>
                {withoutLines.map((line, index) => (
                  <p 
                    key={index}
                    className="text-lg md:text-xl font-inter text-gray-500 dark:text-[#a8a898] leading-relaxed"
                  >
                    {line}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-sm font-inter text-[#85612c] dark:text-[#c5b0cd] mb-4" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                  WITH THIS LAYER
                </p>
                {withLines.map((line, index) => (
                  <p 
                    key={index}
                    className={`text-lg md:text-xl font-inter leading-relaxed ${
                      line === "Intelligence becomes infrastructure."
                        ? "font-semibold text-[#000000] dark:text-[#f6f6f4]"
                        : "text-gray-600 dark:text-[#a8a898]"
                    }`}
                  >
                    {line}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
