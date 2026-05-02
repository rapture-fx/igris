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
      className="absolute top-1/2 -translate-y-1/2 right-3 z-10 p-1.5 rounded transition-colors"
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
              The execution layer for AI tasks.
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
          <div className="py-10 sm:py-16">
            <div className="hidden sm:flex flex-row items-center gap-10">
              <div className="flex-shrink-0">
<img 
                src={'/pkrllol.png'} 
                alt="Product"
                className="rounded-lg"
                style={{ 
                  height: 'auto',
                  maxHeight: '600px',
                  width: '100%', 
                  maxWidth: '480px',
                  objectFit: 'contain',
                  opacity: 1
                }} 
              />
              </div>
            <div className="flex flex-col justify-center">
              <div style={{ maxWidth: '320px' }}>
                <p className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Models decide. Igris executes.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Igris gives AI systems a governed path for turning model output into controlled action. Define boundaries, handle failure paths, and generate signed records of what happened during execution.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Built for teams running AI beyond simple prompts — where tasks need to be inspected, constrained, and verified across cloud, edge, and local environments.
                </p>
              </div>
              <div className="mt-6" style={{ maxWidth: '320px' }}>
                <ul className="list-disc list-inside space-y-3">
                  <li>
                    <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                      Governed runs
                    </span>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      Apply limits, permission checks, and execution boundaries before AI output becomes action.
                    </p>
                  </li>
                  <li>
                    <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                      Failure paths
                    </span>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      Keep tasks moving across cloud, edge, and local environments when part of the system fails.
                    </p>
                  </li>
                  <li>
                    <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                      Signed records
                    </span>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      Produce verifiable execution records for critical runs, decisions, and actions.
                    </p>
                  </li>
                  <li>
                    <span className="text-sm md:text-base text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                      Deploy anywhere
                    </span>
                    <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed ml-4" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                      Run the same execution model across servers, devices, and edge environments.
                    </p>
                  </li>
                </ul>
                <div className="mt-6">
                  <div className="landing-surface-card relative rounded-2xl border px-3 py-2 md:px-4 md:py-2 inline-block pt-4" style={{ minWidth: '280px' }}>
                    <CopyButton />
                    <span className="font-mono text-xs md:text-sm select-all whitespace-nowrap mr-8" style={{ color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151' }}>
                      {INSTALL_CMD}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            </div>
            <div className="sm:hidden flex flex-col gap-6">
              <img
                src={'/pkrllol.png'}
                alt="Product"
                className="w-full rounded-xl"
                style={{ maxHeight: '350px', objectFit: 'contain', objectPosition: 'center', opacity: 1 }}
              />
              <div className="max-w-full">
                <p className="text-lg md:text-xl lg:text-2xl mb-2 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Models decide. Igris executes.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Igris gives AI systems a governed path for turning model output into controlled action. Define boundaries, handle failure paths, and generate signed records of what happened during execution.
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Built for teams running AI beyond simple prompts — where tasks need to be inspected, constrained, and verified across cloud, edge, and local environments.
                </p>
              </div>
              <div className="mt-4 max-w-full md:max-w-[320px]">
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Governed runs
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Apply limits, permission checks, and execution boundaries before AI output becomes action.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Failure paths
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Keep tasks moving across cloud, edge, and local environments when part of the system fails.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Signed records
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Produce verifiable execution records for critical runs, decisions, and actions.
                </p>
                <p className="text-sm md:text-base mb-3 text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', fontWeight: 400 }}>
                  Deploy anywhere
                </p>
                <p className="text-xs md:text-sm text-gray-600 dark:text-[#a8a898] leading-relaxed mb-3" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                  Run the same execution model across servers, devices, and edge environments.
                </p>
                <div className="mt-6">
                  <div className="landing-surface-card relative rounded-2xl border px-3 py-2 md:px-4 md:py-2 inline-block pt-4" style={{ minWidth: '280px' }}>
                    <CopyButton />
                    <span className="font-mono text-xs md:text-sm select-all whitespace-nowrap mr-8" style={{ color: mounted && theme === 'dark' ? '#c8c8b8' : '#374151' }}>
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
