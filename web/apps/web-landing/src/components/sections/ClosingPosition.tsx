import React from 'react'
import Link from 'next/link'

export default function ClosingPosition() {
  return (
    <>
      <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
            <div className="relative px-4 md:px-8 lg:px-12 flex flex-col justify-center bg-[#f6f6f4] dark:bg-[#1b1912]" style={{
              minHeight: '500px',
              borderLeft: '0.5px solid #d1d5db',
              borderRight: '0.5px solid #d1d5db'
            }}>

            <div className="w-full flex flex-row items-center justify-between relative z-10" style={{ minHeight: '500px' }}>
              <div className="max-w-3xl text-left flex flex-col">
                <h3 className="text-xl md:text-2xl lg:text-3xl mb-6 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
                  One platform. Four layers.<br />Complete control from edge to cloud.
                </h3>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                    <button
                      className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md"
                    >
                      Get Started
                    </button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
