'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

export default function Footer() {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
     <footer className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-all duration-200">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-8">
          <div className="px-4 md:px-8 lg:px-12 text-[#f6f6f4]" style={{ backgroundColor: '#14120a', borderLeft: '0.5px solid #d1d5db', borderRight: '0.5px solid #d1d5db', borderBottom: '0.5px solid #d1d5db' }}>
          {/* Main footer content */}
          <div className="py-8 md:py-16">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
              {/* Legal links - stacked vertically on left */}
              <div className="flex flex-col gap-2 text-left">
                <span className="text-xs text-[#f6f6f4] font-medium mb-1">
                  Company
                </span>
                <Link href="/terms" className="text-xs text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Terms of Service
                </Link>
                <Link href="/privacy" className="text-xs text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Privacy Policy
                </Link>
                <Link href="/cookies" className="text-xs text-[#a8a898] hover:text-[#f6f6f4] transition-colors" style={{ fontFamily: 'var(--font-geist-sans)' }}>
                  Cookie Policy
                </Link>
                 {/* Social Media Icons */}
                 <div className="flex gap-3 mt-2 items-center">
                   <Link href="https://x.com/igrisinertial" target="_blank" rel="noopener noreferrer">
                     <img
                       src="/dmx.png"
                       alt="X (Twitter)"
                       width={12}
                       height={12}
                       style={{ width: '12px', height: '12px' }}
                       className="hover:opacity-70 transition-opacity"
                     />
                   </Link>
                   <Link href="https://discord.com" target="_blank" rel="noopener noreferrer">
                     <img
                       src="/dsc.png"
                       alt="Discord"
                       className="h-[14px] w-auto hover:opacity-70 transition-opacity"
                     />
                   </Link>
                   <Link href="https://github.com/igrisinertial" target="_blank" rel="noopener noreferrer">
                     <img
                       src="/gh.png"
                       alt="GitHub"
                       width={12}
                       height={12}
                       style={{ width: '12px', height: '12px' }}
                       className="hover:opacity-70 transition-opacity"
                     />
                   </Link>
                   <Link href="https://www.linkedin.com/company/igrisinertial" target="_blank" rel="noopener noreferrer">
                     <img
                       src="/lkd.png"
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
                  src="/dmfoot.png"
                  alt="Igris Inertial"
                  className="h-6 w-auto"
                />
              </div>
            </div>
          </div>

          {/* Copyright at very bottom */}
          <div style={{ marginTop: '4rem' }} className="pb-6 flex items-center justify-between">
            <span className="text-xs text-[#a8a898]" style={{ fontFamily: 'var(--font-geist-sans)' }}>
              © 2026 Igris Inertial.
            </span>
          </div>
        </div>
      </div>
    </footer>
  )
}
