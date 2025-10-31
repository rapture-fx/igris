'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="flex flex-col md:flex-row justify-between gap-12">
            {/* Left Side - Company Group and Copyright */}
            <div className="flex flex-col">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">
                  Company
                </h3>
                <ul className="space-y-3">
                  <li>
                    <Link href="/contact" className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                      Contact
                    </Link>
                  </li>
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
                </ul>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-inter mt-40">
                © 2024 Schlep-engine.
              </p>
            </div>

            {/* Right Side - Logo */}
            <div className="flex flex-col items-start md:items-end">
              <div className="flex items-center">
                <Image
                  src="/Docs Schlep-engne.svg"
                  alt="Schlep-engine"
                  width={30}
                  height={30}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}