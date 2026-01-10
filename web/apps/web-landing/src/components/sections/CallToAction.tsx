'use client';

import Link from 'next/link';
import { useModal } from '../../contexts/ModalContext';

export default function CallToAction() {
  const { openEarlyAccessModal } = useModal();

  return (
    <section className="dark:bg-gray-900 text-gray-900 dark:text-white" style={{ backgroundColor: '#f6f6f4', borderBottom: '0.5px solid rgba(156, 163, 175, 0.3)' }}>
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
              <h2 className="text-2xl md:text-2xl lg:text-3xl tracking-tight mb-4 md:mb-6 font-inter" style={{ color: '#000000' }}>Start Your 14-Day Trial</h2>
              <p className="text-sm md:text-base text-gray-600 font-inter mb-6 md:mb-8 max-w-2xl mx-auto">
                Full feature access. Hard usage caps. No production guarantees. No credit card required.
              </p>

              <div className="inline-block">
                <button
                  onClick={openEarlyAccessModal}
                  className="inline-flex items-center justify-center text-white px-4 py-2 md:px-6 md:py-3 rounded-md md:rounded-xl hover:opacity-90 transition-all duration-200 text-xs md:text-base shadow-sm md:shadow-md hover:shadow-lg font-inter"
                  style={{ backgroundColor: '#000000', minHeight: '36px' }}
                >
                  Start 14-day trial
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
