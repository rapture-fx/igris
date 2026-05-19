'use client';

import Header from '../../src/components/sections/Header'
import Footer from '../../src/components/sections/Footer'
import Pricing from '../../src/components/sections/Pricing'
import Faq from '../../src/components/sections/Faq'
import ClosingPosition from '../../src/components/sections/ClosingPosition'
import ScrollReveal from '../../src/components/ui/ScrollReveal'

export default function PricingPage() {
  return (
    <div className="relative min-h-screen bg-white dark:bg-[#110f0f] md:pl-[40rem] pt-14 md:pt-0">
      <div className="relative z-10">
        <Header />
        <main>
          <ScrollReveal>
            <section className="pt-40 pb-6 px-4 sm:px-6 lg:px-8">
              <div className="mr-auto max-w-[1000px] text-center">
                <h1 className="text-xl md:text-3xl lg:text-4xl mb-4 text-[#000000] dark:text-[#f6f6f4] max-w-lg mx-auto" style={{ fontFamily: 'var(--font-geist-pixel-square, Geist Pixel Square, monospace)' }}>
                  Pricing
                </h1>
                
              </div>
            </section>
          </ScrollReveal>

          <ScrollReveal delay={0.1}><Pricing /></ScrollReveal>
          
          <div className="mr-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
            <div>
              <ScrollReveal delay={0.1}><Faq /></ScrollReveal>
            </div>
          </div>
          <div className="mr-auto max-w-[1000px] px-4 sm:px-6 lg:px-8">
            <div>
              <ScrollReveal delay={0.1}><ClosingPosition /></ScrollReveal>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
