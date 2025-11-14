'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="flex justify-between items-center">
            {/* Left side - Legal links and contact */}
            <div className="flex items-center gap-6">
              <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Terms of Service
              </Link>
              <Link href="/cookies" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Cookie Policy
              </Link>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                support@schlep-engine-com
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                © 2024 Schlep-engine.
              </p>
            </div>

            {/* Right side - Logo */}
            <div className="flex items-center">
              <Image
                src="/schlep-logo-34.png"
                alt="Schlep-engine"
                width={20}
                height={20}
              />
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}