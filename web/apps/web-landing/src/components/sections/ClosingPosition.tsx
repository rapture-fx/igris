import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

export default function ClosingPosition() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
            <div className="relative px-4 md:px-8 lg:px-12 flex flex-col justify-center bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r section-border" style={{
              minHeight: '500px'
            }}>
            {/* clo.png - background */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: mounted && theme === 'dark' ? 'none' : 'url(/clo.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}></div>

            <div className="w-full flex flex-row items-center justify-between relative z-10" style={{ minHeight: '500px' }}>
              <div className="max-w-3xl text-left flex flex-col">
                <h3 className="text-lg md:text-xl lg:text-2xl mb-6 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}>
                  One platform. Four layers.<br />Complete control from edge to cloud.
                </h3>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                    <button
                      className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium"
                      style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 400 }}
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
