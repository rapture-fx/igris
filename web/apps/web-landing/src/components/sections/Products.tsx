import React, { useEffect, useState } from 'react'
import Image from 'next/image'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useProductPopup } from '../../contexts/ProductPopupContext'

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const { openOverture, openRuntime } = useProductPopup()

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
        <div className="relative px-4 md:px-8 lg:px-12 flex flex-col bg-[#f6f6f4] dark:bg-[#1b1912] border-t border-l border-r border-b border-gray-300 dark:border-[#f6f6f4]/5 min-h-[800px] md:h-[850px]">

          {/* Title Section - Shows first on mobile, last on desktop */}
          <div className="mb-6 md:mb-0 md:hidden text-left" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
              01. PRODUCT
            </p>
            <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
              16 megabytes. Absolute certainty.
            </h2>
            <p className="text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed mb-8">
              Deploy to any hardware—ARM, x86, embedded. Load a GGUF model. Set hard limits: max tokens, max memory, max execution time. Every output cryptographically signed. Run one device or ten thousand.
            </p>

            {/* Product Narrative - Mobile */}
            <div className="space-y-8 text-left">
              {/* Single unified product story */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6">
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1.5rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/r.png"
                    alt="Runtime AI Execution"
                    fill
                    style={{ objectFit: 'cover', opacity: 0.6 }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  16MB static binary. GGUF model support (Llama, Phi, Mistral, Qwen). OS-level resource enforcement. Ed25519 cryptographic signing. Offline-first, sync-capable. ROS2 compatible.
                </p>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  Deploy to Pi, industrial controller, or rack-mounted server. Set memory caps. Define execution timeouts. Every inference executes within bounds or fails predictably. The view unlocks when you scale.
                </p>
                <button
                  onClick={openRuntime}
                  className="group inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  <span className="font-inter">
                    Explore Runtime
                  </span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>

              {/* Fleet view emerges when you scale */}
              <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 bg-gray-50 dark:bg-[#1b1912]/50">
                <h3 className="text-base font-inter mb-3 text-[#000000] dark:text-[#f6f6f4]">
                  The view unlocks when you scale
                </h3>
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                  <Image
                    src="/rtnm.png"
                    alt="Fleet Dashboard"
                    fill
                    style={{ objectFit: 'cover', opacity: 0.6 }}
                  />
                </div>
                <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                  Monitor device status. Deploy model updates. Manage configurations from a single dashboard. The fleet view is included—not as a separate product, but as the natural evolution of running more than one thing.
                </p>
                <button
                  onClick={openOverture}
                  className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                >
                  <span className="font-inter">
                    View Fleet Capabilities
                  </span>
                  <ChevronRight className="ml-1 h-3 w-3" />
                </button>
              </div>
            </div>
          </div>

          {/* Split Layout: Left Products (wider), Right Title (narrower) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-0 flex-1">

            {/* Left Column: Single product narrative - 2 columns wide (Desktop only) */}
            <div className="hidden md:flex md:col-span-2 flex-col items-start justify-start" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingRight: '2rem' }}>
              <div className="w-full space-y-8">

                {/* Runtime - The complete solution */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6">
                  <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1.5rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <img
                      src="/r.png"
                      alt="Runtime AI Execution"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        opacity: 0.6
                      }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    16MB static binary. GGUF model support (Llama, Phi, Mistral, Qwen). OS-level resource enforcement. Ed25519 cryptographic signing. Offline-first, sync-capable. ROS2 compatible.
                  </p>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    Deploy to Pi, industrial controller, or rack-mounted server. Set memory caps. Define execution timeouts. Every inference executes within bounds or fails predictably. The view unlocks when you scale.
                  </p>
                  <button
                    onClick={openRuntime}
                    className="group inline-flex items-center justify-center bg-black text-white dark:bg-[#f6f6f4] dark:text-black px-4 py-2 hover:bg-gray-800 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    <span className="font-inter">
                      Explore Runtime
                    </span>
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

                {/* Fleet View - The horizon that appears */}
                <div className="border border-gray-300 dark:border-[#f6f6f4]/5 p-6 mb-12 bg-gray-50 dark:bg-[#1b1912]/50">
                  <h3 className="text-base font-inter mb-3 text-[#000000] dark:text-[#f6f6f4]">
                    The view unlocks when you scale
                  </h3>
                  <div className="border border-gray-300 dark:border-[#f6f6f4]/5" style={{ marginTop: '0', marginBottom: '1rem', height: '200px', position: 'relative', overflow: 'hidden' }}>
                    <Image
                      src="/rtnm.png"
                      alt="Fleet Dashboard"
                      fill
                      style={{ objectFit: 'cover', opacity: 0.6 }}
                    />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed font-inter mb-4">
                    Monitor device status. Deploy model updates. Manage configurations from a single dashboard. The fleet view is included—not as a separate product, but as the natural evolution of running more than one thing.
                  </p>
                  <button
                    onClick={openOverture}
                    className="group inline-flex items-center justify-center bg-gray-200 dark:bg-[#f6f6f4] text-gray-900 dark:text-black px-4 py-2 hover:bg-gray-300 dark:hover:bg-gray-200 transition-all duration-200 text-xs font-medium shadow-md hover:shadow-lg"
                  >
                    <span className="font-inter">
                      View Fleet Capabilities
                    </span>
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </button>
                </div>

              </div>
            </div>

            {/* Right Column: Title and Description (Desktop only) */}
            <div className="hidden md:flex md:col-span-1 md:border-l flex-col justify-start dark:border-[#f6f6f4]/5" style={{ paddingTop: '3rem', paddingBottom: '3rem', paddingLeft: '1rem' }}>
              <p className="text-base text-[#c5b0cd] mb-2" style={{ fontFamily: 'Roboto Mono, monospace', letterSpacing: '0.05em' }}>
                01. PRODUCT
              </p>
              <h2 className="text-lg md:text-xl lg:text-2xl font-inter mb-4 text-[#000000] dark:text-[#f6f6f4]">
                16 megabytes. Absolute certainty.
              </h2>
              <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] font-inter leading-relaxed">
                Bounded execution. Cryptographic proof. Offline operation. One binary. Signed decisions across your entire fleet.
              </p>
            </div>

          </div>

        </div>
      </div>
    </section>
  )
}
