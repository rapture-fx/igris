'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-8 md:py-16">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6">
            {/* Left side - Legal links and contact */}
            <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
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
            </div>

            {/* Right side - Logo */}
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Image
                  src="/schlep-logo-34.png"
                  alt="Igris Inertial"
                  width={20}
                  height={20}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}