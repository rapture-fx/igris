import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'
import { useTheme } from 'next-themes'

const INSTALL_CMD = 'curl -fsSL https://igrisinertial.com/install | bash'

function CopyButton() {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    navigator.clipboard.writeText(INSTALL_CMD)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className="absolute top-3 right-3 z-10 p-1.5 rounded transition-colors"
      title={copied ? 'Copied' : 'Copy'}
    >
      {copied ? (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-gray-500">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      )}
    </button>
  )
}

export default function Products() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-3 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)' }}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3" style={{ paddingTop: '1.5rem', paddingBottom: '1.5rem' }}>
            <h2 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              The execution layer<br className="hidden md:inline" /> beneath intelligence.
            </h2>
            <Link
              href="https://docs.igrisinertial.com/"
              className="group inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md border shrink-0 md:ml-4"
              style={{ backgroundColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.08)' : '#f9f9fa', color: mounted && theme === 'dark' ? '#f6f6f4' : '#1b1912', borderColor: mounted && theme === 'dark' ? 'rgba(246,246,244,0.12)' : 'rgba(20,18,10,0.1)', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
            >
              Explore Platform
              <ChevronRight className="ml-1 h-3 w-3 md:h-4 md:w-4" />
            </Link>
          </div>
        </div>
      </div>

      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-3 md:px-8 lg:px-12" style={{ borderLeft: 'var(--section-border)', borderRight: 'var(--section-border)', paddingBottom: 0 }}>
          <div style={{ position: 'relative' }} className="py-10 sm:py-60">
            <div className="hidden sm:flex items-center justify-end" style={{ position: 'absolute', top: 0, left: 0, bottom: 0, right: '50%' }}>
              <img 
                src={mounted && theme === 'dark' ? '/sfat.png' : '/salt.png'} 
                alt="Product"
                style={{ 
                  maxWidth: '350px',
                  width: '100%',
                  height: 'auto', 
                  objectFit: 'contain',
                  objectPosition: 'right',
                  opacity: 1
                }} 
              />
            </div>
            <div className="hidden sm:flex flex-col justify-center" style={{ position: 'relative', zIndex: 1, top: 0, bottom: 0, marginLeft: '50%', paddingLeft: '2rem' }}>
              <div style={{ maxWidth: '320px' }}>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Hybrid behavior trees meet LLM reasoning.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Where AI models meet real-world execution. Your systems need more than raw intelligence. They need execution that survives failure and proves every decision.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  The Nervous System governs how language model reasoning becomes action. Structured paths keep behavior bounded. Hard limits prevent runaway processes. Cryptographic signatures prove what happened.
                </p>
              </div>
              <div className="mt-6" style={{ maxWidth: '320px' }}>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  One system, everywhere
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  One binary runs on servers, robots, and edge devices. Same guarantees anywhere.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Observe decisions in real time. Inspect actions. Verify outcomes. Trust what happened.
                </p>
                <div className="relative mt-2">
                  <div className="landing-surface-card relative rounded-2xl border px-4 py-3 md:px-8 md:py-4 inline-block" style={{ minWidth: '280px' }}>
                    <CopyButton />
                    <span className="font-mono text-xs md:text-sm select-all whitespace-nowrap" style={{ color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151' }}>
                      {INSTALL_CMD}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="sm:hidden flex flex-col gap-6">
              <img
                src={mounted && theme === 'dark' ? '/sfat.png' : '/salt.png'}
                alt="Product"
                className="w-full rounded-xl"
                style={{ maxHeight: '260px', objectFit: 'contain', objectPosition: 'center' }}
              />
              <div className="max-w-full">
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Hybrid behavior trees meet LLM reasoning.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Where AI models meet real-world execution. Your systems need more than raw intelligence. They need execution that survives failure and proves every decision.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  The Nervous System governs how language model reasoning becomes action. Structured paths keep behavior bounded. Hard limits prevent runaway processes. Cryptographic signatures prove what happened.
                </p>
              </div>
              <div className="mt-4 max-w-full md:max-w-[320px]">
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  One system, everywhere
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  One binary runs on servers, robots, and edge devices. Same guarantees anywhere.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Observe decisions in real time. Inspect actions. Verify outcomes. Trust what happened.
                </p>
                <div className="relative mt-2">
                  <CopyButton />
                  <div className="landing-surface-card rounded-2xl border px-4 py-3 md:px-8 md:py-4 inline-block" style={{ minWidth: '280px' }}>
                    <span className="font-mono text-xs md:text-sm select-all whitespace-nowrap" style={{ color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151' }}>
                      {INSTALL_CMD}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
