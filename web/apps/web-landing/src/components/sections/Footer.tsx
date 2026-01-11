'use client'

import Link from 'next/link'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white transition-all duration-200" style={{ backgroundColor: '#f6f6f4', fontFamily: 'Roboto Mono, monospace' }}>
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
              <Link href="/terms" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                Privacy Policy
              </Link>
              <Link href="/cookies" className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                Cookie Policy
              </Link>
              <p className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Roboto Mono, monospace' }}>
                support@igrisinertial.com
              </p>
              <span className="text-xs text-gray-500 dark:text-gray-400" style={{ fontFamily: 'Roboto Mono, monospace' }}>
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
                <Link href="https://www.linkedin.com/igris-inertial/" target="_blank" rel="noopener noreferrer">
                  <img
                    src="/linkedin.png"
                    alt="LinkedIn"
                    width={15}
                    height={12}
                    style={{ width: '15px', height: '12px' }}
                    className="hover:opacity-70 transition-opacity"
                  />
                </Link>
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