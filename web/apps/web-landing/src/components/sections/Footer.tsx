'use client'

import Link from 'next/link'
import Image from 'next/image'

export default function Footer() {

  return (
    <footer className="dark:bg-gray-900 text-gray-900 dark:text-white font-inter" style={{ backgroundColor: '#f7f7f3' }}>
      <div className="mx-auto max-w-[1400px] px-4 sm:px-6 lg:px-8">
        <div className="py-16">
          <div className="grid grid-cols-1 gap-8">
            {/* Brand Column */}
            <div className="flex justify-center">
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-center mt-8 mb-12">
                  <Image
                    src="/Docs Schlep-engne.svg"
                    alt="Schlep-engine"
                    width={30}
                    height={30}
                  />
                </div>
                {/* Copyright */}
                <p className="text-sm text-gray-500 dark:text-gray-400 font-inter">
                  © 2024 Schlep-engine.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}