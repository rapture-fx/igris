'use client'

import Link from 'next/link'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function Footer() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12 border-l border-r border-b section-border text-gray-900 dark:text-[#f6f6f4]" style={{ backgroundColor: '#14120a' }}>
          {/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Legal links - stacked vertically on left */}
              <div className="flex flex-col gap-2 text-left">
                <span className="text-xs text-gray-900 dark:text-[#f6f6f4] font-medium mb-1">
                  Company
                </span>
                <Link href="/terms" className="text-xs text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-xs text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/cookies" className="text-xs text-gray-600 dark:text-[#a8a898] hover:text-gray-900 dark:hover:text-[#f6f6f4] transition-colors">
                  Cookie Policy
                </Link>
                {/* Social Media Icons */}
                <div className="flex gap-3 mt-2">
                  <Link href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer">
                    <img
                      src={mounted && theme === 'dark' ? '/dmx.png' : '/x.png'}
                      alt="X (Twitter)"
                      width={12}
                      height={12}
                      style={{ width: '12px', height: '12px' }}
                      className="hover:opacity-70 transition-opacity"
                    />
                  </Link>
                  <Link href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer">
                    <img
                      src={mounted && theme === 'dark' ? '/lkd.png' : '/linkedin.png'}
                      alt="LinkedIn"
                      width={12}
                      height={12}
                      style={{ width: '12px', height: '12px' }}
                      className="hover:opacity-70 transition-opacity"
                    />
                  </Link>
                </div>
              </div>

              {/* Logo - on right top for desktop, centered for mobile */}
              <div className="flex justify-start md:justify-end">
                <img
                  src={mounted && theme === 'dark' ? '/dmfoot.png' : '/foot.png'}
                  alt="Igris Inertial"
                  className="h-6 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-start">
            <span className="text-xs text-gray-500 dark:text-[#a8a898]">
              © 2026 Igris Inertial.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
