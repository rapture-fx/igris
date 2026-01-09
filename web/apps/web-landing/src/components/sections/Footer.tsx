'use client'

import Link from 'next/link'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-16 px-4 md:px-8 lg:px-12" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
        }}>
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
            {/* Legal links and contact - stacked vertically on left */}
            <div className="flex flex-col gap-4 text-left">
              <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Cookie Policy
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                support@igrisinertial.com
              </p>
              <span className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                © 2025 Igris Inertial.
              </span>
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
                <div className="w-4 h-4 flex items-center justify-center">
                  <Link href="https://www.linkedin.com/igris-inertial/" target="_blank" rel="noopener noreferrer">
                    <img
                      src="/linkedin.png"
                      alt="LinkedIn"
                      width={14}
                      height={12}
                      style={{ width: '14px', height: '12px' }}
                      className="hover:opacity-70 transition-opacity"
                    />
                  </Link>
                </div>
              </div>
            </div>

            {/* Logo - on right top */}
            <img
              src="/footers.png"
              alt="Igris Inertial"
              width={28}
              height={28}
              style={{ width: '28px', height: '28px' }}
            />
          </div>
        </div>
      </div>
    </footer>
  )
}