'use client'

import Link from 'next/link'

export default function Footer() {

  return (
     <footer className="dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-200" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          {/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Legal links - stacked vertically on left */}
              <div className="flex flex-col gap-2 text-left">
                <span className="text-xs text-gray-900 dark:text-white font-medium mb-1">
                  Company
                </span>
                <Link href="/terms" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Privacy Policy
                </Link>
                <Link href="/cookies" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                  Cookie Policy
                </Link>
                {/* Social Media Icons */}
                <div className="flex gap-3 mt-2">
                  <Link href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer">
                    <img
                      src="/x.png"
                      alt="X (Twitter)"
                      width={12}
                      height={12}
                      style={{ width: '12px', height: '12px' }}
                      className="hover:opacity-70 transition-opacity"
                    />
                  </Link>
                  <Link href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer">
                    <img
                      src="/linkedin.png"
                      alt="LinkedIn"
                      width={12}
                      height={12}
                      style={{ width: '12px', height: '12px' }}
                      className="hover:opacity-70 transition-opacity"
                    />
                  </Link>
                </div>
              </div>

              {/* Logo - on right top */}
              <img
                 src="/foot.png"
                 alt="Igris Inertial"
                 style={{ height: '16px', width: 'auto' }}
               />
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              © 2026 Igris Inertial.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
