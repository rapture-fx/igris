import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function ClosingPosition() {
  return (
    <section className="bg-white dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: 'var(--section-border)' }} />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12 bg-white dark:bg-[#110f0f]" style={{
          borderLeft: 'var(--section-border)',
          borderRight: 'var(--section-border)'
        }}>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 py-6 md:py-8">
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'Inter, sans-serif' }}>
              Run AI across edge and cloud.
              <br />
              With execution you can verify.
            </h3>
            <Link href="https://console.igrisinertial.com/auth?mode=signup">
              <button
                className="inline-flex items-center justify-center px-3 py-1.5 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-xl shrink-0 md:ml-4 bg-[#1b1912] text-[#f6f6f4] dark:bg-[#f6f6f4] dark:text-[#1b1912]"
                style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}
              >
                Get Started
                <ChevronRight className="ml-1 h-4 w-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: 'var(--section-border)' }} />
    </section>
  )
}
