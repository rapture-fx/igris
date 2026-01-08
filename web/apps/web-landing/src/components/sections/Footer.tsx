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
          <div className="flex flex-col items-center gap-6">
            {/* Legal links and contact - centered */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 text-center">
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
            </div>

            {/* Logo and copyright - centered together */}
            <div className="flex items-center gap-2">
              <img
                src="/footers.png"
                alt="Igris Inertial"
                width={28}
                height={28}
                style={{ width: '28px', height: '28px' }}
              />
              <span className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                © 2025 Igris Inertial.
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}