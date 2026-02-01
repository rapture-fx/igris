import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'

export default function Manifesto() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <>
      <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
        <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="relative px-4 md:px-8 lg:px-12 flex flex-col justify-center bg-[#f6f6f4] dark:bg-[#1b1912] border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5" style={{
            minHeight: '400px'
          }}>
            {/* grd.png - background (light mode only) */}
            <div className="absolute inset-0 pointer-events-none" style={{
              backgroundImage: mounted && theme === 'dark' ? 'none' : 'url(/grd.png)',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              opacity: 0.5
            }}></div>

            <div className="w-full flex flex-row items-center justify-between relative z-10">
              <div className="max-w-3xl text-left flex flex-col">
                <h3 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                  Undefined behavior is not a strategy.
                </h3>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed mb-3 max-w-2xl">
                  Your system made a decision. Can you prove what it was?
                </p>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed mb-3 max-w-2xl">
                  Can you prove it didn't exceed memory bounds? Can you prove it ran the model version you certified?
                </p>
                <p className="text-sm md:text-base text-gray-700 dark:text-[#c8c8b8] font-inter leading-relaxed mb-6 max-w-2xl">
                  Most execution environments offer probabilistic behavior—best effort, hope for the best. Logs tell stories. Stories are not evidence. When your drone enters restricted airspace, or your production job allocates unbounded memory, you need proof. Not logs. Proof.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 pl-0 md:pl-0 lg:pl-0">
                  <Link href="https://docs.igrisinertial.com/runtime/quickstart">
                    <button
                      className="inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium font-inter"
                    >
                      Download Runtime
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
