import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)' }}>
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '2rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              The execution layer beneath intelligence.
            </h2>
            <Link
              href="/runtime"
              className="group inline-flex items-center justify-center px-4 py-2 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-sm font-medium shadow-sm rounded-md border shrink-0 ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingBottom: 0 }}>
          <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)', width: '100vw', marginLeft: '50%', transform: 'translateX(-50%)' }} />

          <div style={{ paddingTop: '3rem', paddingBottom: '12rem', position: 'relative' }}>
            <div style={{ maxWidth: '360px' }}>
              <p className="text-base md:text-lg mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                Hybrid behavior trees meet LLM reasoning.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Where AI models meet real-world execution. Your systems need more than raw intelligence. They need execution that survives failure and proves every decision.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                The Nervous System governs how language model reasoning becomes action. Structured paths keep behavior bounded. Hard limits prevent runaway processes. Cryptographic signatures prove what happened.
              </p>
            </div>
            <div className="mt-6" style={{ maxWidth: '360px' }}>
              <p className="text-base md:text-lg mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                One system, everywhere
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                One binary runs on servers, robots, and edge devices. Same guarantees anywhere.
              </p>
              <p className="text-sm md:text-base text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                Observe decisions in real time. Inspect actions. Verify outcomes. Trust what happened.
              </p>
            </div>
            <div className="absolute right-0 top-0 flex items-start justify-center pr-[10%]" style={{ width: '50%', paddingTop: '3rem', pointerEvents: 'none' }}>
              <img 
                src="/spm.png" 
                alt="" 
                style={{ 
                  width: '110%', 
                  height: 'auto', 
                  objectFit: 'contain',
                  opacity: 1,
                }} 
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
