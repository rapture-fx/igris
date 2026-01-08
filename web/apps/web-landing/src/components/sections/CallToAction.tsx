'use client';

import Link from 'next/link';

export default function CallToAction() {
  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4' }}>
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-left py-12 pt-12 md:py-16 md:pt-16 lg:py-24 lg:pt-24 px-4 md:px-8 lg:px-12 relative min-h-[500px] flex flex-col justify-center" style={{
          borderLeft: '0.5px solid rgba(156, 163, 175, 0.3)',
          borderRight: '0.5px solid rgba(156, 163, 175, 0.3)',
          backgroundColor: '#f6f6f4'
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
          {/* Content Container with Original Width */}
          <div className="max-w-[1100px] mx-auto w-full">
            <div className="text-center">
              <h2 className="text-2xl md:text-2xl lg:text-3xl tracking-tight mb-6 md:mb-8 font-inter" style={{ color: '#000000' }}>Get Started With Overture</h2>

              <div className="inline-block">
                <Link
                  href="/overture"
                  className="inline-flex items-center justify-center text-white px-3 py-1.5 md:px-6 md:py-3 rounded-md md:rounded-xl hover:opacity-90 transition-all duration-200 text-xs md:text-base shadow-sm md:shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#000000', minHeight: '36px' }}
                >
                  Explore Documentation
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
