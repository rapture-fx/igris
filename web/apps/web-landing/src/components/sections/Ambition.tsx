'use client'

import React from 'react'

export default function Ambition() {
  const lines = [
    "This is not a product you integrate.",
    "This is the layer AI development assumes exists.",
    "Just like:",
    "Operating systems for software",
    "Protocols for networks",
    "Runtimes for applications",
    "Every AI and every robot should run on a deterministic execution layer.",
    "This one."
  ]

  const justLike = ["Operating systems for software", "Protocols for networks", "Runtimes for applications"]

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="py-16 md:py-24">
            <div className="max-w-3xl">
              {lines.map((line, index) => {
                if (index === 2) {
                  return (
                    <div key={index} className="my-8">
                      <p className="text-lg md:text-xl font-inter text-gray-600 dark:text-[#a8a898] mb-4">
                        {line}
                      </p>
                      <div className="ml-6 space-y-2">
                        {justLike.map((item, jIndex) => (
                          <p 
                            key={jIndex}
                            className="text-base md:text-lg text-[#85612c] dark:text-[#c5b0cd] font-inter italic"
                            style={{ fontFamily: 'Roboto Mono, monospace' }}
                          >
                            {item}
                          </p>
                        ))}
                      </div>
                    </div>
                  )
                }
                return (
                  <p 
                    key={index}
                    className={`text-lg md:text-xl lg:text-2xl font-inter mb-4 leading-relaxed ${
                      line === "This is not a product you integrate." || 
                      line === "This is the layer AI development assumes exists." ||
                      line === "Every AI and every robot should run on a deterministic execution layer." ||
                      line === "This one."
                        ? "font-semibold text-[#000000] dark:text-[#f6f6f4]"
                        : "text-gray-600 dark:text-[#a8a898]"
                    }`}
                  >
                    {line}
                  </p>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
