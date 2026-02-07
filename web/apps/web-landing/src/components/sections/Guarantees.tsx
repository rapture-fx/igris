'use client'

import React from 'react'

export default function Guarantees() {
  const items = [
    {
      title: "Deterministic execution",
      description: "Same inputs. Same behavior. Or a predictable failure. Never random."
    },
    {
      title: "Operates everywhere",
      description: "Cloud. Edge. Devices. Robots. Offline environments."
    },
    {
      title: "Provable behavior",
      description: "Every action can be verified. Replayed. Audited."
    },
    {
      title: "Intelligence amplification",
      description: "Models reason freely, but within enforced bounds. This layer does not replace intelligence. It makes intelligence usable everywhere."
    }
  ]

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/10">
          <div className="py-16 md:py-24">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {items.map((item, index) => (
                <div key={index} className="border border-gray-300 dark:border-[#f6f6f4]/10 p-6">
                  <h3 className="text-lg md:text-xl font-inter mb-3 text-[#000000] dark:text-[#f6f6f4] font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-base md:text-lg text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                    {item.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
