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
              href="https://docs.igrisinertial.com/"
              className="group inline-flex items-center justify-center px-3 py-1.5 md:px-6 md:py-3 hover:opacity-80 transition-all duration-200 text-xs md:text-sm font-medium shadow-sm rounded-md border shrink-0 ml-3 md:ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? '#1b1912' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: 'rgba(20, 18, 10, 0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{ borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)', borderRight: '0.5px solid rgba(209, 213, 219, 0.35)', paddingBottom: 0 }}>
          <div style={{ paddingTop: '3rem', paddingBottom: '3rem', position: 'relative' }}>
            <div className="hidden sm:block" style={{ position: 'absolute', top: '3rem', right: 0, bottom: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ 
                width: '600px', 
                height: '100%', 
                borderRadius: '12px', 
                border: '1px solid rgba(209, 213, 219, 0.35)',
                overflow: 'hidden',
                paddingRight: '1rem'
              }}>
                <img 
                  src="/prikoo.png" 
                  alt="Product"
                  style={{ 
                    width: '100%', 
                    height: '100%', 
                    objectFit: 'contain',
                    objectPosition: 'left',
                    opacity: 1
                  }} 
                />
              </div>
            </div>
            <div style={{ maxWidth: '320px', position: 'relative', zIndex: 1 }}>
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
            <div className="mt-6" style={{ maxWidth: '320px' }}>
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
          </div>
        </div>
      </div>
    </section>
  )
}
