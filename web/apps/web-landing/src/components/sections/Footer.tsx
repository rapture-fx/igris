'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

export default function Footer() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-gray-900 dark:text-[#f6f6f4]" style={{ backgroundColor: 'transparent' }}>
{/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Left side - Company + Features + Resources + Social */}
              <div className="grid grid-cols-2 gap-6 md:flex md:gap-12">
                {/* Product */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Product
                  </span>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Verifiable Execution
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Governed AI Tasks
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Failure Recovery
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Signed Receipts
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Local Execution
                  </Link>
                </div>

                {/* Developers */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Developers
                  </span>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Quickstart
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    SDKs
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    API Reference
                  </Link>
                  <Link href="/core" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Demo
                  </Link>
                  <a href="https://docs.igrisinertial.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Docs
                  </a>
                </div>

                {/* Use Cases */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Use Cases
                  </span>
                  <Link href="/use-cases" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    AI Agents
                  </Link>
                  <Link href="/use-cases" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Internal Automation
                  </Link>
                  <Link href="/use-cases" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Edge AI
                  </Link>
                  <Link href="/use-cases" prefetch={false} className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Robotics Research
                  </Link>
                </div>

                {/* Company links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Company
                  </span>
                  <Link href="/pricing" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Pricing
                  </Link>
                  <Link href="/blog" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Blog
                  </Link>
                  <a href="mailto:support@igrisinertial.com" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Contact
                  </a>
                </div>

                {/* Social links */}
                <div className="flex flex-col gap-2 text-left">
                  <span className="text-sm text-[#000000] dark:text-[#f6f6f4] font-medium mb-1" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Social
                  </span>
                  <a href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    GitHub
                  </a>
                  <a href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    X (Twitter)
                  </a>
                  <a href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    LinkedIn
                  </a>
                  <a href="https://discord.com" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
                    Discord
                  </a>
                </div>
              </div>

              {/* Logo - on right top for desktop, centered for mobile */}
              <div className="flex justify-start md:justify-end">
                <img
                  src={mounted && theme === 'dark' ? '/inertiadm.png' : '/inertia.png'}
                  alt="Igris Inertial"
                  className="h-9 w-auto rounded-lg"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-[#a8a898]" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
              © 2026 Igris Inertial.
            </span>
            {mounted && (
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                aria-label="Toggle dark mode"
                className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 dark:text-[#a8a898] hover:text-gray-700 dark:hover:text-[#f6f6f4] hover:bg-black/[0.05] dark:hover:bg-white/[0.07] transition-colors duration-200"
              >
                {theme === 'dark' ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5" />
                    <line x1="12" y1="1" x2="12" y2="3" />
                    <line x1="12" y1="21" x2="12" y2="23" />
                    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                    <line x1="1" y1="12" x2="3" y2="12" />
                    <line x1="21" y1="12" x2="23" y2="12" />
                    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </footer>
  )
}
