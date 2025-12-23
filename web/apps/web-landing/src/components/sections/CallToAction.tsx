'use client';

import Link from 'next/link';

export default function CallToAction() {
  return (
    <div className="py-2 dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      {/* First Frame - CTA Content */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-left py-16 pt-16 md:py-24 md:pt-24 lg:py-40 lg:pt-32 px-4 md:px-8 lg:px-12 relative min-h-[800px] flex flex-col justify-center" style={{
          borderTop: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)'
        }}>
          {/* Background image with opacity */}
          <div 
            className="absolute inset-0 rounded-none"
            style={{
              backgroundImage: 'url("/seven.png")',
              backgroundSize: 'contain',
              backgroundPosition: 'bottom',
              backgroundRepeat: 'no-repeat',
              opacity: 0.18
            }}
          />
          {/* Top left bleeding cross */}
          <div className="absolute -top-4 -left-4 w-8 h-8">
            <div className="absolute top-3.5 left-0 w-8" style={{ borderTop: '0.5px solid #1a1e21' }}></div>
            <div className="absolute top-0 left-3.5 h-8" style={{ borderLeft: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Bottom right bleeding cross */}
          <div className="absolute -bottom-4 -right-4 w-8 h-8">
            <div className="absolute bottom-3.5 right-0 w-8" style={{ borderBottom: '0.5px solid #1a1e21' }}></div>
            <div className="absolute bottom-0 right-3.5 h-8" style={{ borderRight: '0.5px solid #1a1e21' }}></div>
          </div>
          {/* Content Container with Original Width */}
          <div className="max-w-[1300px] mx-auto w-full">
            <div className="text-center">
              <h2 className="text-2xl md:text-4xl lg:text-5xl tracking-tight mb-6 md:mb-8 font-inter" style={{ color: '#000000' }}>Choose your deployment</h2>

              <div className="inline-block">
                <Link
                  href="/overture"
                  className="inline-flex items-center justify-center text-white px-3 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl hover:opacity-90 transition-all duration-200 text-xs md:text-base shadow-sm md:shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#000000', minHeight: '36px' }}
                >
                  Get Started
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
