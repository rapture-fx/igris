'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 md:gap-12">
            {/* Company */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Company
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/about" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="/blog" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="/contact" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>

            {/* Product */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Product
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/features" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Features
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link href="/integrations" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Integrations
                  </Link>
                </li>
              </ul>
            </div>

            {/* Resources */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Resources
              </h3>
              <ul className="space-y-3">
                <li>
                  <a
                    href="https://docs.schlep-engine.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Documentation
                  </a>
                </li>
                <li>
                  <Link href="/guides" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Guides
                  </Link>
                </li>
                <li>
                  <Link href="/support" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Support
                  </Link>
                </li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                Legal
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link href="/privacy" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link href="/terms" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link href="/cookies" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                    Cookie Policy
                  </Link>
                </li>
              </ul>
            </div>

            {/* Logo */}
            <div className="flex flex-col items-start md:items-end">
              <div className="flex items-center">
                <Image
                  src="/Schlep Engine 14x11cm (34).png"
                  alt="Schlep-engine"
                  width={20}
                  height={20}
                />
              </div>
            </div>
          </div>

          {/* Copyright */}
          <div className="mt-12">
            <p className="text-sm text-gray-500 dark:text-gray-400 font-inter">
              © 2024 Schlep-engine.
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}