import React from 'react'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default function ClosingPosition() {
  return (
    <section className="bg-[#f6f6f4] dark:bg-dark-bg text-gray-900 dark:text-[#f6f6f4] transition-colors duration-200">
      {/* Full-width top border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />

      <div className="mx-auto max-w-[1100px] px-4 sm:px-6 lg:px-8">
        <div className="px-4 md:px-8 lg:px-12 bg-[#f6f6f4] dark:bg-[#1b1912]" style={{
          borderLeft: '0.5px solid rgba(209, 213, 219, 0.35)',
          borderRight: '0.5px solid rgba(209, 213, 219, 0.35)'
        }}>
          <div className="flex items-center justify-between" style={{ paddingTop: '3rem', paddingBottom: '3rem' }}>
            <h3 className="text-xl md:text-2xl lg:text-3xl text-[#000000] dark:text-[#f6f6f4]" style={{ fontFamily: 'var(--font-geist-pixel-square)' }}>
              Complete control from edge to cloud.
            </h3>
            <Link href="https://docs.igrisinertial.com/runtime/quickstart">
              <button
                className="inline-flex items-center justify-center px-6 py-3 hover:opacity-80 transition-all duration-200 text-xs font-medium shadow-sm rounded-md shrink-0 ml-4"
                style={{ backgroundColor: '#1b1912', color: '#f6f6f4' }}
              >
                Get Started
                <ChevronRight className="ml-1 h-3 w-3" />
              </button>
            </Link>
          </div>
        </div>
      </div>

      {/* Full-width bottom border */}
      <div style={{ borderTop: '0.5px solid rgba(209, 213, 219, 0.35)' }} />
    </section>
  )
}
